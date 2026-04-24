import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAdmin } from '../../../hooks/useAdmin';
import { useTheme } from '../../../context/ThemeContext';
import { Button } from '../../ui/Button';

interface UserMenuProps {
  isMobile?: boolean;
  className?: string;
  onLinkClick?: () => void;
}

function ThemeToggleInline() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="flex items-center justify-center w-[30px] h-[30px] rounded border border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text2)] hover:text-[var(--color-text)] transition-colors duration-150 shrink-0"
    >
      {isDark ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export const UserMenu = memo(function UserMenu({ isMobile = false, className = '', onLinkClick }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  if (!user) {
    return (
      <div className={`hidden sm:flex items-center gap-2.5 ${className}`}>
        <Link to="/signin" onClick={onLinkClick}>
          <Button variant="outline" size="sm">Sign In</Button>
        </Link>
        <ThemeToggleInline />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        <Link to="/profile" onClick={onLinkClick} className="block px-3 py-2.5 rounded text-sm font-medium text-[var(--color-text2)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)] transition-colors duration-150">
          Profile
        </Link>
        {isAdmin && (
          <Link to="/admin/events" onClick={onLinkClick} className="block px-3 py-2.5 rounded text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-[var(--color-surface2)] transition-colors duration-150">
            Admin Panel
          </Link>
        )}
        <button onClick={() => { signOut(); onLinkClick?.(); }} className="w-full text-left px-3 py-2.5 rounded text-sm font-medium text-[var(--color-text2)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)] transition-colors duration-150">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className={`hidden sm:flex items-center gap-2.5 ${className}`}>
      {isAdmin && (
        <Link to="/admin/events" className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:opacity-80 transition-opacity duration-150">
          Admin
        </Link>
      )}
      <Link to="/profile" className="text-sm font-medium text-[var(--color-text2)] hover:text-[var(--color-text)] transition-colors duration-150">
        Profile
      </Link>
      <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
      <ThemeToggleInline />
    </div>
  );
});
