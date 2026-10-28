import { getPublicHousePoints, isHousePointOverrideActive } from './housePublicPointOverrides';

describe('removed public House overrides (#692)', () => {
  it.each([2025, 2026, 2027, null])('has no public override for academic year %s', (year) => {
    expect(isHousePointOverrideActive(year)).toBe(false);
    expect(getPublicHousePoints({ houseKey: 'synthetic-house', academicYearStart: year, calculatedPoints: 42 })).toBe(42);
  });

  it('does not ship House Chair figures through the deprecated public helper', () => {
    expect(getPublicHousePoints({ houseKey: 'house-a', academicYearStart: 2025, calculatedPoints: 0 })).toBe(0);
    expect(getPublicHousePoints({ houseKey: 'house-b', academicYearStart: 2025, calculatedPoints: 9 })).toBe(9);
  });
});
