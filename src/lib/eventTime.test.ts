import { buildGcalTimedDates, formatEventDateRange } from './eventTime';

describe('formatEventDateRange', () => {
  it('shows only the start date when an event ends before it starts', () => {
    expect(formatEventDateRange('2026-10-01', '2026-09-30')).toBe('Oct 1');
  });

  it('keeps single-day and valid multi-day dates readable', () => {
    expect(formatEventDateRange('2026-09-25', null)).toBe('Sep 25');
    expect(formatEventDateRange('2026-09-25T19:00:00Z', '2026-09-25')).toBe('Sep 25');
    expect(formatEventDateRange('2026-09-25', '2026-09-27')).toBe('Sep 25 – 27');
    expect(formatEventDateRange('2026-09-30', '2026-10-01')).toBe('Sep 30 – Oct 1');
  });
});

describe('San Diego event dates', () => {
  it('shows a September 30 evening event on September 30, even when stored in October UTC', () => {
    expect(formatEventDateRange('2026-10-01T01:00:00+00:00', '2026-09-30')).toBe('Sep 30');
    expect(formatEventDateRange('2026-10-01T01:00:00+00:00')).toBe('Sep 30');
  });

  it('exports September 30 at 6–8 PM for a Google Calendar link using the LA timezone', () => {
    expect(buildGcalTimedDates('2026-10-01T01:00:00+00:00', '18:00:00', '20:00:00'))
      .toBe('20260930T180000/20260930T200000');
  });

  it('respects standard time, explicit offsets, and date-only House/calendar inputs', () => {
    expect(buildGcalTimedDates('2026-12-02T02:00:00Z', '18:00', '20:00'))
      .toBe('20261201T180000/20261201T200000');
    expect(formatEventDateRange('2026-09-30T18:00:00-07:00', '2026-10-02'))
      .toBe('Sep 30 – Oct 2');
    expect(buildGcalTimedDates('2026-09-30', '18:00', '20:00'))
      .toBe('20260930T180000/20260930T200000');
  });
});
