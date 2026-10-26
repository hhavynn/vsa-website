// Protected domain — House membership. Capacity configuration for automatic
// House placement. Pure presentation: the parent owns the values.
import type { PlacementHouse } from '../../../lib/housePlacement';
import { cn } from '../../../lib/utils';

export interface HousePlacementCapacityEditorProps {
  houses: PlacementHouse[];
  demand: Readonly<Record<string, number>>;
  suggested: Readonly<Record<string, number>>;
  /** Raw input per House id. */
  values: Readonly<Record<string, string>>;
  edited: boolean;
  applicantCount: number;
  onChange: (houseId: string, value: string) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function parseCapacityInput(value: string | undefined): number | null {
  const text = (value ?? '').trim();
  return /^\d{1,5}$/.test(text) ? Number(text) : null;
}

const labelCls = 'font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

export function HousePlacementCapacityEditor({
  houses,
  demand,
  suggested,
  values,
  edited,
  applicantCount,
  onChange,
  onReset,
  disabled = false,
}: HousePlacementCapacityEditorProps) {
  const parsed = houses.map((house) => parseCapacityInput(values[house.id]));
  const invalid = parsed.some((value) => value === null);
  const total = parsed.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const difference = total - applicantCount;

  return (
    <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="House capacities">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Capacities</h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
            Equal split by default; the extra spots go to the most-requested Houses. Capacities must add up to the number of included applicants.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled || !edited}
          className="rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          Reset to Equal Split
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              {['House', '1st-choice demand', 'Suggested', 'Capacity'].map((heading) => (
                <th key={heading} className={`px-2 py-2 text-left ${labelCls}`} style={{ color: 'var(--color-text3)' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {houses.map((house, index) => (
              <tr key={house.id}>
                <td className="px-2 py-2 font-semibold" style={{ color: 'var(--color-text)' }}>{house.label}</td>
                <td className="px-2 py-2 font-mono" style={{ color: 'var(--color-text2)' }}>{demand[house.id] ?? 0}</td>
                <td className="px-2 py-2 font-mono" style={{ color: 'var(--color-text2)' }}>{suggested[house.id] ?? 0}</td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={values[house.id] ?? ''}
                    disabled={disabled}
                    onChange={(event) => onChange(house.id, event.target.value)}
                    aria-label={`Capacity for ${house.label}`}
                    aria-invalid={parsed[index] === null}
                    className={cn(
                      'w-24 rounded border bg-[var(--color-surface2)] px-2 py-1 font-mono text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]',
                      parsed[index] === null ? 'border-red-500' : 'border-[var(--color-border)]',
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--color-text2)' }}>
        <div><dt className="inline">Total capacity: </dt><dd className="inline font-mono font-semibold" data-testid="capacity-total" style={{ color: 'var(--color-text)' }}>{total}</dd></div>
        <div><dt className="inline">Included applicants: </dt><dd className="inline font-mono font-semibold" style={{ color: 'var(--color-text)' }}>{applicantCount}</dd></div>
        <div><dt className="inline">Difference: </dt><dd className="inline font-mono font-semibold" style={{ color: 'var(--color-text)' }}>{difference > 0 ? `+${difference}` : difference}</dd></div>
      </dl>
      {invalid && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Each capacity must be a whole number of 0 or more.</p>
      )}
      {!invalid && difference !== 0 && (
        <p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {difference > 0
            ? `${difference} spot${difference === 1 ? '' : 's'} would stay empty. Lower a capacity or reset to the equal split.`
            : `${-difference} applicant${difference === -1 ? '' : 's'} would have no spot. Raise a capacity or reset to the equal split.`}
        </p>
      )}
    </section>
  );
}
