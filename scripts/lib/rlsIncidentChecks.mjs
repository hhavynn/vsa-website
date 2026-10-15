// Regression checks for the historical RLS / grant security incidents (#227),
// kept as pure functions so the logic that runs against production in
// scripts/verify-rls-security.mjs is the same logic the unit tests feed a fake
// "hardened" client and a fake "pre-migration" client
// (src/lib/rlsIncidentChecks.test.ts).
//
// Every check takes a Supabase-like client (`from(...).select(...)`, `rpc(...)`)
// and returns an array of results: { outcome: 'pass' | 'fail' | 'skip', message }.
// A check never prints, never reads process.env, and never puts a row value in a
// message, so a leak cannot land in a CI log. Each asserts the PROPERTY a
// migration established ("no rows reach anon", "the column does not resolve"),
// not the mechanism, so a different valid fix still passes.
//
// Read-only: only SELECTs and RPC calls that the database must refuse. The
// write checks at the bottom run only behind RLS_ALLOW_MUTATION_TESTS and keep
// the verifier's existing non-destructive shapes.

export const PASS = 'pass';
export const FAIL = 'fail';
export const SKIP = 'skip';

const pass = (message) => ({ outcome: PASS, message });
const fail = (message) => ({ outcome: FAIL, message });
const skip = (message) => ({ outcome: SKIP, message });

const isMissingRelation = (error) => ['PGRST205', '42P01'].includes(error?.code);
const isDenied = (error) => error?.code === '42501';
const isUndefinedColumn = (error) => error?.code === '42703';
const isRecursion = (error) =>
  error?.code === '42P17' || /infinite recursion/i.test(error?.message ?? '');
const describe = (error) => `code=${error?.code ?? 'none'}`;

// ---------------------------------------------------------------------------
// 20260619000000_emergency_security_hardening.sql, 20260619050000 and
// 20260620000000 (check-in code secrets), 20260620010000 (attendance RLS)
// ---------------------------------------------------------------------------

/**
 * Property: this audience gets no rows from a table that is private to admins or
 * to the row owner. Denial (42501) and an RLS-filtered empty result both hold.
 * Rows prove the table is exposed; a recursion error is called out separately
 * (20260620020000); any other error means the probe never reached the policy.
 *
 * Incident (#227): 20260619000000 section E dropped "Event attendance is
 * viewable by everyone" (event_attendance leaked every user UUID and points to
 * anon); 20260619050000 + 20260620000000 moved check-in codes into the
 * admin-only event_check_in_secrets; 20260620010000 hardened attendance and
 * user_points policies; 20260619000000 section A closed user_profiles.
 */
export async function checkNoRowsFromProtectedTable(client, { table, columns, who, optional = false }) {
  const { data, error } = await client.from(table).select(columns).limit(1);
  if (isMissingRelation(error)) {
    return [optional ? skip(`${who} read of ${table} (table absent from this database)`) : fail(`${who} read of ${table} failed: ${table} does not exist (${describe(error)})`)];
  }
  if (isRecursion(error)) {
    return [fail(`${who} read of ${table} hit RLS policy recursion (${describe(error)}) (#227)`)];
  }
  if (isDenied(error)) return [pass(`${who} cannot read ${table} (permission denied, #227)`)];
  if (error) {
    return [fail(`${who} read of ${table} failed for a non-authorization reason, so privacy was not verified: ${describe(error)} (#227)`)];
  }
  if (data && data.length > 0) {
    return [fail(`${who} read ${table} successfully and got ${data.length} row(s) (values omitted) (#227)`)];
  }
  return [pass(`${who} cannot read ${table} (RLS returned no rows, #227)`)];
}

/**
 * Property: a signed-in ordinary user sees only their own rows in a table whose
 * policy is "own rows (+ admin)". Any foreign owner id is a leak. Denial of the
 * whole table also holds (the retired archives are revoked outright).
 *
 * Incident (#227): 20260619000000 section E / 20260620010000 replaced
 * "viewable by everyone" with own-rows-only policies on event_attendance and
 * user_points; section A did the same for user_profiles ("Users can view all
 * profiles" exposed every email and is_admin flag).
 * Needs RLS_TEST_USER_*; the signed-in sections skip without them.
 */
export async function checkUserSeesOnlyOwnRows(client, { table, ownerColumn, userId, who = 'ordinary user' }) {
  // Ask only for rows owned by someone else (or by no one). Sampling rows and
  // filtering here could return a page of the caller's own rows and miss a leak.
  const { data, error } = await client
    .from(table)
    .select(ownerColumn)
    .or(`${ownerColumn}.neq.${userId},${ownerColumn}.is.null`)
    .limit(1);
  if (isMissingRelation(error)) return [skip(`${who} own-rows check on ${table} (table absent from this database)`)];
  if (isRecursion(error)) return [fail(`${who} read of ${table} hit RLS policy recursion (${describe(error)}) (#227)`)];
  if (isDenied(error)) return [pass(`${who} cannot read ${table} at all (permission denied, #227)`)];
  if (error) return [fail(`${who} own-rows check on ${table} failed for a non-authorization reason: ${describe(error)} (#227)`)];
  if ((data ?? []).length > 0) {
    return [fail(`${who} can read ${table} rows owned by someone else (values omitted) (#227)`)];
  }
  return [pass(`${who} sees only their own ${table} rows (#227)`)];
}

