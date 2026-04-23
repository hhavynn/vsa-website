import { Link, useLocation } from 'react-router-dom';
import { memo, useState, useRef, useEffect } from 'react';
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

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home' },
  {
    path: '/events',
    label: 'Events',
    dropdown: true,
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
    dropdown: true,
    items: [
      { path: '/ace', label: 'ACE' },
      { path: '/house-system', label: 'House System' },
      { path: '/intern-program', label: 'Intern Program' },
    ],
  },
  { path: '/gallery', label: 'Gallery' },
];

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
        {NAV_ITEMS.map(item =>
          item.dropdown ? (
            <div key={item.label}>
              <button
                onClick={() => handleDropdownToggle(item.label)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors duration-150"
              >
                {item.label}
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen(item.label) ? 'rotate-180' : ''}`}
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
                    className="overflow-hidden pl-4 border-l border-slate-700/50 ml-3"
                  >
                    {item.items?.map(sub => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        onClick={closeAll}
                        className="block px-3 py-2 text-sm text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors duration-150"
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
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive(item.path)
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
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
    <div className={`hidden sm:flex items-center gap-1 ${className}`}>
      {NAV_ITEMS.map(item =>
        item.dropdown ? (
          <div
            key={item.label}
            className="relative"
            ref={item.label === 'Events' ? eventsRef : item.label === 'Get Involved' ? involvedRef : undefined}
          >
            <button
              onClick={() => handleDropdownToggle(item.label)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isDropdownOpen(item.label)
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-200 ${isDropdownOpen(item.label) ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {isDropdownOpen(item.label) && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute left-0 top-full mt-2 w-44 rounded-xl bg-slate-900 border border-slate-700/60 shadow-card backdrop-blur-sm py-1 z-50"
                >
                  {item.items?.map(sub => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={closeAll}
                      className="block px-4 py-2.5 text-sm text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors duration-150"
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
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
              isActive(item.path)
                ? 'text-indigo-400 bg-indigo-500/10'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.label}
          </Link>
        )
      )}
    </div>
  );
});
