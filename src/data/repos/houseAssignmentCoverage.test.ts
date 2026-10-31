import { getCompleteHouseBatchCoverage, getRevealedHouseBatches } from './houseAssignmentCoverage';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('requests applicant identity and source_house with stable paging (#621)', async () => {
  supabaseMock.queueResult('house_assignment_drafts', { data: [], error: null });
  await getCompleteHouseBatchCoverage('fictional-batch');
  const selects = supabaseMock.queriesFor('house_assignment_drafts')[0].calls
    .filter((call) => call.method === 'select').map((call) => String(call.args[0]));
  expect(selects).toEqual(['id,member_id,house_profile_id,applicant_id,source_house,source_name,source_order,match_status']);
});

it('includes formerly revealed archived batches with the published-at filter', async () => {
  supabaseMock.queueResult('house_assignment_batches', {
    data: [{ id: 'fictional-archived', published_at: '2026-11-12T00:00:00Z', status: 'archived' }],
    error: null,
  });
  const batches = await getRevealedHouseBatches(2026);
  expect(batches[0].id).toBe('fictional-archived');
  const calls = supabaseMock.queriesFor('house_assignment_batches')[0].calls;
  expect(calls).toContainEqual({ method: 'eq', args: ['academic_year_start', 2026] });
  expect(calls).toContainEqual({ method: 'not', args: ['published_at', 'is', null] });
  expect(calls).toContainEqual({ method: 'range', args: [0, 499] });
});

it('rejects the entire archived-batch read when a later page errors', async () => {
  supabaseMock.queueResult('house_assignment_batches', {
    data: Array.from({ length: 500 }, (_, index) => ({ id: 'fictional-' + index })), error: null,
  });
  supabaseMock.queueResult('house_assignment_batches', {
    data: null, error: { message: 'synthetic page failure', code: 'P0001', details: 'synthetic transaction error' },
  });
  await expect(getRevealedHouseBatches(2026))
    .rejects.toMatchObject({ message: 'synthetic page failure' });
  const queries = supabaseMock.queriesFor('house_assignment_batches');
  expect(queries).toHaveLength(2);
  expect(queries[1].calls).toContainEqual({ method: 'range', args: [500, 999] });
});
