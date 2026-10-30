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
