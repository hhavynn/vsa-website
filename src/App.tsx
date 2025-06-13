import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Events } from './pages/Events';
import { Leaderboard } from './pages/Leaderboard';
import { AdminEvents } from './pages/Admin/Events';
import { Profile } from './pages/Profile';
import { Cabinet } from './pages/Cabinet';
import { GetInvolved } from './pages/GetInvolved';
import { AuthProvider } from './context/AuthContext';
import { PointsProvider } from './context/PointsContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <PointsProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="events" element={<Events />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="admin/events" element={<AdminEvents />} />
            <Route path="profile" element={<Profile />} />
            <Route path="cabinet" element={<Cabinet />} />
            <Route path="get-involved" element={<GetInvolved />} />
          </Route>
        </Routes>
      </PointsProvider>
    </AuthProvider>
  );
}

export default App;
