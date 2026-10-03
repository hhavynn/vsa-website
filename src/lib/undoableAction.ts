// Deferred-commit undo. Instead of soft-deleting rows (which would force every
// public read path to filter them out, and a missed filter leaks deleted
// content), the page hides the row, shows an Undo toast, and only runs the
// real write once the window passes. Undo simply cancels the write, so the
// database never held a half-deleted state.
//
// Failure direction is safe: if the tab closes inside the window the write
// never happens and the row stays. Leaving the page flushes (commits) pending
// work immediately so a navigation never silently drops an intended delete.

export const DEFAULT_UNDO_WINDOW_MS = 7000;

export interface PendingUndoable {
  /** Cancels the write if it has not run. Returns true if it was cancelled. */
  cancel(): boolean;
  /** Runs the write now (no-op if it already ran or was cancelled). */
  flush(): Promise<void>;
  readonly settled: boolean;
}

export interface UndoableOptions {
  commit: () => void | Promise<unknown>;
  delayMs?: number;
  onCommitted?: () => void;
  /** Commit failed: the page should restore the hidden row and say so. */
  onError?: (error: unknown) => void;
}

const pending = new Set<PendingUndoable>();

export function scheduleUndoable(options: UndoableOptions): PendingUndoable {
  let state: 'pending' | 'running' | 'cancelled' | 'done' = 'pending';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = async () => {
    if (state !== 'pending') return;
    state = 'running';
    if (timer) clearTimeout(timer);
    timer = null;
    try {
      await options.commit();
      state = 'done';
      pending.delete(handle);
      options.onCommitted?.();
    } catch (error) {
      state = 'done';
      pending.delete(handle);
      options.onError?.(error);
    }
  };

  const handle: PendingUndoable = {
    cancel() {
      if (state !== 'pending') return false;
      state = 'cancelled';
      if (timer) clearTimeout(timer);
      timer = null;
      pending.delete(handle);
      return true;
    },
    flush: run,
    get settled() {
      return state !== 'pending';
    },
  };

  timer = setTimeout(() => void run(), options.delayMs ?? DEFAULT_UNDO_WINDOW_MS);
  pending.add(handle);
  return handle;
}

/** Commit everything still waiting (page unload / navigation away). */
export function flushAllPendingUndoables(): Promise<void[]> {
  return Promise.all(Array.from(pending).map((entry) => entry.flush()));
}

export function pendingUndoableCount(): number {
  return pending.size;
}
