import { formatEventDay } from './eventTime';

// The bulk-preview list (and anything else using formatEventDay) must name the
// San Diego Event day no matter where the admin's device is. Jest cannot switch
// the process timezone mid-run, so `npm run test:timezones` executes this file
// under UTC, America/New_York, Asia/Ho_Chi_Minh and America/Los_Angeles; the
// expectations below are fixed strings, so every run must agree.
describe(`formatEventDay (TZ=${process.env.TZ ?? 'unset'})`, () => {
  it('names the San Diego day for an evening event that is already "tomorrow" in UTC', () => {
    // 7:00 PM PST on Mar 9 is 03:00 UTC on Mar 10.
    expect(formatEventDay('2030-03-10T03:00:00Z', '19:00')).toBe('Mar 9, 2030');
  });

  it('keeps a daytime event on its own day', () => {
    // 12:00 UTC = 4/5 AM Pacific, same calendar day.
    expect(formatEventDay('2030-03-10T12:00:00Z', '04:00')).toBe('Mar 10, 2030');
    // 19:00 PDT on Jun 15 = 02:00 UTC Jun 16.
    expect(formatEventDay('2030-06-16T02:00:00Z', '19:00')).toBe('Jun 15, 2030');
  });

  it('keeps legacy UTC-midnight rows on the day that was entered', () => {
    expect(formatEventDay('2030-03-10T00:00:00Z')).toBe('Mar 10, 2030');
    expect(formatEventDay('2030-03-10T00:00:00+00:00', null)).toBe('Mar 10, 2030');
  });

  it('passes date-only values through unchanged', () => {
    expect(formatEventDay('2030-03-10')).toBe('Mar 10, 2030');
  });
});
