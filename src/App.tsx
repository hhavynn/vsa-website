import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
import { Test } from './components/Test';
import { AdminEvents } from './pages/Admin/Events';
import { Leaderboard } from './pages/Leaderboard';
import { useAdmin } from './hooks/useAdmin';
import { Events } from './pages/Events';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <>
      <Test />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="profile" element={<Profile />} />
          <Route path="events" element={<Events />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route
            path="admin/events"
            element={
              <AdminRoute>
                <AdminEvents />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
