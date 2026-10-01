// Which academic year the public leaderboard shows by default. Extracted from
// Leaderboard.tsx so admin surfaces (e.g. the Top 3 Story generator) resolve
// "the current year" exactly the way the public page does.

import type { AcademicTerm } from '../types';

export interface AcademicYearOption {
  year: number;
  label: string;
  isActive: boolean;
  hasData: boolean;
}

export function buildAcademicYearOptions(
  terms: Pick<AcademicTerm, 'academic_year_start' | 'academic_year_end' | 'is_active'>[],
  yearsWithData: number[]
): AcademicYearOption[] {
  const years = new Map<number, AcademicYearOption>();

  terms.forEach((term) => {
    const existing = years.get(term.academic_year_start);
    if (existing) {
      existing.isActive = existing.isActive || term.is_active;
      return;
    }

    years.set(term.academic_year_start, {
      year: term.academic_year_start,
      label: `${term.academic_year_start}-${term.academic_year_end}`,
      isActive: term.is_active,
      hasData: false,
    });
  });

  yearsWithData.forEach((year) => {
    const existing = years.get(year);
    if (existing) {
      existing.hasData = true;
    } else {
      years.set(year, {
        year,
        label: `${year}-${year + 1}`,
        isActive: false,
        hasData: true,
      });
    }
  });

  return Array.from(years.values()).sort((a, b) => b.year - a.year);
}

/**
 * Prefer the active year when it has data, then the most recent year with
 * data, then the active year, then the newest known year.
 */
export function resolveDefaultLeaderboardYear(academicYears: AcademicYearOption[]): number | null {
  if (academicYears.length === 0) return null;

  const activeYear = academicYears.find((year) => year.isActive);
  if (activeYear?.hasData) return activeYear.year;

  const mostRecentYearWithData = academicYears.find((year) => year.hasData);
  if (mostRecentYearWithData) return mostRecentYearWithData.year;

  if (activeYear) return activeYear.year;

  return academicYears[0].year;
}
