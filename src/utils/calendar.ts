// Typed helpers for the public /calendar page.
//
// Normalizes VSA events, House events, and application windows into a single
// public-safe CalendarItem shape, and provides month-grid, filtering, and
// Google Calendar URL helpers. Date strings are always "YYYY-MM-DD" and are
// parsed with lib/dateOnly to avoid timezone-shift bugs.

import { ApplicationStatus, Event, HouseEvent, PublicApplicationLink } from '../types';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { HOUSE_COLORS, HouseName, normalizeHouse } from '../constants/houses';
import { buildGcalTimedDates } from '../lib/eventTime';
import { parseDateOnly, toDateOnlyString } from '../lib/dateOnly';
import { getLosAngelesDateOnly } from './losAngelesDate';
import { getHousePagePath } from './houseSlug';

export type CalendarSource = 'vsa' | 'house' | 'application';

export type CalendarCategory = Event['event_type'] | 'house' | 'application';

export interface CalendarHouseTag {
  name: HouseName;
  color: string;
  pagePath: string;
}

export interface CalendarItem {
  /** Unique across all sources, e.g. "vsa:<id>" */
  key: string;
  source: CalendarSource;
  title: string;
  description: string | null;
  /** Start date, "YYYY-MM-DD" */
  date: string;
  /** Inclusive end date for multi-day items, "YYYY-MM-DD" */
  endDate: string | null;
  /** SQL time "HH:MM[:SS]" */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  category: CalendarCategory;
  categoryLabel: string;
  points: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  houses: CalendarHouseTag[];
  /** Internal route for "see more" */
  detailPath: string | null;
  applicationStatus: ApplicationStatus | null;
  /** For application items: marks the window opening vs. the deadline */
  deadlineKind: 'opens' | 'due' | null;
}

// ── Date-only math ───────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a local Date as "YYYY-MM-DD" without UTC conversion. */
export function toLocalDateOnlyString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Add days to a "YYYY-MM-DD" string using local-time math. */
export function addDaysToDateOnly(dateStr: string, days: number): string {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return dateStr;
  parsed.setDate(parsed.getDate() + days);
  return toLocalDateOnlyString(parsed);
}

/** Data window shown on the calendar: 3 months back through 9 months ahead. */
export function getCalendarWindow(todayStr: string): { start: string; end: string } {
  const today = parseDateOnly(todayStr) ?? new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 10, 0);
  return { start: toLocalDateOnlyString(start), end: toLocalDateOnlyString(end) };
}

// ── Source → CalendarItem converters ─────────────────────────────────────────

export function vsaEventToCalendarItem(event: Event): CalendarItem {
  return {
    key: `vsa:${event.id}`,
    source: 'vsa',
    title: event.name,
    description: event.description || null,
    date: toDateOnlyString(event.date),
    endDate: event.end_date ? toDateOnlyString(event.end_date) : null,
    startTime: event.start_time ?? null,
    endTime: event.end_time ?? null,
    location: event.location || null,
    category: event.event_type,
    categoryLabel: EVENT_TYPE_LABELS[event.event_type] ?? 'Event',
    points: typeof event.points === 'number' ? event.points : null,
    imageUrl: event.image_url ?? null,
    thumbnailUrl: event.thumbnail_url ?? null,
    houses: [],
    detailPath: '/events',
    applicationStatus: null,
    deadlineKind: null,
  };
}

export function houseEventToCalendarItem(event: HouseEvent): CalendarItem {
  const assets =
    event.houses && event.houses.length > 0 ? event.houses : event.house ? [event.house] : [];
  const houses: CalendarHouseTag[] = [];
  for (const asset of assets) {
    const name = normalizeHouse(asset.house_key || asset.house || asset.display_name);
    if (name && !houses.some((h) => h.name === name)) {
      houses.push({
        name,
        color: asset.accent_color || HOUSE_COLORS[name],
        pagePath: getHousePagePath(asset),
      });
    }
  }

  return {
    key: `house:${event.id}`,
    source: 'house',
    title: event.title,
    description: event.description,
    date: toDateOnlyString(event.event_date),
    endDate: null,
    startTime: event.start_time,
    endTime: event.end_time,
    location: event.location,
    category: 'house',
    categoryLabel: 'House Event',
    points: null,
    imageUrl: event.image_url,
    thumbnailUrl: event.image_thumbnail_url,
    houses,
    detailPath: houses[0]?.pagePath ?? '/house',
    applicationStatus: null,
    deadlineKind: null,
  };
}

/**
 * Turn one application window into calendar markers for its open date and
 * deadline. Disabled windows are skipped entirely. Only fields from the
 * public_application_links view are used; the (masked) target URL is never
 * surfaced on the calendar — items link to /get-involved instead.
 */
export function applicationToCalendarItems(link: PublicApplicationLink): CalendarItem[] {
  if (!link.is_enabled || link.status === 'disabled') return [];

  const base: Omit<CalendarItem, 'key' | 'title' | 'date' | 'deadlineKind'> = {
    source: 'application',
    description: link.description,
    endDate: null,
    startTime: null,
    endTime: null,
    location: null,
    category: 'application',
    categoryLabel: 'Applications & Deadlines',
    points: null,
    imageUrl: null,
    thumbnailUrl: null,
    houses: [],
    detailPath: '/get-involved',
    applicationStatus: link.status,
  };

  const items: CalendarItem[] = [];
  if (link.open_at) {
    items.push({
      ...base,
      key: `application:${link.id}:opens`,
      title: `${link.title} — applications open`,
      date: getLosAngelesDateOnly(new Date(link.open_at)),
      deadlineKind: 'opens',
    });
  }
  if (link.due_at) {
    items.push({
      ...base,
      key: `application:${link.id}:due`,
      title: `${link.title} — due`,
      date: getLosAngelesDateOnly(new Date(link.due_at)),
      deadlineKind: 'due',
    });
  }
  return items;
}

