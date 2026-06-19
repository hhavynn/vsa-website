import { memo, useCallback, useState } from 'react';
import { NavLogo } from './NavLogo';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';
import { MobileDrawer } from './MobileDrawer';

export const NavigationShell = memo(function NavigationShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

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
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex h-[60px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4 lg:gap-8">
            <NavLogo />
            <NavLinks />
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text2)] shadow-[0_1px_0_rgba(196,184,168,0.35)] transition-colors duration-150 hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
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

          <UserMenu />
        </div>
      </div>

      <MobileDrawer isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </nav>
  );
});
