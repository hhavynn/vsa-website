import { OPERATIONAL_STATUS_HINT, operationalStatusLabel, toOperationalStatus } from '../../../../lib/operationalStatus';

const DOT: Record<string, string> = {
  draft: 'bg-amber-500',
  locked: 'bg-sky-500',
  published: 'bg-green-500',
  archived: 'bg-gray-400',
  none: 'bg-gray-400',
};

export interface StatusBadgeProps {
  /** A cycle/batch status, or null/undefined when nothing has been started. */
  status: string | null | undefined;
  className?: string;
}

/** The one Draft / Locked / Published / Archived badge for every yearly workflow. */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const known = toOperationalStatus(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-sans text-[11px] font-semibold ${className} border-[var(--color-border)] text-text-primary bg-surface2`}
      title={known ? OPERATIONAL_STATUS_HINT[known] : 'Nothing has been started yet.'}
      data-status={known ?? 'none'}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[known ?? 'none']}`} />
      {operationalStatusLabel(status)}
    </span>
  );
}