// ── Google Calendar URL ──────────────────────────────────────────────────────

/**
 * Build the "dates" param for an all-day item from date-only strings.
 * Google Calendar treats the all-day end date as exclusive, so one day is
 * added past the (inclusive) last day of the item.
 */
export function buildGcalAllDayDatesFromDateOnly(
  startDate: string,
  endDate?: string | null
): string {
  const start = toDateOnlyString(startDate);
  const lastDay = endDate && endDate > start ? toDateOnlyString(endDate) : start;
  const exclusiveEnd = addDaysToDateOnly(lastDay, 1);
  return `${start.replace(/-/g, '')}/${exclusiveEnd.replace(/-/g, '')}`;
}

export function buildGoogleCalendarUrl(item: CalendarItem): string {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', item.title);

  if (item.startTime && item.endTime) {
    url.searchParams.set('dates', buildGcalTimedDates(item.date, item.startTime, item.endTime));
    url.searchParams.set('ctz', 'America/Los_Angeles');
  } else {
    url.searchParams.set('dates', buildGcalAllDayDatesFromDateOnly(item.date, item.endDate));
  }

  if (item.description) url.searchParams.set('details', item.description);
  if (item.location) url.searchParams.set('location', item.location);
  return url.toString();
}

// ── Month grid ───────────────────────────────────────────────────────────────

export interface CalendarDayCell {
  dateStr: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
}

/**
 * Build a Sunday-start month grid. Rows are trimmed to the weeks the month
 * actually spans (4–6 rows of 7 cells).
 */
export function getMonthGrid(year: number, monthIndex: number, todayStr: string): CalendarDayCell[] {
  const startOffset = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const rows = Math.ceil((startOffset + daysInMonth) / 7);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(year, monthIndex, 1 - startOffset + i);
    const dateStr = toLocalDateOnlyString(d);
    cells.push({
      dateStr,
      dayOfMonth: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
      isToday: dateStr === todayStr,
    });
  }
  return cells;
}

export function getMonthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** True when the item's (inclusive) date range covers the given day. */
export function itemOccursOn(item: CalendarItem, dateStr: string): boolean {
  if (!item.endDate || item.endDate <= item.date) return item.date === dateStr;
  return item.date <= dateStr && dateStr <= item.endDate;
}

// ── Filtering / sorting / grouping ───────────────────────────────────────────

export type CalendarCategoryFilter =
  | 'all'
  | 'vsa'
  | 'house'
  | 'vcn'
  | 'wildn_culture'
  | 'applications';

export function matchesCategoryFilter(
  item: CalendarItem,
  filter: CalendarCategoryFilter,
  house: HouseName | null = null
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'vsa':
      return item.source === 'vsa';
    case 'house':
      return item.source === 'house' && (!house || item.houses.some((h) => h.name === house));
    case 'vcn':
      return item.category === 'vcn';
    case 'wildn_culture':
      return item.category === 'wildn_culture';
    case 'applications':
      return item.source === 'application';
    default:
      return true;
  }
}

export function isPointsEligible(item: CalendarItem): boolean {
  return (item.points ?? 0) > 0;
}

export type CalendarScope = 'upcoming' | 'week' | 'month';

function itemLastDay(item: CalendarItem): string {
  return item.endDate && item.endDate > item.date ? item.endDate : item.date;
}

export function matchesScope(item: CalendarItem, scope: CalendarScope, todayStr: string): boolean {
  const lastDay = itemLastDay(item);
  switch (scope) {
    case 'upcoming':
      return lastDay >= todayStr;
    case 'week':
      return lastDay >= todayStr && item.date <= addDaysToDateOnly(todayStr, 6);
    case 'month':
      return lastDay >= todayStr && item.date.slice(0, 7) === todayStr.slice(0, 7);
    default:
      return true;
  }
}

/** Sort by start date, all-day items first within a day, then by start time. */
export function compareCalendarItems(a: CalendarItem, b: CalendarItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (!a.startTime && b.startTime) return -1;
  if (a.startTime && !b.startTime) return 1;
  if (a.startTime && b.startTime && a.startTime !== b.startTime) {
    return a.startTime < b.startTime ? -1 : 1;
  }
  return a.title.localeCompare(b.title);
}

export interface CalendarDayGroup {
  dateStr: string;
  items: CalendarItem[];
}

/** Group sorted items by start date (multi-day items appear under their start day). */
export function groupItemsByDate(items: CalendarItem[]): CalendarDayGroup[] {
  const groups: CalendarDayGroup[] = [];
  for (const item of [...items].sort(compareCalendarItems)) {
    const current = groups[groups.length - 1];
    if (current && current.dateStr === item.date) {
      current.items.push(item);
    } else {
      groups.push({ dateStr: item.date, items: [item] });
    }
  }
  return groups;
}

/** "Today · Wed, Jul 2" / "Tomorrow · Thu, Jul 3" / "Fri, Jul 4" */
export function formatDayGroupLabel(dateStr: string, todayStr: string): string {
  const parsed = parseDateOnly(dateStr);
  const formatted = parsed
    ? parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : dateStr;
  if (dateStr === todayStr) return `Today · ${formatted}`;
  if (dateStr === addDaysToDateOnly(todayStr, 1)) return `Tomorrow · ${formatted}`;
  return formatted;
}
