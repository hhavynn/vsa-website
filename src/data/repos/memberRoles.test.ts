import { getPublicMemberRoles, getPublishedBoardMemberIds } from './memberRoles';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const year = { id: 'cabinet-year-2026' };
const roles = [
  { id: 'role-1', member_id: 'verified-1', role: 'Events Chair', category: 'General Board' },
  { id: 'role-2', member_id: 'verified-2', role: 'Intern', category: 'Interns' },
  { id: 'role-3', member_id: null, role: 'President', category: 'Executive Board' },
];

describe('bounded public role-source reads (#623/#627)', () => {
  it('reads exactly one year and one batched Cabinet query with minimal public fields', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: roles, error: null });
    const result = await getPublicMemberRoles(2026, ['verified-2', 'verified-1', 'verified-2']);

    expect(result.get('verified-1')?.map((role) => role.label)).toEqual(['Board Member', 'Events Chair']);
    expect(result.get('verified-2')?.map((role) => role.label)).toEqual(['Intern']);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['cabinet_years', 'cabinet_members']);
    expect(supabaseMock.filtersFor('cabinet_years')).toEqual([['start_year', 2026]]);
    expect(supabaseMock.filtersFor('cabinet_members')).toEqual([['cabinet_year_id', year.id]]);

    const members = supabaseMock.queriesFor('cabinet_members')[0].calls;
    expect(members.find((call) => call.method === 'select')?.args[0]).toBe('id, member_id, role, category');
    expect(members.find((call) => call.method === 'in')?.args).toEqual([
      'member_id', ['verified-1', 'verified-2'],
    ]);
    expect(members.some((call) => call.method === 'limit' && call.args[0] === 501)).toBe(true);
    expect(JSON.stringify(members)).not.toMatch(/email|draft|review_note|house_member_yearly_points|\*/);
  });

  it('returns no roles without a Cabinet year or selected IDs; never guesses from legacy yearless Cabinet entries', async () => {
    expect(await getPublicMemberRoles(2026, [])).toEqual(new Map());
    expect(supabaseMock.queries()).toHaveLength(0);
    supabaseMock.queueResult('cabinet_years', { data: [], error: null });
    expect(await getPublicMemberRoles(2026, ['verified-1'])).toEqual(new Map());
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('fails closed on an ambiguous Cabinet year instead of presenting mismatched historical roles', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year, { id: 'duplicate' }], error: null });
    await expect(getPublicMemberRoles(2026, ['verified-1'])).rejects.toThrow();
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
  });

  it('propagates public permission failures without suppressing the independently fetched leaderboard', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(getPublicMemberRoles(2026, ['verified-1'])).rejects.toThrow();
    expect(supabaseMock.queriesFor('member_yearly_points')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('supports the existing 100-row and Show All pagination with bounded batches rather than N+1', async () => {
    const visibleIds = Array.from({ length: 153 }, (_, i) => `member-${String(i).padStart(3, '0')}`);
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    for (let chunk = 0; chunk < 4; chunk += 1) {
      supabaseMock.queueResult('cabinet_members', {
        data: [roles[0]], error: null,
      });
    }
    const result = await getPublicMemberRoles(2026, visibleIds);
    expect(result.get('verified-1')).toBeUndefined();
    const queryBatches = supabaseMock.queriesFor('cabinet_members');
    expect(queryBatches).toHaveLength(4);
    queryBatches.forEach((query, index) => {
      const batch = query.calls.find((call) => call.method === 'in')?.args[1] as string[];
      expect(batch).toEqual(visibleIds.slice(index * 50, (index + 1) * 50));
      expect(batch.length).toBeLessThanOrEqual(50);
      expect(query.calls.find((call) => call.method === 'select')?.args[0]).toBe('id, member_id, role, category');
    });
    expect(supabaseMock.queriesFor('cabinet_years')).toHaveLength(1);
  });

  it('rejects unbounded enumeration rather than querying all member roles', async () => {
    const beyondVisible = Array.from({ length: 2001 }, (_, i) => `member-${i}`);
    await expect(getPublicMemberRoles(2026, beyondVisible)).rejects.toThrow(/visible-member limit/);
    expect(supabaseMock.queries()).toHaveLength(0);
  });
});


describe('published Board cohort read (#628)', () => {
  it('reads only canonical linked Board IDs and excludes intern-only and unlinked officers', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: [
      { id: 'r1', member_id: 'member-board', category: 'Executive Board' },
      { id: 'r2', member_id: 'member-board', category: 'General Board' },
      { id: 'r3', member_id: 'intern-only', category: 'Interns' },
      { id: 'r4', member_id: null, category: 'Executive Board' },
    ], error: null });
    await expect(getPublishedBoardMemberIds(2026)).resolves.toEqual(new Set(['member-board']));
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['cabinet_years', 'cabinet_members']);
    const reads = supabaseMock.queriesFor('cabinet_members')[0].calls;
    expect(reads).toContainEqual({ method: 'select', args: ['id, member_id, category'] });
    expect(reads).toContainEqual({ method: 'eq', args: ['cabinet_year_id', year.id] });
    expect(reads).toContainEqual({ method: 'range', args: [0, 499] });
    expect(JSON.stringify(reads)).not.toMatch(/name|email|draft|house_member|attendance|points|\*/);
  });

  it('fails closed when an academic year or published Board roster is unavailable', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [], error: null });
    await expect(getPublishedBoardMemberIds(2026)).rejects.toThrow();
    expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(0);
    supabaseMock.reset();
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: [{ id: 'i1', member_id: 'intern', category: 'Interns' }], error: null });
    await expect(getPublishedBoardMemberIds(2026)).rejects.toThrow(/not yet available/);
  });

  it('paginates the public roster after 500 rows without arbitrary classifications', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    const make = (index: number) => ({ id: 'r-' + index, member_id: 'member-' + index, category: 'General Board' });
    supabaseMock.queueResult('cabinet_members', { data: Array.from({ length: 500 }, (_, i) => make(i)), error: null });
    supabaseMock.queueResult('cabinet_members', { data: [make(500)], error: null });
    const result = await getPublishedBoardMemberIds(2026);
    expect(result.size).toBe(501);
    const ranges = supabaseMock.queriesFor('cabinet_members').flatMap(q => q.calls).filter(c => c.method === 'range');
    expect(ranges).toEqual([{ method: 'range', args: [0, 499] }, { method: 'range', args: [500, 999] }]);
  });

  it('does not silently classify after an RLS/permissions failure', async () => {
    supabaseMock.queueResult('cabinet_years', { data: [year], error: null });
    supabaseMock.queueResult('cabinet_members', { data: null, error: postgrestError('permission denied', '42501') });
    await expect(getPublishedBoardMemberIds(2026)).rejects.toThrow();
    expect(supabaseMock.queriesFor('member_yearly_points')).toHaveLength(0);
  });
});
