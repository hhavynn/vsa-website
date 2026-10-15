// Fails-if-reverted proof for the RLS incident regression checks (#227).
//
// The migration chain is not replayable here (#393/#396), so reverting a
// migration is simulated instead: every check is fed (a) a fake client that
// answers like the hardened database and must PASS, and (b) a fake client that
// answers like the database BEFORE that migration (rows returned, PII columns
// resolving, recursion error, function executable) and must FAIL. The checks
// are the same functions scripts/verify-rls-security.mjs runs against production.
import {
  ANON_DENIED_MEMBER_COLUMNS,
  VIEWS_WITHOUT_USER_ID,
  checkAdminReadsUserProfiles,
  checkAnonCannotReadMemberPii,
  checkEventsHaveNoReadableCheckInCode,
  checkIsAdminUserHelper,
  checkNoRowsFromProtectedTable,
  checkOrdinaryUserRefusedBySmartMerge,
  checkPublicViewsOmitAuthUserId,
  checkRpcDeniedAtGrant,
  checkUserCannotWriteEventAttendance,
  checkUserCannotWriteUserPoints,
  checkUserProfilesNoRecursion,
  checkUserSeesOnlyOwnRows,
  classifyInsertDenied,
  classifyNoRowsUpdated,
} from '../../scripts/lib/rlsIncidentChecks.mjs';

interface Request {
  kind: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  table?: string;
  filter?: string;
  columns?: string;
  fn?: string;
  args?: unknown;
}
interface Answer {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

// Minimal PostgREST-shaped client: chainable builders that resolve to
// { data, error } from `answer(request)`. Every request is recorded.
function fakeClient(answer: (request: Request) => Answer) {
  const requests: Request[] = [];
  const resolve = (request: Request) => {
    requests.push(request);
    const { data = null, error = null } = answer(request);
    return { data, error, status: error ? 400 : 200 };
  };
  const builder = (table: string) => {
    const request: Request = { kind: 'select', table };
    let started = false;
    const api: any = {
      select(columns: string) {
        if (!started) request.kind = 'select';
        started = true;
        request.columns = columns;
        return api;
      },
      insert() { request.kind = 'insert'; started = true; return api; },
      update() { request.kind = 'update'; started = true; return api; },
      delete() { request.kind = 'delete'; started = true; return api; },
      eq() { return api; },
      or(filter: string) { request.filter = filter; return api; },
      limit() { return api; },
      maybeSingle() { return api; },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(resolve({ ...request })).then(onFulfilled, onRejected);
      },
    };
    return api;
  };
  return {
    requests,
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => Promise.resolve(resolve({ kind: 'rpc', fn, args })),
  };
}

const outcomes = (results: { outcome: string }[]) => results.map((r) => r.outcome);
const denied = { error: { code: '42501', message: 'permission denied for table x' } };
const recursion = {
  error: { code: '42P17', message: 'infinite recursion detected in policy for relation "user_profiles"' },
};
const NIL = '00000000-0000-0000-0000-000000000000';
const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('20260619050000 + 20260620000000: check-in codes are unreachable', () => {
  const check = (client: any, who = 'anon') =>
    checkNoRowsFromProtectedTable(client, { table: 'event_check_in_secrets', columns: 'event_id', who });

  it('passes when the table is denied or RLS filters it to nothing', async () => {
    expect(outcomes(await check(fakeClient(() => denied)))).toEqual(['pass']);
    expect(outcomes(await check(fakeClient(() => ({ data: [] }))))).toEqual(['pass']);
  });

  it('fails when rows come back (the pre-migration, readable shape)', async () => {
    const readable = fakeClient(() => ({ data: [{ event_id: 'e1' }] }));
    expect(outcomes(await check(readable))).toEqual(['fail']);
    expect(outcomes(await check(readable, 'ordinary user'))).toEqual(['fail']);
  });

  it('does not count an unrelated error as proof of privacy', async () => {
    expect(outcomes(await check(fakeClient(() => ({ error: { code: '08006', message: 'down' } }))))).toEqual(['fail']);
  });

  it('skips a required-absent table only when it is optional', async () => {
    const missing = fakeClient(() => ({ error: { code: 'PGRST205', message: 'not found' } }));
    expect(outcomes(await checkNoRowsFromProtectedTable(missing, { table: 't', columns: 'id', who: 'anon', optional: true }))).toEqual(['skip']);
    expect(outcomes(await check(missing))).toEqual(['fail']);
  });

  it('never puts a row value in its message', async () => {
    const [result] = await check(fakeClient(() => ({ data: [{ event_id: 'SECRET-CODE-ABC' }] })));
    expect(result.message).not.toContain('SECRET-CODE-ABC');
  });
});

