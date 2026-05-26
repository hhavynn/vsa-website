import { format as fnsFormat, parseISO } from 'date-fns';

/**
 * Ensures a string matches YYYY-MM-DD format.
 */
export function toDateOnlyString(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  return match[0];
}

/**
 * Parses a SQL date string (YYYY-MM-DD) as a local Date object.
 * This avoids the day-shift bug caused by parsing as UTC.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    // Fallback to parseISO if it's not a simple date string
    const date = parseISO(value);
    return isNaN(date.getTime()) ? null : date;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // new Date(year, monthIndex, day) creates a date in local time
  const date = new Date(year, month - 1, day);

  // Validate date (e.g. to handle Feb 31)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Alias for parseDateOnly to maintain compatibility with existing code.
 */
export const parseDateOnlyAsLocalDate = parseDateOnly;

/**
 * Formats a SQL date string (YYYY-MM-DD) without timezone shift.
 * Supports either a date-fns format string OR Intl.DateTimeFormatOptions.
 */
export function formatDateOnly(
  value: string | null | undefined, 
  formatOrOptions: string | Intl.DateTimeFormatOptions = 'MMM d, yyyy'
): string {
  const date = parseDateOnly(value);
  if (!date) return '';

  if (typeof formatOrOptions === 'string') {
    return fnsFormat(date, formatOrOptions);
  }
  
  return new Intl.DateTimeFormat('en-US', formatOrOptions).format(date);
}

/**
 * Comparison helpers for sorting date-only strings.
 */
export function compareDateOnlyAsc(a: string | null | undefined, b: string | null | undefined): number {
  const dateA = a ? toDateOnlyString(a) : '';
  const dateB = b ? toDateOnlyString(b) : '';
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  return dateA.localeCompare(dateB);
}

export function compareDateOnlyDesc(a: string | null | undefined, b: string | null | undefined): number {
  return compareDateOnlyAsc(b, a);
}

/**
 * Returns true if the string appears to be a date-only (YYYY-MM-DD) format.
 */
export function isDateOnlyString(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(value);
}
