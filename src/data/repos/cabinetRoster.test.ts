/**
 * Cabinet rollover persistence. Structure copy must write positions only,
 * starting a draft must be idempotent, a locked roster must be immutable, and
 * publishing must go through the single transactional database function and
 * never write public rows or activate a Cabinet year from the client. The
 * function's own behavior (atomicity, idempotency, adoption, blockers) is
 * covered by scripts/verify-cabinet-roster.sql.
 */
import { cabinetRosterRepository } from './cabinetRoster';
import { supabaseMock } from '../../test-utils/supabaseMock';
import { CabinetRosterCycle, CabinetRosterDraft } from '../../lib/cabinetRoster';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

function cycle(status: CabinetRosterCycle['status']): CabinetRosterCycle {
  return {
    id: 'cycle-1',
    cabinet_year_id: 'cy-2027',
    source_cabinet_year_id: 'cy-2026',
    status,
    created_by: 'admin-1',
    locked_at: null,
    published_at: null,
    created_at: '2026-10-02T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
  };
}

function draft(n: number, overrides: Partial<CabinetRosterDraft> = {}): CabinetRosterDraft {
  return {
    id: `d${n}`,
    cycle_id: 'cycle-1',
    role: `Role ${n}`,
    category: 'General Board',
    display_order: n,
    name: `Person ${n}`,
    member_id: `m${n}`,
    year: null,
    college: null,
    major: null,
    pronouns: null,
    favorite_snack: null,
    fun_fact: null,
    published_cabinet_member_id: null,
    created_at: `2026-10-02T00:00:0${n}Z`,
    updated_at: '2026-10-02T00:00:00Z',
    ...overrides,
  };
}

function callsFor(table: string, method: string) {
  return supabaseMock.queriesFor(table).flatMap((q) => q.calls).filter((c) => c.method === method);
}

beforeEach(() => supabaseMock.reset());

describe('starting a draft from last year', () => {
  const previous = [
    { role: 'Co-President', category: 'Executive Board', display_order: 0 },
    { role: 'Co-President', category: 'Executive Board', display_order: 0 },
    { role: 'Historian', category: 'General Board', display_order: 7 },
  ];

  it('copies role, category and display_order only', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: null, error: null });
    supabaseMock.queueResult('cabinet_members', { data: previous, error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });

    const result = await cabinetRosterRepository.createCycle({ cabinetYearId: 'cy-2027', sourceCabinetYearId: 'cy-2026', userId: 'admin-1' });

    expect(result).toMatchObject({ created: true, positionsCopied: 3 });
    const inserted = callsFor('cabinet_roster_drafts', 'insert')[0].args[0] as Array<Record<string, unknown>>;
    expect(inserted).toEqual([
      { role: 'Co-President', category: 'Executive Board', display_order: 0, cycle_id: 'cycle-1' },
      { role: 'Co-President', category: 'Executive Board', display_order: 0, cycle_id: 'cycle-1' },
      { role: 'Historian', category: 'General Board', display_order: 7, cycle_id: 'cycle-1' },
    ]);
    // The source read asks for the three structural columns only, never people.
    expect(callsFor('cabinet_members', 'select')[0].args[0]).toBe('role, category, display_order');
    inserted.forEach((row) => {
      expect(row).not.toHaveProperty('name');
      expect(row).not.toHaveProperty('member_id');
      expect(row).not.toHaveProperty('fun_fact');
    });
  });

  it('returns the existing live roster and writes nothing on a repeat', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });

    const result = await cabinetRosterRepository.createCycle({ cabinetYearId: 'cy-2027', sourceCabinetYearId: 'cy-2026', userId: 'admin-1' });

    expect(result).toMatchObject({ created: false, positionsCopied: 0 });
    expect(callsFor('cabinet_roster_cycles', 'insert')).toHaveLength(0);
    expect(supabaseMock.queriesFor('cabinet_roster_drafts')).toHaveLength(0);
  });

  it('does not touch cabinet_members or activate anything', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: null, error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });

    await cabinetRosterRepository.createCycle({ cabinetYearId: 'cy-2027', sourceCabinetYearId: null, userId: null });

    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
    expect(supabaseMock.queriesFor('cabinet_years')).toHaveLength(0);
  });
});

