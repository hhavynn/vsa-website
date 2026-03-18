import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAdmin } from '../../../hooks/useAdmin';
import { Avatar } from '../../features/avatar/Avatar';

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
          className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 focus:ring-offset-zinc-950"
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
          className="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors duration-150"
        >
          <Avatar size="sm" />
          <span>Profile</span>
        </Link>
        {isAdmin && (
          <Link
            to="/admin/events"
            onClick={onLinkClick}
            className="block px-3 py-2.5 rounded text-sm font-medium text-accent-400 hover:text-accent-300 hover:bg-zinc-800 transition-colors duration-150"
          >
            Admin Panel
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2.5 rounded text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors duration-150"
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
          className="text-sm font-medium text-accent-400 hover:text-accent-300 transition-colors duration-150"
        >
          Admin
        </Link>
      )}
      <Link
        to="/profile"
        className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors duration-150"
      >
        <Avatar size="sm" />
        <span>Profile</span>
      </Link>
      <button
        onClick={signOut}
        className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-zinc-950"
      >
        Sign Out
      </button>
    </div>
  );
});
