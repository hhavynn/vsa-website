// Public-safe aggregate helpers for the VSA Wrapped page.
//
// These operate only on data the site already exposes publicly (published
// events, public gallery albums, the house_yearly_points aggregate view) and
// return community-level numbers — never individual member stats.

import { Event, HouseYearlyPoints } from '../types';
import { toDateOnlyString } from '../lib/dateOnly';
import { HOUSE_COLORS, HOUSE_OPTIONS } from '../constants/houses';
import { getPublicHousePoints, isHousePointOverrideActive } from './housePublicPointOverrides';

/** Count published events whose start date falls inside a date-only window. */
export function countEventsInWindow(
  events: Pick<Event, 'date'>[],
  windowStart: string,
  windowEnd: string
): number {
  return events.filter((event) => {
    const day = toDateOnlyString(event.date);
    return day >= windowStart && day <= windowEnd;
  }).length;
}

/**
 * Build public House standings the same way the Leaderboard page does:
 * when the DB view has no calculated rows for an override year, inject
 * official placeholder rows, then apply the House Chair's public point
 * overrides. Keeps Wrapped's House Cup consistent with /leaderboard.
 */
export function buildPublicHouseStandings(
  rawData: HouseYearlyPoints[],
  academicYearStart: number
): HouseYearlyPoints[] {
  const base =
    rawData.length === 0 && isHousePointOverrideActive(academicYearStart)
      ? HOUSE_OPTIONS.map((houseName) => ({
          house: houseName,
          house_profile_id: houseName,
          display_name: houseName,
          image_url: null,
          accent_color: HOUSE_COLORS[houseName],
          academic_year_start: academicYearStart,
          academic_year_end: academicYearStart + 1,
          total_points: 0,
          events_attended: 0,
          unique_events: 0,
          unique_members: 0,
          average_points_per_member: null,
          latest_activity_at: null,
        }))
      : rawData;

  return base.map((house) => ({
    ...house,
    total_points: getPublicHousePoints({
      houseKey: house.house,
      houseName: house.display_name,
      academicYearStart: house.academic_year_start,
      calculatedPoints: house.total_points,
    }),
  }));
}

/** Sort House standings by total points, highest first. */
export function sortHouseStandings(houses: HouseYearlyPoints[]): HouseYearlyPoints[] {
  return [...houses].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
}

/** House Cup winner, or null when standings are empty or tied at zero. */
export function pickHouseWinner(houses: HouseYearlyPoints[]): HouseYearlyPoints | null {
  const sorted = sortHouseStandings(houses);
  const winner = sorted[0];
  if (!winner || (winner.total_points ?? 0) <= 0) return null;
  return winner;
}

/** Community-wide points total across all Houses (aggregate of aggregates). */
export function sumCommunityPoints(houses: HouseYearlyPoints[]): number {
  return houses.reduce((total, house) => total + (house.total_points ?? 0), 0);
}

/** "12345" → "12,345" for big stat displays. */
export function formatStatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Round an aggregate to a friendly "over N" floor (e.g. 12,481 → 12,000) so
 * headline stats read like a recap, not a spreadsheet. Values under 100 are
 * returned exactly.
 */
export function roundToFriendlyFloor(value: number): number {
  if (value < 100) return value;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)) - 1);
  return Math.floor(value / magnitude) * magnitude;
}
