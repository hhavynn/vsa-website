import { ACTIVITY_ACTIONS, ActivityEntry, buildUndoMetadata } from '../../lib/adminActivity';
import { UndoDeps, undoActivity } from './adminUndo';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('./aceAssignments', () => ({ aceAssignmentsRepository: {} }));
jest.mock('./aceFamilies', () => ({ aceFamiliesRepository: {} }));
jest.mock('./houseAssignments', () => ({ houseAssignmentsRepository: {} }));
jest.mock('./internCohort', () => ({ internCohortRepository: {} }));
jest.mock('./adminActivity', () => ({ adminActivityRepository: { record: jest.fn() } }));

const NOW = Date.parse('2026-10-02T12:00:00Z');

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 'e1',
  actorUserId: 'u',
  action: ACTIVITY_ACTIONS.houseAssignmentChanged,
  entityType: 'house_assignment_draft',
  entityId: 'd1',
  academicYearStart: 2026,
  summary: "Changed Kevin's House: Boo → Toad",
  metadata: buildUndoMetadata({ kind: 'house_draft_house', target: { batchId: 'b1', draftId: 'd1' }, before: 'boo', after: 'toad' }),
  createdAt: '2026-10-02T11:00:00Z',
  ...overrides,
});

function makeDeps(state: { found: boolean; value: string | null; editable: boolean }): jest.Mocked<UndoDeps> {
  return {
    now: jest.fn(() => NOW),
    readState: jest.fn().mockResolvedValue(state),
    apply: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue('log-2'),
  };
}

describe('undoActivity', () => {
  it('restores the previous value and records the undo as its own entry', async () => {
    const deps = makeDeps({ found: true, value: 'toad', editable: true });
    const result = await undoActivity(entry(), { deps });
    expect(result).toEqual({ ok: true });
    expect(deps.apply).toHaveBeenCalledWith(expect.objectContaining({ kind: 'house_draft_house' }), 'boo');
    expect(deps.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'house.assignment_undone', metadata: { undoes: 'e1' } }));
  });

  it('refuses, and changes nothing, when the value moved on since', async () => {
    const deps = makeDeps({ found: true, value: 'frog', editable: true });
    const result = await undoActivity(entry(), { deps });
    expect(result.ok).toBe(false);
    expect(deps.apply).not.toHaveBeenCalled();
    expect(deps.record).not.toHaveBeenCalled();
  });

  it('refuses when the batch is no longer a draft', async () => {
    const deps = makeDeps({ found: true, value: 'toad', editable: false });
    expect((await undoActivity(entry(), { deps })).ok).toBe(false);
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it('never undoes a publication, even if an undo block is attached', async () => {
    const deps = makeDeps({ found: true, value: 'toad', editable: true });
    const result = await undoActivity(entry({ action: ACTIVITY_ACTIONS.houseBatchPublished }), { deps });
    expect(result.ok).toBe(false);
    expect(deps.readState).not.toHaveBeenCalled();
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it('does not undo the same change twice', async () => {
    const deps = makeDeps({ found: true, value: 'toad', editable: true });
    const result = await undoActivity(entry(), { deps, undoneIds: new Set(['e1']) });
    expect(result.ok).toBe(false);
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it('reports a failed apply without recording an undo', async () => {
    const deps = makeDeps({ found: true, value: 'toad', editable: true });
    deps.apply.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await undoActivity(entry(), { deps });
    expect(result.ok).toBe(false);
    expect(deps.record).not.toHaveBeenCalled();
  });

  it('survives a failure to read the current value', async () => {
    const deps = makeDeps({ found: true, value: 'toad', editable: true });
    deps.readState.mockRejectedValue(new Error('network'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await undoActivity(entry(), { deps });
    expect(result).toEqual({ ok: false, reason: 'Could not check the current value. Nothing was changed.' });
    expect(deps.apply).not.toHaveBeenCalled();
  });
});

describe('undoActivity when the write loses the race', () => {
  it('reports the conflict and records nothing', async () => {
    const { UndoConflictError } = jest.requireActual('./adminUndo');
    const deps = makeDeps({ found: true, value: 'toad', editable: true });
    deps.apply.mockRejectedValue(new UndoConflictError());
    const result = await undoActivity(entry(), { deps });
    expect(result).toEqual({ ok: false, reason: 'It was changed again while undoing, so nothing was changed.' });
    expect(deps.record).not.toHaveBeenCalled();
  });
});
