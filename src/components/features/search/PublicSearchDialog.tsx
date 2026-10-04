import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { PublicSearchPanel } from './PublicSearchPanel';

interface PublicSearchDialogProps {
  onClose: () => void;
}

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * The global search dialog. Mounted only while open (the provider lazy-loads
 * it), so a visitor who never searches never loads this code or its data.
 * Full-width at the top of the screen on phones; a centered card from `sm` up.
 */
export default function PublicSearchDialog({ onClose }: PublicSearchDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock page scroll while open and hand focus back to whatever opened us.
  // A layout effect so the opener is read before the search box (a child's
  // passive effect) takes focus.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  // The dialog has two tab stops (the box and Close), so a simple wrap keeps focus inside.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const stops = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []); // eslint-disable-line testing-library/no-node-access
    if (stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 backdrop-blur-sm sm:px-4 sm:pt-[12vh]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search the site"
        onKeyDown={onKeyDown}
        className="w-full overflow-hidden rounded-b-xl border border-[var(--color-border)] bg-[var(--color-surface)] pt-[env(safe-area-inset-top)] shadow-xl sm:max-w-xl sm:rounded-xl sm:pt-0"
      >
        <div className="flex items-center justify-between px-4 pt-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text3)]">Search VSA</span>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 min-h-[44px] rounded-lg px-3 font-sans text-sm font-semibold text-[var(--color-text2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
          >
            Close
          </button>
        </div>
        <PublicSearchPanel variant="dialog" autoFocus onDone={onClose} onEscape={onClose} />
        <div className="hidden justify-between px-4 py-2 font-mono text-[10px] text-[var(--color-text3)] sm:flex">
          <span>↑↓ to move · Enter to open · Esc to close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
