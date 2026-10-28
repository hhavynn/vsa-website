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
    assignment_method: 'manual',
    capacity_config: null,
    excluded_applicants: null,
    payment_cycle_id: null,
    eligibility_mode: null,
    payment_snapshot_version: null,
    revised_from_batch_id: null,
    generation_reason: null,
    applicant_set_fingerprint: null,
    eligibility_summary: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

function draft(order: number, overrides: Partial<HouseAssignmentDraft> = {}): HouseAssignmentDraft {
  return {
    id: `d${order}`,
    batch_id: 'batch-1', applicant_id: null,
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
    submission_timestamp: null,
    source_row_number: null,
    generated_house_profile_id: null,
    override_reason: null,
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

describe('timestamp-priority (automatic) batches', () => {
  const placementBatch = (status: HouseAssignmentBatch['status']): HouseAssignmentBatch => ({
    ...batch(status),
    assignment_method: 'timestamp_ranked',
    capacity_config: { 'p-boo': 1, 'p-toad': 1 },
  });
  const placed = (order: number, overrides: Partial<HouseAssignmentDraft> = {}) => draft(order, {
    house_profile_id: order === 1 ? 'p-boo' : 'p-toad',
    generated_house_profile_id: order === 1 ? 'p-boo' : 'p-toad',
    preferences: order === 1 ? ['p-boo', 'p-toad'] : ['p-toad', 'p-boo'],
    source_order: order - 1,
    submission_timestamp: `2026-10-22T03:0${order}:00.000Z`,
    source_row_number: order + 1,
    ...overrides,
  });
  function queuePlacementSnapshot(status: HouseAssignmentBatch['status'], drafts: HouseAssignmentDraft[]) {
    supabaseMock.queueResult('house_assignment_batches', { data: placementBatch(status), error: null });
    supabaseMock.queueResult('house_assignment_drafts', { data: drafts, error: null });
    supabaseMock.queueResult('house_page_assets', { data: profiles, error: null });
    supabaseMock.queueResult('house_memberships', { data: [], error: null });
  }

  it('saves placement metadata on the batch, and leaves it off manual imports', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: placementBatch('draft'), error: null });
    supabaseMock.queueResult('house_assignment_drafts', { data: null, error: null });
    await houseAssignmentsRepository.createBatch({
      academicYearStart: YEAR,
      effectiveStartDate: START,
      sourceLabel: 'Auto',
      userId: 'admin-1',
      rows: [{ source_name: 'Person 1', source_order: 0 }],
      placement: { capacityConfig: { 'p-boo': 1 }, excludedApplicants: [{ source_row_number: 7, name: 'Left Out', reason: 'Withdrew' }] },
    });
    supabaseMock.queueResult('house_assignment_batches', { data: batch('draft'), error: null });
    supabaseMock.queueResult('house_assignment_drafts', { data: null, error: null });
    await houseAssignmentsRepository.createBatch({ academicYearStart: YEAR, effectiveStartDate: START, sourceLabel: 'Sheet', userId: null, rows: [{ source_name: 'Person 1' }] });

    const inserts = supabaseMock.queriesFor('house_assignment_batches').flatMap((query) => query.calls).filter((call) => call.method === 'insert');
    expect(inserts[0].args[0]).toMatchObject({
      assignment_method: 'timestamp_ranked',
      capacity_config: { 'p-boo': 1 },
      excluded_applicants: [{ source_row_number: 7, name: 'Left Out', reason: 'Withdrew' }],
    });
    expect(inserts[1].args[0]).not.toHaveProperty('assignment_method');
    expect(inserts[1].args[0]).not.toHaveProperty('capacity_config');
    expect(membershipWrites()).toHaveLength(0);
  });

  it('re-runs the strict checks on persisted rows and refuses to lock with an unmatched applicant', async () => {
    queuePlacementSnapshot('draft', [placed(1), placed(2, { member_id: null, match_status: 'unmatched' })]);
    await expect(houseAssignmentsRepository.lockBatch('batch-1')).rejects.toThrow(/not linked to a confirmed member/);
    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('locks a complete placement without writing memberships', async () => {
    queuePlacementSnapshot('draft', [placed(1), placed(2)]);
    supabaseMock.queueResult('house_assignment_batches', { data: [{ id: 'batch-1' }], error: null });
    const preflight = await houseAssignmentsRepository.lockBatch('batch-1');
    expect(preflight.canLock).toBe(true);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('refuses to publish when persisted state exceeds a capacity, writing nothing', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: placementBatch('locked'), error: null });
    queuePlacementSnapshot('locked', [placed(1, { house_profile_id: 'p-toad', override_reason: 'moved' }), placed(2)]);
    await expect(houseAssignmentsRepository.publishBatch('batch-1', 'admin-1')).rejects.toThrow(/Cannot publish: Boo has 0 of 1 spots filled/);
    expect(membershipWrites()).toHaveLength(0);
    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
  });

  it('merges the database payment gate into preflight and refuses to lock a stale draft', async () => {
    queuePlacementSnapshot('draft', [placed(1), placed(2)]);
    supabaseMock.queueResult('rpc:house_batch_payment_blockers', {
      data: ['Payments changed since this sort. Rerun sorting with the current payment statuses.'],
      error: null,
    });
    await expect(houseAssignmentsRepository.lockBatch('batch-1')).rejects.toThrow(/Payments changed since this sort/);
    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
  });

  it('starts the Reveal through the payment gate and writes no membership when it refuses', async () => {
    const gated = { ...placementBatch('locked'), payment_cycle_id: 'cycle-1', eligibility_mode: 'final', payment_snapshot_version: 4 };
    supabaseMock.queueResult('house_assignment_batches', { data: gated, error: null });
    supabaseMock.queueResult('house_assignment_batches', { data: gated, error: null });
    supabaseMock.queueResult('house_assignment_drafts', { data: [placed(1), placed(2)], error: null });
    supabaseMock.queueResult('house_page_assets', { data: profiles, error: null });
    supabaseMock.queueResult('house_memberships', { data: [], error: null });
    supabaseMock.queueResult('rpc:house_batch_payment_blockers', { data: [], error: null });
    supabaseMock.queueResult('rpc:admin_begin_house_batch_publish', {
      data: null,
      error: { code: '23514', message: 'Payment eligibility blocks this Reveal: 1 included applicant(s) are not Paid or Waived, or were withdrawn.', details: '', hint: '' },
    });
    await expect(houseAssignmentsRepository.publishBatch('batch-1', 'admin-1')).rejects.toThrow(/not Paid or Waived/);
    expect(supabaseMock.queriesFor('rpc:admin_begin_house_batch_publish')).toHaveLength(1);
    expect(membershipWrites()).toHaveLength(0);
    expect(supabaseMock.usedMethod('house_assignment_batches', 'update')).toBe(false);
  });

  it('saves a rerun with its payment lineage', async () => {
    supabaseMock.queueResult('house_assignment_batches', { data: placementBatch('draft'), error: null });
    supabaseMock.queueResult('house_assignment_drafts', { data: null, error: null });
    await houseAssignmentsRepository.createBatch({
      academicYearStart: YEAR,
      effectiveStartDate: START,
      sourceLabel: 'Post-payment rerun',
      userId: 'admin-1',
      rows: [{ source_name: 'A', applicant_id: 'app-1', source_order: 0 }],
      placement: {
        capacityConfig: { 'p-boo': 1 },
        excludedApplicants: [{ source_row_number: 3, name: 'B', reason: 'Payment: unpaid (confirmed)' }],
        payment: { cycleId: 'cycle-1', eligibilityMode: 'final', snapshotVersion: 7, generationReason: 'post_payment_rerun', revisedFromBatchId: 'batch-0', fingerprint: 'v1-abc', summary: { included: 1, excluded: 1 } },
      },
    });
    const insert = supabaseMock.queriesFor('house_assignment_batches').flatMap((query) => query.calls).find((call) => call.method === 'insert');
    expect(insert?.args[0]).toMatchObject({
      assignment_method: 'timestamp_ranked',
      payment_cycle_id: 'cycle-1',
      eligibility_mode: 'final',
      payment_snapshot_version: 7,
      generation_reason: 'post_payment_rerun',
      revised_from_batch_id: 'batch-0',
      applicant_set_fingerprint: 'v1-abc',
    });
    const rows = supabaseMock.queriesFor('house_assignment_drafts').flatMap((query) => query.calls).find((call) => call.method === 'insert');
    expect(rows?.args[0]).toEqual([expect.objectContaining({ applicant_id: 'app-1', batch_id: 'batch-1' })]);
  });
});

