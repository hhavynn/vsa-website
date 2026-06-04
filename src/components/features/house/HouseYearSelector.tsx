import { Link, useNavigate } from 'react-router-dom';
import { getVerifiedLegacyHouseYears } from '../../../data/legacyHouseArchive';

interface YearOption {
  startYear: number;
  label: string;
  badge: string;
  route: string;
}

// Update this list each year when a new House cycle is added or completed.
const PRIMARY_YEAR_OPTIONS: YearOption[] = [
  { startYear: 2026, label: '2026-2027', badge: 'Not announced', route: '/house/year/2026-2027' },
  { startYear: 2025, label: '2025-2026', badge: 'Current',     route: '/house' },
  { startYear: 2024, label: '2024-2025', badge: 'Archive',     route: '/house/year/2024-2025' },
];

interface HouseYearSelectorProps {
  /** The academic year start integer (e.g. 2025 for 2025-2026). */
  activeStartYear: number | null;
  className?: string;
}

export function HouseYearSelector({ activeStartYear, className = '' }: HouseYearSelectorProps) {
  const navigate = useNavigate();
  const verifiedYears = getVerifiedLegacyHouseYears();
  
  // Filter out years already in PRIMARY_YEAR_OPTIONS
  const moreYears = verifiedYears
    .filter(y => !PRIMARY_YEAR_OPTIONS.some(opt => opt.startYear === y.startYear))
    .sort((a, b) => b.startYear - a.startYear);

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

      <div className="flex flex-wrap items-center gap-2">
        {PRIMARY_YEAR_OPTIONS.map((opt) => {
          const isActive = activeStartYear === opt.startYear;
          return (
            <Link
              key={opt.startYear}
              to={opt.route}
              aria-current={isActive ? 'page' : undefined}
              className={`
                shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors duration-150
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
                    ? { background: 'var(--brand)', color: 'white' }
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
              className="appearance-none rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--color-text2)] transition-colors hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              value={activeStartYear && !PRIMARY_YEAR_OPTIONS.some(o => o.startYear === activeStartYear) ? activeStartYear : ""}
              onChange={(e) => {
                if (e.target.value) {
                  navigate(`/house/year/${e.target.value}-${parseInt(e.target.value) + 1}`);
                }
              }}
              aria-label="More years"
            >
              <option value="" disabled>More Years</option>
              {moreYears.map((y) => (
                <option key={y.startYear} value={y.startYear}>
                  {y.academicYear}
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
