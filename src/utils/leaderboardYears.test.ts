import { buildAcademicYearOptions, resolveDefaultLeaderboardYear } from './leaderboardYears';

const term = (start: number, isActive = false) => ({
  academic_year_start: start,
  academic_year_end: start + 1,
  is_active: isActive,
});

describe('buildAcademicYearOptions', () => {
  it('merges terms with years that have data, newest first', () => {
    const options = buildAcademicYearOptions([term(2025), term(2025, true), term(2026)], [2024, 2025]);
    expect(options).toEqual([
      { year: 2026, label: '2026-2027', isActive: false, hasData: false },
      { year: 2025, label: '2025-2026', isActive: true, hasData: true },
      { year: 2024, label: '2024-2025', isActive: false, hasData: true },
    ]);
  });
});

describe('resolveDefaultLeaderboardYear', () => {
  it('prefers the active year when it has data', () => {
    expect(resolveDefaultLeaderboardYear(buildAcademicYearOptions([term(2026, true)], [2025, 2026]))).toBe(2026);
  });

  it('falls back to the most recent year with data when the active year has none', () => {
    expect(resolveDefaultLeaderboardYear(buildAcademicYearOptions([term(2026, true)], [2024, 2025]))).toBe(2025);
  });

  it('uses the active year when no year has data, else the newest year', () => {
    expect(resolveDefaultLeaderboardYear(buildAcademicYearOptions([term(2025, true), term(2026)], []))).toBe(2025);
    expect(resolveDefaultLeaderboardYear(buildAcademicYearOptions([term(2025), term(2026)], []))).toBe(2026);
  });

  it('returns null with no years at all', () => {
    expect(resolveDefaultLeaderboardYear([])).toBeNull();
  });
});
