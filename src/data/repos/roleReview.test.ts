import { listCabinetRoleReviewSources } from './roleReview';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('reads only the six published Cabinet fields within the selected year and never any drafts', async () => {
  supabaseMock.setDefault('cabinet_members', { data: [{
    id: 'role-one',
    name: 'Ada Example',
    role: 'Events Chair',
    category: 'General Board',
    member_id: null,
    cabinet_year_id: 'year-2026',
  }], error: null });

  const rows = await listCabinetRoleReviewSources('year-2026');
  expect(rows).toHaveLength(1);
  const [request] = supabaseMock.queriesFor('cabinet_members');
  expect(request.calls).toContainEqual({ method: 'select', args: ['id, name, role, category, member_id, cabinet_year_id'] });
  expect(request.calls).toContainEqual({ method: 'eq', args: ['cabinet_year_id', 'year-2026'] });
  expect(request.calls).toContainEqual({ method: 'range', args: [0, 499] });
  expect(supabaseMock.queriesFor('cabinet_roster_drafts')).toHaveLength(0);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('continues after 500 published role rows instead of treating the page cap as complete', async () => {
  const item = (i: number) => ({
    id: 'role-' + i, name: 'Fictional ' + i, role: 'General Chair',
    category: 'General Board', member_id: null, cabinet_year_id: 'year-2026',
  });
  supabaseMock.queueResult('cabinet_members', { data: Array.from({ length: 500 }, (_, i) => item(i)), error: null });
  supabaseMock.queueResult('cabinet_members', { data: [item(500)], error: null });
  const result = await listCabinetRoleReviewSources('year-2026');
  expect(result).toHaveLength(501);
  expect(result[500].id).toBe('role-500');
  const ranges = supabaseMock.queriesFor('cabinet_members').flatMap((query) => query.calls).filter((call) => call.method === 'range');
  expect(ranges).toEqual([{ method: 'range', args: [0, 499] }, { method: 'range', args: [500, 999] }]);
});

it('never makes an unrelated academic-year role available for linking', async () => {
  supabaseMock.queueResult('cabinet_members', { data: [{
    id: 'other-year-row', name: 'Fictional Officer', role: 'President',
    category: 'Executive Board', member_id: null, cabinet_year_id: 'year-2025',
  }], error: null });
  await expect(listCabinetRoleReviewSources('year-2026'))
    .rejects.toThrow(/incomplete or inconsistent/);
  expect(supabaseMock.filtersFor('cabinet_members')).toContainEqual(['cabinet_year_id', 'year-2026']);
});

it('fails closed on duplicate source IDs across pages rather than picking the first match', async () => {
  const item = (i: number) => ({
    id: 'role-' + i, name: 'Fictional ' + i, role: 'Chair',
    category: 'General Board', member_id: null, cabinet_year_id: 'year-2026',
  });
  supabaseMock.queueResult('cabinet_members', {
    data: Array.from({ length: 500 }, (_, i) => item(i)), error: null,
  });
  supabaseMock.queueResult('cabinet_members', { data: [item(499)], error: null });
  await expect(listCabinetRoleReviewSources('year-2026'))
    .rejects.toThrow(/incomplete or inconsistent/);
  expect(supabaseMock.queriesFor('cabinet_members')).toHaveLength(2);
});

it('rejects an incomplete second-page permission response instead of returning the first 500', async () => {
  const base = {
    name: 'Fictional Member', role: 'Chair', category: 'General Board',
    member_id: null, cabinet_year_id: 'year-2026',
  };
  supabaseMock.queueResult('cabinet_members', {
    data: Array.from({ length: 500 }, (_, i) => ({ ...base, id: 'role-' + i })), error: null,
  });
  supabaseMock.queueResult('cabinet_members', {
    data: null, error: { message: 'synthetic permission denied', code: '42501', details: '', hint: '' },
  });
  await expect(listCabinetRoleReviewSources('year-2026'))
    .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
});

it('refuses null, malformed and over-limit pages rather than treating them as zero matches', async () => {
  supabaseMock.queueResult('cabinet_members', { data: null, error: null });
  await expect(listCabinetRoleReviewSources('year-2026')).rejects.toThrow(/invalid page/);

  supabaseMock.queueResult('cabinet_members', { data: [{ id: 'no-year' }], error: null });
  await expect(listCabinetRoleReviewSources('year-2026'))
    .rejects.toThrow(/incomplete or inconsistent/);

  const item = (i: number) => ({
    id: 'role-' + i, name: 'Fictional ' + i, role: 'Chair',
    category: 'General Board', member_id: null, cabinet_year_id: 'year-2026',
  });
  supabaseMock.queueResult('cabinet_members', {
    data: Array.from({ length: 501 }, (_, i) => item(i)), error: null,
  });
  await expect(listCabinetRoleReviewSources('year-2026'))
    .rejects.toThrow(/invalid page/);
});

it('does not query private rows without an explicit selected Cabinet year', async () => {
  await expect(listCabinetRoleReviewSources('')).resolves.toEqual([]);
  expect(supabaseMock.queries()).toHaveLength(0);
});
