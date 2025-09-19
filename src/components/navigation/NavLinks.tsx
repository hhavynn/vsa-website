import { Link, useLocation } from 'react-router-dom';
import { memo, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface NavItem {
  path: string;
  label: string;
  dropdown?: boolean;
  items?: Array<{
    path: string;
    label: string;
  }>;
}

interface NavLinksProps {
  isMobile?: boolean;
  className?: string;
  onLinkClick?: () => void;
}

export const NavLinks = memo(function NavLinks({ isMobile = false, className = '', onLinkClick }: NavLinksProps) {
  const location = useLocation();
  const { theme } = useTheme();
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isGetInvolvedOpen, setIsGetInvolvedOpen] = useState(false);

  const navItems: NavItem[] = useMemo(() => [
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
  ], []);

  const handleDropdownToggle = (label: string) => {
    if (label === 'Events') {
      setIsEventsOpen(!isEventsOpen);
    } else if (label === 'Get Involved') {
      setIsGetInvolvedOpen(!isGetInvolvedOpen);
    }
  };

  const closeDropdowns = () => {
    setIsEventsOpen(false);
    setIsGetInvolvedOpen(false);
    onLinkClick?.();
  };

  const getLinkClassName = (path: string) => {
    const baseClasses = isMobile 
      ? 'block px-3 py-2 text-base font-medium'
      : 'inline-flex items-center font-bold text-lg px-2 py-1 rounded-md transition-colors duration-150';
    
    const activeClasses = location.pathname === path
      ? 'text-indigo-600 underline underline-offset-8 decoration-2 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/50'
      : theme === 'dark' 
        ? 'text-gray-100 hover:text-indigo-400 hover:bg-gray-800' 
        : 'text-gray-800 hover:text-indigo-600 hover:bg-gray-100';
    
    return `${baseClasses} ${activeClasses}`;
  };

  const getDropdownButtonClassName = (label: string) => {
    const baseClasses = isMobile
      ? 'w-full flex items-center justify-between px-3 py-2 text-base font-medium'
      : 'inline-flex items-center font-bold text-lg px-2 py-1 transition-colors duration-150 rounded-md';
    
    const isOpen = (label === 'Events' && isEventsOpen) || (label === 'Get Involved' && isGetInvolvedOpen);
    const activeClasses = isOpen
      ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/50'
      : theme === 'dark' 
        ? 'text-gray-100 hover:text-indigo-400 hover:bg-gray-800' 
        : 'text-gray-800 hover:text-indigo-600 hover:bg-gray-100';
    
    return `${baseClasses} ${activeClasses}`;
  };

  if (isMobile) {
    return (
      <div className={`space-y-1 ${className}`}>
        {navItems.map((item) => (
          item.dropdown ? (
            <div key={item.label}>
              <button
                onClick={() => handleDropdownToggle(item.label)}
                className={getDropdownButtonClassName(item.label)}
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
              {((item.label === 'Events' && isEventsOpen) || (item.label === 'Get Involved' && isGetInvolvedOpen)) && (
                <div className="pl-4">
                  {item.items?.map((subItem) => (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      className={`block px-3 py-2 text-base font-medium ${
                        theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                      onClick={closeDropdowns}
                    >
                      {subItem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              key={item.path}
              to={item.path}
              className={getLinkClassName(item.path)}
              onClick={closeDropdowns}
            >
              {item.label}
            </Link>
          )
        ))}
      </div>
    );
  }

  return (
    <div className={`hidden sm:flex sm:space-x-6 ${className}`}>
      {navItems.map((item) => (
        item.dropdown ? (
          <div key={item.label} className="relative group">
            <button
              onClick={() => handleDropdownToggle(item.label)}
              className={getDropdownButtonClassName(item.label)}
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
                      onClick={closeDropdowns}
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
            className={getLinkClassName(item.path)}
          >
            {item.label}
          </Link>
        )
      ))}
    </div>
  );
});
