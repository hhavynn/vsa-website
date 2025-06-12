import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePointsContext } from '../../context/PointsContext';
import { useAdmin } from '../../hooks/useAdmin';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function Header() {
  const { user, signOut } = useAuth();
  const { points, loading: pointsLoading } = usePointsContext();
  const { isAdmin } = useAdmin();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserName = async () => {
      if (!user) {
        setUserName(null);
        return;
      }
      
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          return;
        }

        if (profile) {
          const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
          setUserName(name || 'there');
        }
      } catch (err) {
        console.error('Error fetching user name:', err);
      }
    };

    fetchUserName();
  }, [user]);

  return (
    <header className="bg-gray-800 text-white shadow-lg relative z-10">
      <div className="h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center text-lg font-bold text-gray-100 hover:text-white transition-colors duration-200">
              <img src="/images/vsa-logo.png" alt="VSA Logo" className="h-8 w-8 mr-2" />
              VSA
            </Link>
            <Link to="/events" className="text-gray-300 hover:text-white transition-colors duration-200">
              Events
            </Link>
            <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors duration-200">
              Leaderboard
            </Link>
            {isAdmin && (
              <Link to="/admin/events" className="text-gray-300 hover:text-white transition-colors duration-200">
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center space-x-6">
            {user ? (
              <>
                <span className="text-sm font-medium text-gray-100">
                  {userName || 'Loading...'}
                </span>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-600 text-white">
                    {pointsLoading ? (
                      <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      `${points} points`
                    )}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  Sign Out
                </button>
                {/* User avatar (placeholder) */}
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              </>
            ) : (
              <Link
                to="/"
                className="text-gray-300 hover:text-white transition-colors duration-200"
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