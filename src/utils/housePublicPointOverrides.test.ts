/**
 * Characterization tests for the frozen 2025-2026 public House point totals
 * (#293).
 *
 * POINTS SYSTEM COVERED: the LEADERBOARD system's public House display
 * (house_yearly_points). These overrides replace the displayed total only; they
 * do not touch the check-in system (event_attendance + user_points) and are
 * not a recalculation. See docs/leaderboard-system.md.
 *
 * The expected numbers are the House Chair's official figures, copied here
 * deliberately as literals: if the frozen table changes, this test must fail.
 */

import { getPublicHousePoints, isHousePointOverrideActive } from './housePublicPointOverrides';

const OFFICIAL_2025: Array<[string, number]> = [
  ['bowser', 247],
  ['donkey-kong', 215],
  ['toad', 158],
  ['boo', 125],
];

describe('getPublicHousePoints: frozen 2025-2026 totals', () => {
  it.each(OFFICIAL_2025)('returns the official total for %s regardless of calculated points', (houseKey, official) => {
    expect(getPublicHousePoints({ houseKey, academicYearStart: 2025, calculatedPoints: 0 })).toBe(official);
    expect(getPublicHousePoints({ houseKey, academicYearStart: 2025, calculatedPoints: 99999 })).toBe(official);
  });

  it('pins the full official table (sum 745)', () => {
    const total = OFFICIAL_2025.reduce(
      (sum, [houseKey]) => sum + getPublicHousePoints({ houseKey, academicYearStart: 2025, calculatedPoints: 0 }),
      0
    );
    expect(total).toBe(247 + 215 + 158 + 125);
  });
});

describe('getPublicHousePoints: key normalisation', () => {
  const resolve = (houseKey?: string | null, houseName?: string | null) =>
    getPublicHousePoints({ houseKey, houseName, academicYearStart: 2025, calculatedPoints: -1 });

  it('lower-cases the key', () => {
    expect(resolve('BOWSER')).toBe(247);
    expect(resolve('Boo')).toBe(125);
  });

  it('trims surrounding whitespace', () => {
    expect(resolve('  Toad  ')).toBe(158);
  });

  it('turns internal whitespace runs into a single hyphen', () => {
    expect(resolve('Donkey Kong')).toBe(215);
    expect(resolve('donkey   kong')).toBe(215);
    expect(resolve('donkey\tkong')).toBe(215);
  });

  it('accepts an already-hyphenated key', () => {
    expect(resolve('donkey-kong')).toBe(215);
  });

  it('falls back to houseName when houseKey is missing, null or empty', () => {
    expect(resolve(undefined, 'Bowser')).toBe(247);
    expect(resolve(null, 'Donkey Kong')).toBe(215);
    expect(resolve('', 'Toad')).toBe(158);
  });

  it('prefers houseKey over houseName when both are present', () => {
    expect(resolve('boo', 'Bowser')).toBe(125);
  });

  it('does not strip a "House " prefix (unlike normalizeHouse), so such a name is not overridden', () => {
    expect(resolve('House Bowser')).toBe(-1);
  });

  it('passes the calculated value through for an unknown House', () => {
    expect(getPublicHousePoints({ houseKey: 'test-house', academicYearStart: 2025, calculatedPoints: 33 })).toBe(33);
  });

  it('passes the calculated value through when no key or name is given', () => {
    expect(getPublicHousePoints({ academicYearStart: 2025, calculatedPoints: 12 })).toBe(12);
    expect(getPublicHousePoints({ houseKey: null, houseName: null, academicYearStart: 2025, calculatedPoints: 0 })).toBe(0);
  });
});

describe('getPublicHousePoints: other years pass through', () => {
  it.each([2023, 2024, 2026, 2027])('returns calculated points unchanged for academic year %s', (year) => {
    expect(getPublicHousePoints({ houseKey: 'bowser', academicYearStart: year, calculatedPoints: 61 })).toBe(61);
  });

  it('passes through when the year is null or omitted', () => {
    expect(getPublicHousePoints({ houseKey: 'bowser', academicYearStart: null, calculatedPoints: 61 })).toBe(61);
    expect(getPublicHousePoints({ houseKey: 'bowser', calculatedPoints: 61 })).toBe(61);
  });

  it('passes through when the year is the end year (2026) rather than the start year', () => {
    expect(getPublicHousePoints({ houseKey: 'boo', academicYearStart: 2026, calculatedPoints: 5 })).toBe(5);
  });
});

describe('isHousePointOverrideActive', () => {
  it('is active only for academic year start 2025', () => {
    expect(isHousePointOverrideActive(2025)).toBe(true);
    expect(isHousePointOverrideActive(2024)).toBe(false);
    expect(isHousePointOverrideActive(2026)).toBe(false);
    expect(isHousePointOverrideActive(null)).toBe(false);
    expect(isHousePointOverrideActive(undefined)).toBe(false);
    expect(isHousePointOverrideActive()).toBe(false);
  });
});
