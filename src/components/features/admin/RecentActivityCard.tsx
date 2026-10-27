import { Link } from 'react-router-dom';
import { useAdminActivity } from '../../../hooks/useAdminActivity';
import { ActivityList } from './ops';

/** Overview: the last few operational changes, with Undo where it is safe. */
export function RecentActivityCard() {
  const { entries, loading, error, canUndo, undo, undoing, undone } = useAdminActivity({ limit: 6 });
  return (
    <section aria-labelledby="recent-changes-title" className="h-full rounded-lg border border-[var(--color-border)] bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="recent-changes-title" className="font-serif text-xl font-bold text-text-primary">Recent changes</h2>
        <Link to="/admin/recent-changes" className="font-sans text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
          See all →
        </Link>
      </div>
      {loading ? (
        <p className="mt-3 text-xs text-text-muted">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-xs text-text-muted">Recent changes are not available yet.</p>
      ) : (
        <ActivityList entries={entries} canUndo={canUndo} onUndo={undo} undoing={undoing} undone={undone} empty="No changes recorded yet. Edits to ACE, Houses, Cabinet and Interns will show here." />
      )}
    </section>
  );
}
