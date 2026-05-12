import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SignInForm } from '../components/features/auth/SignInForm';
import { PageTitle } from '../components/common/PageTitle';
import { PageLoader } from '../components/common/PageLoader';
import { useAuth } from '../hooks/useAuth';
import { useAdmin } from '../hooks/useAdmin';

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
      <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-serif leading-none tracking-[-0.03em] mb-2" style={{ fontSize: 36, color: 'var(--color-text)' }}>
              Admin Access
            </h1>
            <p className="font-sans text-sm" style={{ color: 'var(--color-text2)' }}>Sign in with an approved admin account.</p>
          </div>

          <div className="border rounded" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '32px' }}>
            {showUnauthorized ? (
              <div className="space-y-4">
                <div className="rounded border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
                  This account is signed in, but it is not authorized for the VSA admin panel.
                </div>
                <button
                  onClick={signOut}
                  className="w-full rounded bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <SignInForm />
            )}
          </div>

          <p className="mt-6 text-center font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            Admin access is limited to approved VSA website maintainers.
          </p>
          {locationState?.unauthorized && !showUnauthorized && (
            <p className="mt-3 text-center font-sans text-xs text-red-400">
              Please sign in with an admin account to continue.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
