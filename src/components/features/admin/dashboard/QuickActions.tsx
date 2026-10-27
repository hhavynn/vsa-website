import { Link } from 'react-router-dom';
import { ADMIN_QUICK_ACTIONS, adminNavItemFor } from '../../../../lib/adminNavigation';

/** The six most common jobs, each a plain link to an existing admin page. */
export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="font-serif text-xl font-bold text-text-primary">
        Quick actions
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ADMIN_QUICK_ACTIONS.map((action) => {
          const Icon = adminNavItemFor(action.to)?.icon;
          return (
            <li key={action.to}>
              <Link
                to={action.to}
                className="group flex min-h-[64px] items-center gap-3 rounded-lg border border-[var(--color-border)] bg-surface p-3 transition-colors hover:border-brand-600 hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-400 dark:focus-visible:outline-brand-400"
              >
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  {Icon && <Icon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-sm font-semibold text-text-primary">{action.label}</span>
                  <span className="block truncate font-sans text-xs text-text-secondary">{action.hint}</span>
                </span>
                <span aria-hidden className="text-text-muted transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
