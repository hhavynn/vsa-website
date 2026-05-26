import { 
  formatDateOnly, 
  parseDateOnly, 
  toDateOnlyString, 
  compareDateOnlyAsc, 
  compareDateOnlyDesc,
  isDateOnlyString
} from './dateOnly';

describe('date-only helpers', () => {
  describe('toDateOnlyString', () => {
    it('extracts YYYY-MM-DD from various formats', () => {
      expect(toDateOnlyString('2026-04-18')).toBe('2026-04-18');
      expect(toDateOnlyString('2026-04-18T12:00:00Z')).toBe('2026-04-18');
    });

    it('returns empty string for invalid inputs', () => {
      expect(toDateOnlyString(null)).toBe('');
      expect(toDateOnlyString('')).toBe('');
      expect(toDateOnlyString('not-a-date')).toBe('');
    });
  });

  describe('parseDateOnly', () => {
    it('parses date-only values as local calendar dates', () => {
      const date = parseDateOnly('2026-04-18');
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(3); // April
      expect(date?.getDate()).toBe(18);
    });

    it('rejects invalid calendar dates like Feb 31', () => {
      expect(parseDateOnly('2026-02-31')).toBeNull();
    });

    it('falls back to parseISO for non-YYYY-MM-DD strings', () => {
      const date = parseDateOnly('2026-04-18T12:00:00Z');
      expect(date).not.toBeNull();
      expect(date instanceof Date).toBe(true);
      expect(isNaN(date!.getTime())).toBe(false);
    });
  });

  describe('formatDateOnly', () => {
    it('formats a YYYY-MM-DD date using string format', () => {
      expect(formatDateOnly('2026-04-18', 'MMM d, yyyy')).toBe('Apr 18, 2026');
    });

    it('formats a YYYY-MM-DD date using Intl options', () => {
      expect(
        formatDateOnly('2026-04-18', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric',
        })
      ).toBe('4/18/2026');
    });

    it('returns empty string for invalid dates', () => {
      expect(formatDateOnly(null)).toBe('');
      expect(formatDateOnly('invalid')).toBe('');
    });
  });

  describe('sorting helpers', () => {
    const dates = ['2026-01-17', '2025-12-31', '2026-01-01'];

    it('sorts ascending', () => {
      expect([...dates].sort(compareDateOnlyAsc)).toEqual([
        '2025-12-31',
        '2026-01-01',
        '2026-01-17'
      ]);
    });

    it('sorts descending', () => {
      expect([...dates].sort(compareDateOnlyDesc)).toEqual([
        '2026-01-17',
        '2026-01-01',
        '2025-12-31'
      ]);
    });

    it('handles nulls in sorting', () => {
      const withNulls = ['2026-01-17', null, '2026-01-01'];
      expect([...withNulls].sort(compareDateOnlyAsc)).toEqual([
        '2026-01-01',
        '2026-01-17',
        null
      ]);
    });
  });

  describe('isDateOnlyString', () => {
    it('identifies valid date-only strings', () => {
      expect(isDateOnlyString('2026-04-18')).toBe(true);
    });

    it('rejects timestamp strings', () => {
      expect(isDateOnlyString('2026-04-18T12:00:00Z')).toBe(false);
    });

    it('rejects garbage', () => {
      expect(isDateOnlyString('not-a-date')).toBe(false);
      expect(isDateOnlyString(null)).toBe(false);
    });
  });
});
