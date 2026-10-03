import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import { confirmLeaveIfUnsaved } from '../hooks/useUnsavedChangesGuard';
import { PageLoader } from '../components/common/PageLoader';
import { SessionExpiredDialog } from '../components/features/auth/SessionExpiredDialog';

// React 18's types predate the `inert` attribute; it is a plain boolean
// attribute in the DOM, so pass it through untyped.
const INERT_PROPS = { inert: '', 'aria-hidden': true } as Record<string, unknown>;

interface AdminRouteProps {
  children?: React.ReactNode; // Make children optional if not always used directly
}

export function AdminRoute({ children }: AdminRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, sessionExpired, discardExpiredSession } = useAuth();
  const { isAdmin, loading } = useAdmin();

  // The admin this shell last verified. If their session ends unprompted, the
  // page they were editing is kept mounted (and so are its unsaved edits)
  // behind a re-authentication prompt, instead of being redirected away.
  const verifiedAdmin = useRef<{ id: string; email?: string } | null>(null);
  useEffect(() => {
    if (user && isAdmin && !loading) {
      verifiedAdmin.current = { id: user.id, email: user.email };
    }
  }, [user, isAdmin, loading]);

  // Leaving the admin area while a session is still marked expired means the
  // held page and its cached rows are abandoned: drop them rather than leaving
  // an expired admin's data in memory until the cache times out.
  const expiredRef = useRef(sessionExpired);
  expiredRef.current = sessionExpired;
  const discardRef = useRef(discardExpiredSession);
  discardRef.current = discardExpiredSession;
  useEffect(
    () => () => {
      if (expiredRef.current) discardRef.current();
    },
    []
  );

  const held = verifiedAdmin.current;
  const sessionEnded = !user && sessionExpired && held !== null;
  // Same admin signed back in, access being re-checked: keep the page up.
  const reverifying = !!user && loading && held !== null && user.id === held.id;

  const promptOpen = sessionEnded || reverifying;

  if (!promptOpen) {
    if (loading) {
      return <PageLoader message="Verifying admin access..." />;
    }

    if (!user) {
      return (
        <Navigate
          to="/admin/login"
          replace
          state={{ from: { pathname: location.pathname, search: location.search } }}
        />
      );
    }

    if (!isAdmin) {
      return (
        <Navigate
          to="/admin/login"
          replace
          state={{ unauthorized: true, from: { pathname: location.pathname, search: location.search } }}
        />
      );
    }
  }

  // One tree shape for every state that renders the page (normal, session
  // ended, re-verifying): the page is always the first child, so React keeps it
  // mounted, with its form state, while the prompt comes and goes after it.
  // Keyed by account so a different admin signing in never inherits the
  // previous one's in-progress edits, even if no loader shows in between.
  // While the prompt is open the page is made inert, so keyboard focus, find
  // and screen readers cannot reach admin content behind the opaque cover.
  // (`display: contents` keeps the wrapper out of the layout.)
  return (
    <>
      <div
        key={user?.id ?? held?.id ?? 'signed-out'}
        style={{ display: 'contents' }}
        {...(promptOpen ? INERT_PROPS : {})}
      >
        {children ?? <Outlet />}
      </div>
      {promptOpen && (
        <SessionExpiredDialog
          email={held?.email}
          verifying={reverifying}
          onLeave={() => {
            if (!confirmLeaveIfUnsaved()) return;
            discardExpiredSession();
            navigate('/admin/login', { replace: true });
          }}
        />
      )}
    </>
  );
}
