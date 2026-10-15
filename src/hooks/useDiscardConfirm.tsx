import { ReactNode, useCallback, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export interface DiscardPrompt {
  title: string;
  /** Say what is lost, and what happens next. */
  description: ReactNode;
  confirmLabel?: string;
}

interface PendingDiscard {
  prompt: DiscardPrompt;
  action: () => void;
}

/**
 * Standard-tier replacement for `window.confirm('...unsaved changes. Discard?')`
 * on in-page transitions (open another record, cancel an editor). Because the
 * dialog is async, the action that would discard the edits is parked and runs
 * only on Confirm; Cancel (or Escape) leaves the page exactly as it was.
 *
 * Render `discardDialog` once, outside any modal it may be opened from.
 */
export function useDiscardConfirm() {
  const [pending, setPending] = useState<PendingDiscard | null>(null);

  /** Runs `action` now when nothing is at risk, otherwise after the admin confirms. */
  const requestDiscard = useCallback((dirty: boolean, prompt: DiscardPrompt, action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    setPending({ prompt, action });
  }, []);

  const discardDialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.prompt.title ?? 'Discard unsaved changes?'}
      description={pending?.prompt.description ?? null}
      confirmLabel={pending?.prompt.confirmLabel ?? 'Discard changes'}
      cancelLabel="Keep editing"
      onConfirm={() => pending?.action()}
      onClose={() => setPending(null)}
    />
  );

  return { requestDiscard, discardDialog };
}
