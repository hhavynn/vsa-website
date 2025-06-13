import { Navigate, Outlet } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';

interface AdminRouteProps {
  children?: React.ReactNode; // Make children optional if not always used directly
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin, loading } = useAdmin();

  if (loading) return null; // or a loading spinner

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
} 