import { Link } from 'react-router-dom';
import type { PublicMemberHouse } from '../../../data/repos/houseMemberships';
import { cn } from '../../../lib/utils';

/** House membership is an affiliation, not proof of being a House Parent. */
export function PublishedHouseBadge({ house, compact = false, className, to, yearLabel }: {
  house: PublicMemberHouse | null | undefined;
  compact?: boolean;
  className?: string;
  to?: string;
  yearLabel?: string;
}) {
  if (!house) return null;
  const classNames = cn(
    'inline-flex min-w-0 max-w-full break-words rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] font-sans font-semibold leading-snug text-[var(--color-text2)]',
    compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
    to && 'min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
    className,
  );
  const label = <>House · {house.label}{yearLabel ? ' · ' + yearLabel : ''}</>;
  if (to) return (
    <Link to={to} className={classNames}
      aria-label={`Open ${house.label} House page for ${yearLabel ?? house.academicYearStart}`}>
      {label}
    </Link>
  );
  return (
    <span
      aria-label={`Revealed House: ${house.label}`}
      className={classNames}
    >
      {label}
    </span>
  );
}
