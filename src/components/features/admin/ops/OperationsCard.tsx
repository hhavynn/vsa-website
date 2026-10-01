import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface OperationsCardProps {
  title: string;
  /** Where "Open" goes; the whole header is the link. */
  to: string;
  linkLabel?: string;
  /** Right-aligned status (usually a StatusBadge). */
  aside?: ReactNode;
  children: ReactNode;
}

/** The one card shell for the Operations dashboard: title link, status, body. */
export function OperationsCard({ title, to, linkLabel = 'Open', aside, children }: OperationsCardProps) {
  return (
    <section
      className="scrapbook-paper flex h-full flex-col overflow-hidden"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        {aside}
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">{children}</div>
      <Link
        to={to}
        className="border-t px-4 py-2.5 font-sans text-[11px] font-semibold text-brand-600 transition-colors hover:bg-[var(--color-surface2)] dark:text-brand-400"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {linkLabel} →
      </Link>
    </section>
  );
}
