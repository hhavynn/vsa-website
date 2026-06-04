import {
  combineLocalDateTime,
  defaultDueDateTime,
  getApplicationStatus,
  maskTargetUrl,
  splitLocalDateTime,
} from './applicationLinks';

describe('application link helpers', () => {
  describe('getApplicationStatus', () => {
    const open = '2026-06-01T00:00:00.000Z';
    const due = '2026-06-10T00:00:00.000Z';

    it('returns disabled when not enabled regardless of dates', () => {
      const now = new Date('2026-06-05T00:00:00.000Z');
      expect(getApplicationStatus(open, due, false, now)).toBe('disabled');
    });

    it('returns not_open before the open date', () => {
      const now = new Date('2026-05-20T00:00:00.000Z');
      expect(getApplicationStatus(open, due, true, now)).toBe('not_open');
    });

    it('returns open inside the window', () => {
      const now = new Date('2026-06-05T00:00:00.000Z');
      expect(getApplicationStatus(open, due, true, now)).toBe('open');
    });

    it('treats the open boundary as open', () => {
      expect(getApplicationStatus(open, due, true, new Date(open))).toBe('open');
    });

    it('treats the due boundary as open (closes after the moment)', () => {
      expect(getApplicationStatus(open, due, true, new Date(due))).toBe('open');
    });

    it('returns closed after the due date', () => {
      const now = new Date('2026-06-20T00:00:00.000Z');
      expect(getApplicationStatus(open, due, true, now)).toBe('closed');
    });

    it('allows open dates in the past (still open before due)', () => {
      const pastOpen = '2020-01-01T00:00:00.000Z';
      const now = new Date('2026-06-05T00:00:00.000Z');
      expect(getApplicationStatus(pastOpen, due, true, now)).toBe('open');
    });
  });

  describe('defaultDueDateTime', () => {
    it('defaults the time to 11:59 PM local when only a date is given', () => {
      const result = defaultDueDateTime('2026-06-10');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getDate()).toBe(10);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });
  });

  describe('combineLocalDateTime', () => {
    it('uses the provided time when present', () => {
      const iso = combineLocalDateTime('2026-06-10', '14:30', '23:59');
      expect(iso).not.toBeNull();
      const parsed = new Date(iso!);
      expect(parsed.getHours()).toBe(14);
      expect(parsed.getMinutes()).toBe(30);
    });

    it('falls back to the fallback time when the time is blank', () => {
      const iso = combineLocalDateTime('2026-06-10', '', '23:59');
      expect(iso).not.toBeNull();
      const parsed = new Date(iso!);
      expect(parsed.getHours()).toBe(23);
      expect(parsed.getMinutes()).toBe(59);
    });

    it('returns null when the date is empty', () => {
      expect(combineLocalDateTime('', '12:00', '23:59')).toBeNull();
    });

    it('round-trips through splitLocalDateTime', () => {
      const iso = combineLocalDateTime('2026-06-10', '09:05', '23:59');
      const parts = splitLocalDateTime(iso);
      expect(parts.date).toBe('2026-06-10');
      expect(parts.time).toBe('09:05');
    });
  });

  describe('maskTargetUrl', () => {
    const url = 'https://forms.gle/example';

    it('exposes the URL only when open', () => {
      expect(maskTargetUrl('open', url)).toBe(url);
    });

    it('masks the URL for not_open / closed / disabled', () => {
      expect(maskTargetUrl('not_open', url)).toBeNull();
      expect(maskTargetUrl('closed', url)).toBeNull();
      expect(maskTargetUrl('disabled', url)).toBeNull();
    });
  });
});
