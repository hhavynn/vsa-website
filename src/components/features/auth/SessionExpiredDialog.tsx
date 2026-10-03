import { useEffect, useRef } from 'react';
import { SignInForm } from './SignInForm';

interface SessionExpiredDialogProps {
  email?: string;
  /** True once the admin has signed back in and access is being re-verified. */
  verifying: boolean;
  onLeave: () => void;
}

/**
 * Covers the admin area when its session ends unprompted. The page underneath
 * stays mounted (the admin shell renders this over it), so unsaved edits
 * survive; signing back in as the same account simply uncovers it. The cover
 * is opaque so no admin data stays visible while nobody is signed in.
 */
export function SessionExpiredDialog({ email, verifying, onLeave }: SessionExpiredDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Take focus from the page underneath, which may have been mid-keystroke in
  // a textarea: the email is prefilled, so go straight to the password.
  useEffect(() => {
    const field = email ? 'input[type="password"]' : 'input[type="email"]';
    dialogRef.current?.querySelector<HTMLInputElement>(field)?.focus();
  }, [email]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto px-4 py-10"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-body"
        className="w-full max-w-md rounded border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '32px' }}
      >
        <h2
          id="session-expired-title"
          className="font-serif leading-none tracking-[-0.03em] mb-3"
          style={{ fontSize: 28, color: 'var(--color-text)' }}
        >
          Your session ended
        </h2>
        <p
          id="session-expired-body"
          className="font-sans text-sm mb-6"
          style={{ color: 'var(--color-text2)' }}
        >
          You were signed out, either because your session expired or because you signed out in another
          tab. Sign in again with the same account to keep going; anything you hadn&apos;t saved is
          still on the page. Signing in with a different account discards it.
        </p>

        {verifying ? (
          <p role="status" className="font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
            Verifying admin access...
          </p>
        ) : (
          <>
            <SignInForm defaultEmail={email} onSignedIn={() => undefined} />
            <button
              type="button"
              onClick={onLeave}
              className="mt-4 w-full text-center font-sans text-xs underline"
              style={{ color: 'var(--color-text3)' }}
            >
              Leave admin and discard unsaved changes
            </button>
          </>
        )}
      </div>
    </div>
  );
}