describe('20260620000000: events carries no readable check_in_code column', () => {
  it('passes when the column is gone (42703) or denied (42501)', async () => {
    for (const answer of [{ error: { code: '42703', message: 'column does not exist' } }, denied]) {
      expect(outcomes(await checkEventsHaveNoReadableCheckInCode(fakeClient(() => answer), { who: 'anon' }))).toEqual(['pass']);
    }
  });

  it('fails when the column resolves, even for an empty table', async () => {
    for (const answer of [{ data: [{ check_in_code: 'ABCD' }] }, { data: [] }]) {
      expect(outcomes(await checkEventsHaveNoReadableCheckInCode(fakeClient(() => answer), { who: 'ordinary user' }))).toEqual(['fail']);
    }
  });
});

describe('20260619040000: anon cannot read member PII', () => {
  it('passes when every PII column is denied', async () => {
    const results = await checkAnonCannotReadMemberPii(fakeClient(() => denied));
    expect(outcomes(results)).toEqual(ANON_DENIED_MEMBER_COLUMNS.map(() => 'pass'));
  });

  it('fails for each column that still returns rows (table-level anon SELECT)', async () => {
    const client = fakeClient((r) => ({ data: [{ [r.columns as string]: 'x' }] }));
    expect(outcomes(await checkAnonCannotReadMemberPii(client))).toEqual(ANON_DENIED_MEMBER_COLUMNS.map(() => 'fail'));
  });

  it('is not hidden by one denied column: a single still-granted column fails', async () => {
    const client = fakeClient((r) => (r.columns === 'email' ? { data: [{ email: 'x' }] } : denied));
    expect(outcomes(await checkAnonCannotReadMemberPii(client))).toEqual(['pass', 'fail', 'pass']);
  });

  it('treats an empty, error-free answer as unconfirmed, not as a pass', async () => {
    expect(outcomes(await checkAnonCannotReadMemberPii(fakeClient(() => ({ data: [] }))))).toEqual(['fail', 'fail', 'fail']);
  });
});

describe('20260619040000: public member views omit the auth user_id', () => {
  const columnGone = { error: { code: '42703', message: 'column does not exist' } };

  it('passes when user_id no longer resolves on any view', async () => {
    const results = await checkPublicViewsOmitAuthUserId(fakeClient(() => columnGone));
    expect(outcomes(results)).toEqual(VIEWS_WITHOUT_USER_ID.map(() => 'pass'));
  });

  it('fails when a view still exposes user_id (even with zero rows)', async () => {
    const results = await checkPublicViewsOmitAuthUserId(
      fakeClient((r) => (r.table === 'member_yearly_points' ? { data: [] } : columnGone)),
    );
    expect(outcomes(results)).toEqual(['fail', 'pass', 'pass', 'pass']);
  });

  it('skips a view absent from the database', async () => {
    const results = await checkPublicViewsOmitAuthUserId(fakeClient(() => ({ error: { code: 'PGRST205' } })), { views: ['v'] });
    expect(outcomes(results)).toEqual(['skip']);
  });
});

