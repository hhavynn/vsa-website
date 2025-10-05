import { Navigate, Outlet } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';

interface AdminRouteProps {
  children?: React.ReactNode; // Make children optional if not always used directly
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin, loading } = useAdmin();

  console.log('AdminRoute - Current state:', { isAdmin, loading });

  if (loading) {
    console.log('AdminRoute - Still loading...');
    return null;
  }

  if (!isAdmin) {
    console.log('AdminRoute - Not admin, redirecting to sign in');
    return <Navigate to="/signin" replace />;
  }

  console.log('AdminRoute - Admin access granted');
  return children ? <>{children}</> : <Outlet />;
} 