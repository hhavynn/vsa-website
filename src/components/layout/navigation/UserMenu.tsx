import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAdmin } from '../../../hooks/useAdmin';
import { useTheme } from '../../../context/ThemeContext';

interface UserMenuProps {
  isMobile?: boolean;
  className?: string;
  onLinkClick?: () => void;
}

function ThemeToggleInline({ isMobile = false }: { isMobile?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`${isMobile ? 'h-10 w-full justify-start gap-2 px-3' : 'h-9 w-9 justify-center'} flex items-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text2)] transition-colors duration-150 hover:border-[var(--brand)] hover:text-[var(--brand)]`}
    >
      {isDark ? (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" strokeWidth={1.8} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {isMobile && <span className="font-sans text-[13.5px] font-medium">Theme</span>}
    </button>
  );
}

export const UserMenu = memo(function UserMenu({ isMobile = false, className = '', onLinkClick }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  const mobileLinkClass = 'block rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[var(--text2)] transition-colors duration-150 hover:bg-[var(--surface2)] hover:text-[var(--text)]';

  if (isMobile) {
    return (
      <div className={`space-y-1 ${className}`}>
        {!user ? (
          <Link
            to="/signin"
            onClick={onLinkClick}
            className="block rounded-lg bg-[var(--brand)] px-3 py-2.5 text-[13.5px] font-semibold text-[#f8fbfb]"
          >
            Sign In
          </Link>
        ) : (
          <>
            <Link to="/profile" onClick={onLinkClick} className={mobileLinkClass}>
              Profile
            </Link>
            {isAdmin && (
              <Link to="/admin/events" onClick={onLinkClick} className="block rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-[var(--accent)] transition-colors duration-150 hover:bg-[var(--surface2)]">
                Admin
              </Link>
            )}
            <button
              onClick={() => { signOut(); onLinkClick?.(); }}
              className={`${mobileLinkClass} w-full text-left`}
            >
              Sign Out
            </button>
          </>
        )}
        <ThemeToggleInline isMobile />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`hidden items-center gap-2.5 md:flex ${className}`}>
        <ThemeToggleInline />
        <Link
          to="/signin"
          onClick={onLinkClick}
          className="rounded-lg bg-[var(--brand)] px-[18px] py-2 text-[13px] font-semibold text-[#f8fbfb] transition-all duration-200 hover:-translate-y-px hover:brightness-110"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className={`hidden items-center gap-2.5 md:flex ${className}`}>
      {isAdmin && (
        <Link to="/admin/events" className="text-[13.5px] font-semibold text-[var(--accent)] transition-opacity duration-150 hover:opacity-80">
          Admin
        </Link>
      )}
      <Link to="/profile" className="text-[13.5px] font-medium text-[var(--text2)] transition-colors duration-150 hover:text-[var(--text)]">
        Profile
      </Link>
      <button
        onClick={signOut}
        className="rounded-lg border border-[var(--border2)] px-3 py-2 text-[13px] font-medium text-[var(--text2)] transition-colors duration-150 hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      >
        Sign Out
      </button>
      <ThemeToggleInline />
    </div>
  );
});