describe('20260620020000: user_profiles policies do not recurse', () => {
  it('passes for anon on any non-recursive answer, rows or denial', async () => {
    for (const answer of [{ data: [] }, denied]) {
      expect(outcomes(await checkUserProfilesNoRecursion(fakeClient(() => answer), { who: 'anon', mustRead: false }))).toEqual(['pass']);
    }
  });

  it('fails for every audience on 42P17 (the pre-fix policy)', async () => {
    const broken = fakeClient(() => recursion);
    expect(outcomes(await checkUserProfilesNoRecursion(broken, { who: 'anon', mustRead: false }))).toEqual(['fail']);
    expect(outcomes(await checkUserProfilesNoRecursion(broken, { who: 'ordinary user', mustRead: true }))).toEqual(['fail']);
    expect(outcomes(await checkUserProfilesNoRecursion(broken, { who: 'admin', mustRead: true }))).toEqual(['fail']);
  });

  it('recognises recursion by message when the code is missing', async () => {
    const byMessage = fakeClient(() => ({ error: { message: 'infinite recursion detected in policy for relation "user_profiles"' } }));
    expect(outcomes(await checkUserProfilesNoRecursion(byMessage, { who: 'anon', mustRead: false }))).toEqual(['fail']);
  });

  it('requires a signed-in caller to be able to read, not just to avoid 42P17', async () => {
    expect(outcomes(await checkUserProfilesNoRecursion(fakeClient(() => denied), { who: 'admin', mustRead: true }))).toEqual(['fail']);
    expect(outcomes(await checkUserProfilesNoRecursion(fakeClient(() => ({ data: [{ id: ME }] })), { who: 'admin', mustRead: true }))).toEqual(['pass']);
  });

  it('admin read passes with rows and fails on recursion, denial, or no rows', async () => {
    expect(outcomes(await checkAdminReadsUserProfiles(fakeClient(() => ({ data: [{ id: ME }] }))))).toEqual(['pass']);
    expect(outcomes(await checkAdminReadsUserProfiles(fakeClient(() => recursion)))).toEqual(['fail']);
    expect(outcomes(await checkAdminReadsUserProfiles(fakeClient(() => denied)))).toEqual(['fail']);
    expect(outcomes(await checkAdminReadsUserProfiles(fakeClient(() => ({ data: [] }))))).toEqual(['fail']);
  });

  it('is_admin_user() is caller-bound: false for users, true for admins, failing on recursion', async () => {
    expect(outcomes(await checkIsAdminUserHelper(fakeClient(() => ({ data: false })), { who: 'ordinary user', expected: false }))).toEqual(['pass']);
    expect(outcomes(await checkIsAdminUserHelper(fakeClient(() => ({ data: true })), { who: 'ordinary user', expected: false }))).toEqual(['fail']);
    expect(outcomes(await checkIsAdminUserHelper(fakeClient(() => ({ data: true })), { who: 'admin', expected: true }))).toEqual(['pass']);
    expect(outcomes(await checkIsAdminUserHelper(fakeClient(() => recursion), { who: 'admin', expected: true }))).toEqual(['fail']);
  });
});

describe('20260619000000 (A, E) + 20260620010000: callers see only their own rows', () => {
  const own = (table: string, ownerColumn: string) => ({ table, ownerColumn, userId: ME });

  it('asks the database for foreign-owned rows only, so a page of own rows cannot hide a leak', async () => {
    const client = fakeClient(() => ({ data: [] }));
    await checkUserSeesOnlyOwnRows(client, own('event_attendance', 'user_id'));
    expect(client.requests).toEqual([
      { kind: 'select', table: 'event_attendance', columns: 'user_id', filter: `user_id.neq.${ME},user_id.is.null` },
    ]);
  });

  it('passes when no foreign row comes back, or the table is revoked', async () => {
    expect(outcomes(await checkUserSeesOnlyOwnRows(fakeClient(() => ({ data: [] })), own('user_points', 'user_id')))).toEqual(['pass']);
    expect(outcomes(await checkUserSeesOnlyOwnRows(fakeClient(() => denied), own('event_attendance', 'user_id')))).toEqual(['pass']);
  });

  it('fails when another user\'s row is visible (the "viewable by everyone" shape)', async () => {
    const leaky = fakeClient(() => ({ data: [{ user_id: OTHER }] }));
    expect(outcomes(await checkUserSeesOnlyOwnRows(leaky, own('event_attendance', 'user_id')))).toEqual(['fail']);
    const profiles = fakeClient(() => ({ data: [{ id: OTHER }] }));
    expect(outcomes(await checkUserSeesOnlyOwnRows(profiles, own('user_profiles', 'id')))).toEqual(['fail']);
  });

  it('fails on recursion while reading user_profiles', async () => {
    expect(outcomes(await checkUserSeesOnlyOwnRows(fakeClient(() => recursion), own('user_profiles', 'id')))).toEqual(['fail']);
  });

  it('anon gets no rows from user_profiles, event_attendance or user_points', async () => {
    for (const [table, columns] of [['user_profiles', 'id'], ['event_attendance', 'id'], ['user_points', 'user_id']]) {
      const check = (client: any) => checkNoRowsFromProtectedTable(client, { table, columns, who: 'anon' });
      expect(outcomes(await check(fakeClient(() => ({ data: [] }))))).toEqual(['pass']);
      expect(outcomes(await check(fakeClient(() => denied)))).toEqual(['pass']);
      expect(outcomes(await check(fakeClient(() => ({ data: [{ id: OTHER }] }))))).toEqual(['fail']);
      expect(outcomes(await check(fakeClient(() => recursion)))).toEqual(['fail']);
    }
  });
});

