import { Link, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';
import { GetInvolvedDropdown } from './GetInvolvedDropdown';

interface NavItem {
  path: string;
  label: string;
}

// Desktop-only flat nav items. "Home" is intentionally omitted — the logo
// handles home navigation. "Get Involved" is handled by GetInvolvedDropdown.
const FLAT_NAV_ITEMS: NavItem[] = [
  { path: '/events',       label: 'Events' },
  { path: '/leaderboard',  label: 'Leaderboard' },
  { path: '/gallery',      label: 'Gallery' },
  { path: '/cabinet',      label: 'Cabinet' },
  { path: '/uvsa-network', label: 'Network' },
];

export const NavLinks = memo(function NavLinks() {
  const location = useLocation();

  const isActive = useMemo(
    () => (path: string) => {
      if (path === '/') return location.pathname === '/';
      return location.pathname === path || location.pathname.startsWith(path + '/');
    },
    [location.pathname]
  );

  const linkBase =
    'font-sans text-[13px] font-semibold transition-colors duration-150 rounded-lg border px-3 py-1.5';
  const activeLink =
    'text-[var(--brand)] bg-[var(--surface2)] border-[var(--border2)]';
  const inactiveLink =
    'text-[var(--text2)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--border)]';

  return (
    <div className="hidden items-center gap-1 md:flex">
      {FLAT_NAV_ITEMS.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`${linkBase} ${isActive(item.path) ? activeLink : inactiveLink}`}
        >
          {item.label}
        </Link>
      ))}

      {/* Get Involved — separate component with flyout dropdown */}
      <GetInvolvedDropdown />
    </div>
  );
});
