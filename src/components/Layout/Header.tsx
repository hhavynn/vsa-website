import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { usePoints } from '../../hooks/usePoints';

export function Header() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { points } = usePoints();
  const [userName, setUserName] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGetInvolvedDropdownOpen, setIsGetInvolvedDropdownOpen] = useState(false);
  const [isEventsDropdownOpen, setIsEventsDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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

  const getNavLinkClass = (path: string) => (
    `text-gray-300 hover:text-white transition-colors duration-200 ${location.pathname === path ? 'text-white font-semibold' : ''}`
  );

  return (
    <header className={`text-white shadow-lg relative z-10 transition-colors duration-300 ${isScrolled ? 'bg-gray-800/90 backdrop-blur-sm' : 'bg-gray-800'}`}>
      <div className="h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center text-lg font-bold text-gray-100 hover:text-white transition-colors duration-200">
              <img src="/images/vsa-logo.png" alt="VSA Logo" className="h-8 w-8 mr-2" loading="lazy" />
              <span className="hidden sm:inline">VSA</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6 ml-6">
              {/* Events Dropdown for Desktop */}
              <div className="relative group">
                <Link to="/events" className={`${getNavLinkClass('/events')} flex items-center group-hover:text-white`}>
                  Events
                  <button
                    onClick={(e) => {
                      e.preventDefault();
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
                      className={`${getNavLinkClass('/vcn')} block px-4 py-2 text-sm hover:bg-gray-600 hover:text-white`}
                      onClick={() => setIsEventsDropdownOpen(false)}
                    >
                      VCN
                    </Link>
                    <Link
                      to="/wild-n-culture"
                      className={`${getNavLinkClass('/wild-n-culture')} block px-4 py-2 text-sm hover:bg-gray-600 hover:text-white`}
                      onClick={() => setIsEventsDropdownOpen(false)}
                    >
                      Wild n' Culture
                    </Link>
                  </div>
                )}
              </div>
              
              <Link to="/leaderboard" className={getNavLinkClass('/leaderboard')}>Leaderboard</Link>
              <Link to="/cabinet" className={getNavLinkClass('/cabinet')}>Cabinet</Link>
              
              {/* Get Involved Dropdown for Desktop */}
              <div className="relative group">
                <Link to="/get-involved" className={`${getNavLinkClass('/get-involved')} flex items-center group-hover:text-white`}>
                  Get Involved
                  <button
                    onClick={(e) => {
                      e.preventDefault();
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
                      className={`${getNavLinkClass('/ace')} block px-4 py-2 text-sm hover:bg-gray-600 hover:text-white`}
                      onClick={() => setIsGetInvolvedDropdownOpen(false)}
                    >
                      ACE Program
                    </Link>
                    <Link
                      to="/house-system"
                      className={`${getNavLinkClass('/house-system')} block px-4 py-2 text-sm hover:bg-gray-600 hover:text-white`}
                      onClick={() => setIsGetInvolvedDropdownOpen(false)}
                    >
                      House System
                    </Link>
                    <Link
                      to="/intern-program"
                      className={`${getNavLinkClass('/intern-program')} block px-4 py-2 text-sm hover:bg-gray-600 hover:text-white`}
                      onClick={() => setIsGetInvolvedDropdownOpen(false)}
                    >
                      Internship Program
                    </Link>
                  </div>
                )}
              </div>

              <Link to="/gallery" className={getNavLinkClass('/gallery')}>Gallery</Link>
              {isAdmin && (
                <Link to="/admin/events" className={getNavLinkClass('/admin/events')}>Admin</Link>
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
                {userName && (
                  <span className="text-gray-300">Hello, {userName}!</span>
                )}
                <div className="flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm text-yellow-400 font-medium">{points !== null ? `${points} pts` : '-- pts'}</span>
                </div>
                <Link
                  to="/profile"
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Profile
                </Link>
                <button
                  onClick={signOut}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-gray-800 py-2">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                to="/events"
                className={`${getNavLinkClass('/events')} block px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                Events
              </Link>
              {/* Mobile Events Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsEventsDropdownOpen(!isEventsDropdownOpen)}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-between"
                >
                  <span>Events</span>
                  <svg
                    className={`h-5 w-5 transform ${isEventsDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
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
                {isEventsDropdownOpen && (
                  <div className="pl-4 space-y-1">
                    <Link
                      to="/vcn"
                      className={`${getNavLinkClass('/vcn')} block px-3 py-2 rounded-md text-base font-medium`}
                      onClick={() => {
                        setIsEventsDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      VCN
                    </Link>
                    <Link
                      to="/wild-n-culture"
                      className={`${getNavLinkClass('/wild-n-culture')} block px-3 py-2 rounded-md text-base font-medium`}
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
                className={`${getNavLinkClass('/leaderboard')} block px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                Leaderboard
              </Link>
              <Link
                to="/cabinet"
                className={`${getNavLinkClass('/cabinet')} block px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                Cabinet
              </Link>
              {/* Mobile Get Involved Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsGetInvolvedDropdownOpen(!isGetInvolvedDropdownOpen)}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-between"
                >
                  <span>Get Involved</span>
                  <svg
                    className={`h-5 w-5 transform ${isGetInvolvedDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
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
                {isGetInvolvedDropdownOpen && (
                  <div className="pl-4 space-y-1">
                    <Link
                      to="/ace"
                      className={`${getNavLinkClass('/ace')} block px-3 py-2 rounded-md text-base font-medium`}
                      onClick={() => {
                        setIsGetInvolvedDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      ACE Program
                    </Link>
                    <Link
                      to="/house-system"
                      className={`${getNavLinkClass('/house-system')} block px-3 py-2 rounded-md text-base font-medium`}
                      onClick={() => {
                        setIsGetInvolvedDropdownOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      House System
                    </Link>
                    <Link
                      to="/intern-program"
                      className={`${getNavLinkClass('/intern-program')} block px-3 py-2 rounded-md text-base font-medium`}
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
                className={`${getNavLinkClass('/gallery')} block px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                Gallery
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/events"
                  className={`${getNavLinkClass('/admin/events')} block px-3 py-2 rounded-md text-base font-medium`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              {user && (
                <>
                  <Link
                    to="/profile"
                    className={`${getNavLinkClass('/profile')} block px-3 py-2 rounded-md text-base font-medium`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 