import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface InvolvementLink {
  path: string;
  label: string;
  description: string;
  emoji: string;
}

const LINKS: InvolvementLink[] = [
  {
    path: '/get-involved',
    label: 'Start Here',
    description: 'New to VSA? This is your entry point.',
    emoji: '👋',
  },
  {
    path: '/house',
    label: 'House',
    description: 'Join a house fam and compete through the year.',
    emoji: '🏠',
  },
  {
    path: '/ace',
    label: 'ACE',
    description: 'Big/Little mentorship and fam bonds.',
    emoji: '🌱',
  },
  {
    path: '/intern-program',
    label: 'Intern Program',
    description: 'Learn cabinet work and help run VSA.',
    emoji: '📋',
  },
  {
    path: '/vcn',
    label: 'VCN',
    description: 'Vietnamese Cultural Night performing arts.',
    emoji: '🎭',
  },
];

// Parent is "active" if user is on any involvement-related page
const INVOLVEMENT_PREFIXES = LINKS.map((l) => l.path);

export function GetInvolvedDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();

  const isActive = INVOLVEMENT_PREFIXES.some((prefix) =>
    location.pathname === prefix || location.pathname.startsWith(prefix + '/')
  );

  const close = useCallback(() => setOpen(false), []);
  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(close, 120);
  }, [close]);
  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  // Close on route change
  useEffect(() => { close(); }, [location.pathname, close]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        containerRef.current?.querySelector('a')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const linkBase = 'font-sans text-[13px] font-semibold transition-colors duration-150';
  const activeState = 'text-[var(--brand)] bg-[var(--surface2)] border-[var(--border2)]';
  const inactiveState =
    'text-[var(--text2)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--border)]';

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onFocus={() => { cancelClose(); setOpen(true); }}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          scheduleClose();
        }
      }}
    >
      {/* Trigger — click navigates to /get-involved; hover/focus opens dropdown */}
      <Link
        to="/get-involved"
        className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 ${linkBase} ${isActive ? activeState : inactiveState}`}
        aria-label="Get Involved"
      >
        Get Involved
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Link>

      {/* Flyout panel */}
      {open && (
        <div
          role="menu"
          aria-label="Get Involved programs"
          className="absolute right-0 top-full z-50 mt-1.5 w-[272px] overflow-hidden rounded-xl border"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            boxShadow:
              '0 8px 32px rgba(20,32,40,0.13), 0 2px 8px rgba(20,32,40,0.08)',
          }}
        >
          {/* Panel header */}
          <div
            className="border-b px-4 py-3"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface2)',
            }}
          >
            <p
              className="font-serif text-[14px] leading-tight"
              style={{ color: 'var(--color-text)' }}
            >
              Ways to get involved
            </p>
            <p
              className="mt-0.5 font-sans text-[11px]"
              style={{ color: 'var(--color-text3)' }}
            >
              Find your place in VSA.
            </p>
          </div>

          {/* Links */}
          <div className="py-1.5">
            {LINKS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                role="menuitem"
                onClick={close}
                className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-100 hover:bg-[var(--color-surface2)] focus:bg-[var(--color-surface2)] focus:outline-none"
              >
                <span
                  className="mt-0.5 shrink-0 text-[15px] leading-none"
                  aria-hidden="true"
                >
                  {item.emoji}
                </span>
                <div className="min-w-0">
                  <div
                    className="font-sans text-[13px] font-semibold leading-snug"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="mt-0.5 font-sans text-[11px] leading-snug"
                    style={{ color: 'var(--color-text3)' }}
                  >
                    {item.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
