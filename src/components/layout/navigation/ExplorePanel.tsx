import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { QUICK_LINKS, GET_INVOLVED, EXPLORE_LINKS, INVOLVEMENT_PREFIXES, isRouteActive } from './navConfig';

// Desktop nav — single "Explore" trigger opening a three-group flyout
// (Quick Links / Get Involved / Explore). Replaces the old GetInvolvedDropdown,
// which only surfaced Get Involved and left House, Points, and Wild N' Culture
// out of the always-visible top nav entirely.

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{ color: 'var(--color-text3)' }}
    >
      {children}
    </div>
  );
}

export function ExplorePanel() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();

  const isInvolvedActive = INVOLVEMENT_PREFIXES.some((prefix) => isRouteActive(location.pathname, prefix));
  const isExploreGroupActive = EXPLORE_LINKS.some((l) => isRouteActive(location.pathname, l.path));
  const isQuickLinkActive = QUICK_LINKS.some((l) => isRouteActive(location.pathname, l.path));
  const triggerActive = isInvolvedActive || isExploreGroupActive || isQuickLinkActive;

  const close = useCallback(() => setOpen(false), []);
  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(close, 120);
  }, [close]);
  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => { close(); }, [location.pathname, close]);

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

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const linkBase = 'flex items-center gap-1 rounded-lg border px-3 py-1.5 font-sans text-[13px] font-semibold transition-colors duration-150';
  const activeState = 'text-[var(--brand)] bg-[var(--surface2)] border-[var(--border2)]';
  const inactiveState = 'text-[var(--text2)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--border)]';

  const itemRow = 'flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-sans text-[13px] font-semibold transition-colors duration-100 hover:bg-[var(--color-surface2)] focus:bg-[var(--color-surface2)] focus:outline-none';

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onFocus={cancelClose}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          scheduleClose();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Explore VSA"
        onClick={() => setOpen((v) => !v)}
        className={`${linkBase} ${triggerActive || open ? activeState : inactiveState}`}
      >
        Explore
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Explore VSA"
          className="absolute left-1/2 top-full z-50 mt-1.5 grid w-[min(620px,calc(100vw-32px))] -translate-x-1/2 grid-cols-3 overflow-hidden rounded-xl border"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            boxShadow: '0 8px 32px rgba(20,32,40,0.13), 0 2px 8px rgba(20,32,40,0.08)',
          }}
        >
          {/* Quick Links */}
          <div className="border-r p-4" style={{ borderColor: 'var(--color-border)' }}>
            <GroupLabel>Quick Links</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  role="menuitem"
                  onClick={close}
                  className={itemRow}
                  style={{ color: isRouteActive(location.pathname, item.path) ? 'var(--brand)' : 'var(--color-text2)' }}
                >
                  <span className="text-[15px] leading-none" aria-hidden="true">{item.emoji}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Get Involved */}
          <div className="border-r p-4" style={{ borderColor: 'var(--color-border)' }}>
            <GroupLabel>Get Involved</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {GET_INVOLVED.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  role="menuitem"
                  onClick={close}
                  className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-100 hover:bg-[var(--color-surface2)] focus:bg-[var(--color-surface2)] focus:outline-none"
                >
                  <span className="mt-0.5 shrink-0 text-[15px] leading-none" aria-hidden="true">{item.emoji}</span>
                  <div className="min-w-0">
                    <div
                      className="font-sans text-[13px] font-semibold leading-snug"
                      style={{ color: isRouteActive(location.pathname, item.path) ? 'var(--brand)' : 'var(--color-text)' }}
                    >
                      {item.label}
                    </div>
                    <div className="mt-0.5 font-sans text-[11px] leading-snug" style={{ color: 'var(--color-text3)' }}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div className="p-4">
            <GroupLabel>Explore</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {EXPLORE_LINKS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  role="menuitem"
                  onClick={close}
                  className={itemRow}
                  style={{ color: isRouteActive(location.pathname, item.path) ? 'var(--brand)' : 'var(--color-text2)' }}
                >
                  <span className="text-[15px] leading-none" aria-hidden="true">{item.emoji}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
