import { formatLosAngelesClock, getLosAngelesDateOnly, losAngelesDateTimeToIso } from './losAngelesDate';
import { buildGcalTimedDates } from '../lib/eventTime';

describe('losAngelesDateTimeToIso', () => {
  it('converts a Pacific daylight-time evening to the right instant', () => {
    // La Jolla S'mores: Oct 2, 5:30 PM PDT is the next UTC day.
    expect(losAngelesDateTimeToIso('2026-10-02', '17:30')).toBe('2026-10-03T00:30:00.000Z');
  });

  it('converts a Pacific standard-time date', () => {
    expect(losAngelesDateTimeToIso('2027-01-15', '18:00:00')).toBe('2027-01-16T02:00:00.000Z');
  });

  it('handles the day DST ends', () => {
    expect(losAngelesDateTimeToIso('2026-11-01', '12:00')).toBe('2026-11-01T20:00:00.000Z');
  });

  it('defaults to midnight', () => {
    expect(losAngelesDateTimeToIso('2026-10-02')).toBe('2026-10-02T07:00:00.000Z');
  });

  it('round-trips through the San Diego calendar day and clock', () => {
    const iso = losAngelesDateTimeToIso('2026-10-02', '17:30');
    expect(getLosAngelesDateOnly(new Date(iso))).toBe('2026-10-02');
    expect(formatLosAngelesClock(iso)).toBe('5:30 PM');
  });
});

describe('Google Calendar dates for evening events', () => {
  it('keeps an evening event on its San Diego day', () => {
    // Stored as 2026-10-03 00:30 UTC; the event is Oct 2 in San Diego.
    expect(buildGcalTimedDates('2026-10-03T00:30:00+00:00', '17:30:00', '20:30:00')).toBe(
      '20261002T173000/20261002T203000'
    );
  });
});
