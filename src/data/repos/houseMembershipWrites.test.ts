/**
 * Characterization of the EXISTING protected House writer (#291).
 * Never calls Supabase: recording mock validates exactly which tables could be
 * written and refuses to turn a failed write into a successful Reveal.
 */
import {
  houseMembershipsWriteRepository,
  type ApplyHouseMembershipInput,
} from './houseMembershipWrites';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const INPUT: ApplyHouseMembershipInput = {
  memberId: 'fictional-member', houseProfileId: 'fictional-house-new',
  houseCacheLabel: 'Fictional House', academicYearStart: 2026,
  effectiveStartDate: '2026-11-08', source: 'house_assignment_batch',
  sourceImportId: 'fictional-approved-batch', notes: 'Synthetic test note',
  userId: 'fictional-admin', memberLabel: 'Example Student',
};

const old = {
  id: 'old-membership', house_profile_id: 'fictional-house-old',
  effective_start_date: '2026-09-20', effective_end_date: null,
};
const later = {
  id: 'later-membership', house_profile_id: 'fictional-house-later',
  effective_start_date: '2027-01-12', effective_end_date: null,
};
const writes = (table: string) => supabaseMock.queriesFor(table).flatMap(q =>
  q.calls.filter(c => ['insert', 'update', 'delete', 'upsert'].includes(c.method)));

beforeEach(() => supabaseMock.reset());