/**
 * Property: no column of public.events carries a check-in code. Selecting it
 * must fail (42703 column absent, or 42501 denied for an audience that still
 * had the column); a successful select, even of zero rows, proves the column
 * resolves and is readable.
 *
 * Incident (#227): 20260619000000 section C revoked it from anon only, so any
 * signed-in user could read live codes; 20260620000000 section D dropped the
 * column after moving codes to event_check_in_secrets.
 */
export async function checkEventsHaveNoReadableCheckInCode(client, { who }) {
  const { error } = await client.from('events').select('check_in_code').limit(1);
  if (isUndefinedColumn(error)) return [pass(`${who} cannot select events.check_in_code (column does not exist, #227)`)];
  if (isDenied(error)) return [pass(`${who} cannot select events.check_in_code (permission denied, #227)`)];
  if (!error) return [fail(`${who} can select events.check_in_code: the column resolves and is readable (#227)`)];
  return [fail(`${who} select of events.check_in_code failed for an unexpected reason: ${describe(error)} (#227)`)];
}

/**
 * Property: an RPC this role must never run is refused with a grant-level
 * 42501, before the function body runs. A function that answers (or raises its
 * own error) is executable by this role even if its in-body guard held; the
 * guard is a second layer, not the grant.
 *
 * Incident (#227): 20260619000000 section B revoked smart_merge_members from
 * PUBLIC; 20260620020000 revoked is_admin_user from PUBLIC and anon. Nil UUID
 * arguments only: even a regressed grant finds no row to touch.
 */
export async function checkRpcDeniedAtGrant(client, { fn, args, who }) {
  const { data, error } = await client.rpc(fn, args);
  if (isDenied(error)) return [pass(`${who} cannot call ${fn} (permission denied, #227)`)];
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return [skip(`${who} call of ${fn} (function absent from this database)`)];
  }
  return [fail(`${who} could execute ${fn} or got an unexpected error: ${error ? describe(error) : `returned ${typeof data}`} (#227)`)];
}

/**
 * Property: a signed-in non-admin calling smart_merge_members is refused with an
 * authorization error, not a data-access one. With nil ids a missing guard
 * surfaces as "Source member not found", which proves the body ran. Never
 * called with real ids.
 *
 * Incident (#227): 20260619000000 section B added the admin guard; before it any
 * authenticated user could merge (delete) members. Needs RLS_TEST_USER_*.
 */
export async function checkOrdinaryUserRefusedBySmartMerge(client, { nilId }) {
  const { error } = await client.rpc('smart_merge_members', { p_source_id: nilId, p_target_id: nilId });
  const message = error?.message ?? '';
  if (!error) return [fail('ordinary user ran smart_merge_members without being refused (#227)')];
  if (/not found/i.test(message)) {
    return [fail('ordinary user got past the smart_merge_members admin guard and reached member lookup (#227)')];
  }
  // The guard's own exception (20260619000000 section B). A grant-level 42501
  // ("permission denied for function") never reaches the guard, and it would
  // also break the admin merge callers, so it is not a pass.
  if (/admin access required/i.test(message)) {
    return [pass('ordinary user is refused by the smart_merge_members admin guard (#227)')];
  }
  if (isDenied(error)) {
    return [fail('authenticated has lost EXECUTE on smart_merge_members: the admin guard was not reached, and admin merges break too (#227)')];
  }
  return [fail(`ordinary user smart_merge_members call failed for an unexpected reason: ${describe(error)} (#227)`)];
}

// ---------------------------------------------------------------------------
// 20260619040000_minimize_public_member_exposure.sql
// ---------------------------------------------------------------------------

// members columns that must never reach anon. id/first_name/... stay granted.
export const ANON_DENIED_MEMBER_COLUMNS = ['user_id', 'email', 'needs_review'];

/**
 * Property: anon cannot read member PII from the raw members table. Each
 * sensitive column is probed alone, so one still-granted column cannot hide
 * behind another that is denied. Expects 42501 (or 42703 if a column goes
 * away). An empty answer without an error is a FAIL: members is not empty, so
 * it cannot tell a revoke from an unconfirmed privilege state.
 *
 * Incident (#227): 20260619040000 revoked members table SELECT from anon and
 * re-granted only the display-safe columns; before it anon could read every
 * member's email and auth user_id.
 */
