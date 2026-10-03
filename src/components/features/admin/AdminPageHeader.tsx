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
  className?: string;
}) {
  const { pathname } = useLocation();
  const item = adminNavItemFor(pathname);
  const crumbs = adminBreadcrumbs(pathname, detail);
  const heading = title ?? item?.label ?? 'Admin';
  const blurb = description ?? item?.description;

  return (
    <header
      className={`border-b px-6 py-6 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:px-8 sm:py-8 ${className}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="min-w-0">
        {crumbs.length > 1 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    {index > 0 && (
                      <li aria-hidden="true" className="select-none">
                        ›
                      </li>
                    )}
                    <li className="min-w-0 max-w-[16rem] truncate" aria-current={last ? 'page' : undefined}>
                      {crumb.to && !last ? (
                        <Link to={crumb.to} className="font-semibold underline-offset-2 hover:underline hover:text-[var(--color-text)]">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span style={last ? { color: 'var(--color-text2)' } : undefined}>{crumb.label}</span>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          </nav>
        )}
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
          {heading}
        </h1>
        {blurb && (
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
            {blurb}
          </p>
        )}
      </div>
      {actions && <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">{actions}</div>}
    </header>
  );
}
