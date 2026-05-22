import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminNav } from './AdminNav';

const AdminLayout: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: 'calc(100vh - 58px)', background: 'var(--color-bg)' }}>
      {/* Mobile Top Bar */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="font-sans text-sm font-semibold uppercase tracking-widest text-[var(--brand)]">
          VSA Admin
        </div>
        <button 
          onClick={() => setMobileNavOpen(true)} 
          className="flex h-8 w-8 items-center justify-center rounded-md border text-[var(--color-text2)] transition-colors hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"
          style={{ borderColor: 'var(--color-border)' }}
          aria-label="Open admin navigation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      <AdminNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