describe('20260619000000 (B) + 20260620020000: privileged RPCs are not executable by the wrong role', () => {
  const grantDenied = { error: { code: '42501', message: 'permission denied for function smart_merge_members' } };

  it('anon is refused at the grant', async () => {
    const results = await checkRpcDeniedAtGrant(fakeClient(() => grantDenied), { fn: 'smart_merge_members', args: {}, who: 'anon' });
    expect(outcomes(results)).toEqual(['pass']);
  });

  it('fails when the function runs for anon, or only its own guard refuses (grant still present)', async () => {
    const executes = fakeClient(() => ({ data: true }));
    const guardOnly = fakeClient(() => ({ error: { code: 'P0001', message: 'Permission denied: admin access required for smart_merge_members' } }));
    for (const client of [executes, guardOnly]) {
      expect(outcomes(await checkRpcDeniedAtGrant(client, { fn: 'smart_merge_members', args: {}, who: 'anon' }))).toEqual(['fail']);
    }
  });

  it('a signed-in non-admin must be refused by an authorization error, not reach member lookup', async () => {
    const guarded = fakeClient(() => ({ error: { code: 'P0001', message: 'Permission denied: admin access required for smart_merge_members' } }));
    expect(outcomes(await checkOrdinaryUserRefusedBySmartMerge(guarded, { nilId: NIL }))).toEqual(['pass']);
    // Pre-guard: the body ran and failed on the nil id.
    const unguarded = fakeClient(() => ({ error: { code: 'P0001', message: `Source member not found: ${NIL}` } }));
    expect(outcomes(await checkOrdinaryUserRefusedBySmartMerge(unguarded, { nilId: NIL }))).toEqual(['fail']);
    expect(outcomes(await checkOrdinaryUserRefusedBySmartMerge(fakeClient(() => ({ data: null })), { nilId: NIL }))).toEqual(['fail']);
  });

  it('a lost EXECUTE grant is not the guard: 42501 at the grant fails', async () => {
    const grantRevoked = fakeClient(() => ({ error: { code: '42501', message: 'permission denied for function smart_merge_members' } }));
    expect(outcomes(await checkOrdinaryUserRefusedBySmartMerge(grantRevoked, { nilId: NIL }))).toEqual(['fail']);
  });

  it('only ever calls smart_merge_members with the nil id', async () => {
    const client = fakeClient(() => ({ error: { code: 'P0001', message: 'admin access required' } }));
    await checkOrdinaryUserRefusedBySmartMerge(client, { nilId: NIL });
    expect(client.requests).toEqual([{ kind: 'rpc', fn: 'smart_merge_members', args: { p_source_id: NIL, p_target_id: NIL } }]);
  });
});

