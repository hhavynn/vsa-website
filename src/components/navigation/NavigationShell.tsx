import { memo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { NavLogo } from './NavLogo';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';
import { MobileDrawer } from './MobileDrawer';

export const NavigationShell = memo(function NavigationShell() {
  const { theme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`shadow-lg bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo and nav */}
          <div className="flex items-center space-x-8">
            <NavLogo />
            <NavLinks />
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={toggleMobileMenu}
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
          <UserMenu />
        </div>
      </div>

      {/* Mobile menu */}
      <MobileDrawer isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </nav>
  );
});
