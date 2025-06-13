import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function Header() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [userName, setUserName] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center text-lg font-bold text-gray-100 hover:text-white transition-colors duration-200">
              <img src="/images/vsa-logo.png" alt="VSA Logo" className="h-8 w-8 mr-2" />
              <span className="hidden sm:inline">VSA</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6 ml-6">
              <Link to="/events" className="text-gray-300 hover:text-white transition-colors duration-200">
                Events
              </Link>
              <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors duration-200">
                Leaderboard
              </Link>
              <Link to="/cabinet" className="text-gray-300 hover:text-white transition-colors duration-200">
                Cabinet
              </Link>
              <Link to="/get-involved" className="text-gray-300 hover:text-white transition-colors duration-200">
                Get Involved
              </Link>
              {isAdmin && (
                <Link to="/admin/events" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-white focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  Profile
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  Sign Out
                </button>
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

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                to="/events"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Events
              </Link>
              <Link
                to="/leaderboard"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Leaderboard
              </Link>
              <Link
                to="/cabinet"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Cabinet
              </Link>
              <Link
                to="/get-involved"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Get Involved
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/events"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 