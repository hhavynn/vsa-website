import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Events } from './pages/Events';
import { Leaderboard } from './pages/Leaderboard';
import AdminEvents from './pages/Admin/Events';
import { Profile } from './pages/Profile';
import { Cabinet } from './pages/Cabinet';
import { GetInvolved } from './pages/GetInvolved';
import { Gallery } from './pages/Gallery';
import { Ace } from './pages/Ace';
import { House } from './pages/House';
import { Internship } from './pages/Internship';
import { Vcn } from './pages/Vcn';
import { WildNCulture } from './pages/WildNCulture';
import { PointsProvider } from './context/PointsContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';

export function AppRoutes() {
  return (
    <>
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-white focus:text-gray-900 focus:p-4 focus:rounded-br-lg"
      >
        Skip to main content
      </a>
      <PointsProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="events" element={<Events />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route element={<ProtectedRoute />}>
              <Route path="profile" element={<Profile />} />
              <Route path="cabinet" element={<Cabinet />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="admin/events" element={<AdminEvents />} />
            </Route>
            <Route path="get-involved" element={<GetInvolved />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="ace" element={<Ace />} />
            <Route path="house-system" element={<House />} />
            <Route path="intern-program" element={<Internship />} />
            <Route path="vcn" element={<Vcn />} />
            <Route path="wild-n-culture" element={<WildNCulture />} />
          </Route>
        </Routes>
      </PointsProvider>
    </>
  );
} 