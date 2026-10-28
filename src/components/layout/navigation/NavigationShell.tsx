import { memo, useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NavLogo } from './NavLogo';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';
import { MobileDrawer } from './MobileDrawer';
import { PublicSearchButton } from '../../features/search/PublicSearchButton';
import { usePublicEditorialRoute } from '../publicEditorialTheme';

function FindMyPointsShortcut({ editorial }: { editorial: boolean }) {
  const { pathname } = useLocation();
  const active = pathname === '/points';
  const tone = editorial
    ? active
      ? 'border-ed-ink bg-ed-ink text-ed-on-ink'
      : 'border-ed-line text-ed-ink hover:border-ed-ink'
    : active
      ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--color-on-brand)]'
      : 'border-[var(--border2)] text-[var(--text2)] hover:border-[var(--brand)] hover:text-[var(--brand)]';
  return (
    <Link
      to="/points"
      aria-label="Find My Points"
      className={`flex items-center gap-1.5 border px-3 py-1.5 font-sans text-[12.5px] font-bold transition-colors duration-150 ${
        editorial ? 'rounded-none' : 'rounded-full'
      } ${tone}`}
    >
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" strokeWidth={1.8} />
        <circle cx="12" cy="12" r="4" strokeWidth={1.8} />
        <circle cx="12" cy="12" r="0.6" fill="currentColor" />
      </svg>
      Find My Points
    </Link>
  );
}

export const NavigationShell = memo(function NavigationShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const editorial = usePublicEditorialRoute();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed left-0 right-0 top-0 z-50 border-b"
      style={{
        background: 'linear-gradient(180deg, var(--nav-bg) 0%, var(--color-bg) 180%)',
        borderColor: 'var(--color-nav-border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className={editorial ? 'mx-auto max-w-[1600px] px-4 sm:px-[4vw]' : 'mx-auto max-w-[1280px] px-4 sm:px-6'}>
        <div className="flex h-[60px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4 lg:gap-8">
            <NavLogo />
            <NavLinks />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <PublicSearchButton compact />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className={`flex h-11 w-11 items-center justify-center border border-[var(--border2)] bg-[var(--surface2)] ${editorial ? 'rounded-none' : 'rounded-lg'} text-[var(--text2)] shadow-[0_1px_0_rgba(196,184,168,0.35)] transition-colors duration-150 hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
            >
              {isMobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          <div className="hidden items-center gap-2.5 md:flex">
            <PublicSearchButton />
            <FindMyPointsShortcut editorial={editorial} />
            <UserMenu />
            {editorial && (
              // Figma .nav-cta — square ink button.
              <Link
                to="/get-involved"
                className="ml-1 hidden min-h-[40px] items-center gap-6 bg-ed-ink px-4 font-sans text-[12.5px] font-semibold tracking-[0.04em] text-ed-on-ink transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink lg:inline-flex"
              >
                Join VSA <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <MobileDrawer isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </nav>
  );
});
