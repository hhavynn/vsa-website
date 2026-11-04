import { act, renderHook } from '@testing-library/react';
import { reconcileCalendarMonthCursor, usePacificCalendarDay } from './usePacificCalendarDay';

beforeEach(() => {
  jest.useFakeTimers();
  // Nov 4, 2026 at 11:59:30 PM Pacific (PST).
  jest.setSystemTime(new Date('2026-11-05T07:59:30Z'));
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Pacific day rollover on an already-open calendar (#213)', () => {
  it('refreshes the date at midnight instead of freezing it at mount', () => {
    const { result } = renderHook(() => usePacificCalendarDay());
    expect(result.current).toBe('2026-11-04');
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(result.current).toBe('2026-11-05');
  });

  it('refreshes when a throttled tab becomes visible again', () => {
    const { result } = renderHook(() => usePacificCalendarDay());
    jest.setSystemTime(new Date('2026-11-05T08:03:00Z'));
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current).toBe('2026-11-05');
  });

  it('refreshes when the browser regains focus after midnight', () => {
    const { result } = renderHook(() => usePacificCalendarDay());
    jest.setSystemTime(new Date('2026-11-05T08:10:00Z'));
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current).toBe('2026-11-05');
  });

  it('uses Pacific dates over the spring DST transition', () => {
    jest.setSystemTime(new Date('2026-03-08T07:59:30Z'));
    const { result } = renderHook(() => usePacificCalendarDay());
    expect(result.current).toBe('2026-03-07');
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(result.current).toBe('2026-03-08');
  });
});

describe('calendar month on a Pacific date change', () => {
  it('follows a new current month when the viewer was on the old current month', () => {
    expect(reconcileCalendarMonthCursor(
      { year: 2026, monthIndex: 10 },
      '2026-11-30', '2026-12-01',
    )).toEqual({ year: 2026, monthIndex: 11 });
  });

  it('preserves a deliberately selected historical month', () => {
    const selected = { year: 2026, monthIndex: 9 };
    expect(reconcileCalendarMonthCursor(selected, '2026-11-30', '2026-12-01')).toBe(selected);
  });

  it('does not move the month when only the day changes', () => {
    const selected = { year: 2026, monthIndex: 10 };
    expect(reconcileCalendarMonthCursor(selected, '2026-11-04', '2026-11-05')).toBe(selected);
  });
});
