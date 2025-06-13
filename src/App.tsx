import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Events } from './pages/Events';
import { Leaderboard } from './pages/Leaderboard';
import { AdminEvents } from './pages/Admin/Events';
import { Profile } from './pages/Profile';
import { Cabinet } from './pages/Cabinet';
import { GetInvolved } from './pages/GetInvolved';
import { Gallery } from './pages/Gallery';
import { Ace } from './pages/Ace';
import { House } from './pages/House';
import { Internship } from './pages/Internship';
import { Vcn } from './pages/Vcn';
import { WildNCulture } from './pages/WildNCulture';
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
            <Route path="gallery" element={<Gallery />} />
            <Route path="ace" element={<Ace />} />
            <Route path="house-system" element={<House />} />
            <Route path="intern-program" element={<Internship />} />
            <Route path="vcn" element={<Vcn />} />
            <Route path="wild-n-culture" element={<WildNCulture />} />
          </Route>
        </Routes>
      </PointsProvider>
    </AuthProvider>
  );
}

export default App;
