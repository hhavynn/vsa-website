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
  const [isGetInvolvedDropdownOpen, setIsGetInvolvedDropdownOpen] = useState(false);
  const [isEventsDropdownOpen, setIsEventsDropdownOpen] = useState(false);

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
              {/* Events Dropdown for Desktop */}
              <div className="relative group">
                <Link to="/events" className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center group-hover:text-white">
                  Events
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent link navigation when clicking dropdown toggle
                      setIsEventsDropdownOpen(!isEventsDropdownOpen);
                    }}
                    className="ml-1 p-1 rounded-full hover:bg-gray-700 focus:outline-none"
                  >
                    <svg
                      className={`h-4 w-4 transform ${isEventsDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </Link>
                {isEventsDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg py-1 z-20">
                    <Link
                      to="/vcn"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                      onClick={() => setIsEventsDropdownOpen(false)}
                    >
                      VCN
                    </Link>
                    <Link
                      to="/wild-n-culture"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                      onClick={() => setIsEventsDropdownOpen(false)}
                    >
                      Wild n' Culture
                    </Link>
                  </div>
                )}
              </div>
              
              <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors duration-200">
                Leaderboard
              </Link>
              <Link to="/cabinet" className="text-gray-300 hover:text-white transition-colors duration-200">
                Cabinet
              </Link>
              
              {/* Get Involved Dropdown for Desktop */}
              <div className="relative group">
                <Link to="/get-involved" className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center group-hover:text-white">
                  Get Involved
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent link navigation when clicking dropdown toggle
                      setIsGetInvolvedDropdownOpen(!isGetInvolvedDropdownOpen);
                    }}
                    className="ml-1 p-1 rounded-full hover:bg-gray-700 focus:outline-none"
                  >
                    <svg
                      className={`h-4 w-4 transform ${isGetInvolvedDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </Link>
                {isGetInvolvedDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg py-1 z-20">
                    <Link
                      to="/ace"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                      onClick={() => setIsGetInvolvedDropdownOpen(false)}
                    >
                      ACE Program
                    </Link>
                    <Link
                      to="/house-system"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                      onClick={() => setIsGetInvolvedDropdownOpen(false)}
                    >
                      House System
                    </Link>
                    <Link
                      to="/intern-program"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                      onClick={() => setIsGetInvolvedDropdownOpen(false)}
                    >
                      Internship Program
                    </Link>
                  </div>
                )}
              </div>

              <Link to="/gallery" className="text-gray-300 hover:text-white transition-colors duration-200">
                Gallery
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
              {/* Events Dropdown for Mobile */}
              <div className="relative">
                <Link
                  to="/events"
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700 flex items-center justify-between"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Events
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent link navigation when clicking dropdown toggle
                      setIsEventsDropdownOpen(!isEventsDropdownOpen);
                    }}
                    className="ml-1 p-1 rounded-full hover:bg-gray-700 focus:outline-none"
                  >
                    <svg
                      className={`h-4 w-4 transform ${isEventsDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </Link>
                {isEventsDropdownOpen && (
                  <div className="pl-4 pr-2 py-1 space-y-1">
                    <Link
                      to="/vcn"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                      onClick={() => {
                        setIsEventsDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      VCN
                    </Link>
                    <Link
                      to="/wild-n-culture"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                      onClick={() => {
                        setIsEventsDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      Wild n' Culture
                    </Link>
                  </div>
                )}
              </div>
              
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
              
              {/* Get Involved Dropdown for Mobile */}
              <div className="relative">
                <Link
                  to="/get-involved"
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700 flex items-center justify-between"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get Involved
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent link navigation when clicking dropdown toggle
                      setIsGetInvolvedDropdownOpen(!isGetInvolvedDropdownOpen);
                    }}
                    className="ml-1 p-1 rounded-full hover:bg-gray-700 focus:outline-none"
                  >
                    <svg
                      className={`h-4 w-4 transform ${isGetInvolvedDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </Link>
                {isGetInvolvedDropdownOpen && (
                  <div className="pl-4 pr-2 py-1 space-y-1">
                    <Link
                      to="/ace"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                      onClick={() => {
                        setIsGetInvolvedDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      ACE Program
                    </Link>
                    <Link
                      to="/house-system"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                      onClick={() => {
                        setIsGetInvolvedDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      House System
                    </Link>
                    <Link
                      to="/intern-program"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                      onClick={() => {
                        setIsGetInvolvedDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      Internship Program
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/gallery"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Gallery
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