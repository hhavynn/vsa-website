import { Link, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';
import { ExplorePanel } from './ExplorePanel';
import { navLinkClass, usePublicEditorialRoute } from '../publicEditorialTheme';

interface NavItem {
  path: string;
  label: string;
}

// Desktop-only pinned nav items. "Home" is intentionally omitted — the logo
// handles home navigation. Everything else (Calendar, House, Points, Gallery,
// Cabinet, UVSA, WNC, program pages) lives in the shared ExplorePanel so
// desktop and mobile read from one destination map instead of two.
const FLAT_NAV_ITEMS: NavItem[] = [
  { path: '/events',      label: 'Events' },
  { path: '/leaderboard', label: 'Leaderboard' },
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

  const editorial = usePublicEditorialRoute();

  return (
    <div className={`hidden items-center md:flex ${editorial ? 'gap-5 lg:gap-8' : 'gap-1'}`}>
      {FLAT_NAV_ITEMS.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={navLinkClass(editorial, isActive(item.path))}
        >
          {item.label}
        </Link>
      ))}

      {/* Explore — shared three-group flyout (Quick Links / Get Involved / Explore) */}
      <ExplorePanel />
    </div>
  );
});
