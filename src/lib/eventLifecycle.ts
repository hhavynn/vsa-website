import {
  getLosAngelesDateOnly,
  losAngelesDateTimeToIso,
  addDaysToDateOnly,
} from '../utils/losAngelesDate';
import { getEventDateOnly } from './eventTime';

export type EventLifecycleStatus = 'upcoming' | 'ongoing' | 'past';

export interface EventLifecycleCandidate {
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  end_date?: string | null;
}

export interface EventLifecycleBounds {
  startDate: string; // YYYY-MM-DD in San Diego (America/Los_Angeles)
  endDate: string; // Final scheduled YYYY-MM-DD in San Diego
  startInstant: Date; // UTC instant when the event starts
  endInstant: Date; // UTC instant when the event ends
}

function parseTimeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Determines the start and end instants in America/Los_Angeles for an event.
 * Reuses getEventDateOnly to preserve legacy UTC-midnight dates and
 * handles single-day, multi-day, overnight, and time-less events cleanly.
 */
export function getEventLifecycleBounds(
  event: EventLifecycleCandidate
): EventLifecycleBounds {
  // 1. Derive the correct San Diego calendar date from event.date
  const startDate = getEventDateOnly(event.date, event.start_time);

  // 2. Final calendar day (for multi-day events or single-day fallback)
  const hasValidEndDate = Boolean(
    event.end_date &&
      /^\d{4}-\d{2}-\d{2}$/.test(event.end_date) &&
      event.end_date >= startDate
  );
  const baseEndDate = hasValidEndDate && event.end_date ? event.end_date : startDate;

  // 3. Overnight events: when scheduled on a single day but end_time < start_time
  const isOvernight = Boolean(
    baseEndDate === startDate &&
      event.start_time &&
      event.end_time &&
      parseTimeToMinutes(event.end_time) < parseTimeToMinutes(event.start_time)
  );
  const scheduledEndDate = isOvernight
    ? addDaysToDateOnly(startDate, 1)
    : baseEndDate;

  // 4. Start instant
  const startInstant = new Date(
    event.start_time
      ? losAngelesDateTimeToIso(startDate, event.start_time)
      : losAngelesDateTimeToIso(startDate, '00:00')
  );

  // 5. End instant:
  // If end_time is provided, use scheduledEndDate + end_time.
  // If no end_time is provided, keep it eligible through the end of its final
  // San Diego calendar day (i.e. until midnight entering the next day).
  const endInstant = new Date(
    event.end_time
      ? losAngelesDateTimeToIso(scheduledEndDate, event.end_time)
      : losAngelesDateTimeToIso(addDaysToDateOnly(baseEndDate, 1), '00:00')
  );

  return {
    startDate,
    endDate: scheduledEndDate,
    startInstant,
    endInstant,
  };
}

/**
 * Classifies an event into 'upcoming', 'ongoing', or 'past' based on
 * America/Los_Angeles time, independent of the browser's local timezone.
 *
 * Boundary rule: at the scheduled end instant, the event becomes past.
 */
export function getEventLifecycleStatus(
  event: EventLifecycleCandidate,
  now: Date = new Date()
): EventLifecycleStatus {
  const { startInstant, endInstant } = getEventLifecycleBounds(event);
  const nowMs = now.getTime();
  const startMs = startInstant.getTime();
  const endMs = endInstant.getTime();

  if (nowMs < startMs) {
    return 'upcoming';
  }
  if (nowMs < endMs) {
    return 'ongoing';
  }
  return 'past';
}

/**
 * Returns true if the event has not yet ended (either upcoming or ongoing).
 */
export function isEventUpcomingOrOngoing(
  event: EventLifecycleCandidate,
  now: Date = new Date()
): boolean {
  return getEventLifecycleStatus(event, now) !== 'past';
}

/**
 * Returns true if the event has ended.
 */
export function isEventPast(
  event: EventLifecycleCandidate,
  now: Date = new Date()
): boolean {
  return getEventLifecycleStatus(event, now) === 'past';
}

/**
 * Finds the earliest future transition instant (start, end, or San Diego midnight)
 * for a list of candidate events, or null if none exist.
 */
export function getNextEventLifecycleTransition(
  events: EventLifecycleCandidate[],
  now: Date = new Date()
): Date | null {
  const nowMs = now.getTime();
  let earliestMs: number | null = null;

  const consider = (instant: Date) => {
    const t = instant.getTime();
    if (t > nowMs && (earliestMs === null || t < earliestMs)) {
      earliestMs = t;
    }
  };

  for (const event of events) {
    const { startInstant, endInstant } = getEventLifecycleBounds(event);
    consider(startInstant);
    consider(endInstant);
  }

  // Also include the next San Diego midnight rollover
  const todaySD = getLosAngelesDateOnly(now);
  const tomorrowSD = addDaysToDateOnly(todaySD, 1);
  const nextMidnight = new Date(losAngelesDateTimeToIso(tomorrowSD, '00:00'));
  consider(nextMidnight);

  return earliestMs !== null ? new Date(earliestMs) : null;
}
