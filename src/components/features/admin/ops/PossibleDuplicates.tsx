import { Link } from 'react-router-dom';
import { PossibleDuplicate } from '../../../../lib/adminConflicts';
import { cn } from '../../../../lib/utils';

/**
 * "Possible duplicate: Andy Nguyen / Andy Nguyen — Compare →". Flags only; it
 * never merges. Real member-record merges go through Merge Review.
 */
export function PossibleDuplicates({
  duplicates,
  onCompare,
  mergeLink = false,
}: {
  duplicates: readonly PossibleDuplicate[];
  /** Page-local compare (usually: apply the Duplicates filter). */
  onCompare?: (duplicate: PossibleDuplicate) => void;
  /** Offer Merge Review for duplicate member records. */
  mergeLink?: boolean;
}) {
  if (duplicates.length === 0) return null;
  return (
    <section aria-label="Possible duplicates" className="rounded border border-amber-500/40 bg-amber-500/5 px-4 py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
        Possible duplicate{duplicates.length === 1 ? '' : 's'} · {duplicates.length}
      </p>
      <ul className="mt-2 space-y-2">
        {duplicates.slice(0, 6).map((duplicate) => (
          <li key={duplicate.key} data-severity={duplicate.severity} className="font-sans text-xs">
            <p className="font-semibold text-text-primary">
              {duplicate.items.map((item) => (item.detail ? `${item.label} (${item.detail})` : item.label)).join(' · ')}
            </p>
            <p className={cn('text-text-secondary', duplicate.severity === 'blocker' && 'text-red-600 dark:text-red-400')}>{duplicate.reason}</p>
            {onCompare && (
              <button type="button" onClick={() => onCompare(duplicate)} className="mt-0.5 bg-transparent p-0 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
                Compare →
              </button>
            )}
          </li>
        ))}
        {duplicates.length > 6 && <li className="font-sans text-xs text-text-muted">…and {duplicates.length - 6} more.</li>}
      </ul>
      {mergeLink && (
        <Link to="/admin/merge-suggestions" className="mt-2 inline-block font-sans text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
          Open Merge Review →
        </Link>
      )}
    </section>
  );
}
