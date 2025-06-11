import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePointsContext } from '../../context/PointsContext';
import { useAdmin } from '../../hooks/useAdmin';

export function Header() {
  const { user, signOut } = useAuth();
  const { points, loading: pointsLoading } = usePointsContext();
  const { isAdmin } = useAdmin();

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex items-center px-2 py-2 text-gray-900 hover:text-gray-600">
              VSA
            </Link>
            <Link to="/events" className="flex items-center px-2 py-2 text-gray-900 hover:text-gray-600">
              Events
            </Link>
            {user && (
              <>
                <Link to="/profile" className="flex items-center px-2 py-2 text-gray-900 hover:text-gray-600">
                  Profile
                </Link>
                <Link to="/leaderboard" className="flex items-center px-2 py-2 text-gray-900 hover:text-gray-600">
                  Leaderboard
                </Link>
              </>
            )}
            {isAdmin && (
              <Link to="/admin/events" className="flex items-center px-2 py-2 text-gray-900 hover:text-gray-600">
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    {user.email}
                  </span>
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {pointsLoading ? '...' : `${points} points`}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="text-sm text-gray-700 hover:text-gray-900"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
} 