describe('a locked roster cannot silently mutate', () => {
  it.each(['locked', 'published'] as const)('rejects edits when %s', async (status) => {
    const queue = () => supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle(status), error: null });
    queue();
    await expect(cabinetRosterRepository.updateDraft('cycle-1', 'd1', { name: 'X' })).rejects.toThrow(/Reopen/);
    queue();
    await expect(cabinetRosterRepository.addDrafts('cycle-1', [{ role: 'X', category: 'General Board' }])).rejects.toThrow(/Reopen/);
    queue();
    await expect(cabinetRosterRepository.removeDraft('cycle-1', 'd1')).rejects.toThrow(/Reopen/);
    queue();
    await expect(cabinetRosterRepository.deleteCycle('cycle-1')).rejects.toThrow(/Reopen/);
    expect(supabaseMock.queriesFor('cabinet_roster_drafts')).toHaveLength(0);
  });

  it('locks without writing anything public', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('cabinet_roster_drafts', { data: [draft(1)], error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });

    await cabinetRosterRepository.lockCycle('cycle-1');

    expect(callsFor('cabinet_roster_cycles', 'update')[0].args[0]).toEqual({ status: 'locked' });
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('refuses to lock with an empty position or a duplicate canonical member', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('cabinet_roster_drafts', { data: [draft(1, { name: null, member_id: null })], error: null });
    await expect(cabinetRosterRepository.lockCycle('cycle-1')).rejects.toThrow(/still empty/);

    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('cabinet_roster_drafts', { data: [draft(1, { member_id: 'x' }), draft(2, { member_id: 'x' })], error: null });
    await expect(cabinetRosterRepository.lockCycle('cycle-1')).rejects.toThrow(/duplicate canonical member/);
    expect(supabaseMock.usedMethod('cabinet_roster_cycles', 'update')).toBe(false);
  });

  it('locks a roster with unresolved links and no photos (neither blocks)', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('cabinet_roster_drafts', { data: [draft(1, { member_id: null }), draft(2)], error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });
    await expect(cabinetRosterRepository.lockCycle('cycle-1')).resolves.toBeUndefined();
  });
});

describe('publishing', () => {
  const RPC = 'rpc:publish_cabinet_roster_cycle';

  it('publishes through the single database function and never writes public rows itself', async () => {
    supabaseMock.setDefault(RPC, {
      data: { cycle_id: 'cycle-1', status: 'published', created: 18, updated: 1, total: 19, already_published: false },
      error: null,
    });

    await expect(cabinetRosterRepository.publishCycle('cycle-1')).resolves.toEqual({ alreadyPublished: false, created: 18, updated: 1 });

    expect(supabaseMock.queriesFor(RPC)[0].calls[0].args[0]).toEqual({ p_cycle_id: 'cycle-1' });
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
    expect(supabaseMock.queriesFor('cabinet_roster_drafts')).toHaveLength(0);
    expect(supabaseMock.queriesFor('cabinet_roster_cycles')).toHaveLength(0);
  });

  it('never touches cabinet_years, so publishing cannot activate a year', async () => {
    supabaseMock.setDefault(RPC, { data: { created: 1, updated: 0, already_published: false }, error: null });
    await cabinetRosterRepository.publishCycle('cycle-1');
    expect(supabaseMock.queriesFor('cabinet_years')).toHaveLength(0);
    expect(JSON.stringify(supabaseMock.queries())).not.toContain('is_active');
  });

  it('reports a repeat publish as already published with nothing created', async () => {
    supabaseMock.setDefault(RPC, { data: { created: 0, updated: 0, total: 19, already_published: true }, error: null });
    await expect(cabinetRosterRepository.publishCycle('cycle-1')).resolves.toEqual({ alreadyPublished: true, created: 0, updated: 0 });
  });

  it("surfaces the database's blocker message", async () => {
    supabaseMock.setDefault(RPC, {
      data: null,
      error: { message: 'Publish blocked: 2 position(s) are still empty', code: 'P0001', details: '', hint: '' },
    });
    await expect(cabinetRosterRepository.publishCycle('cycle-1')).rejects.toThrow('Publish blocked: 2 position(s) are still empty');
  });

  it('rejects an unexpected response shape', async () => {
    supabaseMock.setDefault(RPC, { data: { hello: 'world' }, error: null });
    await expect(cabinetRosterRepository.publishCycle('cycle-1')).rejects.toThrow(/unexpected response/);
  });
});

describe('locking never publishes', () => {
  it('does not write public rows when a roster is locked', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('cabinet_roster_drafts', { data: [draft(0)], error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });
    await cabinetRosterRepository.lockCycle('cycle-1');
    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(callsFor('cabinet_members', 'update')).toHaveLength(0);
    expect(supabaseMock.usedMethod('rpc:publish_cabinet_roster_cycle', 'rpc')).toBe(false);
  });
});