export async function checkAnonCannotReadMemberPii(client) {
  const results = [];
  for (const column of ANON_DENIED_MEMBER_COLUMNS) {
    const { data, error } = await client.from('members').select(column).limit(1);
    if (isDenied(error) || isUndefinedColumn(error)) {
      results.push(pass(`anon cannot select members.${column} (${isDenied(error) ? 'access denied' : 'column absent'}, #227)`));
    } else if (error) {
      results.push(fail(`anon select members.${column} failed with unexpected ${describe(error)} (#227)`));
    } else if (data && data.length > 0) {
      results.push(fail(`anon could select members.${column} (values omitted) (#227)`));
    } else {
      results.push(fail(`anon select members.${column} succeeded without error but returned empty (unconfirmed privilege state) (#227)`));
    }
  }
  return results;
}

// Public views that had auth user ids removed by 20260619040000, plus the
// current projection that replaced direct members reads.
export const VIEWS_WITHOUT_USER_ID = [
  'member_yearly_points',
  'house_member_yearly_points',
  'house_member_all_time_points',
  'public_members',
];

/**
 * Property: no public member view exposes an auth user id. Selecting user_id
 * must fail (42703, the column is gone). A successful select proves the view
 * still carries it, even when the view is empty.
 *
 * Incident (#227): 20260619040000 recreated these views without user_id so the
 * public leaderboard could not hand out auth UUIDs.
 */