describe('applyPlacementOverride', () => {
  const RPC = 'rpc:admin_apply_house_placement_override';
  const auto = (overrides: Partial<HouseAssignmentDraft> = {}) => draft(1, { generated_house_profile_id: 'p-toad', ...overrides });

  it('sends a swap as one RPC call and returns the rows the database updated', async () => {
    const updated = [auto({ house_profile_id: 'p-boo', override_reason: 'Approved' }), draft(2, { house_profile_id: 'p-toad' })];
    supabaseMock.queueResult(RPC, { data: updated, error: null });

    const rows = await houseAssignmentsRepository.applyPlacementOverride('batch-1', [
      { draftId: 'd1', houseProfileId: 'p-boo' },
      { draftId: 'd2', houseProfileId: 'p-toad' },
    ], 'Approved');

    expect(rows).toEqual(updated);
    expect(supabaseMock.queriesFor(RPC)).toHaveLength(1);
    expect(supabaseMock.queriesFor(RPC)[0].calls[0].args[0]).toEqual({
      p_batch_id: 'batch-1',
      p_changes: [{ draft_id: 'd1', house_profile_id: 'p-boo' }, { draft_id: 'd2', house_profile_id: 'p-toad' }],
      p_reason: 'Approved',
    });
    // No direct row writes, and never a membership write.
    expect(supabaseMock.usedMethod('house_assignment_drafts', 'update')).toBe(false);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('passes the database refusal through and changes nothing else', async () => {
    supabaseMock.queueResult(RPC, { data: null, error: { code: '23514', message: 'That House would have 3 applicants but its capacity is 2. Nothing was changed.' } });
    await expect(houseAssignmentsRepository.applyPlacementOverride('batch-1', [{ draftId: 'd1', houseProfileId: 'p-boo' }], 'x'))
      .rejects.toThrow('Nothing was changed.');
    expect(supabaseMock.usedMethod('house_assignment_drafts', 'update')).toBe(false);
  });

  it.each(['PGRST202', '42883'])('refuses a single move when the RPC is unavailable (%s), without reading or writing rows', async (code) => {
    supabaseMock.queueResult(RPC, { data: null, error: { code, message: 'Function unavailable' } });
    await expect(houseAssignmentsRepository.applyPlacementOverride('batch-1', [
      { draftId: 'd1', houseProfileId: 'p-boo' },
    ], 'Approved')).rejects.toThrow(/House placement changes are unavailable.*20261027120000.*Nothing was changed/);
    expect(supabaseMock.queriesFor('house_assignment_drafts')).toHaveLength(0);
    expect(supabaseMock.queriesFor('house_assignment_batches')).toHaveLength(0);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('refuses a swap when the RPC is unavailable, without recommending unvalidated single moves', async () => {
    supabaseMock.queueResult(RPC, { data: null, error: { code: 'PGRST202', message: 'Function unavailable' } });
    await expect(houseAssignmentsRepository.applyPlacementOverride('batch-1', [
      { draftId: 'd1', houseProfileId: 'p-boo' },
      { draftId: 'd2', houseProfileId: 'p-toad' },
    ], 'Approved')).rejects.toThrow(/House placement changes are unavailable.*20261027120000.*Nothing was changed/);
    expect(supabaseMock.queriesFor('house_assignment_drafts')).toHaveLength(0);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('sends a single move through the RPC without writing rows directly', async () => {
    const updated = [auto({ house_profile_id: 'p-boo', override_reason: 'Approved' })];
    supabaseMock.queueResult(RPC, { data: updated, error: null });
    await expect(houseAssignmentsRepository.applyPlacementOverride('batch-1', [
      { draftId: 'd1', houseProfileId: 'p-boo' },
    ], 'Approved')).resolves.toEqual(updated);
    expect(supabaseMock.queriesFor(RPC)).toHaveLength(1);
    expect(supabaseMock.queriesFor('house_assignment_drafts')).toHaveLength(0);
    expect(membershipWrites()).toHaveLength(0);
  });

  it('rejects an empty or oversized change list without calling the database', async () => {
    await expect(houseAssignmentsRepository.applyPlacementOverride('batch-1', [], null)).rejects.toThrow(/one row, or two/);
    expect(supabaseMock.queriesFor(RPC)).toHaveLength(0);
  });
});
