import { Link, useLocation } from 'react-router-dom';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NavItem {
  path: string;
  label: string;
  items?: Array<{ path: string; label: string }>;
}

interface NavLinksProps {
  isMobile?: boolean;
  className?: string;
  onLinkClick?: () => void;
}

export const NavLinks = memo(function NavLinks({ isMobile = false, className = '', onLinkClick }: NavLinksProps) {
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = useMemo(() => [
    {
      path: '/events',
      label: 'Events',
      items: [
        { path: '/events', label: 'All Events' },
        { path: '/vcn', label: 'VCN' },
        { path: '/wild-n-culture', label: "Wild n' Culture" },
      ],
    },
    { path: '/cabinet', label: 'Cabinet' },
    { path: '/leaderboard', label: 'Leaderboard' },
    {
      path: '/get-involved',
      label: 'Get Involved',
      items: [
        { path: '/get-involved', label: 'Overview' },
        { path: '/ace', label: 'ACE' },
        { path: '/house-system', label: 'House System' },
        { path: '/intern-program', label: 'Intern Program' },
      ],
    },
    { path: '/gallery', label: 'Gallery' },
  ], []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (item: NavItem | string) => {
    if (typeof item === 'string') return location.pathname === item;
    return location.pathname === item.path || !!item.items?.some((sub) => location.pathname === sub.path);
  };

  const closeAll = () => {
    setOpenDropdown(null);
    onLinkClick?.();
  };

  const linkBase = 'font-sans text-[13.5px] font-medium transition-colors duration-150';
  const activeLink = 'text-[var(--brand)] bg-[var(--surface2)]';
  const inactiveLink = 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]';

  if (isMobile) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {navItems.map((item) => (
          item.items ? (
            <div key={item.label}>
              <button
                onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 ${linkBase} ${isActive(item) ? activeLink : inactiveLink}`}
              >
                {item.label}
                <svg className={`h-3.5 w-3.5 transition-transform duration-150 ${openDropdown === item.label ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {openDropdown === item.label && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.14 }}
                    className="ml-3 overflow-hidden border-l-2 border-[var(--border2)] pl-3"
                  >
                    {item.items.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        onClick={closeAll}
                        className="block rounded-lg px-3 py-2 text-[13px] text-[var(--text2)] transition-colors duration-150 hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeAll}
              className={`block rounded-lg px-3 py-2.5 ${linkBase} ${isActive(item) ? activeLink : inactiveLink}`}
            >
              {item.label}
            </Link>
          )
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`hidden items-center gap-0.5 md:flex ${className}`}>
      {navItems.map((item) => (
        item.items ? (
          <div key={item.label} className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 ${linkBase} ${isActive(item) ? activeLink : inactiveLink}`}
            >
              {item.label}
              <svg className={`h-3 w-3 transition-transform duration-150 ${openDropdown === item.label ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <AnimatePresence>
              {openDropdown === item.label && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full z-50 mt-2 w-44 rounded-[10px] border border-[var(--border2)] bg-[var(--surface)] p-1 shadow-card"
                >
                  {item.items.map((sub) => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={closeAll}
                      className="block rounded-md px-3 py-2 text-[13.5px] text-[var(--text2)] transition-colors duration-150 hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                    >
                      {sub.label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link
            key={item.path}
            to={item.path}
            className={`rounded-md px-3 py-1.5 ${linkBase} ${isActive(item) ? activeLink : inactiveLink}`}
          >
            {item.label}
          </Link>
        )
      ))}
    </div>
  );
});