describe('20260619000000 (D) + 20260620010000: ordinary users cannot write attendance or points', () => {
  it('classifies inserts: only 42501 passes, a constraint error means RLS let it through', () => {
    expect(classifyInsertDenied('ordinary user', 't', { code: '42501' }).outcome).toBe('pass');
    expect(classifyInsertDenied('ordinary user', 't', { code: '23503' }).outcome).toBe('fail');
    expect(classifyInsertDenied('ordinary user', 't', { code: '23505' }).outcome).toBe('fail');
    expect(classifyInsertDenied('ordinary user', 't', null).outcome).toBe('fail');
  });

  it('classifies updates: 42501 or zero rows pass, any returned row or other error fails', () => {
    expect(classifyNoRowsUpdated('ordinary user', 't', null, { code: '42501' }).outcome).toBe('pass');
    expect(classifyNoRowsUpdated('ordinary user', 't', [], null).outcome).toBe('pass');
    expect(classifyNoRowsUpdated('ordinary user', 't', [{ id: 1 }], null).outcome).toBe('fail');
    expect(classifyNoRowsUpdated('ordinary user', 't', null, { code: '23514' }).outcome).toBe('fail');
  });

  // The hardened database as production is today: inserts and updates are
  // refused with 42501. 20260620010000 once allowed a zero-point self insert;
  // production has no such policy now, and 20261003000000 (#510) revokes the
  // table from authenticated, so no client write passes. Own rows exist, so
  // every probe actually runs.
  const hardened = () =>
    fakeClient((r) => {
      if (r.kind === 'select') return { data: r.table === 'user_points' ? { points: 3 } : [{ id: 'a1', points_earned: 3 }] };
      return denied;
    });
  // The pre-migration database: the self-write policies exist, so the insert
  // reaches a constraint and the update touches the row.
  const reverted = () =>
    fakeClient((r) => {
      if (r.kind === 'select') return { data: r.table === 'user_points' ? { points: 3 } : [{ id: 'a1', points_earned: 3 }] };
      if (r.kind === 'insert') return { error: { code: '23505', message: 'duplicate key' } };
      return { data: [{ id: 'a1', user_id: ME }] };
    });

  it('event_attendance: passes hardened, fails reverted', async () => {
    expect(outcomes(await checkUserCannotWriteEventAttendance(hardened(), { userId: ME, nilId: NIL }))).toEqual(['pass', 'pass']);
    expect(outcomes(await checkUserCannotWriteEventAttendance(reverted(), { userId: ME, nilId: NIL }))).toEqual(['fail', 'fail']);
  });

  it('user_points: passes hardened, fails reverted', async () => {
    expect(outcomes(await checkUserCannotWriteUserPoints(hardened(), { userId: ME }))).toEqual(['pass', 'pass']);
    expect(outcomes(await checkUserCannotWriteUserPoints(reverted(), { userId: ME }))).toEqual(['fail', 'fail']);
  });

  it('skips, and never inserts, when the caller has no existing points row', async () => {
    const client = fakeClient(() => ({ data: null }));
    expect(outcomes(await checkUserCannotWriteUserPoints(client, { userId: ME }))).toEqual(['skip', 'skip']);
    expect(client.requests.some((r) => r.kind === 'insert')).toBe(false);
  });

  it('skips the attendance update probe when the caller has no attendance row', async () => {
    const client = fakeClient((r) => (r.kind === 'select' ? { data: [] } : denied));
    expect(outcomes(await checkUserCannotWriteEventAttendance(client, { userId: ME, nilId: NIL }))).toEqual(['pass', 'skip']);
  });
});

describe('read-only guarantee', () => {
  it('the read-only incident checks issue no writes', async () => {
    const client = fakeClient(() => denied);
    await checkNoRowsFromProtectedTable(client, { table: 'event_attendance', columns: 'id', who: 'anon' });
    await checkAnonCannotReadMemberPii(client);
    await checkPublicViewsOmitAuthUserId(client);
    await checkEventsHaveNoReadableCheckInCode(client, { who: 'anon' });
    await checkUserProfilesNoRecursion(client, { who: 'anon', mustRead: false });
    await checkUserSeesOnlyOwnRows(client, { table: 'user_points', ownerColumn: 'user_id', userId: ME });
    expect(client.requests.filter((r) => ['insert', 'update', 'delete'].includes(r.kind))).toEqual([]);
  });
});
