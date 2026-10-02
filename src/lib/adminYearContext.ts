// Year context for every yearly admin surface. The selected year must be
// impossible to miss, and rows from another year must never be mixed in.
// Pure: callers pass the current academic year (from the existing academic
// term helpers) so nothing here invents date logic.
import { formatYearSpan } from './operationalStatus';

export type YearContextKind = 'current' | 'archived' | 'upcoming';

export interface YearContext {
  yearStart: number;
  /** "2026–27" */
  label: string;
  kind: YearContextKind;
  /** The one-line banner: "Current year", "Viewing archived 2025–26 data", … */
  badge: string;
  /** Archived years are read-mostly; the page can warn before an edit. */
  isArchived: boolean;
}

export function describeYearContext(yearStart: number, currentYearStart: number): YearContext {
  const label = formatYearSpan(yearStart);
  if (yearStart < currentYearStart) {
    return { yearStart, label, kind: 'archived', badge: `Viewing archived ${label} data`, isArchived: true };
  }
  if (yearStart > currentYearStart) {
    return { yearStart, label, kind: 'upcoming', badge: `Upcoming year · ${label}`, isArchived: false };
  }
  return { yearStart, label, kind: 'current', badge: 'Current year', isArchived: false };
}

/**
 * Keeps only rows that belong to `yearStart`. Rows with no year are dropped
 * rather than guessed at: an unlabeled row silently counted toward the wrong
 * year is exactly the bug this guards against.
 */
export function rowsForYear<T extends { academic_year_start?: number | null }>(
  rows: readonly T[],
  yearStart: number,
): T[] {
  return rows.filter((row) => row.academic_year_start === yearStart);
}

/** Distinct years present in `rows`, newest first. Used to build year pickers. */
export function yearsInRows(rows: ReadonlyArray<{ academic_year_start?: number | null }>): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    if (typeof row.academic_year_start === 'number') years.add(row.academic_year_start);
  }
  return Array.from(years).sort((a, b) => b - a);
}
