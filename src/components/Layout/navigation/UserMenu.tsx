import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAdmin } from '../../../hooks/useAdmin';
import { Avatar } from '../../features/avatar/Avatar';
import { motion } from 'framer-motion';

interface UserMenuProps {
  isMobile?: boolean;
  className?: string;
  onLinkClick?: () => void;
}

export const UserMenu = memo(function UserMenu({
  isMobile = false,
  className = '',
  onLinkClick,
}: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  const handleSignOut = () => {
    signOut();
    onLinkClick?.();
  };

  if (!user) {
    return (
      <div className={className}>
        <Link
          to="/signin"
          onClick={onLinkClick}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        <Link
          to="/profile"
          onClick={onLinkClick}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors duration-150"
        >
          <Avatar size="sm" />
          <span>Profile</span>
        </Link>
        {isAdmin && (
          <Link
            to="/admin/events"
            onClick={onLinkClick}
            className="block px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors duration-150"
          >
            Admin Panel
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors duration-150"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className={`hidden sm:flex items-center gap-3 ${className}`}>
      {isAdmin && (
        <Link
          to="/admin/events"
          className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors duration-150"
        >
          Admin
        </Link>
      )}
      <Link
        to="/profile"
        className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors duration-150"
      >
        <Avatar size="sm" />
        <span>Profile</span>
      </Link>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={signOut}
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        Sign Out
      </motion.button>
    </div>
  );
});
