import {
  getCurrentVsaSeason,
  isSummerBreak,
  shouldUseSummerEmptyState,
} from './seasonalState';

describe('seasonal state helpers', () => {
  it('treats the day before June 15 as active year', () => {
    expect(isSummerBreak(new Date('2026-06-14T19:00:00Z'))).toBe(false);
    expect(getCurrentVsaSeason(new Date('2026-06-14T19:00:00Z'))).toBe('active_year');
  });

  it('starts summer break on June 15 in Los Angeles', () => {
    expect(isSummerBreak(new Date('2026-06-15T19:00:00Z'))).toBe(true);
  });

  it('keeps July in summer break', () => {
    expect(isSummerBreak(new Date('2026-07-10T19:00:00Z'))).toBe(true);
  });

  it('keeps September 14 in summer break', () => {
    expect(isSummerBreak(new Date('2026-09-14T19:00:00Z'))).toBe(true);
  });

  it('ends summer break on September 15 in Los Angeles', () => {
    expect(isSummerBreak(new Date('2026-09-15T19:00:00Z'))).toBe(false);
  });

  it('does not use summer empty states when active items exist', () => {
    const summerDate = new Date('2026-07-10T19:00:00Z');
    expect(shouldUseSummerEmptyState(true, summerDate)).toBe(false);
    expect(shouldUseSummerEmptyState(false, summerDate)).toBe(true);
  });
});
