/**
 * Intern cohort persistence and publish behavior. Publishing must create the
 * right cabinet_members Interns row, record its id on the draft, and never
 * duplicate on a repeat; a locked cohort must not be editable.
 */
import { internCohortRepository } from './internCohort';
import { supabaseMock } from '../../test-utils/supabaseMock';
import { InternCohortCycle, InternCohortDraft } from '../../lib/internCohort';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

function cycle(status: InternCohortCycle['status']): InternCohortCycle {
  return {
    id: 'cycle-1',
    academic_year_start: 2026,
    academic_year_end: 2027,
    cabinet_year_id: 'cy-2026',
    status,
    created_by: 'admin-1',
    locked_at: null,
    published_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

function draft(order: number, overrides: Partial<InternCohortDraft> = {}): InternCohortDraft {
  return {
    id: `d${order}`,
    cycle_id: 'cycle-1',
    name: `Intern ${order}`,
    member_id: `m${order}`,
    mentor_cabinet_member_id: null,
    role_or_track: null,
    caption: null,
    internal_notes: null,
    display_order: order,
    published_cabinet_member_id: null,
    created_at: `2026-10-01T00:00:0${order}Z`,
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function callsFor(table: string, method: string) {
  return supabaseMock.queriesFor(table).flatMap((q) => q.calls).filter((c) => c.method === method);
}

/** getCycle, getDrafts, then the existing Interns rows, as publishCycle reads them. */
function queuePublish(status: InternCohortCycle['status'], drafts: InternCohortDraft[], existing: unknown[] = []) {
  supabaseMock.queueResult('intern_cohort_cycles', { data: cycle(status), error: null });
  supabaseMock.queueResult('intern_cohort_drafts', { data: drafts, error: null });
  supabaseMock.queueResult('cabinet_members', { data: existing, error: null });
}

beforeEach(() => supabaseMock.reset());

describe('draft persistence', () => {
  it('saves pasted interns into the cycle as private draft rows', async () => {
    supabaseMock.queueResult('intern_cohort_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('intern_cohort_drafts', { data: [draft(0)], error: null });

    await internCohortRepository.addDrafts('cycle-1', [{ name: 'Sarah Nguyen', member_id: 'm-sarah', display_order: 0 }]);

    expect(callsFor('intern_cohort_drafts', 'insert')[0].args[0]).toEqual([
      { name: 'Sarah Nguyen', member_id: 'm-sarah', display_order: 0, cycle_id: 'cycle-1' },
    ]);
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('stores a cabinet mentor on the draft', async () => {
    supabaseMock.queueResult('intern_cohort_cycles', { data: cycle('draft'), error: null });

    await internCohortRepository.updateDraft('cycle-1', 'd1', { mentor_cabinet_member_id: 'cm-emily' });

    expect(callsFor('intern_cohort_drafts', 'update')[0].args[0]).toEqual({ mentor_cabinet_member_id: 'cm-emily' });
  });
});

describe('a locked cohort cannot silently mutate', () => {
  it.each(['locked', 'published'] as const)('rejects edits when %s', async (status) => {
    const queue = () => supabaseMock.queueResult('intern_cohort_cycles', { data: cycle(status), error: null });
    queue();
    await expect(internCohortRepository.updateDraft('cycle-1', 'd1', { name: 'X' })).rejects.toThrow(/Reopen/);
    queue();
    await expect(internCohortRepository.addDrafts('cycle-1', [{ name: 'X' }])).rejects.toThrow(/Reopen/);
    queue();
    await expect(internCohortRepository.removeDraft('cycle-1', 'd1')).rejects.toThrow(/Reopen/);
    queue();
    await expect(internCohortRepository.reorder('cycle-1', [{ id: 'd1', display_order: 2 }])).rejects.toThrow(/Reopen/);
    queue();
    await expect(internCohortRepository.deleteCycle('cycle-1')).rejects.toThrow(/Reopen/);
    expect(supabaseMock.queriesFor('intern_cohort_drafts')).toHaveLength(0);
  });

  it('locks without writing anything public', async () => {
    supabaseMock.queueResult('intern_cohort_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('intern_cohort_drafts', { data: [draft(1)], error: null });
    supabaseMock.queueResult('intern_cohort_cycles', { data: [{ id: 'cycle-1' }], error: null });

    await internCohortRepository.lockCycle('cycle-1');

    expect(callsFor('intern_cohort_cycles', 'update')[0].args[0]).toEqual({ status: 'locked' });
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('refuses to lock with a duplicate canonical member', async () => {
    supabaseMock.queueResult('intern_cohort_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('intern_cohort_drafts', { data: [draft(1, { member_id: 'x' }), draft(2, { member_id: 'x' })], error: null });

    await expect(internCohortRepository.lockCycle('cycle-1')).rejects.toThrow(/duplicate canonical member/);
    expect(supabaseMock.usedMethod('intern_cohort_cycles', 'update')).toBe(false);
  });
});

describe('publishing', () => {
  it('refuses to publish a cohort that is not locked', async () => {
    supabaseMock.queueResult('intern_cohort_cycles', { data: cycle('draft'), error: null });
    await expect(internCohortRepository.publishCycle('cycle-1')).rejects.toThrow(/locked/);
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('creates the Interns row in the cycle cabinet year and records its id on the draft', async () => {
    queuePublish('locked', [draft(0, { member_id: 'm-sarah', name: 'Sarah Nguyen', role_or_track: 'Events', display_order: 4, mentor_cabinet_member_id: 'cm-e', caption: 'hi', internal_notes: 'private' })]);
    supabaseMock.queueResult('cabinet_members', { data: { id: 'cm-new' }, error: null });
    supabaseMock.queueResult('intern_cohort_cycles', { data: [{ id: 'cycle-1' }], error: null });

    const result = await internCohortRepository.publishCycle('cycle-1');

    expect(result).toEqual({ alreadyPublished: false, created: 1, updated: 0 });
    expect(callsFor('cabinet_members', 'insert')[0].args[0]).toEqual({
      name: 'Sarah Nguyen',
      role: 'Events',
      category: 'Interns',
      display_order: 4,
      member_id: 'm-sarah',
      cabinet_year_id: 'cy-2026',
    });
    expect(callsFor('intern_cohort_drafts', 'update')[0].args[0]).toEqual({ published_cabinet_member_id: 'cm-new' });
    expect(callsFor('intern_cohort_cycles', 'update')[0].args[0]).toEqual({ status: 'published' });
  });

  it('adopts an already-published Interns row for the same member instead of duplicating it', async () => {
    queuePublish('locked', [draft(0, { member_id: 'm-sarah', name: 'Sarah Nguyen' })], [
      { id: 'cm-old', name: 'Sarah N.', member_id: 'm-sarah' },
    ]);
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-old' }], error: null });
    supabaseMock.queueResult('intern_cohort_cycles', { data: [{ id: 'cycle-1' }], error: null });

    const result = await internCohortRepository.publishCycle('cycle-1');

    expect(result).toEqual({ alreadyPublished: false, created: 0, updated: 1 });
    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(supabaseMock.queriesFor('cabinet_members').flatMap((q) => q.calls)).toContainEqual({ method: 'eq', args: ['id', 'cm-old'] });
    expect(callsFor('intern_cohort_drafts', 'update')[0].args[0]).toEqual({ published_cabinet_member_id: 'cm-old' });
  });

  it('updates the recorded row in place on a retry, creating nothing', async () => {
    queuePublish('locked', [draft(0, { published_cabinet_member_id: 'cm-1' }), draft(1, { published_cabinet_member_id: 'cm-2' })]);
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-1' }], error: null });
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-2' }], error: null });
    supabaseMock.queueResult('intern_cohort_cycles', { data: [{ id: 'cycle-1' }], error: null });

    const result = await internCohortRepository.publishCycle('cycle-1');

    expect(result).toEqual({ alreadyPublished: false, created: 0, updated: 2 });
    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(supabaseMock.usedMethod('intern_cohort_drafts', 'update')).toBe(false);
  });

  it('matches an unlinked intern to an unlinked existing row by name only', async () => {
    queuePublish('locked', [draft(0, { member_id: null, name: 'Zed Unknown' })], [
      { id: 'cm-linked', name: 'Zed Unknown', member_id: 'someone' },
      { id: 'cm-name', name: 'zed unknown', member_id: null },
    ]);
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'cm-name' }], error: null });
    supabaseMock.queueResult('intern_cohort_cycles', { data: [{ id: 'cycle-1' }], error: null });

    await internCohortRepository.publishCycle('cycle-1');

    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(callsFor('intern_cohort_drafts', 'update')[0].args[0]).toEqual({ published_cabinet_member_id: 'cm-name' });
  });

  it('inserts a fresh row when the recorded one was deleted', async () => {
    queuePublish('locked', [draft(0, { published_cabinet_member_id: 'cm-gone' })]);
    supabaseMock.queueResult('cabinet_members', { data: [], error: null });
    supabaseMock.queueResult('cabinet_members', { data: { id: 'cm-new' }, error: null });
    supabaseMock.queueResult('intern_cohort_cycles', { data: [{ id: 'cycle-1' }], error: null });

    const result = await internCohortRepository.publishCycle('cycle-1');

    expect(result).toEqual({ alreadyPublished: false, created: 1, updated: 0 });
    expect(callsFor('intern_cohort_drafts', 'update')[0].args[0]).toEqual({ published_cabinet_member_id: 'cm-new' });
  });

  it('is a no-op for an already published cohort', async () => {
    supabaseMock.queueResult('intern_cohort_cycles', { data: cycle('published'), error: null });

    expect(await internCohortRepository.publishCycle('cycle-1')).toEqual({ alreadyPublished: true, created: 0, updated: 0 });
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
    expect(supabaseMock.usedMethod('intern_cohort_cycles', 'update')).toBe(false);
  });

  it('does not make draft interns public before publish', async () => {
    supabaseMock.queueResult('intern_cohort_cycles', { data: cycle('draft'), error: null });
    supabaseMock.queueResult('intern_cohort_drafts', { data: [draft(0)], error: null });
    supabaseMock.queueResult('intern_cohort_cycles', { data: [{ id: 'cycle-1' }], error: null });
    await internCohortRepository.lockCycle('cycle-1');
    expect(callsFor('cabinet_members', 'insert')).toHaveLength(0);
    expect(callsFor('cabinet_members', 'update')).toHaveLength(0);
  });
});
