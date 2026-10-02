import { useMemo } from 'react';
import { PageTitle } from '../../components/common/PageTitle';
import { ActivityList, EmptyState, FilterChips } from '../../components/features/admin/ops';
import { useAdminActivity } from '../../hooks/useAdminActivity';
import { useUrlFilter } from '../../hooks/useUrlFilter';
import { ACTIVITY_FILTERS, ActivityEntry, matchesActivityFilter } from '../../lib/adminActivity';
import { QuickFilter, applyQuickFilter, countByFilter } from '../../lib/adminFilters';

const FILTERS: ReadonlyArray<QuickFilter<ActivityEntry>> = ACTIVITY_FILTERS.map((filter) => ({
  key: filter.key,
  label: filter.label,
  predicate: (entry) => matchesActivityFilter(entry.action, filter.key),
}));
const FILTER_KEYS = FILTERS.map((filter) => filter.key);

export default function AdminRecentChanges() {
  const [filter, setFilter] = useUrlFilter(FILTER_KEYS);
  const { entries, loading, error, canUndo, undo, undoing, undone } = useAdminActivity({ limit: 200 });
  const counts = useMemo(() => countByFilter(entries, FILTERS), [entries]);
  const visible = useMemo(() => applyQuickFilter(entries, FILTERS, filter), [entries, filter]);

  return (
    <>
      <PageTitle title="Recent Changes" />
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 sm:px-8 sm:py-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Recent Changes</h1>
        <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-text-secondary">
          Who changed what in the yearly operations tools. Simple edits can be undone while nothing has changed them since; publishing, reveals, and year setup use their own corrective workflows.
        </p>
      </div>
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <FilterChips filters={FILTERS} counts={counts} active={filter} onChange={setFilter} label="Filter by area" />
        {loading ? (
          <p className="py-6 text-center text-sm text-text-muted">Loading changes…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">Could not load recent changes. If this is new, the activity log migration may not be applied yet.</p>
        ) : entries.length === 0 ? (
          <EmptyState title="No changes recorded yet." description="Edits to ACE, Houses, Cabinet, Interns, member links, and year setup show up here as they happen." />
        ) : (
          <section className="scrapbook-paper border-[var(--color-border)] bg-surface px-5 py-2" aria-label="Changes">
            <ActivityList entries={visible} canUndo={canUndo} onUndo={undo} undoing={undoing} undone={undone} empty="Nothing in this area yet." />
          </section>
        )}
      </div>
    </>
  );
}
