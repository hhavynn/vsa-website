import { supabaseMock } from '../../test-utils/supabaseMock';
import { UndoSpec } from '../../lib/adminActivity';
import { UndoConflictError, applyUndo } from './adminUndo';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('./adminActivity', () => ({ adminActivityRepository: { record: jest.fn() } }));

beforeEach(() => supabaseMock.reset());

const house: UndoSpec = { kind: 'house_draft_house', target: { batchId: 'b1', draftId: 'd1' }, before: 'boo', after: 'toad' };

describe('applyUndo is a database-level compare-and-set', () => {
  it('only matches while the column still holds the recorded value', async () => {
    supabaseMock.setDefault('house_assignment_drafts', { data: [{ id: 'd1' }], error: null });
    await applyUndo(house, 'boo');
    const filters = supabaseMock.filtersFor('house_assignment_drafts');
    expect(filters).toContainEqual(['id', 'd1']);
    expect(filters).toContainEqual(['batch_id', 'b1']);
    expect(filters).toContainEqual(['house_profile_id', 'toad']);
    const update = supabaseMock.queriesFor('house_assignment_drafts')[0].calls.find((call) => call.method === 'update');
    expect(update?.args[0]).toEqual({ house_profile_id: 'boo' });
  });

  it('fails, rather than overwriting, when another admin changed it first (no row matched)', async () => {
    supabaseMock.setDefault('house_assignment_drafts', { data: [], error: null });
    await expect(applyUndo(house, 'boo')).rejects.toBeInstanceOf(UndoConflictError);
  });

  it('treats a recorded empty value as IS NULL', async () => {
    supabaseMock.setDefault('ace_family_members', { data: [{ id: 'n1' }], error: null });
    await applyUndo({ kind: 'ace_node_link', target: { nodeId: 'n1' }, before: 'm0', after: null }, 'm0');
    const calls = supabaseMock.queriesFor('ace_family_members')[0].calls;
    expect(calls).toContainEqual({ method: 'is', args: ['member_id', null] });
  });

  it('rejects when more than one row would change', async () => {
    supabaseMock.setDefault('intern_cohort_drafts', { data: [{ id: 'a' }, { id: 'b' }], error: null });
    await expect(
      applyUndo({ kind: 'intern_mentor', target: { cycleId: 'c1', draftId: 'd1' }, before: null, after: 'm' }, null),
    ).rejects.toBeInstanceOf(UndoConflictError);
  });

  it('scopes the ACE Big undo to its draft and the recorded Big', async () => {
    supabaseMock.setDefault('ace_assignment_drafts', { data: [{ id: 'd1' }], error: null });
    await applyUndo({ kind: 'ace_draft_big', target: { draftId: 'd1' }, before: 'big-a', after: 'big-b' }, 'big-a');
    expect(supabaseMock.filtersFor('ace_assignment_drafts')).toEqual(expect.arrayContaining([['id', 'd1'], ['big_ace_member_id', 'big-b']]));
  });
});
