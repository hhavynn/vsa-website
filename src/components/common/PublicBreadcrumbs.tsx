import { Link, useLocation } from 'react-router-dom';
import { buildPublicBreadcrumbs, type BreadcrumbContext, type Crumb } from '../../lib/publicBreadcrumbs';
import { cn } from '../../lib/utils';

interface PublicBreadcrumbsProps {
  /** Page-supplied facts the URL cannot carry (the House pages' current year, a House's real name). */
  context?: BreadcrumbContext;
  /** An explicit trail instead of the route-derived one. */
  trail?: Crumb[];
  className?: string;
}

/**
 * The one breadcrumb for nested public pages. Derives its trail from the
 * route (lib/publicBreadcrumbs.ts) and renders nothing where there is no
 * hierarchy to show. Narrow screens truncate the intermediate crumbs (with the
 * full label in a tooltip) and let the current page wrap, so where you are is
 * never the part that gets cut off.
 */
export function PublicBreadcrumbs({ context, trail, className }: PublicBreadcrumbsProps) {
  const { pathname } = useLocation();
  const crumbs = trail ?? buildPublicBreadcrumbs(pathname, context);
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('vsa-container py-3', className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-sans text-[13px] leading-snug text-[var(--color-text2)]">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${index}-${crumb.label}`} className={cn('flex items-center gap-1.5', isLast ? 'min-w-0' : 'shrink-0')}>
              {index > 0 && (
                <span aria-hidden className="text-[var(--color-text3)]">
                  ›
                </span>
              )}
              {isLast || !crumb.to ? (
                <span aria-current="page" className="min-w-0 break-words font-semibold text-[var(--color-text)]">
                  {crumb.label}
                  {crumb.badge && (
                    <span className="ml-1.5 rounded-full border border-[var(--color-border)] px-1.5 py-px align-middle font-mono text-[10px] font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
                      {crumb.badge}
                    </span>
                  )}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  title={crumb.label}
                  className="block max-w-[7.5rem] truncate rounded-sm hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:text-brand-400 dark:focus-visible:ring-brand-400 sm:max-w-[16rem]"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
