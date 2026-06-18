import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { UserMenu } from './UserMenu';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavLink {
  path: string;
  label: string;
  emoji?: string;
  description?: string;
}

// ─── Link groups ──────────────────────────────────────────────────────────────

const QUICK_LINKS: NavLink[] = [
  { path: '/events',      label: 'Events',         emoji: '📅' },
  { path: '/points',      label: 'Find My Points', emoji: '🎯' },
  { path: '/leaderboard', label: 'Leaderboard',    emoji: '⭐' },
];

const INVOLVEMENT_LINKS: NavLink[] = [
  { path: '/get-involved',  label: 'Get Involved',  emoji: '👋', description: 'Start here' },
  { path: '/house',         label: 'House',          emoji: '🏠', description: 'Fams + competition' },
  { path: '/ace',           label: 'ACE',            emoji: '🌱', description: 'Big/Little mentorship' },
  { path: '/intern-program',label: 'Intern Program', emoji: '📋', description: 'Run VSA with cabinet' },
  { path: '/vcn',           label: 'VCN',            emoji: '🎭', description: 'Performing arts' },
];

const EXPLORE_LINKS: NavLink[] = [
  { path: '/gallery',       label: 'Gallery',        emoji: '📷' },
  { path: '/cabinet',       label: 'Cabinet',        emoji: '🗂️' },
  { path: '/uvsa-network',  label: 'UVSA Network',   emoji: '🌐' },
  { path: '/wild-n-culture',label: 'Wild N Culture',  emoji: '🎉' },
];

const INVOLVEMENT_PREFIXES = INVOLVEMENT_LINKS.map((l) => l.path);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRouteActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-1.5 px-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ color: 'var(--color-text3)' }}
    >
      {children}
    </div>
  );
}

interface DrawerLinkProps {
  to: string;
  label: string;
  emoji?: string;
  description?: string;
  active?: boolean;
  onClick: () => void;
}

function DrawerLink({ to, label, emoji, description, active = false, onClick }: DrawerLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-100
        ${active
          ? 'bg-[var(--color-surface2)] text-[var(--brand)]'
          : 'text-[var(--color-text2)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] focus:bg-[var(--color-surface2)] focus:outline-none'
        }
      `}
    >
      {emoji && (
        <span className="shrink-0 text-[18px] leading-none" aria-hidden="true">
          {emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-sans text-[14px] font-semibold leading-snug">{label}</div>
        {description && (
          <div
            className="font-sans text-[11px] leading-snug"
            style={{ color: 'var(--color-text3)' }}
          >
            {description}
          </div>
        )}
      </div>
      {active && (
        <span
          className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: 'var(--brand)' }}
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer = memo(function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const location = useLocation();
  const [involvementExpanded, setInvolvementExpanded] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Collapse involvement accordion when drawer closes
  useEffect(() => {
    if (!isOpen) setInvolvementExpanded(false);
  }, [isOpen]);

  // Close drawer on route change
  useEffect(() => { onClose(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Focus trap: send focus into drawer when it opens
  useEffect(() => {
    if (isOpen) {
      const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  const isInvolvementActive = INVOLVEMENT_PREFIXES.some((p) =>
    isRouteActive(location.pathname, p)
  );

  // Render via portal so the overlay sits above the nav's stacking context
  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — renders at body level, always above nav */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="fixed inset-0 z-[60] md:hidden"
            style={{ background: 'rgba(12, 20, 28, 0.55)', backdropFilter: 'blur(2px)' }}
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-[320px] flex-col md:hidden"
            style={{
              background: 'var(--color-bg)',
              borderLeft: '1px solid var(--color-border)',
              boxShadow: '-8px 0 32px rgba(20,32,40,0.14)',
            }}
          >
            {/* Drawer header */}
            <div
              className="flex h-[60px] shrink-0 items-center justify-between border-b px-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <Link
                to="/"
                onClick={onClose}
                className="font-serif text-[16px] tracking-[-0.01em] transition-opacity hover:opacity-80"
                style={{ color: 'var(--color-text)' }}
              >
                VSA <span className="font-light italic" style={{ color: 'var(--brand)' }}>at UCSD</span>
              </Link>
              <button
                onClick={onClose}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text2)] transition-colors duration-150 hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-3 py-4">

              {/* Quick links */}
              <section aria-label="Quick links" className="mb-5">
                <SectionLabel>Quick links</SectionLabel>
                <div className="space-y-0.5">
                  {QUICK_LINKS.map((link) => (
                    <DrawerLink
                      key={link.path}
                      to={link.path}
                      label={link.label}
                      emoji={link.emoji}
                      active={isRouteActive(location.pathname, link.path)}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </section>

              {/* Get Involved — accordion */}
              <section aria-label="Get Involved programs" className="mb-5">
                <SectionLabel>Get Involved</SectionLabel>

                {/* Accordion toggle */}
                <button
                  onClick={() => setInvolvementExpanded((v) => !v)}
                  aria-expanded={involvementExpanded}
                  className={`
                    flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-100
                    ${isInvolvementActive
                      ? 'bg-[var(--color-surface2)]'
                      : 'hover:bg-[var(--color-surface2)]'
                    }
                  `}
                >
                  <span className="shrink-0 text-[18px] leading-none" aria-hidden="true">👋</span>
                  <div className="min-w-0 flex-1 text-left">
                    <div
                      className={`font-sans text-[14px] font-semibold leading-snug ${isInvolvementActive ? 'text-[var(--brand)]' : 'text-[var(--color-text2)]'}`}
                    >
                      Get Involved
                    </div>
                    <div
                      className="font-sans text-[11px] leading-snug"
                      style={{ color: 'var(--color-text3)' }}
                    >
                      Programs and ways to join
                    </div>
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${involvementExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    style={{ color: 'var(--color-text3)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded links */}
                <AnimatePresence initial={false}>
                  {involvementExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div
                        className="ml-3 mt-0.5 space-y-0.5 border-l pl-3"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        {INVOLVEMENT_LINKS.map((link) => (
                          <DrawerLink
                            key={link.path}
                            to={link.path}
                            label={link.label}
                            description={link.description}
                            active={isRouteActive(location.pathname, link.path)}
                            onClick={onClose}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Explore */}
              <section aria-label="Explore" className="mb-5">
                <SectionLabel>Explore</SectionLabel>
                <div className="space-y-0.5">
                  {EXPLORE_LINKS.map((link) => (
                    <DrawerLink
                      key={link.path}
                      to={link.path}
                      label={link.label}
                      emoji={link.emoji}
                      active={isRouteActive(location.pathname, link.path)}
                      onClick={onClose}
                    />
                  ))}
                </div>
              </section>

            </div>

            {/* Footer: theme toggle + admin/sign-out */}
            <div
              className="shrink-0 border-t px-3 py-3"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <UserMenu isMobile onLinkClick={onClose} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(drawerContent, document.body);
});
