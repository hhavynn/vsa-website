/**
 * Cabinet rollover persistence. Structure copy must write positions only,
 * starting a draft must be idempotent, a locked roster must be immutable, and
 * publishing must be idempotent, photo-optional, and must never activate a
 * Cabinet year.
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

/** getCycle, getDrafts, then the existing public rows, as publishCycle reads them. */
function queuePublish(status: CabinetRosterCycle['status'], drafts: CabinetRosterDraft[], existing: unknown[] = []) {
  supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle(status), error: null });
  supabaseMock.queueResult('cabinet_roster_drafts', { data: drafts, error: null });
  supabaseMock.queueResult('cabinet_members', { data: existing, error: null });
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
  it('refuses to publish a roster that is not locked', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });
    await expect(cabinetRosterRepository.publishCycle('cycle-1')).rejects.toThrow(/locked/);
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('creates the public row, records its id on the draft, and publishes the cycle', async () => {
    queuePublish('locked', [draft(0, { name: 'Havyn Nguyen', member_id: 'm-havyn', role: 'Co-President', category: 'Executive Board', display_order: 0, fun_fact: 'hi' })]);
    supabaseMock.queueResult('cabinet_members', { data: { id: 'cm-new' }, error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });

    const result = await cabinetRosterRepository.publishCycle('cycle-1');

    expect(result).toEqual({ alreadyPublished: false, created: 1, updated: 0 });
    expect(callsFor('cabinet_members', 'insert')[0].args[0]).toMatchObject({
      name: 'Havyn Nguyen',
      role: 'Co-President',
      category: 'Executive Board',
      member_id: 'm-havyn',
      cabinet_year_id: 'cy-2027',
      fun_fact: 'hi',
    });
    expect(callsFor('cabinet_roster_drafts', 'update')[0].args[0]).toEqual({ published_cabinet_member_id: 'cm-new' });
    expect(callsFor('cabinet_roster_cycles', 'update')[0].args[0]).toEqual({ status: 'published' });
  });

  it('never activates the cabinet year or touches the photo columns', async () => {
    queuePublish('locked', [draft(0)]);
    supabaseMock.queueResult('cabinet_members', { data: { id: 'cm-new' }, error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });

    await cabinetRosterRepository.publishCycle('cycle-1');

    expect(supabaseMock.queriesFor('cabinet_years')).toHaveLength(0);
    const payload = callsFor('cabinet_members', 'insert')[0].args[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('image_url');
    expect(payload).not.toHaveProperty('thumbnail_url');
    expect(JSON.stringify(supabaseMock.queries())).not.toContain('is_active');
  });

  it('publishes without any approved photo (a photo is never required)', async () => {
    queuePublish('locked', [draft(0, { member_id: null })]);
    supabaseMock.queueResult('cabinet_members', { data: { id: 'cm-new' }, error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });
    await expect(cabinetRosterRepository.publishCycle('cycle-1')).resolves.toMatchObject({ created: 1 });
  });

  it('adopts an already-public row for the same member instead of duplicating it', async () => {
    queuePublish('locked', [draft(0, { member_id: 'm-havyn', name: 'Havyn Nguyen' })], [
      { id: 'cm-old', name: 'Havyn N.', member_id: 'm-havyn' },
    ]);
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-old' }], error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });

    const result = await cabinetRosterRepository.publishCycle('cycle-1');

    expect(result).toEqual({ alreadyPublished: false, created: 0, updated: 1 });
    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(callsFor('cabinet_roster_drafts', 'update')[0].args[0]).toEqual({ published_cabinet_member_id: 'cm-old' });
  });

  it('updates an adopted row without blanking fields the draft left empty', async () => {
    queuePublish('locked', [draft(0, { member_id: 'm-havyn', name: 'Havyn Nguyen', college: null, fun_fact: null })], [
      { id: 'cm-old', name: 'Havyn Nguyen', member_id: 'm-havyn' },
    ]);
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-old' }], error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });

    await cabinetRosterRepository.publishCycle('cycle-1');

    const patch = callsFor('cabinet_members', 'update')[0].args[0] as Record<string, unknown>;
    expect(patch).toMatchObject({ name: 'Havyn Nguyen', member_id: 'm-havyn', cabinet_year_id: 'cy-2027' });
    expect(patch).not.toHaveProperty('college');
    expect(patch).not.toHaveProperty('fun_fact');
  });

  it('retries after a partial publish by updating recorded rows in place, creating nothing', async () => {
    queuePublish('locked', [draft(0, { published_cabinet_member_id: 'cm-1' }), draft(1, { published_cabinet_member_id: 'cm-2' })], [
      { id: 'cm-1', name: 'Person 0', member_id: 'm0' },
      { id: 'cm-2', name: 'Person 1', member_id: 'm1' },
    ]);
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-1' }], error: null });
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-2' }], error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });

    const result = await cabinetRosterRepository.publishCycle('cycle-1');

    expect(result).toEqual({ alreadyPublished: false, created: 0, updated: 2 });
    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(supabaseMock.usedMethod('cabinet_roster_drafts', 'update')).toBe(false);
  });

  it('is a no-op for an already published roster', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('published'), error: null });

    expect(await cabinetRosterRepository.publishCycle('cycle-1')).toEqual({ alreadyPublished: true, created: 0, updated: 0 });
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
    expect(supabaseMock.usedMethod('cabinet_roster_cycles', 'update')).toBe(false);
  });

  it('leaves existing public rows that are not in the roster untouched', async () => {
    queuePublish('locked', [draft(0, { member_id: 'm0' })], [
      { id: 'cm-other', name: 'Someone Else', member_id: 'm-other' },
    ]);
    supabaseMock.queueResult('cabinet_members', { data: { id: 'cm-new' }, error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });

    await cabinetRosterRepository.publishCycle('cycle-1');

    expect(callsFor('cabinet_members', 'delete')).toHaveLength(0);
    expect(callsFor('cabinet_members', 'update')).toHaveLength(0);
  });

  it('does not make draft rosters public before publish', async () => {
    supabaseMock.queueResult('cabinet_roster_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('cabinet_roster_drafts', { data: [draft(0)], error: null });
    supabaseMock.queueResult('cabinet_roster_cycles', { data: [{ id: 'cycle-1' }], error: null });
    await cabinetRosterRepository.lockCycle('cycle-1');
    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(callsFor('cabinet_members', 'update')).toHaveLength(0);
  });
});
