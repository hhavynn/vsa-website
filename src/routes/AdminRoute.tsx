import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import { PageLoader } from '../components/common/PageLoader';

interface AdminRouteProps {
  children?: React.ReactNode; // Make children optional if not always used directly
}

export function AdminRoute({ children }: AdminRouteProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin, loading } = useAdmin();

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

  return children ? <>{children}</> : <Outlet />;
}
