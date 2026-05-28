import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useEffect } from 'react';

const NAV_GROUPS = [
  { group: null, items: [{ to: '/admin', label: 'Dashboard' }] },
  { group: 'Member Experience', items: [
    { to: '/admin/events', label: 'Events' },
    { to: '/admin/houses', label: 'Houses' },
    { to: '/admin/ace', label: 'ACE Families' },
    { to: '/admin/uvsa-schools', label: 'UVSA Schools' },
    { to: '/admin/external-events', label: 'External Events' },
  ]},
  { group: 'Content & Media', items: [
    { to: '/admin/content', label: 'Homepage Content' },
    { to: '/admin/cabinet', label: 'Cabinet' },
    { to: '/admin/gallery', label: 'Gallery' },
    { to: '/admin/vcn', label: 'VCN Archives' },
    { to: '/admin/resources', label: 'Resources Index' },
    { to: '/admin/settings', label: 'Site Settings' },
  ]},
  { group: 'Points & Attendance', items: [
    { to: '/admin/import', label: 'Attendance Imports' },
    { to: '/admin/members', label: 'Members' },
    { to: '/admin/points', label: 'Points Tools' },
    { to: '/admin/merge-suggestions', label: 'Merge Review' },
    { to: '/admin/years', label: 'Years & Terms' },
  ]},
  { group: 'System', items: [
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/feedback', label: 'Feedback' },
  ]},
];

export function AdminNav({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'AD';

  // Prevent scrolling on body when mobile nav is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden" 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Nav Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col border-r transition-transform duration-300 md:static md:w-[220px] md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="font-sans text-[13px] font-bold tracking-widest text-[var(--brand)] uppercase">
              VSA Admin
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>
              Dashboard
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="flex h-8 w-8 items-center justify-center rounded border bg-[var(--color-surface2)] text-[var(--color-text2)] transition-colors hover:text-[var(--color-text)] md:hidden"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group ?? 'top'} className="mb-4 last:mb-0">
              {group && (
                <div className="mb-2 px-3 font-sans text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
                  {group}
                </div>
              )}
              <div className="space-y-1">
                {items.map(({ to, label }) => {
                  const active = pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={onClose}
                      className="group flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition-all"
                      style={{
                        background: active ? 'var(--color-surface2)' : 'transparent',
                        color: active ? 'var(--color-text)' : 'var(--color-text2)',
                        borderColor: active ? 'var(--color-border)' : 'transparent',
                      }}
                    >
                      {active && (
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                      )}
                      <span className={active ? '' : 'group-hover:translate-x-1 transition-transform'}>
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t px-5 py-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm font-sans text-[11px] font-bold uppercase"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-sans text-[13px] font-semibold text-[var(--color-text)]">Admin User</div>
            <div className="truncate font-mono text-[9px] uppercase tracking-wider text-[var(--color-text3)]">vsaucsd.org</div>
          </div>
        </div>
      </aside>
    </>
  );
}
