export function getLosAngelesDateOnly(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function getLosAngelesWallClockMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/**
 * Converts a San Diego wall-clock date + time ("YYYY-MM-DD", "HH:mm[:ss]") to
 * the exact instant as an ISO string, independent of the browser's timezone.
 * `new Date("YYYY-MM-DDTHH:mm")` uses the device's zone instead, which stores
 * the wrong instant for anyone whose device is not set to Pacific time.
 */
export function losAngelesDateTimeToIso(dateOnly: string, time: string = '00:00'): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = time.split(':').map(Number);
  const wallClockMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // Two passes settle the Pacific offset, including across DST changes.
  let instantMs = wallClockMs;
  for (let pass = 0; pass < 2; pass += 1) {
    instantMs = wallClockMs - (getLosAngelesWallClockMs(new Date(instantMs)) - instantMs);
  }
  return new Date(instantMs).toISOString();
}

/** "h:mm AM" for an instant, shown in San Diego time. */
export function formatLosAngelesClock(instant: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));
}
