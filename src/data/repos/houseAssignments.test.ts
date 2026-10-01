/**
 * Lock and publish behavior for persisted House assignment batches.
 *
 * What matters here: locking never writes house_memberships, publishing goes
 * through the dated-interval writer (close the open membership, insert the new
 * one, refresh members.house), a published batch is a no-op, and a locked
 * batch cannot be edited.
 */
import { houseAssignmentsRepository } from './houseAssignments';
import { supabaseMock } from '../../test-utils/supabaseMock';
import { HouseAssignmentBatch, HouseAssignmentDraft } from '../../lib/houseAssignmentDraft';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const YEAR = 2026;
const START = '2026-11-08';
const profiles = [
  { id: 'p-boo', house_key: 'Boo', display_name: 'Boo', is_active: true },
  { id: 'p-toad', house_key: 'Toad', display_name: 'Toad', is_active: true },
];

function batch(status: HouseAssignmentBatch['status']): HouseAssignmentBatch {
  return {
    id: 'batch-1',
    academic_year_start: YEAR,
    academic_year_end: YEAR + 1,
    effective_start_date: START,
    status,
    source_label: 'Fall sort',
    created_by: 'admin-1',
    locked_at: null,
    published_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

function draft(order: number, overrides: Partial<HouseAssignmentDraft> = {}): HouseAssignmentDraft {
  return {
    id: `d${order}`,
    batch_id: 'batch-1',
    source_name: `Person ${order}`,
    source_house: null,
    member_id: `m${order}`,
    house_profile_id: 'p-toad',
    match_status: 'match',
    match_method: 'name',
    match_score: 95,
    preferences: null,
    notes: null,
    source_order: order,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

/** Queues the reads loadSnapshot makes, after the leading getBatch. */
function queueSnapshot(status: HouseAssignmentBatch['status'], drafts: HouseAssignmentDraft[], memberships: unknown[] = []) {
  supabaseMock.queueResult('house_assignment_batches', { data: batch(status), error: null });
  supabaseMock.queueResult('house_assignment_drafts', { data: drafts, error: null });
  supabaseMock.queueResult('house_page_assets', { data: profiles, error: null });
  supabaseMock.queueResult('house_memberships', { data: memberships, error: null });
}

function membershipWrites() {
  return supabaseMock.queriesFor('house_memberships')
    .flatMap((query) => query.calls)
    .filter((call) => ['insert', 'update', 'delete', 'upsert'].includes(call.method));
}

beforeEach(() => {
  supabaseMock.reset();
});

describe('locking', () => {
  it('refuses to lock while blockers remain and writes nothing', async () => {
    queueSnapshot('draft', [
      draft(1, { member_id: 'kevin', house_profile_id: 'p-toad' }),
      draft(2, { member_id: 'kevin', house_profile_id: 'p-boo' }),
    ]);

    await expect(houseAssignmentsRepository.lockBatch('batch-1')).rejects.toThrow(/blocker/);

    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('locks a clean draft without touching house_memberships or members', async () => {
    queueSnapshot('draft', [draft(1), draft(2, { house_profile_id: 'p-boo' })]);
    supabaseMock.queueResult('house_assignment_batches', { data: [{ id: 'batch-1' }], error: null });

    const preflight = await houseAssignmentsRepository.lockBatch('batch-1');

    expect(preflight.canLock).toBe(true);
    const updates = supabaseMock.queriesFor('house_assignment_batches')
      .flatMap((query) => query.calls)
      .filter((call) => call.method === 'update');
    expect(updates).toEqual([{ method: 'update', args: [{ status: 'locked' }] }]);
    expect(membershipWrites()).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('does not lock a batch that is no longer a draft', async () => {
    queueSnapshot('locked', [draft(1)]);
    await expect(houseAssignmentsRepository.lockBatch('batch-1')).rejects.toThrow(/not a draft/);
    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
  });
});

describe('a locked batch cannot silently mutate', () => {
  it.each(['locked', 'published'] as const)('rejects row edits, additions, removals, and deletion when %s', async (status) => {
    const gets = () => supabaseMock.queueResult('house_assignment_batches', { data: batch(status), error: null });

    gets();
    await expect(houseAssignmentsRepository.updateDraft('batch-1', 'd1', { house_profile_id: 'p-boo' })).rejects.toThrow(/Reopen/);
    gets();
    await expect(houseAssignmentsRepository.addDraft('batch-1', { source_name: 'New' })).rejects.toThrow(/Reopen/);
    gets();
    await expect(houseAssignmentsRepository.removeDraft('batch-1', 'd1')).rejects.toThrow(/Reopen/);
    gets();
    await expect(houseAssignmentsRepository.deleteBatch('batch-1')).rejects.toThrow(/Reopen/);

    expect(supabaseMock.queriesFor('house_assignment_drafts')).toHaveLength(0);
  });
});

describe('publishing (reveal)', () => {
  it('refuses to publish a batch that is not locked', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('draft'), error: null });
    await expect(houseAssignmentsRepository.publishBatch('batch-1', 'admin-1')).rejects.toThrow(/locked/);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('closes the open membership, inserts the dated one, and refreshes the members.house cache', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('locked'), error: null });
    queueSnapshot(
      'locked',
      [draft(1, { member_id: 'kevin', house_profile_id: 'p-toad' })],
      [{ id: 'old', member_id: 'kevin', house_profile_id: 'p-boo', effective_start_date: '2026-09-20', effective_end_date: null }],
    );
    supabaseMock.queueResult('house_assignment_batches', { data: [{ id: 'batch-1' }], error: null });

    const result = await houseAssignmentsRepository.publishBatch('batch-1', 'admin-1');

    expect(result).toEqual({ alreadyPublished: false, applied: 1, skipped: 0 });
    const calls = membershipWrites();
    expect(calls[0]).toMatchObject({
      method: 'update',
      args: [expect.objectContaining({ effective_end_date: START, updated_by: 'admin-1' })],
    });
    expect(supabaseMock.queriesFor('house_memberships').flatMap((q) => q.calls)).toContainEqual({ method: 'in', args: ['id', ['old']] });
    expect(calls[1]).toMatchObject({
      method: 'insert',
      args: [expect.objectContaining({
        member_id: 'kevin',
        house_profile_id: 'p-toad',
        academic_year_start: YEAR,
        academic_year_end: YEAR + 1,
        effective_start_date: START,
        effective_end_date: null,
        source: 'house_assignment_batch',
        source_import_id: 'batch-1',
      })],
    });
    const cache = supabaseMock.queriesFor('members').flatMap((q) => q.calls);
    expect(cache).toContainEqual({ method: 'update', args: [expect.objectContaining({ house: 'Toad' })] });
    expect(cache).toContainEqual({ method: 'eq', args: ['id', 'kevin'] });
    const statusUpdates = supabaseMock.queriesFor('house_assignment_batches')
      .flatMap((q) => q.calls)
      .filter((call) => call.method === 'update');
    expect(statusUpdates).toContainEqual({ method: 'update', args: [{ status: 'published' }] });
  });

  it('ends the new membership where a later one already begins', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('locked'), error: null });
    queueSnapshot(
      'locked',
      [draft(1, { member_id: 'kevin', house_profile_id: 'p-toad' })],
      [{ id: 'later', member_id: 'kevin', house_profile_id: 'p-boo', effective_start_date: '2027-01-10', effective_end_date: null }],
    );
    supabaseMock.queueResult('house_assignment_batches', { data: [{ id: 'batch-1' }], error: null });

    await houseAssignmentsRepository.publishBatch('batch-1', 'admin-1');

    const insert = membershipWrites().find((call) => call.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ effective_start_date: START, effective_end_date: '2027-01-10' });
  });

  it('skips a member already in that House from that date, so a retry creates no duplicates', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('locked'), error: null });
    queueSnapshot(
      'locked',
      [draft(1, { member_id: 'kevin', house_profile_id: 'p-toad' }), draft(2, { member_id: 'sara', house_profile_id: 'p-boo' })],
      [{ id: 'done', member_id: 'kevin', house_profile_id: 'p-toad', effective_start_date: START, effective_end_date: null }],
    );
    supabaseMock.queueResult('house_assignment_batches', { data: [{ id: 'batch-1' }], error: null });

    const result = await houseAssignmentsRepository.publishBatch('batch-1', 'admin-1');

    expect(result).toEqual({ alreadyPublished: false, applied: 1, skipped: 1 });
    const inserts = membershipWrites().filter((call) => call.method === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].args[0]).toMatchObject({ member_id: 'sara' });
  });

  it('publishes each canonical member once even if the draft lists them twice', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('locked'), error: null });
    queueSnapshot('locked', [
      draft(1, { member_id: 'kevin', house_profile_id: 'p-toad' }),
      draft(2, { member_id: 'kevin', house_profile_id: 'p-toad' }),
    ]);
    supabaseMock.queueResult('house_assignment_batches', { data: [{ id: 'batch-1' }], error: null });

    const result = await houseAssignmentsRepository.publishBatch('batch-1', 'admin-1');

    expect(result.applied).toBe(1);
    expect(membershipWrites().filter((call) => call.method === 'insert')).toHaveLength(1);
  });

  it('skips ambiguous and unmatched rows rather than guessing', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('locked'), error: null });
    queueSnapshot('locked', [
      draft(1, { member_id: 'kevin', match_status: 'review' }),
      draft(2, { member_id: null, match_status: 'unmatched' }),
      draft(3, { member_id: 'sara', match_status: 'manual' }),
    ]);
    supabaseMock.queueResult('house_assignment_batches', { data: [{ id: 'batch-1' }], error: null });

    await houseAssignmentsRepository.publishBatch('batch-1', 'admin-1');

    const inserts = membershipWrites().filter((call) => call.method === 'insert');
    expect(inserts.map((call) => (call.args[0] as { member_id: string }).member_id)).toEqual(['sara']);
  });

  it('is a no-op for an already published batch', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('published'), error: null });

    const result = await houseAssignmentsRepository.publishBatch('batch-1', 'admin-1');

    expect(result).toEqual({ alreadyPublished: true, applied: 0, skipped: 0 });
    expect(supabaseMock.queriesFor('house_memberships')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
  });

  it('stops before writing anything when a blocker appeared since locking', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: batch('locked'), error: null });
    queueSnapshot(
      'locked',
      [draft(1, { member_id: 'kevin', house_profile_id: 'p-toad', source_name: 'Kevin Tran' })],
      [{ id: 'x', member_id: 'kevin', house_profile_id: 'p-boo', effective_start_date: START, effective_end_date: null }],
    );

    await expect(houseAssignmentsRepository.publishBatch('batch-1', 'admin-1')).rejects.toThrow(/Cannot publish/);

    expect(membershipWrites()).toHaveLength(0);
    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
  });
});
