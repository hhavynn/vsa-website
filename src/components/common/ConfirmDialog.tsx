import { ReactNode, RefObject, useEffect, useId, useRef, useState } from 'react';
import { confirmErrorMessage, confirmPhraseMatches } from '../../lib/adminConfirm';
import { cn } from '../../lib/utils';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal frame shared by the admin confirmation and bulk-preview
 * dialogs: role="alertdialog", labelled, focus moved in and restored on close,
 * Tab kept inside, Escape and backdrop click cancel (unless `locked`, which is
 * while an action is running).
 */
export function DialogFrame({
  titleId,
  descriptionId,
  onClose,
  locked = false,
  initialFocusRef,
  wide = false,
  panelClassName,
  children,
}: {
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  locked?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  wide?: boolean;
  /** Extra panel classes, e.g. a larger max width for a review screen. */
  panelClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTarget = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    focusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!lockedRef.current) {
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
    // Focus management runs once per open; the refs above carry later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !lockedRef.current) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn('bg-surface border-border-strong text-text-primary', 'max-h-[90vh] w-full overflow-y-auto rounded-lg border p-5 shadow-2xl', wide ? 'max-w-xl' : 'max-w-md', panelClassName)}
      >
        {children}
      </div>
    </div>
  );
}

export const dialogBtnCls =
  'rounded border border-[var(--color-border)] bg-transparent px-4 py-2 font-sans text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400';

export function dialogPrimaryCls(danger: boolean): string {
  return cn(
    'rounded border-0 px-4 py-2 font-sans text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    danger
      ? 'bg-red-700 hover:bg-red-800 focus-visible:ring-red-600 dark:bg-red-500 dark:hover:bg-red-400'
      : 'bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600 dark:bg-brand-400 dark:text-[#050810]',
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in one or two sentences. Name the item. */
  description: ReactNode;
  /** Cascading effects, one line each ("Also removes 14 members"). */
  consequences?: readonly string[];
  /** Anything extra worth seeing before confirming. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive actions. Default true; pass false for neutral confirms. */
  danger?: boolean;
  /** When set, the admin must type this (the item's name) to enable Confirm. */
  requireText?: string;
  /**
   * Runs the action. While it is pending the dialog is locked and shows
   * "Working…"; when it resolves the dialog closes; when it rejects the dialog
   * stays open and shows the error so nothing fails silently.
   */
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
}

/**
 * The one confirmation dialog for destructive admin actions. Standard tier is
 * a quick Cancel/Confirm; `requireText` makes it the typed tier — reserve that
 * for severe, hard-to-reverse actions so it keeps meaning something.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  consequences,
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  requireText,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = `${uid}-desc`;
  const inputId = `${uid}-phrase`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Each open starts clean: no leftover typed text or stale error.
  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const needsText = Boolean(requireText);
  const canConfirm = !busy && (!needsText || confirmPhraseMatches(typed, requireText ?? ''));

  const run = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      if (mounted.current) {
        setBusy(false);
        onClose();
      }
    } catch (err) {
      if (mounted.current) {
        setBusy(false);
        setError(confirmErrorMessage(err));
      }
    }
  };

  return (
    <DialogFrame
      titleId={titleId}
      descriptionId={descriptionId}
      onClose={onClose}
      locked={busy}
      initialFocusRef={needsText ? inputRef : cancelRef}
    >
      <h2 id={titleId} className="font-serif text-xl font-bold text-text-primary">
        {title}
      </h2>
      <div id={descriptionId} className="mt-2 font-sans text-sm text-text-secondary">
        {description}
      </div>
      {consequences && consequences.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 font-sans text-sm text-text-secondary">
          {consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {children}
      {needsText && (
        <div className="mt-4">
          <label htmlFor={inputId} className="block font-sans text-xs font-semibold text-text-primary">
            Type <span className="font-mono">{requireText}</span> to confirm
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void run();
              }
            }}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded border bg-transparent px-3 py-2 font-mono text-sm border-border-strong text-text-primary"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 font-sans text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} className={dialogBtnCls}>
          {cancelLabel}
        </button>
        <button type="button" onClick={() => void run()} disabled={!canConfirm} className={dialogPrimaryCls(danger)}>
          {busy ? 'Working…' : error ? 'Try again' : confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}
