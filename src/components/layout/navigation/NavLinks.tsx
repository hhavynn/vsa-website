import { Link, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

interface NavItem {
  path: string;
  label: string;
}

interface NavLinksProps {
  isMobile?: boolean;
  className?: string;
  onLinkClick?: () => void;
}

export const NavLinks = memo(function NavLinks({ isMobile = false, className = '', onLinkClick }: NavLinksProps) {
  const location = useLocation();

  const navItems: NavItem[] = useMemo(() => [
    { path: '/', label: 'Home' },
    { path: '/events', label: 'Events' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/gallery', label: 'Gallery' },
    { path: '/cabinet', label: 'Cabinet' },
    { path: '/uvsa-network', label: 'UVSA Network' },
    { path: '/get-involved', label: 'Get Involved' },
  ], []);

  const isActive = (item: NavItem | string) => {
    if (typeof item === 'string') return location.pathname === item;
    if (item.path === '/') return location.pathname === '/';
    return location.pathname === item.path;
  };

  const closeAll = () => {
    onLinkClick?.();
  };

  const linkBase = 'font-sans text-[13px] font-semibold transition-colors duration-150';
  const activeLink = 'text-[var(--brand)] bg-[var(--surface2)] border-[var(--border2)]';
  const inactiveLink = 'text-[var(--text2)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--border)]';

  if (isMobile) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={closeAll}
            className={`block rounded-lg border px-3 py-2.5 ${linkBase} ${isActive(item) ? activeLink : inactiveLink}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className={`hidden items-center gap-1 md:flex ${className}`}>
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`rounded-lg border px-3 py-1.5 ${linkBase} ${isActive(item) ? activeLink : inactiveLink}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
});