describe('House membership write repository (#291)', () => {
  it('pages all current-year membership rows and groups canonical IDs without guessing from names', async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({
      id: 'row-' + i, member_id: 'fictional-' + (i % 2),
      house_profile_id: 'fictional-house', effective_start_date: '2026-09-01',
      effective_end_date: null,
    }));
    supabaseMock.queueResult('house_memberships', { data: first, error: null });
    supabaseMock.queueResult('house_memberships', { data: [{
      id: 'row-1000', member_id: 'fictional-2',
      house_profile_id: 'fictional-house', effective_start_date: '2026-09-01',
      effective_end_date: null,
    }], error: null });
    const result = await houseMembershipsWriteRepository.listMembershipsForYear(2026);
    expect([...result.keys()].sort()).toEqual(['fictional-0', 'fictional-1', 'fictional-2']);
    expect(result.get('fictional-0')).toHaveLength(500);
    expect(result.get('fictional-1')).toHaveLength(500);
    expect(result.get('fictional-2')).toEqual([{
      id: 'row-1000', house_profile_id: 'fictional-house',
      effective_start_date: '2026-09-01', effective_end_date: null,
    }]);
    const q = supabaseMock.queriesFor('house_memberships');
    expect(q).toHaveLength(2);
    expect(q.map(x => x.calls.find(c => c.method === 'range')?.args))
      .toEqual([[0, 999], [1000, 1999]]);
    for (const item of q) {
      expect(item.calls).toContainEqual({ method: 'eq', args: ['academic_year_start', 2026] });
      expect(item.calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
      expect(item.calls).toContainEqual({
        method: 'select',
        args: ['id, member_id, house_profile_id, effective_start_date, effective_end_date'],
      });
    }
    expect(writes('house_memberships')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('returns a genuine empty map, but refuses an error on the later page', async () => {
    supabaseMock.setDefault('house_memberships', { data: [], error: null });
    await expect(houseMembershipsWriteRepository.listMembershipsForYear(2026)).resolves.toEqual(new Map());
    supabaseMock.reset();
    supabaseMock.queueResult('house_memberships', { data: Array.from({ length: 1000 }, (_, i) => ({
      id: 'row-' + i, member_id: 'fictional-member',
      house_profile_id: 'house', effective_start_date: '2026-09-01', effective_end_date: null,
    })), error: null });
    supabaseMock.queueResult('house_memberships', {
      data: null, error: postgrestError('synthetic read denied', '42501'),
    });
    await expect(houseMembershipsWriteRepository.listMembershipsForYear(2026))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
  });

  it('skips existing same-day House without writing the row or cached label', async () => {
    await expect(houseMembershipsWriteRepository.applyMembership({
      ...INPUT, existingMemberships: [{
        id: 'existing', house_profile_id: INPUT.houseProfileId,
        effective_start_date: INPUT.effectiveStartDate, effective_end_date: null,
      }],
    })).resolves.toBe('skipped');
    expect(supabaseMock.queries()).toHaveLength(0);
  });

  it('rejects a different House starting on the same date, never changes cache or membership', async () => {
    await expect(houseMembershipsWriteRepository.applyMembership({
      ...INPUT, existingMemberships: [{
        id: 'existing', house_profile_id: 'fictional-different',
        effective_start_date: INPUT.effectiveStartDate, effective_end_date: null,
      }],
    })).rejects.toMatchObject({ name: 'ValidationError', field: 'house_memberships' });
    expect(supabaseMock.queries()).toHaveLength(0);
  });

  it('rejects an overlapping historical interval without any writes', async () => {
    await expect(houseMembershipsWriteRepository.applyMembership({
      ...INPUT, existingMemberships: [{
        id: 'existing', house_profile_id: 'fictional-other',
        effective_start_date: '2026-10-01', effective_end_date: '2026-12-01',
      }],
    })).rejects.toThrow(/overlaps/);
    expect(supabaseMock.queries()).toHaveLength(0);
  });

  it('closes exactly the old open interval, inserts a bounded one, then updates the cache', async () => {
    const result = await houseMembershipsWriteRepository.applyMembership({
      ...INPUT, existingMemberships: [old, later],
    });
    expect(result).toBe('applied');
    const q = supabaseMock.queriesFor('house_memberships');
    expect(q).toHaveLength(2);
    expect(q[0].calls).toContainEqual({ method: 'in', args: ['id', ['old-membership']] });
    const close = q[0].calls.find(c => c.method === 'update')?.args[0] as Record<string, unknown>;
    expect(close).toMatchObject({
      effective_end_date: '2026-11-08', updated_by: 'fictional-admin',
      updated_at: expect.any(String),
    });
    const insert = q[1].calls.find(c => c.method === 'insert')?.args[0];
    expect(insert).toEqual({
      member_id: 'fictional-member', house_profile_id: 'fictional-house-new',
      academic_year_start: 2026, academic_year_end: 2027,
      effective_start_date: '2026-11-08', effective_end_date: '2027-01-12',
      source: 'house_assignment_batch', source_import_id: 'fictional-approved-batch',
      notes: 'Synthetic test note', created_by: 'fictional-admin', updated_by: 'fictional-admin',
    });
    const cache = supabaseMock.queriesFor('members');
    expect(cache).toHaveLength(1);
    expect(cache[0].calls).toContainEqual({ method: 'eq', args: ['id', 'fictional-member'] });
    expect(cache[0].calls.find(c => c.method === 'update')?.args[0]).toEqual({
      house: 'Fictional House', updated_at: close.updated_at,
    });
    expect(writes('house_assignment_batches')).toHaveLength(0);
    expect(supabaseMock.queriesFor('member_yearly_points')).toHaveLength(0);
  });

  it('fetches membership scoped to exact canonical member ID/year if history not provided', async () => {
    supabaseMock.queueResult('house_memberships', { data: [old], error: null });
    await expect(houseMembershipsWriteRepository.applyMembership(INPUT)).resolves.toBe('applied');
    const read = supabaseMock.queriesFor('house_memberships')[0];
    expect(read.calls).toContainEqual({
      method: 'select', args: ['id, house_profile_id, effective_start_date, effective_end_date'],
    });
    expect(read.calls).toContainEqual({ method: 'eq', args: ['member_id', 'fictional-member'] });
    expect(read.calls).toContainEqual({ method: 'eq', args: ['academic_year_start', 2026] });
    expect(supabaseMock.queriesFor('members')[0].calls)
      .toContainEqual({ method: 'eq', args: ['id', 'fictional-member'] });
  });

  it('fails on the initial scoped read without writing anything', async () => {
    supabaseMock.queueResult('house_memberships', {
      data: null, error: postgrestError('synthetic denied', '42501'),
    });
    await expect(houseMembershipsWriteRepository.applyMembership(INPUT))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(writes('house_memberships')).toHaveLength(0);
    expect(writes('members')).toHaveLength(0);
  });

  it('does not insert if the close write fails, and never updates cache', async () => {
    supabaseMock.queueResult('house_memberships', {
      data: null, error: postgrestError('synthetic close denied', '42501'),
    });
    await expect(houseMembershipsWriteRepository.applyMembership({
      ...INPUT, existingMemberships: [old],
    })).rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(writes('house_memberships').map(c => c.method)).toEqual(['update']);
    expect(writes('members')).toHaveLength(0);
  });

  it('does not update the legacy cache when membership insert is refused', async () => {
    supabaseMock.queueResult('house_memberships', {
      data: null, error: postgrestError('synthetic insert denied', '42501'),
    });
    await expect(houseMembershipsWriteRepository.applyMembership({
      ...INPUT, existingMemberships: [],
    })).rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(writes('house_memberships').map(c => c.method)).toEqual(['insert']);
    expect(writes('members')).toHaveLength(0);
  });

  it('reports a legacy cache failure rather than falsely claiming placement success', async () => {
    supabaseMock.queueResult('members', {
      data: null, error: postgrestError('synthetic cache denied', '42501'),
    });
    await expect(houseMembershipsWriteRepository.applyMembership({
      ...INPUT, existingMemberships: [],
    })).rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(writes('house_memberships')).toHaveLength(1);
    expect(writes('members')).toHaveLength(1);
    // Existing sequential writer is not an all-or-nothing database transaction.
    // Do not call this rollback-proof or allow tests to imply that it is.
  });
});
