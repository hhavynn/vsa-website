/**
 * Application window boundaries (#274).
 *
 * Windows are entered by admins as San Diego wall-clock dates and times and
 * evaluated as instants. These tests pin: the four boundary instants for every
 * managed window, independence from the machine's timezone, DST behaviour, and
 * fail-closed handling of bad configuration. The SQL view
 * public_application_links uses the same comparisons (now() >= open_at,
 * now() <= due_at), so the client and server agree at each edge.
 */

import {
  APPLICATION_KEYS,
  combineLocalDateTime,
  formatApplicationDateTime,
  getApplicationStatus,
  maskTargetUrl,
  splitLocalDateTime,
} from './applicationLinks';

// Machine-timezone independence is checked by running this file under several
// TZ values in separate processes (see the `test:timezones` npm script and the
// CI step that calls it). Changing process.env.TZ inside a running Jest worker
// does not change Date's zone here, so an in-process loop would prove nothing.

const ms = (iso: string, delta = 0) => new Date(new Date(iso).getTime() + delta);

describe('every managed window opens and closes at the exact instant (#274)', () => {
  // Fall recruitment: opens Oct 1 9:00 AM PT, due Oct 8 11:59 PM PT (PDT, UTC-7).
  const openAt = combineLocalDateTime('2026-10-01', '09:00', '00:00')!;
  const dueAt = combineLocalDateTime('2026-10-08', '', '23:59')!;

  it('anchors the window to San Diego time', () => {
    expect(openAt).toBe('2026-10-01T16:00:00.000Z');
    expect(dueAt).toBe('2026-10-09T06:59:00.000Z');
  });

  it.each(APPLICATION_KEYS)('%s: before open, at open, at due, after due', () => {
    const status = (now: Date) => getApplicationStatus(openAt, dueAt, true, now);
    expect(status(ms(openAt, -1))).toBe('not_open');
    expect(status(ms(openAt))).toBe('open');
    expect(status(ms(dueAt))).toBe('open');
    expect(status(ms(dueAt, 1))).toBe('closed');
  });

  it('only exposes the URL while open', () => {
    const url = 'https://example.invalid/form';
    const at = (now: Date) => maskTargetUrl(getApplicationStatus(openAt, dueAt, true, now), url);
    expect(at(ms(openAt, -1))).toBeNull();
    expect(at(ms(openAt))).toBe(url);
    expect(at(ms(dueAt, 1))).toBeNull();
  });
});

describe('the machine timezone never changes a window (#274)', () => {
  it(`same instants, same wall-clock round trip, same display (TZ=${process.env.TZ ?? 'unset'})`, () => {
    expect(combineLocalDateTime('2026-10-01', '09:00', '00:00')).toBe('2026-10-01T16:00:00.000Z');
    expect(splitLocalDateTime('2026-10-01T16:00:00.000Z')).toEqual({ date: '2026-10-01', time: '09:00' });
    expect(formatApplicationDateTime('2026-10-09T06:59:00.000Z')).toBe('Oct 8, 2026, 11:59 PM PDT');
  });
});

describe('DST transitions do not move a boundary (#274)', () => {
  it('windows around the November and March changes', () => {
    // Last day of PDT and first full day of PST (DST ends Nov 1, 2026).
    expect(combineLocalDateTime('2026-10-31', '23:59', '')).toBe('2026-11-01T06:59:00.000Z');
    expect(combineLocalDateTime('2026-11-02', '00:00', '')).toBe('2026-11-02T08:00:00.000Z');
    // Last day of PST and first full day of PDT (DST starts Mar 14, 2027).
    expect(combineLocalDateTime('2027-03-13', '23:59', '')).toBe('2027-03-14T07:59:00.000Z');
    expect(combineLocalDateTime('2027-03-15', '00:00', '')).toBe('2027-03-15T07:00:00.000Z');
  });

  it('times either side of the spring-forward gap still convert', () => {
    expect(combineLocalDateTime('2027-03-14', '01:59', '')).toBe('2027-03-14T09:59:00.000Z');
    expect(combineLocalDateTime('2027-03-14', '03:00', '')).toBe('2027-03-14T10:00:00.000Z');
  });

  it('a midnight deadline on the DST-change day lands on that San Diego date', () => {
    const due = combineLocalDateTime('2026-11-01', '23:59', '')!;
    expect(splitLocalDateTime(due)).toEqual({ date: '2026-11-01', time: '23:59' });
  });
});

describe('misconfiguration fails closed (#274)', () => {
  const sweep = (openAt: string, dueAt: string) =>
    Array.from({ length: 40 }, (_, day) => ms('2026-09-25T00:00:00.000Z', day * 6 * 3600 * 1000)).map((now) =>
      getApplicationStatus(openAt, dueAt, true, now),
    );

  it('a window whose close is before its open is never open', () => {
    expect(sweep('2026-10-05T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).not.toContain('open');
  });

  it('malformed or missing stored dates are treated as disabled', () => {
    const now = ms('2026-10-02T00:00:00.000Z');
    expect(getApplicationStatus('not a date', '2026-10-08T00:00:00.000Z', true, now)).toBe('disabled');
    expect(getApplicationStatus('2026-10-01T00:00:00.000Z', '', true, now)).toBe('disabled');
  });

  it.each([
    ['empty date', '', '09:00'],
    ['slashes', '10/01/2026', '09:00'],
    ['impossible day', '2026-02-30', '09:00'],
    ['hour out of range', '2026-10-01', '24:00'],
    ['garbage time', '2026-10-01', 'nine'],
    ['a time skipped by the March DST change', '2027-03-14', '02:30'],
  ])('admin input with %s produces no timestamp', (_label, date, time) => {
    expect(combineLocalDateTime(date, time, '')).toBeNull();
  });

  it('a disabled window stays disabled inside its dates', () => {
    expect(getApplicationStatus('2026-10-01T00:00:00.000Z', '2026-10-08T00:00:00.000Z', false, ms('2026-10-02T00:00:00.000Z'))).toBe('disabled');
  });
});
