import { Link, useLocation } from 'react-router-dom';
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NavItem {
  path: string;
  label: string;
  dropdown?: boolean;
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
    { path: '/events', label: 'Events', dropdown: true, items: [
      { path: '/events', label: 'All Events' },
      { path: '/vcn', label: 'VCN' },
      { path: '/wild-n-culture', label: "Wild n' Culture" },
    ]},
    { path: '/cabinet', label: 'Cabinet' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/get-involved', label: 'Get Involved', dropdown: true, items: [
      { path: '/ace', label: 'ACE' },
      { path: '/house-system', label: 'House System' },
      { path: '/intern-program', label: 'Intern Program' },
    ]},
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

  const isActive = (path: string) => location.pathname === path;
  const closeAll = () => { setOpenDropdown(null); onLinkClick?.(); };

  const linkBase = 'font-sans text-sm tracking-[-0.01em] transition-colors duration-150';
  const activeLink = 'text-brand-600 dark:text-brand-400 bg-[var(--color-surface2)] rounded px-[10px] py-[5px]';
  const inactiveLink = 'text-[var(--color-text2)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)] rounded px-[10px] py-[5px]';

  if (isMobile) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {navItems.map(item =>
          item.dropdown ? (
            <div key={item.label}>
              <button
                onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded ${linkBase} ${inactiveLink}`}
              >
                {item.label}
                <svg className={`h-3.5 w-3.5 transition-transform duration-150 ${openDropdown === item.label ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {openDropdown === item.label && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.12 }} className="overflow-hidden pl-4 border-l border-[var(--color-border)] ml-3">
                    {item.items?.map(sub => (
                      <Link key={sub.path} to={sub.path} onClick={closeAll} className={`block px-3 py-2 text-sm text-[var(--color-text2)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)] rounded transition-colors duration-150`}>
                        {sub.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link key={item.path} to={item.path} onClick={closeAll} className={`block px-3 py-2.5 rounded ${linkBase} ${isActive(item.path) ? 'text-brand-600 dark:text-brand-400 bg-[var(--color-surface2)]' : 'text-[var(--color-text2)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)]'}`}>
              {item.label}
            </Link>
          )
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`hidden sm:flex items-center gap-0.5 ${className}`}>
      {navItems.map(item =>
        item.dropdown ? (
          <div key={item.label} className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
              className={`inline-flex items-center gap-1 ${linkBase} ${inactiveLink} ${openDropdown === item.label ? 'text-[var(--color-text)]' : ''}`}
            >
              {item.label}
              <svg className={`h-3 w-3 transition-transform duration-150 ${openDropdown === item.label ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <AnimatePresence>
              {openDropdown === item.label && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }}
                  className="absolute left-0 top-full mt-1.5 w-44 rounded bg-[var(--color-surface)] border border-[var(--color-border)] shadow-card py-1 z-50"
                >
                  {item.items?.map(sub => (
                    <Link key={sub.path} to={sub.path} onClick={closeAll} className="block px-4 py-2 text-sm text-[var(--color-text2)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)] transition-colors duration-150">
                      {sub.label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link key={item.path} to={item.path} className={`${linkBase} ${isActive(item.path) ? activeLink : inactiveLink}`}>
            {item.label}
          </Link>
        )
      )}
    </div>
  );
});
