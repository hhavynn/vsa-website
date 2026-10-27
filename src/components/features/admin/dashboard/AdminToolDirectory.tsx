import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronDown } from '../../../../lib/adminIcons';
import { ADMIN_NAV_GROUPS, AdminNavGroup } from '../../../../lib/adminNavigation';
import { cn } from '../../../../lib/utils';

function DirectoryGroup({ group, open, onToggle }: { group: AdminNavGroup; open: boolean; onToggle: () => void }) {
  const panelId = useId();
  const Icon = group.icon;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400"
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0 text-text-secondary" />
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-sm font-semibold text-text-primary">{group.group}</span>
          {group.intro && <span className="block truncate font-sans text-xs text-text-secondary">{group.intro}</span>}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-text-muted">{group.items.length}</span>
        <FiChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open}>
        <ul className="grid gap-1 border-t border-[var(--color-border)] p-2 sm:grid-cols-2">
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex min-h-[48px] items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400"
                >
                  <ItemIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
                  <span className="min-w-0">
                    <span className="block font-sans text-[13px] font-semibold text-text-primary">{item.label}</span>
                    {item.summary && <span className="block font-sans text-xs leading-snug text-text-secondary">{item.summary}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Every admin destination, grouped the same way as the sidebar and collapsed by
 * default. It reads ADMIN_NAV_GROUPS directly: there is no second list to drift.
 */
export function AdminToolDirectory() {
  const groups = ADMIN_NAV_GROUPS.filter((group) => group.group);
  const [open, setOpen] = useState<string[]>([]);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const allOpen = open.length === groups.length;
  return (
    <section aria-labelledby="all-tools-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="all-tools-title" className="font-serif text-xl font-bold text-text-primary">
          All admin tools <span className="font-sans text-sm font-normal text-text-muted">({total})</span>
        </h2>
        <button
          type="button"
          onClick={() => setOpen(allOpen ? [] : groups.map((group) => group.id))}
          className="rounded-md font-sans text-xs font-semibold text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {groups.map((group) => (
          <DirectoryGroup
            key={group.id}
            group={group}
            open={open.includes(group.id)}
            onToggle={() => setOpen((current) => (current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id]))}
          />
        ))}
      </div>
    </section>
  );
}
