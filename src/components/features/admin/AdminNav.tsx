import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

const NAV_GROUPS = [
  { group: null,      items: [{ to: '/admin',                   label: 'Overview' }] },
  { group: 'Data',    items: [
    { to: '/admin/members',           label: 'Members' },
    { to: '/admin/events',            label: 'Events' },
    { to: '/admin/import',            label: 'Import' },
  ]},
  { group: 'Content', items: [
    { to: '/admin/cabinet',           label: 'Cabinet' },
    { to: '/admin/gallery',           label: 'Gallery' },
    { to: '/admin/content',           label: 'Content' },
    { to: '/admin/settings',          label: 'Settings' },
  ]},
  { group: 'Reports', items: [
    { to: '/admin/analytics',         label: 'Analytics' },
    { to: '/admin/points',            label: 'Points' },
    { to: '/admin/feedback',          label: 'Feedback' },
    { to: '/admin/merge-suggestions', label: 'Merge' },
  ]},
];

export function AdminNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <aside
      className="w-[200px] shrink-0 flex flex-col border-r"
      style={{
        background: 'var(--color-sidebar)',
        borderColor: 'var(--color-sidebar-border)',
        minHeight: 'calc(100vh - 58px)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <div className="font-sans text-xs font-semibold text-brand-600 dark:text-brand-400 tracking-[0.03em]">
          VSA ADMIN
        </div>
        <div className="font-sans text-[11px] text-[var(--color-text3)] mt-0.5">Dashboard</div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group ?? 'top'}>
            {group && (
              <div className="font-sans text-[10px] font-semibold text-[var(--color-text3)] uppercase tracking-[0.07em] px-2 pt-3 pb-1">
                {group}
              </div>
            )}
            {items.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 px-2 py-[7px] rounded text-[13px] font-sans tracking-[-0.01em] transition-colors duration-150 border"
                  style={{
                    background: active ? 'var(--color-sidebar-active)' : 'transparent',
                    color: active ? 'var(--color-text)' : 'var(--color-text2)',
                    borderColor: active ? 'var(--color-border-strong)' : 'transparent',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center gap-2.5" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <div
          className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center font-sans text-[10px] font-semibold"
          style={{ background: 'var(--color-surface2)', color: 'var(--color-text2)' }}
        >
          {initials}
        </div>
        <div>
          <div className="font-sans text-xs font-medium text-[var(--color-text)]">Admin</div>
          <div className="font-sans text-[10px] text-[var(--color-text3)]">vsaucsd.org</div>
        </div>
      </div>
    </aside>
  );
}
