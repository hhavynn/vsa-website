import { Link, useLocation } from 'react-router-dom';
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

export const NavLinks = memo(function NavLinks({
  isMobile = false,
  className = '',
  onLinkClick,
}: NavLinksProps) {
  const location = useLocation();
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isGetInvolvedOpen, setIsGetInvolvedOpen] = useState(false);
  const eventsRef = useRef<HTMLDivElement>(null);
  const involvedRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = useMemo(() => [
    { path: '/', label: 'Home' },
    {
      path: '/events', label: 'Events', dropdown: true,
      items: [
        { path: '/events', label: 'All Events' },
        { path: '/vcn', label: 'VCN' },
        { path: '/wild-n-culture', label: "Wild n' Culture" },
      ],
    },
    { path: '/cabinet', label: 'Cabinet' },
    { path: '/leaderboard', label: 'Leaderboard' },
    {
      path: '/get-involved', label: 'Get Involved', dropdown: true,
      items: [
        { path: '/ace', label: 'ACE' },
        { path: '/house-system', label: 'House System' },
        { path: '/intern-program', label: 'Intern Program' },
      ],
    },
    { path: '/gallery', label: 'Gallery' },
  ], []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (eventsRef.current && !eventsRef.current.contains(e.target as Node)) setIsEventsOpen(false);
      if (involvedRef.current && !involvedRef.current.contains(e.target as Node)) setIsGetInvolvedOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDropdownToggle = (label: string) => {
    if (label === 'Events') setIsEventsOpen(v => !v);
    else if (label === 'Get Involved') setIsGetInvolvedOpen(v => !v);
  };

  const closeAll = () => {
    setIsEventsOpen(false);
    setIsGetInvolvedOpen(false);
    onLinkClick?.();
  };

  const isActive = (path: string) => location.pathname === path;
  const isDropdownOpen = (label: string) =>
    (label === 'Events' && isEventsOpen) || (label === 'Get Involved' && isGetInvolvedOpen);

  if (isMobile) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {navItems.map(item =>
          item.dropdown ? (
            <div key={item.label}>
              <button
                onClick={() => handleDropdownToggle(item.label)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors duration-150"
              >
                {item.label}
                <svg
                  className={`h-4 w-4 transition-transform duration-150 ${isDropdownOpen(item.label) ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {isDropdownOpen(item.label) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden pl-4 border-l border-zinc-700 ml-3"
                  >
                    {item.items?.map(sub => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        onClick={closeAll}
                        className="block px-3 py-2 text-sm text-zinc-400 hover:text-brand-400 hover:bg-zinc-800 rounded transition-colors duration-150"
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
              className={`block px-3 py-2.5 rounded text-sm font-medium transition-colors duration-150 ${
                isActive(item.path)
                  ? 'text-brand-400 bg-brand-600/10'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {item.label}
            </Link>
          )
        )}
      </div>
    );
  }

  return (
    <div className={`hidden sm:flex items-center gap-0.5 ${className}`}>
      {navItems.map(item =>
        item.dropdown ? (
          <div
            key={item.label}
            className="relative"
            ref={item.label === 'Events' ? eventsRef : item.label === 'Get Involved' ? involvedRef : undefined}
          >
            <button
              onClick={() => handleDropdownToggle(item.label)}
              className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors duration-150 ${
                isDropdownOpen(item.label)
                  ? 'text-white bg-zinc-800'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {item.label}
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-150 ${isDropdownOpen(item.label) ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {isDropdownOpen(item.label) && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  className="absolute left-0 top-full mt-1.5 w-44 rounded-md bg-zinc-900 border border-zinc-800 shadow-lg py-1 z-50"
                >
                  {item.items?.map(sub => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={closeAll}
                      className="block px-4 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors duration-150"
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
            className={`px-3 py-2 rounded text-sm font-medium transition-colors duration-150 ${
              isActive(item.path)
                ? 'text-white bg-zinc-800'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {item.label}
          </Link>
        )
      )}
    </div>
  );
});
