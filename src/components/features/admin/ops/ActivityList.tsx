import { ActivityEntry } from '../../../../lib/adminActivity';
import { cn } from '../../../../lib/utils';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

/** One line per change: who, what, when, and [Undo] only where it is safe. */
export function ActivityList({
  entries,
  canUndo,
  onUndo,
  undoing,
  undone,
  empty,
}: {
  entries: readonly ActivityEntry[];
  canUndo?: (entry: ActivityEntry) => boolean;
  onUndo?: (entry: ActivityEntry) => void;
  undoing?: boolean;
  undone?: ReadonlySet<string>;
  empty?: string;
}) {
  if (entries.length === 0) {
    return <p className="px-1 py-4 font-sans text-xs text-text-muted">{empty ?? 'No changes recorded yet.'}</p>;
  }
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {entries.map((entry) => {
        const actor = typeof entry.metadata.actor === 'string' ? entry.metadata.actor : 'An admin';
        const wasUndone = undone?.has(entry.id) ?? false;
        return (
          <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5" data-testid="activity-row">
            <div className="min-w-0">
              <p className={cn('font-sans text-[13px] text-text-primary', wasUndone && 'line-through opacity-60')}>
                <span className="font-semibold">{actor}</span> · {entry.summary}
              </p>
              <p className="font-mono text-[11px] text-text-muted">
                {formatWhen(entry.createdAt)}
                {wasUndone ? ' · undone' : ''}
              </p>
            </div>
            {onUndo && canUndo?.(entry) && (
              <button
                type="button"
                disabled={undoing}
                onClick={() => onUndo(entry)}
                className="rounded border border-[var(--color-border)] bg-transparent px-2.5 py-1 font-sans text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)] disabled:opacity-50"
              >
                Undo
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
