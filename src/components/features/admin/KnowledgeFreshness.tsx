import { KnowledgeFreshnessResult } from '../../../lib/aiKnowledgeFreshness';
import { cn } from '../../../lib/utils';

const BADGE_TONE = {
  high: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200',
  medium: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100',
  low: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-100',
} as const;

/** "Stale" (something changed or expired) or "Review due" (time to look again). Renders nothing when current. */
export function FreshnessBadge({ result }: { result: KnowledgeFreshnessResult | undefined }) {
  if (!result || result.status === 'current' || !result.severity) return null;
  return (
    <span className={cn('rounded-full border px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em]', BADGE_TONE[result.severity])}>
      {result.status === 'stale' ? 'Stale' : 'Review due'}
    </span>
  );
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
}

/**
 * The selected snippet's freshness: when it was last reviewed (and by whom, if
 * the log has it), why it is stale or due, and a "Mark reviewed" that stamps the
 * saved snippet without rewriting it. An expired date or a missing/unpublished
 * link is not something a review can fix, so those say what to change instead.
 */
export function FreshnessCard({
  result,
  lastVerifiedAt,
  reviewer,
  validUntil,
  busy,
  onMarkReviewed,
}: {
  result: KnowledgeFreshnessResult | undefined;
  lastVerifiedAt: string | null;
  reviewer: string | null;
  validUntil: string | null;
  busy: boolean;
  onMarkReviewed: () => void;
}) {
  if (!result) return null;
  const reviewed = formatDate(lastVerifiedAt);
  const expires = formatDate(validUntil ? new Date(Date.parse(validUntil) - 1).toISOString() : null);
  const current = result.status === 'current';

  return (
    <section
      aria-label="Freshness"
      className={cn(
        'mx-4 mt-4 rounded-lg border p-4 sm:mx-5',
        current ? 'border-[var(--color-border)] bg-[var(--color-surface2)]' : result.severity ? BADGE_TONE[result.severity] : '',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-sans text-sm font-semibold">{current ? 'Up to date' : result.status === 'stale' ? 'Stale: needs a person to check it' : 'Review due'}</h3>
          <p className="mt-1 font-sans text-xs">
            {reviewed ? `Last reviewed ${reviewed}${reviewer ? ` by ${reviewer}` : ''}.` : 'Never marked as reviewed.'}
            {expires && ` Time-bound: valid through ${expires}.`}
          </p>
          {!current && (
            <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-xs">
              {result.issues.map((issue) => (
                <li key={issue.code}>{issue.reason}</li>
              ))}
            </ul>
          )}
          {!current && !result.clearedByReview && (
            <p className="mt-2 font-sans text-xs font-semibold">Marking it reviewed will not fix this: change the date or the link, or deactivate the snippet.</p>
          )}
        </div>
        <button
          type="button"
          onClick={onMarkReviewed}
          disabled={busy}
          className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-sans text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Mark reviewed'}
        </button>
      </div>
      <p className="mt-2 font-sans text-[11px] opacity-80">Stamps today as the review date on the saved snippet. The text is not changed.</p>
    </section>
  );
}
