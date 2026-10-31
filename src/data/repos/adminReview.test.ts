import { adminReviewRepository } from './adminReview';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const ids = (count: number) => Array.from({ length: count }, (_, i) => 'synthetic-id-' + i);

describe('admin-only draft review marks (#291)', () => {
  it('never queries on empty IDs and returns the actual empty states', async () => {
    await expect(adminReviewRepository.listReviewed('ace_assignment_draft', [])).resolves.toEqual(new Set());
    await expect(adminReviewRepository.mark('ace_assignment_draft', [], 2026)).resolves.toBe(0);
    await expect(adminReviewRepository.unmark('ace_assignment_draft', [])).resolves.toBeUndefined();
    expect(supabaseMock.queries()).toHaveLength(0);
  });

  it('scopes reads to exact entity type and chunks more than 100 IDs', async () => {
    const wanted = ids(101);
    supabaseMock.queueResult('admin_review_marks', {
      data: [{ entity_id: wanted[0] }, { entity_id: wanted[1] }], error: null,
    });
    supabaseMock.queueResult('admin_review_marks', {
      data: [{ entity_id: wanted[100] }, { entity_id: wanted[0] }], error: null,
    });
    await expect(adminReviewRepository.listReviewed('cabinet_roster_draft', wanted))
      .resolves.toEqual(new Set([wanted[0], wanted[1], wanted[100]]));
    const q = supabaseMock.queriesFor('admin_review_marks');
    expect(q).toHaveLength(2);
    for (const query of q) {
      expect(query.calls).toContainEqual({ method: 'select', args: ['entity_id'] });
      expect(query.calls).toContainEqual({ method: 'eq', args: ['entity_type', 'cabinet_roster_draft'] });
    }
    expect(q[0].calls).toContainEqual({ method: 'in', args: ['entity_id', wanted.slice(0, 100)] });
    expect(q[1].calls).toContainEqual({ method: 'in', args: ['entity_id', wanted.slice(100)] });
    expect(supabaseMock.queriesFor('ace_assignment_drafts')).toHaveLength(0);
  });

  it('leaves a genuine empty published review set as empty', async () => {
    supabaseMock.setDefault('admin_review_marks', { data: [], error: null });
    await expect(adminReviewRepository.listReviewed('intern_cohort_draft', ['fictional-id']))
      .resolves.toEqual(new Set());
  });

  it('writes only advisory reviewed marks, with do-not-overwrite semantics', async () => {
    supabaseMock.setDefault('admin_review_marks', { data: null, error: null });
    const wanted = ids(101);
    await expect(adminReviewRepository.mark('house_assignment_draft', wanted, 2026)).resolves.toBe(101);
    const q = supabaseMock.queriesFor('admin_review_marks');
    expect(q).toHaveLength(2);
    for (const query of q) {
      expect(query.calls.find((c) => c.method === 'upsert')?.args[1]).toEqual({
        onConflict: 'entity_type,entity_id', ignoreDuplicates: true,
      });
    }
    const first = q[0].calls.find((c) => c.method === 'upsert')?.args[0] as Record<string, unknown>[];
    const second = q[1].calls.find((c) => c.method === 'upsert')?.args[0] as Record<string, unknown>[];
    expect(first).toHaveLength(100);
    expect(second).toHaveLength(1);
    expect(first[0]).toEqual({
      entity_type: 'house_assignment_draft', entity_id: wanted[0], academic_year_start: 2026,
    });
    expect(second[0].entity_id).toBe(wanted[100]);
    expect(supabaseMock.queriesFor('house_assignment_drafts')).toHaveLength(0);
  });

  it('removes only exact entity ids for the requested draft type', async () => {
    await adminReviewRepository.unmark('ace_assignment_draft', ['fictional-id']);
    const q = supabaseMock.queriesFor('admin_review_marks');
    expect(q).toHaveLength(1);
    expect(q[0].calls).toContainEqual({ method: 'delete', args: [] });
    expect(q[0].calls).toContainEqual({ method: 'eq', args: ['entity_type', 'ace_assignment_draft'] });
    expect(q[0].calls).toContainEqual({ method: 'in', args: ['entity_id', ['fictional-id']] });
  });

  it('fails whole read on later-page denied, rather than returning partial marks', async () => {
    const wanted = ids(101);
    supabaseMock.queueResult('admin_review_marks', {
      data: [{ entity_id: wanted[0] }], error: null,
    });
    supabaseMock.queueResult('admin_review_marks', {
      data: null, error: postgrestError('synthetic RLS denied', '42501'),
    });
    await expect(adminReviewRepository.listReviewed('ace_assignment_draft', wanted))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
  });

  it('propagates a later mark/unmark failure (writes are not claimed atomic)', async () => {
    supabaseMock.queueResult('admin_review_marks', { data: null, error: null });
    supabaseMock.queueResult('admin_review_marks', {
      data: null, error: postgrestError('synthetic denied', '42501'),
    });
    await expect(adminReviewRepository.mark('cabinet_roster_draft', ids(101), null))
      .rejects.toMatchObject({ code: '42501' });
    supabaseMock.queueResult('admin_review_marks', {
      data: null, error: postgrestError('synthetic denied', '42501'),
    });
    await expect(adminReviewRepository.unmark('cabinet_roster_draft', ['id']))
      .rejects.toMatchObject({ code: '42501' });
  });
});
