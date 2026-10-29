// Admin-only operational reporting for House leadership (#638).
// Uses the same year-scoped House events/host associations as HouseEventsManager.
// A past calendar date is NOT proof an event was held, and House events never
// award points or provide member/GBM attendance evidence by themselves.
import type { HouseEvent, HousePageAsset } from '../types';
import { formatAcademicYear, getAcademicTermDateRange } from './academicTerms';
import { hostIdsOf, hostLabel } from './houseEventDashboard';

export type HousePlanningQuarter = 'fall' | 'winter' | 'spring';
export const HOUSE_PLANNING_QUARTERS: readonly HousePlanningQuarter[] = ['fall', 'winter', 'spring'];

export interface HousePlanningCount {
  profileId: string;
  houseLabel: string;
  quarter: HousePlanningQuarter;
  /** Published date in the past; whether it actually happened is unknown. */
  pastUnverified: number;
  /** Published with today's or a future date. */
  scheduled: number;
  /** Unpublished, regardless of whether its date passed. */
  drafts: number;
}

export interface HousePlanningSummary {
  year: number;
  rows: HousePlanningCount[];
  /** Count event records only once, even when more than one House hosted. */
  uniqueEventCount: number;
  /** Missing/invalid date or dates outside Fall/Winter/Spring. */
  dateNeedsReview: number;
  /** No valid same-year House host association. */
  hostNeedsReview: number;
}

/** Date-only strings are validated without timezone-dependent Date parsing. */
function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Academic-year Fall is calendar year Y; Winter and Spring are Y + 1. */
export function planningQuarterForDate(date: string, academicYearStart: number): HousePlanningQuarter | null {
  if (!isValidDateOnly(date)) return null;
  for (const quarter of HOUSE_PLANNING_QUARTERS) {
    const calendarYear = quarter === 'fall' ? academicYearStart : academicYearStart + 1;
    const { startsOn, endsOn } = getAcademicTermDateRange(quarter, calendarYear);
    if (date >= startsOn && date <= endsOn) return quarter;
  }
  return null;
}

export function summarizeHouseEventPlanning(
  events: readonly HouseEvent[],
  profiles: readonly HousePageAsset[],
  year: number,
  today: string,
): HousePlanningSummary {
  // A stale profile from a prior academic year is never a current-year host.
  const houses = profiles.filter((profile) => profile.academic_year_start === year);
  const houseIds = new Set(houses.map((profile) => profile.id));
  const rows = houses.flatMap((profile) =>
    HOUSE_PLANNING_QUARTERS.map((quarter) => ({
      profileId: profile.id,
      houseLabel: hostLabel(profile),
      quarter,
      pastUnverified: 0,
      scheduled: 0,
      drafts: 0,
    })),
  );
  const counts = new Map(rows.map((row) => [`${row.profileId}:${row.quarter}`, row]));
  const uniqueEvents = new Map(events.filter((event) => event.academic_year_start === year).map((event) => [event.id, event]));
  let dateNeedsReview = 0;
  let hostNeedsReview = 0;

  for (const event of Array.from(uniqueEvents.values())) {
    const quarter = planningQuarterForDate(event.event_date || '', year);
    if (!quarter) dateNeedsReview += 1;

    // house_event_houses is authoritative; the legacy primary-host column
    // alone is not proof of a valid association.
    const hosts = Array.from(new Set(hostIdsOf(event))).filter((id) => houseIds.has(id));
    if (hosts.length === 0) hostNeedsReview += 1;
    if (!quarter) continue;

    for (const hostId of hosts) {
      const row = counts.get(`${hostId}:${quarter}`);
      if (!row) continue;
      if (!event.is_published) row.drafts += 1;
      else if (event.event_date < today) row.pastUnverified += 1;
      else row.scheduled += 1;
    }
  }

  return { year, rows, uniqueEventCount: uniqueEvents.size, dateNeedsReview, hostNeedsReview };
}

function csvValue(value: string | number): string {
  const text = String(value);
  // Prevent Excel/Sheets formula execution if an admin-supplied House label
  // starts with a spreadsheet formula prefix.
  const escaped = /^\s*[=+@-]/.test(text) && typeof value === 'string' ? `'${text}` : text;
  return `"${escaped.replace(/"/g, '""')}"`;
}

/** Aggregate-only CSV: no member data, check-in links, or event titles. */
export function housePlanningCsv(summary: HousePlanningSummary): string {
  const columns = ['House', 'Academic year', 'Quarter', 'Past date (unverified)', 'Scheduled', 'Unpublished drafts', 'Total'];
  const rows = summary.rows.map((row) => [
    row.houseLabel,
    formatAcademicYear(summary.year),
    row.quarter,
    row.pastUnverified,
    row.scheduled,
    row.drafts,
    row.pastUnverified + row.scheduled + row.drafts,
  ]);
  return [columns, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n') + '\r\n';
}
