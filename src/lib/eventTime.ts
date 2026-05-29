// Utilities for event start/end time display and Google Calendar URL generation.
// Avoids timezone-shift bugs by keeping date and time handling separate.

/**
 * Format a SQL time value like "19:00:00" or "19:00" to "7:00 PM".
 */
export function formatEventTime(time: string): string {
  const parts = time.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Format a time range for display: "7 PM – 9 PM" or "7:00 PM – 9:30 PM".
 */
export function formatEventTimeRange(startTime: string, endTime: string): string {
  return `${formatEventTime(startTime)} – ${formatEventTime(endTime)}`;
}

/**
 * Convert a SQL time "HH:MM:SS" or "HH:MM" to "HHMMSS" for Google Calendar.
 */
function timeToGcalPart(time: string): string {
  const parts = time.split(':');
  const h = (parts[0] ?? '00').padStart(2, '0');
  const m = (parts[1] ?? '00').padStart(2, '0');
  return `${h}${m}00`;
}

/**
 * Extract the date portion "YYYY-MM-DD" from an ISO timestamp or date string.
 * Safe: never calls `new Date("YYYY-MM-DD")` which shifts dates in negative UTC offsets.
 */
function extractDateOnly(isoOrDate: string): string {
  return isoOrDate.slice(0, 10);
}

/**
 * Convert "YYYY-MM-DD" to "YYYYMMDD".
 */
function dateToPart(ymd: string): string {
  return ymd.replace(/-/g, '');
}

/**
 * Build a Google Calendar `dates` param for a timed event.
 * Returns "YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS" (local time, paired with ctz param).
 */
export function buildGcalTimedDates(eventDate: string, startTime: string, endTime: string): string {
  const day = dateToPart(extractDateOnly(eventDate));
  const start = timeToGcalPart(startTime);
  const end = timeToGcalPart(endTime);
  return `${day}T${start}/${day}T${end}`;
}

/**
 * Build a Google Calendar `dates` param for an all-day (date-only) event.
 * Accepts an ISO datetime string and uses a 2-hour default duration.
 * If endDate is provided and differs from the start, it spans multiple days.
 */
export function buildGcalAllDayDates(isoDate: string, endDate?: string | null): string {
  const startDay = dateToPart(extractDateOnly(isoDate));
  if (endDate) {
    const endDay = dateToPart(endDate);
    if (endDay !== startDay) {
      // Google Calendar all-day end is exclusive, so add 1 day
      const endDateObj = new Date(`${endDate}T00:00:00`);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const exclusiveEndDay = dateToPart(endDateObj.toISOString().slice(0, 10));
      return `${startDay}/${exclusiveEndDay}`;
    }
  }
  // Use Date object for UTC conversion — ISO full timestamps are unambiguous.
  const start = new Date(isoDate);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d+/g, '');
  return `${fmt(start)}/${fmt(end)}`;
}

/**
 * Format a date range for display. Returns e.g. "Feb 14 – 16" or "Feb 14" for same-day.
 * isoDate is a full ISO timestamp; endDate is "YYYY-MM-DD" or null.
 */
export function formatEventDateRange(isoDate: string, endDate?: string | null): string {
  const startStr = isoDate.slice(0, 10); // "YYYY-MM-DD"
  if (!endDate || endDate === startStr) {
    const [y, mo, d] = startStr.split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const [sy, smo, sd] = startStr.split('-').map(Number);
  const [ey, emo, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, smo - 1, sd);
  const end = new Date(ey, emo - 1, ed);
  const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (smo === emo && sy === ey) {
    return `${startFmt} – ${ed}`;
  }
  const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

/**
 * Extract HH:MM from a Supabase time value "HH:MM:SS" for an HTML time input.
 */
export function timeToInputValue(time: string | null | undefined): string {
  if (!time) return '';
  return time.slice(0, 5); // "19:00"
}

/**
 * Validate that end time is after start time (strings "HH:MM" or "HH:MM:SS").
 */
export function isEndAfterStart(startTime: string, endTime: string): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return toMinutes(endTime) > toMinutes(startTime);
}
