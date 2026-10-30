import { hasRevealedHouseMemberships } from './publicHouseLookup';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';
jest.mock('../../lib/supabase', () => ({
  get supabase() { return require('../../test-utils/supabaseMock').supabaseMock.client; },
}));
beforeEach(() => supabaseMock.reset());

it('checks a single row from the existing published, score-free House view for one academic year', async () => {
  supabaseMock.queueResult('public_house_memberships', { data: null, count: 1, error: null });
  expect(await hasRevealedHouseMemberships(2026)).toBe(true);
  const queries = supabaseMock.queries();
  expect(queries).toHaveLength(1);
  expect(queries[0].table).toBe('public_house_memberships');
  const calls = queries[0].calls;
  expect(calls.some((c) => c.method === 'select' && c.args[0] === 'member_id' && c.args[1]?.head === true && c.args[1]?.count === 'exact')).toBe(true);
  expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'academic_year_start' && c.args[1] === 2026)).toBe(true);
  expect(calls.some((c) => c.method === 'limit')).toBe(false);
  expect(JSON.stringify(calls)).not.toMatch(/house_yearly_points|house_member|points|email|draft|review_note|\*/);
});
it('hides the action before Reveal, not even treating zero returned memberships as an assignment', async () => {
  supabaseMock.queueResult('public_house_memberships', { data: null, count: 0, error: null });
  await expect(hasRevealedHouseMemberships(2026)).resolves.toBe(false);
});
it('does not disguise a denied public view read as approved Reveal', async () => {
  supabaseMock.queueResult('public_house_memberships', { data: null, error: postgrestError('permission denied', '42501') });
  await expect(hasRevealedHouseMemberships(2026)).rejects.toThrow();
});
