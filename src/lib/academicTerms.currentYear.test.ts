import { resolveCurrentAcademicYearStart } from './academicTerms';

describe('current House academic year fallback (#596)', () => {
  it('uses the active admin term even when the wall clock belongs to an earlier year', () => {
    expect(resolveCurrentAcademicYearStart(2027, new Date(2026, 9, 27))).toBe(2027);
  });

  it('falls back to the current calendar-derived academic year, never a 2025 sentinel', () => {
    expect(resolveCurrentAcademicYearStart(null, new Date(2026, 9, 27))).toBe(2026);
    expect(resolveCurrentAcademicYearStart(null, new Date(2027, 9, 27))).toBe(2027);
    expect(resolveCurrentAcademicYearStart(null, new Date(2031, 0, 15))).toBe(2030);
  });

  it('handles the September rollover and the prior summer deterministically', () => {
    expect(resolveCurrentAcademicYearStart(null, new Date(2027, 7, 31))).toBe(2026);
    expect(resolveCurrentAcademicYearStart(null, new Date(2027, 8, 1))).toBe(2027);
  });
});
