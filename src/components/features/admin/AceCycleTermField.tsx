import { pickupTermCode, type PickupSeason } from '../../../lib/acePickupYear';

const seasons: ReadonlyArray<{ season: PickupSeason; label: string }> = [
  { season: 'FA', label: 'Fall' },
  { season: 'WI', label: 'Winter' },
  { season: 'SP', label: 'Spring' },
];

/** Explicit admin choice; no guessed season from today or an ACE Big's pickup. */
export function aceCycleTermLabel(term: string | null | undefined): string {
  if (!term) return 'Term not selected';
  const match = /^(FA|WI|SP)(\d{2})$/.exec(term);
  if (!match) return 'Unrecognized term';
  const season = seasons.find(option => option.season === match[1]);
  return `${season?.label ?? 'Unknown'} 20${match[2]}`;
}

export function AceCycleTermField({
  id, academicYearStart, value, onChange, disabled = false,
}: {
  id: string;
  academicYearStart: number;
  value: string;
  onChange: (term: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">
        Approved pickup term
      </label>
      <select
        id={id} value={value} disabled={disabled} required
        onChange={event => onChange(event.target.value)}
        className="min-h-11 rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 font-sans text-sm text-[var(--color-text)]"
      >
        <option value="">Choose term — required</option>
        {seasons.map(({ season, label }) => (
          <option key={season} value={pickupTermCode(season, academicYearStart)}>
            {label} {academicYearStart + (season === 'FA' ? 0 : 1)}
          </option>
        ))}
      </select>
    </div>
  );
}