export async function checkPublicViewsOmitAuthUserId(client, { who = 'anon', views = VIEWS_WITHOUT_USER_ID } = {}) {
  const results = [];
  for (const view of views) {
    const { error } = await client.from(view).select('user_id').limit(1);
    if (isMissingRelation(error)) {
      results.push(skip(`${who} user_id probe on ${view} (view does not exist in this database)`));
    } else if (isUndefinedColumn(error) || isDenied(error)) {
      results.push(pass(`${who} cannot select ${view}.user_id (${isUndefinedColumn(error) ? 'column absent' : 'access denied'}, #227)`));
    } else if (!error) {
      results.push(fail(`${who} can select ${view}.user_id: the view exposes auth user ids (#227)`));
    } else {
      results.push(fail(`${who} select ${view}.user_id failed with unexpected ${describe(error)} (#227)`));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 20260620020000_fix_user_profiles_rls_recursion.sql
// ---------------------------------------------------------------------------

/**
 * Property: user_profiles policies evaluate without infinite recursion (no
 * 42P17) for this audience. For anon any non-recursive outcome holds. For a
 * signed-in caller reading their own profile must succeed, so any error fails.
 *
 * Incident (#227): the policy added by 20260619000000 queried user_profiles from
 * inside a user_profiles policy ("infinite recursion detected in policy for
 * relation user_profiles"), breaking every admin check; 20260620020000 moved the
 * lookup into the SECURITY DEFINER helper is_admin_user().
 */
export async function checkUserProfilesNoRecursion(client, { who, mustRead }) {
  const { error } = await client.from('user_profiles').select('id').limit(1);
  if (isRecursion(error)) {
    return [fail(`${who} read of user_profiles hit RLS policy recursion (${describe(error)}) (#227)`)];
  }
  if (mustRead && error) {
    return [fail(`${who} cannot read user_profiles (${describe(error)}); policies did not evaluate (#227)`)];
  }
  return [pass(`${who} user_profiles policies evaluate without recursion (#227)`)];
}

/**
 * Property: an admin reads user_profiles with the policies evaluating cleanly,
 * and gets at least their own row back. Needs RLS_TEST_ADMIN_*.
 *
 * Incident (#227): the "Admins can view all profiles" policy recursed;
 * 20260620020000 rewrote it on is_admin_user().
 */
export async function checkAdminReadsUserProfiles(client) {
  const { data, error } = await client.from('user_profiles').select('id').limit(2);
  if (isRecursion(error)) return [fail(`admin read of user_profiles hit RLS policy recursion (${describe(error)}) (#227)`)];
  if (error) return [fail(`admin cannot read user_profiles (${describe(error)}) (#227)`)];
  if (!data || data.length === 0) return [fail('admin read of user_profiles returned no rows, not even their own (#227)')];
  return [pass('admin can read user_profiles (policies evaluate without recursion, #227)')];
}

/**
 * Property: is_admin_user() evaluates for a signed-in caller without error and
 * answers for that caller only (an ordinary user gets false, an admin true).
 *
 * Incident (#227): 20260620020000 introduced the caller-bound SECURITY DEFINER
 * helper; a broken or unbound helper breaks every admin policy.
 */
export async function checkIsAdminUserHelper(client, { who, expected }) {
  const { data, error } = await client.rpc('is_admin_user', {});
  if (isRecursion(error)) return [fail(`${who} is_admin_user() hit RLS policy recursion (${describe(error)}) (#227)`)];
  if (error) return [fail(`${who} cannot evaluate is_admin_user() (${describe(error)}) (#227)`)];
  if (data !== expected) return [fail(`${who} is_admin_user() returned ${String(data)}, expected ${expected} (#227)`)];
  return [pass(`${who} is_admin_user() returns ${expected} (#227)`)];
}

// ---------------------------------------------------------------------------
// Direct-write probes for event_attendance / user_points (20260619000000
// sections D and E, 20260620010000). Run only behind RLS_ALLOW_MUTATION_TESTS.
// Shapes are the verifier's existing non-destructive ones: inserts collide with
// a constraint checked after RLS, updates write a row's current values back.
// ---------------------------------------------------------------------------

/** An insert is only a pass when RLS/grants refuse it (42501); a constraint error means RLS let it through. */
export function classifyInsertDenied(who, label, error) {
  if (error?.code === '42501') return pass(`${who} cannot insert ${label} (RLS)`);
  if (error?.code === '23503' || error?.code === '23505') {
    return fail(`${who} passed RLS inserting ${label}; only a constraint stopped it (${error.code})`);
  }
  return fail(`${who} insert into ${label} gave unexpected result: ${JSON.stringify(error)}`);
}

/**
 * Only an authorization error proves RLS/grants rejected the write. Any other
 * error (schema cache, constraint, trigger, network) means the probe never
 * reached the policy, so it can't count as a pass.
 */
export function classifyNoRowsUpdated(who, label, data, error) {
  if (error && error.code === '42501') return pass(`${who} cannot update ${label} (${error.message || error.code})`);
  if (error) return fail(`${who} update of ${label} failed for a non-authorization reason, so RLS was not verified: ${JSON.stringify(error)}`);
  if (data && data.length > 0) return fail(`${who} updated ${data.length} ${label} row(s) directly (no-op values; nothing changed)`);
  return pass(`${who} cannot update ${label} (0 rows updated due to RLS)`);
}

/**
 * Property: an ordinary user cannot insert into event_attendance, and cannot
 * update their own attendance row.
 *
 * Incident (#227): 20260620010000 dropped every ordinary-user write policy on
 * event_attendance; 20260620000000 dropped the "insert with valid code" policy
 * that let users self-credit attendance past check_in_to_event.
 */
export async function checkUserCannotWriteEventAttendance(client, { userId, nilId, who = 'ordinary user' }) {
  const results = [];
  const { error: insertError } = await client
    .from('event_attendance')
    .insert([{ event_id: nilId, user_id: userId, points_earned: 0, check_in_type: 'code' }]);
  results.push(classifyInsertDenied(who, 'event_attendance', insertError));

  const { data: own } = await client
    .from('event_attendance')
    .select('id, points_earned')
    .eq('user_id', userId)
    .limit(1);
  if (!own || own.length === 0) {
    results.push(skip(`${who} event_attendance update probe (test user has no attendance rows)`));
  } else {
    const { data, error } = await client
      .from('event_attendance')
      .update({ points_earned: own[0].points_earned })
      .eq('id', own[0].id)
      .select('id');
    results.push(classifyNoRowsUpdated(who, 'event_attendance', data, error));
  }
  return results;
}

/**
 * Property: an ordinary user cannot insert or update user_points. The insert
 * probe runs only when the caller's own row exists, so an RLS bypass hits the
 * primary key (23505) instead of creating a points row.
 *
 * Incident (#227): 20260619000000 section D dropped "Users can update their own
 * points" (any user could set their own total); 20260620010000 pinned the
 * insert policy to zero points. Production no longer has that policy, and the
 * member-account retirement (20261003000000, #510) revokes the table from
 * authenticated outright (both checked 2026-10-15). The pass shape is that
 * current state: any insert is refused, so a zero-point insert reaching 23505
 * is a regression too.
 */
export async function checkUserCannotWriteUserPoints(client, { userId, who = 'ordinary user' }) {
  const results = [];
  const { data: own } = await client
    .from('user_points')
    .select('points')
    .eq('user_id', userId)
    .maybeSingle();
  if (!own) {
    results.push(skip(`${who} user_points insert probe (no existing row, so the probe could create one)`));
    results.push(skip(`${who} user_points update probe (test user has no user_points row)`));
    return results;
  }
  const { error: insertError } = await client
    .from('user_points')
    .insert([{ user_id: userId, points: 0 }]);
  results.push(classifyInsertDenied(who, 'user_points', insertError));

  const { data, error } = await client
    .from('user_points')
    .update({ points: own.points })
    .eq('user_id', userId)
    .select('user_id');
  results.push(classifyNoRowsUpdated(who, 'user_points', data, error));
  return results;
}
