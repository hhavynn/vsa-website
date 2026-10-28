import { useLayoutEffect, useRef } from 'react';
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

  // The search input autofocuses after the frame mounts. Keep all keyboard
  // focus inside the portal while it is open, including if another script
  // attempts to move it back to the page.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const panel = dialogRef.current;
    document.body.style.overflow = 'hidden';

    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      .filter((element) =>
        element.tabIndex >= 0 &&
        !element.matches(':disabled') &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden'
      );
    const focusBoundary = (last = false) => {
      const stops = getFocusable();
      (last ? stops[stops.length - 1] ?? panel : stops[0] ?? panel)?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const stops = getFocusable();
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (!first || !panel.contains(active) || active === panel) {
        event.preventDefault();
        focusBoundary(event.shiftKey);
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (panel && event.target instanceof Node && !panel.contains(event.target)) focusBoundary();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = previousOverflow;
      // Navigation may unmount the opener while search is open. Never focus
      // a detached element; prefer the primary navigation as a safe fallback.
      if (opener?.isConnected && !opener.closest('[inert]')) {
        opener.focus();
      } else {
        document.querySelector<HTMLElement>('nav[aria-label="Primary navigation"] a[href]')?.focus();
      }
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 backdrop-blur-sm sm:px-4 sm:pt-[12vh]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label="Search the site"
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
