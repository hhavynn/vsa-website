import { formatDateOnly, parseDateOnlyAsLocalDate, toDateOnlyString } from './dateOnly';

describe('date-only helpers', () => {
  it('preserves a YYYY-MM-DD calendar date when formatting', () => {
    expect(
      formatDateOnly('2026-04-18', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      })
    ).toBe('4/18/2026');
  });

  it('parses date-only values as local calendar dates', () => {
    const date = parseDateOnlyAsLocalDate('2026-04-18');

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(3);
    expect(date?.getDate()).toBe(18);
  });

  it('normalizes date-like values for date inputs without timezone conversion', () => {
    expect(toDateOnlyString('2026-04-18T00:00:00.000Z')).toBe('2026-04-18');
  });

  it('rejects invalid calendar dates', () => {
    expect(toDateOnlyString('2026-02-31')).toBe('');
  });
});
