// Protected domain — House membership. Read-only Draft A → Draft B comparison
// for a post-payment rerun (#659): who left the cohort, whose House changed
// and why (from the allocator's trace), and per-House capacity/count/rank
// changes. Pure presentation over compareDrafts(); writes nothing.
import { useMemo, useState } from 'react';
import { ordinal } from '../../../lib/housePlacement';
import { formatFormTime } from '../../../lib/housePlacementImport';
import { downloadCsv } from '../../../lib/housePlacementExport';
import {
  COMPARISON_LABEL,
  ComparisonCategory,
  DraftComparison,
  comparisonCsv,
} from '../../../lib/housePayments';
import { cn } from '../../../lib/utils';

const CATEGORY_ORDER: ComparisonCategory[] = ['removed_payment', 'removed_withdrawn', 'moved_better', 'moved_worse', 'moved_other', 'reinstated', 'unchanged'];

const CATEGORY_TONE: Record<ComparisonCategory, string> = {
  removed_payment: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
  removed_withdrawn: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
  moved_better: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
  moved_worse: 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300',
  moved_other: 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300',
  reinstated: 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300',
  unchanged: 'border-[var(--color-border)] text-text-muted',
};

const labelCls = 'font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted';

export interface HouseDraftComparisonProps {
  comparison: DraftComparison;
  houseLabel: (houseId: string | null) => string;
  beforeLabel: string;
  afterLabel: string;
  academicYearStart: number;
}

export function HouseDraftComparison({ comparison, houseLabel, beforeLabel, afterLabel, academicYearStart }: HouseDraftComparisonProps) {
  const changedCount = comparison.entries.length - comparison.counts.unchanged;
  const [filter, setFilter] = useState<ComparisonCategory | 'changed' | 'all' | 'identity'>(changedCount > 0 ? 'changed' : 'all');
  const visible = useMemo(() => comparison.entries.filter((entry) => {
    if (filter === 'all') return true;
    if (filter === 'changed') return entry.category !== 'unchanged';
    if (filter === 'identity') return entry.needsIdentity;
    return entry.category === filter;
  }), [comparison.entries, filter]);
  const identityCount = comparison.entries.filter((entry) => entry.needsIdentity).length;
  const capacityChanged = comparison.houses.some((house) => house.beforeCapacity !== house.afterCapacity);

  function exportCsv() {
    downloadCsv(
      comparisonCsv(comparison, houseLabel),
      `vsa-house-placement-${academicYearStart}-${academicYearStart + 1}-comparison.csv`,
    );
  }

  return (
    <section className="scrapbook-paper space-y-4 p-5 border-[var(--color-border)] bg-surface" aria-label="Compare original and rerun">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-text-primary">Compare: {beforeLabel} → {afterLabel}</h3>
          <p className="mt-1 text-xs text-text-secondary">
            {comparison.beforeTotal} → {comparison.afterTotal} applicants. The sorting rule is unchanged (original submission time, then ranked choices){capacityChanged ? '; capacities were adjusted to the new cohort size' : ''}. Every move below comes from the allocator&rsquo;s own trace.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary"
        >
          Export private comparison CSV
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Change counts">
        {CATEGORY_ORDER.map((category) => (
          <div key={category} className="rounded border px-3 py-2 border-[var(--color-border)] bg-surface2">
            <dt className={labelCls}>{COMPARISON_LABEL[category]}</dt>
            <dd className="mt-0.5 font-serif text-xl font-bold text-text-primary">{comparison.counts[category]}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <caption className="sr-only">Per-House capacity, count and achieved choice, original versus rerun</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th scope="col" className={cn(labelCls, 'py-2 pr-3')}>House</th>
              <th scope="col" className={cn(labelCls, 'py-2 pr-3')}>Capacity</th>
              <th scope="col" className={cn(labelCls, 'py-2 pr-3')}>Placed</th>
              <th scope="col" className={cn(labelCls, 'py-2 pr-3')}>Net</th>
              <th scope="col" className={cn(labelCls, 'py-2')}>Choices achieved (1st / 2nd / …)</th>
            </tr>
          </thead>
          <tbody>
            {comparison.houses.map((house) => {
              const net = house.afterCount - house.beforeCount;
              return (
                <tr key={house.houseId} className="border-b border-[var(--color-border)] last:border-0">
                  <th scope="row" className="py-2 pr-3 font-semibold text-text-primary">{house.label}</th>
                  <td className="py-2 pr-3 font-mono text-text-secondary">{house.beforeCapacity ?? '—'} → {house.afterCapacity}</td>
                  <td className="py-2 pr-3 font-mono text-text-secondary">{house.beforeCount} → {house.afterCount}</td>
                  <td className="py-2 pr-3 font-mono text-text-primary">{net > 0 ? `+${net}` : net}</td>
                  <td className="py-2 font-mono text-text-secondary">
                    {house.beforeRanks.join(' / ')} → {house.afterRanks.join(' / ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="comparison-filter" className={cn(labelCls, 'mb-1 block')}>Show</label>
          <select
            id="comparison-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="rounded border bg-[var(--color-surface2)] px-3 py-2 text-xs text-[var(--color-text)] border-[var(--color-border)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          >
            <option value="changed">Everyone who changed ({changedCount})</option>
            <option value="all">Everyone ({comparison.entries.length})</option>
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>{COMPARISON_LABEL[category]} ({comparison.counts[category]})</option>
            ))}
            <option value="identity">Needs identity review ({identityCount})</option>
          </select>
        </div>
        <p className="text-xs text-text-muted" aria-live="polite">{visible.length} shown</p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded border p-3 text-xs border-[var(--color-border)] text-text-muted">Nobody in this view.</p>
      ) : (
        <ol className="space-y-2" aria-label="Applicant changes">
          {visible.map((entry) => (
            <li key={entry.key} className="rounded border p-3 border-[var(--color-border)] bg-surface2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {entry.name}
                  <span className="ml-2 font-mono text-[11px] font-normal text-text-muted">
                    row {entry.sourceRow ?? '?'} · {formatFormTime(entry.submittedIso)} PT
                  </span>
                </p>
                <span className={cn('rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]', CATEGORY_TONE[entry.category])}>
                  {COMPARISON_LABEL[entry.category]}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-text-secondary">
                #{entry.beforePriority ?? '—'} {houseLabel(entry.beforeHouseId)}{entry.beforeRank ? ` (${ordinal(entry.beforeRank)})` : ''}
                {' → '}
                #{entry.afterPriority ?? '—'} {entry.afterHouseId ? houseLabel(entry.afterHouseId) : 'not placed'}{entry.afterRank ? ` (${ordinal(entry.afterRank)})` : ''}
              </p>
              <p className="mt-1 text-xs text-text-secondary">{entry.reason}</p>
              {(entry.needsIdentity || entry.originalOverride) && (
                <ul className="mt-1 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                  {entry.needsIdentity && <li>Needs identity review: no confirmed member link yet.</li>}
                  {entry.originalOverride && (
                    <li>
                      Original was a manual override ({houseLabel(entry.originalOverride.fromHouseId)} → {houseLabel(entry.originalOverride.toHouseId)}
                      {entry.originalOverride.reason ? `: ${entry.originalOverride.reason}` : ''}). It is not carried over automatically.
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
