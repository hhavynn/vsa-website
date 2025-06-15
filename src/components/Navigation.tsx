import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useAdmin } from '../hooks/useAdmin';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Avatar } from './Avatar/Avatar';

interface NavItem {
  path: string;
  label: string;
  dropdown?: boolean;
  items?: Array<{
    path: string;
    label: string;
  }>;
}

export function Navigation() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const { theme } = useTheme();
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isGetInvolvedOpen, setIsGetInvolvedOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { path: '/', label: 'Home' },
    { 
      path: '/events',
      label: 'Events',
      dropdown: true,
      items: [
        { path: '/events', label: 'All Events' },
        { path: '/vcn', label: 'VCN' },
        { path: '/wild-n-culture', label: 'Wild n\' Culture' }
      ]
    },
    { path: '/cabinet', label: 'Cabinet' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { 
      path: '/get-involved',
      label: 'Get Involved',
      dropdown: true,
      items: [
        { path: '/ace', label: 'ACE' },
        { path: '/house-system', label: 'House System' },
        { path: '/intern-program', label: 'Intern Program' }
      ]
    },
    { path: '/gallery', label: 'Gallery' },
  ];

  return (
    <nav className={`shadow-lg bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo and nav */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center">
              <img
                src="/images/vsa-logo.png"
                alt="VSA Logo"
                className="h-12 w-12 object-contain rounded-md shadow-md border-2 border-indigo-600 bg-white"
              />
            </Link>
            {/* Desktop Navigation */}
            <div className="hidden sm:flex sm:space-x-6">
              {navItems.map((item) => (
                item.dropdown ? (
                  <div key={item.label} className="relative group">
                    <button
                      onClick={() => {
                        if (item.label === 'Events') setIsEventsOpen(!isEventsOpen);
                        if (item.label === 'Get Involved') setIsGetInvolvedOpen(!isGetInvolvedOpen);
                      }}
                      className={`inline-flex items-center font-bold text-lg px-2 py-1 transition-colors duration-150 rounded-md ${
                        (item.label === 'Events' && isEventsOpen) || (item.label === 'Get Involved' && isGetInvolvedOpen)
                          ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/50' :
                          theme === 'dark' ? 'text-gray-100 hover:text-indigo-400 hover:bg-gray-800' : 'text-gray-800 hover:text-indigo-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="mr-1">{item.label}</span>
                      <svg
                        className={`h-5 w-5 transition-transform duration-200 ${
                          (item.label === 'Events' && isEventsOpen) || (item.label === 'Get Involved' && isGetInvolvedOpen)
                            ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {(item.label === 'Events' && isEventsOpen) || (item.label === 'Get Involved' && isGetInvolvedOpen) ? (
                      <div className="absolute left-0 z-20 mt-2 w-56 rounded-lg shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5">
                        <div className="py-2">
                          {item.items?.map((subItem) => (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className="block px-5 py-2 text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors"
                              onClick={() => {
                                setIsEventsOpen(false);
                                setIsGetInvolvedOpen(false);
                              }}
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center font-bold text-lg px-2 py-1 rounded-md transition-colors duration-150 ${
                      location.pathname === item.path
                        ? 'text-indigo-600 underline underline-offset-8 decoration-2 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/50' :
                        theme === 'dark' ? 'text-gray-100 hover:text-indigo-400 hover:bg-gray-800' : 'text-gray-800 hover:text-indigo-600 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              ))}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`inline-flex items-center justify-center p-2 rounded-md ${
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              } hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500`}
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg className="block h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Desktop User Menu */}
          <div className="hidden sm:flex sm:items-center">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Avatar size="sm" />
                  <Link
                    to="/profile"
                    className={`text-lg font-bold ${
                      theme === 'dark' ? 'text-gray-100 hover:text-white' : 'text-gray-800 hover:text-gray-900'
                    }`}
                  >
                    Profile
                  </Link>
                </div>
                {isAdmin && (
                  <Link
                    to="/admin/events"
                    className={`text-lg font-bold ${
                      theme === 'dark' ? 'text-gray-100 hover:text-white' : 'text-gray-800 hover:text-gray-900'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={signOut}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-lg font-bold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    theme === 'dark' ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
                  }`}
                >
                  Sign Out
                </motion.button>
              </div>
            ) : (
              <Link
                to="/signin"
                className={`inline-flex items-center px-4 py-2 border border-transparent text-lg font-bold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  theme === 'dark' ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
                }`}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden"
          >
            <div className={`pt-2 pb-3 space-y-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
              {navItems.map((item) => (
                item.dropdown ? (
                  <div key={item.label}>
                    <button
                      onClick={() => {
                        if (item.label === 'Events') setIsEventsOpen(!isEventsOpen);
                        if (item.label === 'Get Involved') setIsGetInvolvedOpen(!isGetInvolvedOpen);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-base font-medium ${
                        theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                      <svg
                        className={`ml-2 h-5 w-5 transform transition-transform ${
                          (item.label === 'Events' && isEventsOpen) || (item.label === 'Get Involved' && isGetInvolvedOpen)
                            ? 'rotate-180'
                            : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <AnimatePresence>
                      {((item.label === 'Events' && isEventsOpen) || (item.label === 'Get Involved' && isGetInvolvedOpen)) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="pl-4"
                        >
                          {item.items?.map((subItem) => (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`block px-3 py-2 text-base font-medium ${
                                theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                              }`}
                              onClick={() => {
                                setIsEventsOpen(false);
                                setIsGetInvolvedOpen(false);
                                setIsMobileMenuOpen(false);
                              }}
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-3 py-2 text-base font-medium ${
                      theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              ))}
            </div>

            {/* Mobile User Menu */}
            <div className={`pt-4 pb-3 border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
              {user ? (
                <div className="space-y-1">
                  <Link
                    to="/profile"
                    className={`block px-3 py-2 text-base font-medium ${
                      theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin/events"
                      className={`block px-3 py-2 text-base font-medium ${
                        theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      signOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-base font-medium ${
                      theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/signin"
                  className={`block px-3 py-2 text-base font-medium ${
                    theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
} 