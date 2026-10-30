import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SignInForm } from '../components/features/auth/SignInForm';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { useAuth } from '../hooks/useAuth';
import { useAdmin } from '../hooks/useAdmin';
import { FormAlert } from '../components/ui/FieldError';
import { Sparkle } from '../components/ui/Sparkle';

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, loading } = useAdmin();
  const locationState = location.state as { from?: { pathname?: string; search?: string }; unauthorized?: boolean } | null;
  const requestedPath = locationState?.from?.pathname || '/admin';
  const requestedSearch = locationState?.from?.search || '';
  const redirectTo = requestedPath.startsWith('/admin') && requestedPath !== '/admin/login'
    ? `${requestedPath}${requestedSearch}`
    : '/admin';

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAdmin, loading, navigate, redirectTo, user]);

  if (user && loading) {
    return <PageLoader message="Verifying admin access..." />;
  }

  const showUnauthorized = !!user && !isAdmin;

  return (
    <>
      <PageTitle title="Admin Sign In" />
      <div className="vsa-admin-sky relative flex min-h-[calc(100vh-60px)] items-center justify-center overflow-hidden px-4 py-16">
        <Sparkle className="absolute left-[7%] top-[7%] h-7 w-7 sm:left-[12%] sm:top-[16%] text-white/80 dark:text-brand-200/40" glow />
        <Sparkle className="absolute bottom-[5%] right-[10%] h-5 w-5 sm:bottom-[18%] sm:right-[14%] text-white/70 dark:text-brand-200/30" glow />
        <Sparkle className="absolute right-[24%] top-[26%] hidden h-3 w-3 text-white/70 dark:text-brand-200/30 sm:block" />
        <div className="relative w-full max-w-md">
          <div className="mb-7 text-center">
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-secondary">VSA at UCSD · Cabinet workspace</p>
            <h1 className="mt-3 font-display text-[2.75rem] font-normal leading-none tracking-[-0.02em] text-text-primary">
              Admin <i className="text-[var(--ed-wordmark)]">Access</i>
            </h1>
            <p className="mt-3 font-sans text-sm text-text-secondary">Sign in with an approved admin account.</p>
          </div>

          <div className="vsa-ribbon-top overflow-hidden rounded-lg border border-[var(--color-border)] bg-surface p-6 shadow-[0_24px_60px_rgba(51,65,112,0.14)] sm:p-8">
            {showUnauthorized ? (
              <div className="space-y-4">
                <FormAlert>This account is signed in, but it is not authorized for the VSA admin panel.</FormAlert>
                <button
                  onClick={signOut}
                  className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-700 dark:bg-brand-300 dark:text-brand-950 dark:hover:bg-brand-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <SignInForm />
            )}
          </div>

          <p className="mt-6 text-center font-sans text-xs text-text-secondary">
            Admin access is limited to approved VSA website maintainers.
          </p>
          {locationState?.unauthorized && !showUnauthorized && (
            <FormAlert className="mt-3 text-xs">Please sign in with an admin account to continue.</FormAlert>
          )}
        </div>
      </div>
    </>
  );
}
