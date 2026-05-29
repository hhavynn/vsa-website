import { Link } from 'react-router-dom';

interface YearOption {
  startYear: number;
  label: string;
  badge: string;
  route: string;
}

// Update this list each year when a new House cycle is added or completed.
const YEAR_OPTIONS: YearOption[] = [
  { startYear: 2026, label: '2026-2027', badge: 'Coming Fall', route: '/house/year/2026-2027' },
  { startYear: 2025, label: '2025-2026', badge: 'Current',     route: '/house' },
  { startYear: 2024, label: '2024-2025', badge: 'Archive',     route: '/house/year/2024-2025' },
];

interface HouseYearSelectorProps {
  /** The academic year start integer (e.g. 2025 for 2025-2026). */
  activeStartYear: number | null;
  className?: string;
}

export function HouseYearSelector({ activeStartYear, className = '' }: HouseYearSelectorProps) {
  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto pb-0.5 ${className}`}
      role="navigation"
      aria-label="Select academic year"
    >
      <span
        className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
        style={{ color: 'var(--color-text3)' }}
      >
        Year
      </span>

      {YEAR_OPTIONS.map((opt) => {
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
    </div>
  );
}
