// One chronological "upcoming" list for regular VSA events and published House
// events (#634), used by /events and the Home "next event" card. Each source
// keeps its own id and record (a House event is never turned into an `events`
// row), and a collab House event is one item listing every host House. Times
// are Los Angeles wall-clock, through the same lifecycle rules for both kinds.
import type { Event, HouseEvent } from '../types';
import { houseEventToCalendarItem } from '../utils/calendar';
import { EventLifecycleCandidate, getEventLifecycleBounds, isEventUpcomingOrOngoing } from './eventLifecycle';

export type UpcomingItem =
  | { kind: 'vsa'; key: string; sortMs: number; event: Event }
  | { kind: 'house'; key: string; sortMs: number; event: HouseEvent; detailPath: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When an event sorts: its start instant, or for an event without a start
 * time the end of its first day, so it follows that day's timed events.
 */
export function upcomingSortMs(event: EventLifecycleCandidate): number {
  const start = getEventLifecycleBounds(event).startInstant.getTime();
  return event.start_time ? start : start + DAY_MS - 1;
}

function houseCandidate(event: Pick<HouseEvent, 'event_date' | 'start_time' | 'end_time'>): EventLifecycleCandidate {
  return { date: event.event_date, start_time: event.start_time, end_time: event.end_time, end_date: null };
}

/** Not over yet (Los Angeles time): upcoming, or still going on. */
export function isHouseEventUpcomingOrOngoing(event: HouseEvent, now: Date): boolean {
  return isEventUpcomingOrOngoing(houseCandidate(event), now);
}

export function houseEventDetailPath(event: HouseEvent): string {
  return houseEventToCalendarItem(event).detailPath ?? '/house';
}

export function compareUpcoming(a: UpcomingItem, b: UpcomingItem): number {
  const name = (item: UpcomingItem) => `${item.kind === 'vsa' ? item.event.name : item.event.title}\u0000${item.event.id}`;
  // Same instant: the all-VSA event first, then by name (stable).
  return a.sortMs - b.sortMs || (a.kind === b.kind ? 0 : a.kind === 'vsa' ? -1 : 1) || name(a).localeCompare(name(b));
}

/**
 * Merge already-eligible regular events with House events, earliest first.
 * Unpublished House events (never returned by public reads) and ones that are
 * over are dropped; the same House event twice is listed once.
 */
export function mergeUpcoming(vsaEvents: readonly Event[], houseEvents: readonly HouseEvent[], now: Date): UpcomingItem[] {
  const items: UpcomingItem[] = vsaEvents.map((event) => ({ kind: 'vsa', key: `vsa:${event.id}`, sortMs: upcomingSortMs(event), event }));
  const seen = new Set<string>();
  for (const event of houseEvents) {
    if (!event.is_published || seen.has(event.id) || !isHouseEventUpcomingOrOngoing(event, now)) continue;
    seen.add(event.id);
    items.push({ kind: 'house', key: `house:${event.id}`, sortMs: upcomingSortMs(houseCandidate(event)), event, detailPath: houseEventDetailPath(event) });
  }
  return items.sort(compareUpcoming);
}
