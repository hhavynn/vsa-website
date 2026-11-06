import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { adminStatusQuery } from '../../../hooks/useAdmin';
import { SignInSchema, type SignInFormData } from '../../../schemas';
import { FieldError, FormAlert } from '../../ui/FieldError';

const inputCls = 'mt-1 block w-full touch:min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:focus:border-brand-300 dark:focus:ring-brand-300/25';
const labelCls = 'mb-1 block font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-secondary';

const ADMIN_CHECK_FAILED = 'Unable to verify admin access.';

/**
 * Maps a sign-in failure to text that does not reveal whether an account
 * exists (#235). Supabase already answers "Invalid login credentials" for both
 * an unknown email and a wrong password, but other Auth errors such as
 * "Email not confirmed" confirm the address is registered, so everything that
 * isn't a rate limit or a connection problem gets the same message.
 * Supabase Auth rate-limits sign-in per IP server-side; the app does not add a
 * second limiter, which could lock the only admin out.
 */
export function signInErrorMessage(error: unknown): string {
  if (isAuthApiError(error) && error.status === 429) {
    return 'Too many sign-in attempts. Wait a few minutes and try again.';
  }
  if (isAuthRetryableFetchError(error)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (error instanceof Error && error.message === ADMIN_CHECK_FAILED) {
    return ADMIN_CHECK_FAILED;
  }
  return 'Incorrect email or password.';
}

interface SignInFormProps {
  /**
   * Called after an admin signs in, instead of navigating to the requested
   * admin page. The session-expired prompt passes this so the page the admin
   * was working on stays exactly where it is.
   */
  onSignedIn?: () => void;
  defaultEmail?: string;
}

export function SignInForm({ onSignedIn, defaultEmail }: SignInFormProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { signIn, signOut } = useAuth();
  const emailId = useId();
  const passwordId = useId();
  const authErrorRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<SignInFormData>({
    resolver: zodResolver(SignInSchema),
    defaultValues: defaultEmail ? { email: defaultEmail } : undefined,
  });

  // React Hook Form already focuses the first invalid field after a failed
  // client-side submission. An async authentication failure has no invalid
  // field, so move focus to its form-level alert exactly when it appears.
  useEffect(() => {
    if (errors.root) authErrorRef.current?.focus();
  }, [errors.root]);

  const locationState = location.state as { from?: { pathname?: string; search?: string } } | null;
  const requestedPath = locationState?.from?.pathname || '/admin';
  const requestedSearch = locationState?.from?.search || '';
  const redirectTo = requestedPath.startsWith('/admin') && requestedPath !== '/admin/login'
    ? `${requestedPath}${requestedSearch}`
    : '/admin';

  const onSubmit = async (data: SignInFormData) => {
    try {
      const signedInUser = await signIn(data.email, data.password);
      // Always a fresh lookup (never a cached verdict) for a sign-in, and it
      // seeds the cache so the admin shell does not repeat the query.
      let isAdmin: boolean;
      try {
        isAdmin = await queryClient.fetchQuery({ ...adminStatusQuery(signedInUser.id), staleTime: 0 });
      } catch {
        await signOut();
        throw new Error(ADMIN_CHECK_FAILED);
      }

      if (!isAdmin) {
        await signOut();
        setFormError('root', {
          type: 'manual',
          message: 'This sign-in is for VSA admins only. Your account is not authorized for the admin panel.',
        });
        return;
      }

      if (onSignedIn) {
        onSignedIn();
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError('root', {
        type: 'manual',
        message: signInErrorMessage(error),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-busy={isSubmitting} aria-label="Admin sign-in">
      <div>
        <label htmlFor={emailId} className={labelCls}>Email</label>
        <span className="font-sans text-[11px] text-text-muted">Required</span>
        <input
          id={emailId}
          type="email"
          autoComplete="username"
          required
          {...register('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? emailId + '-error' : undefined}
          className={inputCls}
          placeholder="Enter your email"
        />
        {errors.email && (
          <FieldError id={emailId + '-error'} message={errors.email.message} />
        )}
      </div>

      <div>
        <label htmlFor={passwordId} className={labelCls}>Password</label>
        <span className="font-sans text-[11px] text-text-muted">Required</span>
        <input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          required
          {...register('password')}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? passwordId + '-error' : undefined}
          className={inputCls}
          placeholder="Enter your password"
        />
        {errors.password && (
          <FieldError id={passwordId + '-error'} message={errors.password.message} />
        )}
      </div>

      {errors.root && (
        <div ref={authErrorRef} tabIndex={-1} data-testid="sign-in-auth-error-focus">
          <FormAlert>{errors.root.message}</FormAlert>
        </div>
      )}

      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isSubmitting ? 'Signing in and verifying admin access…' : ''}
      </span>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="flex w-full touch:min-h-11 items-center justify-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:opacity-50 dark:bg-brand-300 dark:text-brand-950 dark:hover:bg-brand-200"
      >
        {isSubmitting ? 'Verifying access...' : 'Sign In'}
      </button>
    </form>
  );
}
