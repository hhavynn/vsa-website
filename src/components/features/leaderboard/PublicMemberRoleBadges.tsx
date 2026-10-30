import { cn } from '../../../lib/utils';
import type { PublicMemberRole } from '../../../lib/memberRoles';
import type { PublicMemberHouse } from '../../../data/repos/houseMemberships';
import { PublishedHouseBadge } from './PublishedHouseBadge';

interface Props {
  roles: readonly PublicMemberRole[];
  house?: PublicMemberHouse | null;
  className?: string;
  compact?: boolean;
}

/**
 * Pure display; never a link/button nested within a member's profile opener.
 * The roles are only emitted by the canonical-ID, published-year projection.
 */
export function PublicMemberRoleBadges({ roles, house, className, compact = false }: Props) {
  if (roles.length === 0 && !house) return null;
  return (
    <div
      aria-label={house ? 'Revealed House and verified VSA roles' : 'Verified VSA roles'}
      className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}
    >
      <PublishedHouseBadge house={house} compact={compact} />
      {roles.map((role) => (
        <span
          key={`${role.kind}:${role.label}`}
          className={cn(
            'inline-flex max-w-full break-words rounded-full border font-sans font-semibold leading-snug',
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            role.kind === 'board'
              ? 'border-brand-600/30 bg-brand-600/10 text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-300'
              : role.kind === 'cabinet_position'
                ? 'border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text2)]',
          )}
        >
          {role.label}
        </span>
      ))}
    </div>
  );
}
