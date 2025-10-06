import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useAdmin } from '../../hooks/useAdmin';
import { Avatar } from '../Avatar/Avatar';
import { motion } from 'framer-motion';

interface UserMenuProps {
  isMobile?: boolean;
  className?: string;
  onLinkClick?: () => void;
}

export const UserMenu = memo(function UserMenu({ isMobile = false, className = '', onLinkClick }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { theme } = useTheme();

  const handleSignOut = () => {
    signOut();
    onLinkClick?.();
  };

  if (!user) {
    return (
      <div className={className}>
        <Link
          to="/signin"
          className={`inline-flex items-center px-4 py-2 border border-transparent text-lg font-bold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            theme === 'dark' ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'
          }`}
          onClick={onLinkClick}
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className={`space-y-1 ${className}`}>
        <Link
          to="/profile"
          className={`block px-3 py-2 text-base font-medium ${
            theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
          }`}
          onClick={onLinkClick}
        >
          Profile
        </Link>
        {isAdmin && (
          <Link
            to="/admin/events"
            className={`block px-3 py-2 text-base font-medium ${
              theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
            }`}
            onClick={onLinkClick}
          >
            Admin
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className={`w-full text-left px-3 py-2 text-base font-medium ${
            theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className={`hidden sm:flex sm:items-center ${className}`}>
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
    </div>
  );
});
