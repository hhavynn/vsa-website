import { type ReactNode, useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface RelatedLink {
  /** Internal route. May carry a query string and/or `#anchor`. */
  to: string;
  label: string;
  description?: string;
  /** Runs on click, before navigation (e.g. to reopen a collapsed same-page target). */
  onClick?: () => void;
}

interface RelatedLinksProps {
  /** Eyebrow label, e.g. "Related" or "Looking for…?". */
  heading?: string;
  links: RelatedLink[];
  /** Extra content under the cards, e.g. an open-only application CTA. */
  children?: ReactNode;
  className?: string;
}

/**
 * Lightweight "next step" affordance: a labeled strip of 1-3 compact link
 * cards. Deliberately not a nav bar — it carries an eyebrow label, sits inside
 * page content, and renders nothing when there is nothing relevant to offer.
 */
export function RelatedLinks({
  heading = 'Related',
  links,
  children,
  className,
}: RelatedLinksProps) {
  const headingId = useId();
  if (links.length === 0 && !children) return null;

  return (
    <aside aria-labelledby={headingId} className={className}>
      <div
        id={headingId}
        className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text3)]"
      >
        {heading}
      </div>
      {links.length > 0 && (
        <ul
          className={cn(
            'grid gap-2.5',
            links.length > 1 && 'sm:grid-cols-2',
            links.length > 2 && 'lg:grid-cols-3',
          )}
        >
          {links.map((link) => (
            <li key={link.to} className="min-w-0">
              <Link
                to={link.to}
                onClick={link.onClick}
                className="group flex min-h-[48px] items-center justify-between gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition-colors duration-150 hover:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:border-brand-400 dark:focus-visible:ring-brand-400"
              >
                <span className="min-w-0">
                  <span className="block font-sans text-sm font-semibold text-[var(--color-text)]">
                    {link.label}
                  </span>
                  {link.description && (
                    <span className="mt-0.5 block font-sans text-xs leading-snug text-[var(--color-text2)]">
                      {link.description}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 font-sans text-sm text-brand-600 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none dark:text-brand-400"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {children && <div className={links.length > 0 ? 'mt-4' : undefined}>{children}</div>}
    </aside>
  );
}
