import { Fragment, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { adminBreadcrumbs, adminNavItemFor } from '../../../lib/adminNavigation';

/**
 * The header every admin page shares: breadcrumb trail, title, description,
 * and a slot for the page's primary actions (tabs, Create, etc.).
 *
 * The trail and the default title/description come from `adminNavigation.ts`,
 * keyed by the current path, so a page never hand-writes its own crumbs. Pass
 * `detail` on nested views (a specific fam, House, or event) to append a
 * trailing crumb. Presentation only: this renders no data and grants no access.
 */
export function AdminPageHeader({
  title,
  description,
  detail,
  actions,
  related,
  className = '',
}: {
  /** Defaults to the nav label for the current path. */
  title?: string;
  /** Defaults to the nav entry's description, if any. */
  description?: ReactNode;
  /** Trailing breadcrumb for a nested view, e.g. the selected fam's name. */
  detail?: string | null;
  /** Primary actions, kept in the same top-right slot on every page. */
  actions?: ReactNode;
  /** Admin paths of closely related tools, shown as quick links. Labels and icons come from the nav config. */
  related?: readonly string[];
  className?: string;
}) {
  const { pathname } = useLocation();
  const item = adminNavItemFor(pathname);
  const crumbs = adminBreadcrumbs(pathname, detail);
  const heading = title ?? item?.label ?? 'Admin';
  const blurb = description ?? item?.description;
  const relatedItems = (related ?? []).map((to) => adminNavItemFor(to)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry) && entry?.to !== item?.to);

  return (
    <header
      className={`vsa-admin-field vsa-ribbon-bottom border-b border-[var(--color-border)] px-5 py-6 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:px-8 sm:py-7 ${className}`}
    >
      <div className="min-w-0">
        {crumbs.length > 1 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    {index > 0 && (
                      <li aria-hidden="true" className="select-none">
                        ›
                      </li>
                    )}
                    <li className="min-w-0 max-w-[16rem] truncate">
                      {crumb.to && !last ? (
                        <Link to={crumb.to} className="font-semibold underline-offset-2 hover:underline hover:text-text-primary">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span aria-current={last ? 'page' : undefined} className={last ? 'text-text-secondary' : undefined}>
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          </nav>
        )}
        <h1 className="font-display text-[2rem] font-normal leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[2.6rem]">
          {heading}
        </h1>
        {blurb && (
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-text-secondary">
            {blurb}
          </p>
        )}
        {relatedItems.length > 0 && (
          <nav aria-label="Related tools" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-sans text-xs text-text-muted">Related:</span>
            {relatedItems.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.to}
                  to={entry.to}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-surface px-2.5 py-1 font-sans text-xs font-semibold text-text-secondary transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 dark:hover:border-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400"
                >
                  <Icon aria-hidden className="h-3.5 w-3.5" />
                  {entry.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      {actions && <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">{actions}</div>}
    </header>
  );
}
