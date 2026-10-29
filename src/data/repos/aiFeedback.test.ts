import { aiFeedbackRepository } from './aiFeedback';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('aiFeedbackRepository query and write boundaries (#291)', () => {
  it('records only the bounded excerpt and trimmed feedback and never leaks a full answer', async () => {
    supabaseMock.queueResult('ai_feedback', { data: null, error: null });
    await aiFeedbackRepository.submitFeedback({
      rating: 'not_helpful',
      feedback_text: '   Missing context   ',
      answer_excerpt: ' ' + 'a'.repeat(220) + ' ',
      page_path: '/events',
    });
    const payload = supabaseMock.queriesFor('ai_feedback')[0].calls.find(c => c.method === 'insert')?.args[0];
    expect(payload).toEqual({
      rating: 'not_helpful',
      category: null,
      page_path: '/events',
      feedback_text: 'Missing context',
      answer_excerpt: 'a'.repeat(150),
    });
  });

  it('rejects invalid ratings and oversized text before any database write', async () => {
    await expect(aiFeedbackRepository.submitFeedback({
      rating: 'unknown' as 'helpful',
    })).rejects.toThrow('Valid rating is required');
    await expect(aiFeedbackRepository.submitFeedback({
      rating: 'helpful', feedback_text: 'x'.repeat(1001),
    })).rejects.toThrow('Feedback text is too long');
    expect(supabaseMock.queriesFor('ai_feedback')).toHaveLength(0);
  });

  it('reads newest-first, returns empty arrays, and applies admin filters', async () => {
    supabaseMock.queueResult('ai_feedback', { data: [], error: null });
    await expect(aiFeedbackRepository.listAdminFeedback()).resolves.toEqual([]);
    expect(supabaseMock.queriesFor('ai_feedback')[0].calls).toContainEqual({
      method: 'order', args: ['created_at', { ascending: false }],
    });

    supabaseMock.queueResult('ai_feedback', { data: [{ id: 'feedback-1' }], error: null });
    await expect(aiFeedbackRepository.listAdminFeedback({
      status: 'unresolved', rating: 'not_helpful',
    })).resolves.toEqual([{ id: 'feedback-1' }]);
    const filteredCalls = supabaseMock.queriesFor('ai_feedback')[1].calls;
    expect(filteredCalls).toEqual(expect.arrayContaining([
      { method: 'is', args: ['resolved_at', null] },
      { method: 'eq', args: ['rating', 'not_helpful'] },
    ]));
  });

  it('preserves PostgREST errors instead of returning an empty admin inbox', async () => {
    supabaseMock.queueResult('ai_feedback', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(aiFeedbackRepository.listAdminFeedback()).rejects.toMatchObject({
      name: 'DatabaseError', message: 'Failed to fetch AI feedback: permission denied',
    });
  });

  it('scopes resolution and notes updates to the selected row and trims notes', async () => {
    supabaseMock.queueResult('ai_feedback', { data: null, error: null });
    supabaseMock.queueResult('ai_feedback', { data: null, error: null });
    await aiFeedbackRepository.markResolved('feedback-1');
    await aiFeedbackRepository.updateAdminNotes('feedback-1', '  Reviewed by cabinet  ');
    const queries = supabaseMock.queriesFor('ai_feedback');
    expect(queries).toHaveLength(2);
    expect(supabaseMock.filtersFor('ai_feedback')).toEqual([
      ['id', 'feedback-1'], ['id', 'feedback-1'],
    ]);
    expect(queries[0].calls.find(c => c.method === 'update')?.args[0]).toEqual({
      resolved_at: expect.any(String),
    });
    expect(queries[1].calls.find(c => c.method === 'update')?.args[0]).toEqual({
      admin_notes: 'Reviewed by cabinet',
    });
  });
});
