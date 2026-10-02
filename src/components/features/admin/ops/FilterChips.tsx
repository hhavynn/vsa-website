import { QuickFilter } from '../../../../lib/adminFilters';
import { cn } from '../../../../lib/utils';

export interface FilterChipsProps<T> {
  filters: ReadonlyArray<QuickFilter<T>>;
  counts: Record<string, number>;
  active: string;
  onChange: (key: string) => void;
  label?: string;
}

/** "Unlinked 7": the quick filters a work queue offers, with live counts. */
export function FilterChips<T>({ filters, counts, active, onChange, label = 'Quick filters' }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {filters.map((filter) => {
        const count = counts[filter.key] ?? 0;
        const selected = filter.key === active;
        return (
          <button
            key={filter.key}
            type="button"
            aria-pressed={selected}
            title={filter.hint}
            onClick={() => onChange(filter.key)}
            className={cn(
              'inline-flex min-h-[32px] items-center gap-1.5 rounded border px-2.5 py-1 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400',
              selected
                ? 'border-brand-600 bg-brand-600/10 text-brand-700 dark:border-brand-400 dark:bg-brand-400/15 dark:text-brand-300'
                : 'border-[var(--color-border)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]',
              !selected && count === 0 && filter.key !== 'all' && 'opacity-60',
            )}
          >
            {filter.label}
            <span className="font-mono text-[11px] tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
