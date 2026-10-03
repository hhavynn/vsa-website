import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { DEFAULT_UNDO_WINDOW_MS, PendingUndoable, scheduleUndoable } from '../lib/undoableAction';

export interface RunUndoableOptions {
  /** "Resource deleted" — the toast text. */
  message: string;
  /** Hide the row now (optimistic). Must be reversible by `restore`. */
  hide: () => void;
  /** Put the row back: Undo was pressed, or the delayed write failed. */
  restore: () => void;
  /** The real write. Runs after the undo window, or immediately if the page is left. */
  commit: () => void | Promise<unknown>;
  onCommitted?: () => void;
  failureMessage?: string;
}

/**
 * Hide-then-delete with an Undo toast, for ordinary deletes where a typed
 * confirmation would be overkill. Leaving the page commits anything still
 * waiting (see lib/undoableAction.ts for why this beats soft delete here).
 */
export function useUndoableAction() {
  const mine = useRef(new Set<PendingUndoable>());

  useEffect(() => {
    const handles = mine.current;
    return () => {
      handles.forEach((handle) => void handle.flush());
      handles.clear();
    };
  }, []);

  return useCallback((options: RunUndoableOptions) => {
    options.hide();
    let toastId: string | undefined;
    const handle: PendingUndoable = scheduleUndoable({
      commit: options.commit,
      onCommitted: () => {
        mine.current.delete(handle);
        if (toastId) toast.dismiss(toastId);
        options.onCommitted?.();
      },
      onError: () => {
        mine.current.delete(handle);
        if (toastId) toast.dismiss(toastId);
        options.restore();
        toast.error(options.failureMessage ?? 'Could not complete that. It has been restored.');
      },
    });
    mine.current.add(handle);
    toastId = toast(
      (t) => (
        <span className="flex items-center gap-3 font-sans text-sm">
          <span>{options.message}</span>
          <button
            type="button"
            className="rounded border border-current px-2 py-0.5 text-xs font-semibold"
            onClick={() => {
              if (handle.cancel()) {
                mine.current.delete(handle);
                options.restore();
                toast.dismiss(t.id);
                toast.success('Restored');
              }
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: DEFAULT_UNDO_WINDOW_MS },
    );
    return handle;
  }, []);
}
