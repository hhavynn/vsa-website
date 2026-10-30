import type { PublicMemberHouse } from '../../../data/repos/houseMemberships';
import { cn } from '../../../lib/utils';

/** House membership is an affiliation, not proof of being a House Parent. */
export function PublishedHouseBadge({ house, compact = false, className }: {
  house: PublicMemberHouse | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!house) return null;
  return (
    <span
      aria-label={`Revealed House: ${house.label}`}
      className={cn(
        'inline-flex max-w-full break-words rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] font-sans font-semibold leading-snug text-[var(--color-text2)]',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      House · {house.label}
    </span>
  );
}
