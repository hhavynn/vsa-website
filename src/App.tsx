import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Events } from './pages/Events';
import { Leaderboard } from './pages/Leaderboard';
import { AdminEvents } from './pages/Admin/Events';
import { Profile } from './pages/Profile';
import { AuthProvider } from './context/AuthContext';
import { PointsProvider } from './context/PointsContext';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <PointsProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="events" element={<Events />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="admin/events" element={<AdminEvents />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Routes>
        </PointsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
