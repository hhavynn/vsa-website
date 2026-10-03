import { useEffect, useRef } from 'react';
import { SignInForm } from './SignInForm';

interface SessionExpiredDialogProps {
  email?: string;
  /** True once someone has signed back in and their admin access is being checked. */
  verifying: boolean;
  onLeave: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Covers the admin area when its session ends unprompted. The page underneath
 * stays mounted (the admin shell renders this over it), so unsaved edits
 * survive; signing back in as the same account simply uncovers it. The cover
 * is opaque so no admin data stays visible while nobody is signed in, and
 * focus cannot leave it: the rest of the app (header, footer, widgets) sits
 * outside the inert admin page.
 */
export function SessionExpiredDialog({ email, verifying, onLeave }: SessionExpiredDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Take focus from the page underneath, which may have been mid-keystroke in
  // a textarea: the email is prefilled, so go straight to the password.
  useEffect(() => {
    const field = email ? 'input[type="password"]' : 'input[type="email"]';
    dialogRef.current?.querySelector<HTMLInputElement>(field)?.focus();
  }, [email]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    // Anything else that takes focus (a click on the header, a script) is
    // pulled straight back.
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        (focusable()[0] ?? dialog).focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[var(--color-bg)] px-4 py-10">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-body"
        className="w-full max-w-md rounded border border-[var(--color-border)] bg-surface p-8 focus:outline-none"
      >
        <h2
          id="session-expired-title"
          className="mb-3 font-serif text-[28px] leading-none tracking-[-0.03em] text-text-primary"
        >
          Your session ended
        </h2>
        <p id="session-expired-body" className="mb-6 font-sans text-sm text-text-secondary">
          You were signed out, either because your session expired or because you signed out in another
          tab. Sign in again with the same account to keep going; anything you hadn&apos;t saved is
          still on the page. Signing in with a different account discards it.
        </p>

        {verifying && (
          <p role="status" className="mb-4 font-sans text-sm text-text-secondary">
            Verifying admin access...
          </p>
        )}
        <SignInForm defaultEmail={email} onSignedIn={() => undefined} />
        <button
          type="button"
          onClick={onLeave}
          disabled={verifying}
          className="mt-4 w-full text-center font-sans text-xs text-text-muted underline"
        >
          Leave admin and discard unsaved changes
        </button>
      </div>
    </div>
  );
}
