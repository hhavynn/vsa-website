import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { FiMenu, FiSearch } from '../../../lib/adminIcons';
import { adminNavItemFor } from '../../../lib/adminNavigation';
import { AdminNav } from './AdminNav';
import { AdminQuickSearch, isQuickSearchShortcut } from './AdminQuickSearch';
import { AdminSearchContext } from './AdminSearchContext';

const BAR_BUTTON =
  'flex h-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-text-secondary transition-colors hover:bg-surface2 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400';

const AdminLayout: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const searchOpener = useMemo(() => ({ openSearch: () => setSearchOpen(true) }), []);
  const pageLabel = adminNavItemFor(location.pathname)?.label ?? 'Admin';

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isQuickSearchShortcut(event)) return;
      event.preventDefault();
      setSearchOpen((open) => !open);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: 'calc(100vh - 60px)', background: 'var(--color-bg)' }}>
      {/* Mobile top bar: menu, where you are, and search, all one tap away. */}
      <div className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-[var(--color-border)] bg-surface px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className={`${BAR_BUTTON} gap-2 px-3 font-sans text-[13px] font-semibold`}
          aria-label="Open admin navigation"
          aria-haspopup="dialog"
          aria-expanded={mobileNavOpen}
        >
          <FiMenu aria-hidden className="h-5 w-5" />
          <span aria-hidden>Admin menu</span>
        </button>
        <p className="min-w-0 flex-1 truncate text-right font-sans text-sm font-semibold text-text-primary">{pageLabel}</p>
        <button type="button" onClick={() => setSearchOpen(true)} className={`${BAR_BUTTON} w-10`} aria-label="Search admin">
          <FiSearch aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <AdminNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onSearch={() => setSearchOpen(true)} />
      <AdminQuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminSearchContext.Provider value={searchOpener}>
          <Outlet />
        </AdminSearchContext.Provider>
      </div>
    </div>
  );
};

export default AdminLayout;
