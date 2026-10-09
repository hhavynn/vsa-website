import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearStaged, loadStaged, saveStaged } from '../lib/recoveryStagingStore';
import { StagedDecision, isLocked } from '../lib/recoveryWorkspace';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const UNDO_LIMIT = 30;
export const STAGED_LEAVE_MESSAGE =
  'You have staged recovery decisions that are not applied yet. They stay staged in this tab for a few hours, but closing the tab discards them. Leave anyway?';

type StagedMap = ReadonlyMap<string, StagedDecision>;

const toMap = (decisions: readonly StagedDecision[]): StagedMap => new Map(decisions.map((d) => [d.rowId, d]));

/**
 * Staged recovery decisions, keyed by import row. Persisted per admin in this
 * tab's sessionStorage, guarded against leaving with unapplied work, with an
 * undo stack. A row whose last attempt got no answer is locked: it can only be
 * retried (same request) or cleared by a refresh that finds it applied.
 */
export function useStagedRecovery(userId: string | null) {
  const [staged, setStaged] = useState<StagedMap>(() => toMap(userId ? loadStaged(userId) : []));
  const undo = useRef<StagedMap[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const previousUser = useRef(userId);

  useEffect(() => {
    if (previousUser.current === userId) return;
    if (previousUser.current) clearStaged(previousUser.current);
    previousUser.current = userId;
    undo.current = [];
    setUndoDepth(0);
    setStaged(toMap(userId ? loadStaged(userId) : []));
  }, [userId]);

  useEffect(() => {
    if (userId) saveStaged(userId, Array.from(staged.values()));
  }, [staged, userId]);

  useUnsavedChangesGuard(staged.size > 0, false, STAGED_LEAVE_MESSAGE);

  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  const commit = useCallback((update: (current: StagedMap) => StagedMap) => {
    const current = stagedRef.current;
    const next = update(current);
    if (next === current) return;
    undo.current = [...undo.current.slice(-(UNDO_LIMIT - 1)), current];
    stagedRef.current = next;
    setUndoDepth(undo.current.length);
    setStaged(next);
  }, []);

  const stageMany = useCallback((decisions: readonly StagedDecision[]) => commit((current) => {
    const writable = decisions.filter((d) => !isLocked(current.get(d.rowId)));
    if (writable.length === 0) return current;
    const next = new Map(current);
    writable.forEach((d) => next.set(d.rowId, d));
    return next;
  }), [commit]);

  const stage = useCallback((decision: StagedDecision) => stageMany([decision]), [stageMany]);

  const unstage = useCallback((rowIds: string | readonly string[]) => commit((current) => {
    const ids = (typeof rowIds === 'string' ? [rowIds] : rowIds).filter((id) => current.has(id) && !isLocked(current.get(id)));
    if (ids.length === 0) return current;
    const next = new Map(current);
    ids.forEach((id) => next.delete(id));
    return next;
  }), [commit]);

  /** Clears everything except rows whose outcome is unknown. */
  const clearAll = useCallback(() => commit((current) => {
    const kept = Array.from(current.values()).filter((d) => isLocked(d));
    return kept.length === current.size ? current : toMap(kept);
  }), [commit]);

  const undoLast = useCallback(() => {
    const previous = undo.current.pop();
    setUndoDepth(undo.current.length);
    if (!previous) return;
    // Never resurrect or drop a row whose outcome is unknown: keep its current state.
    const next = new Map(previous);
    stagedRef.current.forEach((d, id) => { if (isLocked(d)) next.set(id, d); });
    stagedRef.current = next;
    setStaged(next);
  }, []);

  /** Replaces staging after a batch (applied rows removed, failures marked). Not undoable. */
  const replaceAll = useCallback((decisions: readonly StagedDecision[]) => {
    undo.current = [];
    setUndoDepth(0);
    const next = toMap(decisions);
    stagedRef.current = next;
    setStaged(next);
  }, []);

  const list = useMemo(() => Array.from(staged.values()), [staged]);
  const ids = useMemo(() => new Set(staged.keys()), [staged]);

  return { staged, list, ids, count: staged.size, stage, stageMany, unstage, clearAll, undoLast, canUndo: undoDepth > 0, replaceAll };
}

export type StagedRecovery = ReturnType<typeof useStagedRecovery>;
