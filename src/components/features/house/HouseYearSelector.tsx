import { Link, useNavigate } from 'react-router-dom';
import { getVerifiedLegacyHouseYears } from '../../../data/legacyHouseArchive';
import { formatAcademicYear } from '../../../lib/academicTerms';

interface YearOption {
  startYear: number;
  label: string;
  badge: string;
  route: string;
}

// Only the active academic year is the Current route. Existing published and
// verified prior years retain their own archive URLs.
export function buildHouseYearOptions(currentYear: number | null): YearOption[] {
  const archivalYears = getVerifiedLegacyHouseYears()
    .filter((year) => currentYear === null
      ? year.status === 'verified'
      : year.startYear <= currentYear)
    .map((year) => year.startYear);
  const years = new Set(archivalYears);
  if (currentYear !== null) years.add(currentYear);

  return Array.from(years)
    .sort((a, b) => b - a)
    .map((startYear) => ({
      startYear,
      label: formatAcademicYear(startYear),
      badge: startYear === currentYear ? 'Current' : 'Archive',
      route: startYear === currentYear ? '/house' : `/house/year/${formatAcademicYear(startYear)}`,
    }));
}

interface HouseYearSelectorProps {
  /** The academic year start integer (e.g. 2025 for 2025-2026). */
  activeStartYear: number | null;
  currentYear: number | null;
  className?: string;
}

export function HouseYearSelector({ activeStartYear, currentYear, className = '' }: HouseYearSelectorProps) {
  const navigate = useNavigate();
  const options = buildHouseYearOptions(currentYear);
  const primaryYearOptions = options.slice(0, 3);
  const moreYears = options.slice(3);
  const activeYearIsAvailable = options.some((option) => option.startYear === activeStartYear);
  // One verified source for both controls. No guess about unreleased Houses,
  // current-year memberships or official standings.
  const selectedOption = activeYearIsAvailable
    ? String(activeStartYear)
    : '';
  const navigateToYear = (value: string) => {
    const selected = options.find((option) => String(option.startYear) === value);
    if (selected) navigate(selected.route);
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 pb-0.5 ${className}`}
      role="navigation"
      aria-label="Select academic year"
    >
      <span
        className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
        style={{ color: 'var(--color-text3)' }}
      >
        Year
      </span>

      {/* Native full-year picker on phones: no horizontal chip scrolling,
          and every verified archive year is one touch target away. */}
      <select
        aria-label="Choose House academic year"
        className="min-h-11 min-w-0 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-sans text-sm font-semibold text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] sm:hidden"
        value={selectedOption}
        onChange={(event) => navigateToYear(event.target.value)}
      >
        {!activeYearIsAvailable && <option value="" disabled>Choose a verified year</option>}
        {options.map((option) => (
          <option key={option.startYear} value={option.startYear}>
            {option.label} · {option.badge}
          </option>
        ))}
      </select>

      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        {primaryYearOptions.map((opt) => {
          const isActive = activeStartYear === opt.startYear;
          return (
            <Link
              key={opt.startYear}
              to={opt.route}
              aria-current={isActive ? 'page' : undefined}
              className={`
                chip-check shrink-0 inline-flex touch:min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors duration-150
                ${isActive
                  ? 'border-[var(--brand)] bg-[var(--color-surface2)] text-[var(--brand)]'
                  : 'border-[var(--color-border)] text-[var(--color-text2)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
                }
              `}
            >
              {opt.label}
              <span
                className="rounded-full px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-widest"
                style={
                  isActive
                    ? { background: 'var(--brand)', color: 'var(--color-on-brand)' }
                    : { background: 'var(--color-surface2)', color: 'var(--color-text3)', border: '1px solid var(--color-border)' }
                }
              >
                {opt.badge}
              </span>
            </Link>
          );
        })}

        {moreYears.length > 0 && (
          <div className="relative inline-block">
            <select
              className="appearance-none touch:min-h-11 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--color-text2)] transition-colors hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              value={activeStartYear && !primaryYearOptions.some(o => o.startYear === activeStartYear) ? activeStartYear : ""}
              onChange={(e) => navigateToYear(e.target.value)}
              aria-label="More years"
            >
              <option value="" disabled>More Years</option>
              {moreYears.map((y) => (
                <option key={y.startYear} value={y.startYear}>
                  {y.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text3)]">
              <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
