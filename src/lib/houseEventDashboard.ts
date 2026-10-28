// Admin → Houses → House Events dashboard (#636). Pure: it sorts one year's
// House events (drafts included, admin only) into views and lists what an
// admin may want to look at. A warning is a prompt to check, never a verdict
// that the event is invalid; nothing here writes or blocks a save.
import type { HouseEvent, HousePageAsset } from '../types';
import { sanitizeHref } from '../utils/sanitizeUrl';

export type HouseEventView = 'attention' | 'drafts' | 'upcoming' | 'past';

export interface HouseEventIssue {
  id: string;
  /** `warn` puts the event in Needs attention; `note` is shown on the row only. */
  level: 'warn' | 'note';
  message: string;
}

export interface HouseCount {
  profile: HousePageAsset;
  published: number;
  drafts: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` plus `days`, in calendar days (no time zone involved). */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((value) => {
    const [y, m, d] = value.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / DAY_MS);
}

export function hostIdsOf(event: Pick<HouseEvent, 'houses'>): string[] {
  return (event.houses ?? []).map((house) => house.id);
}

export function hostLabel(house: Pick<HousePageAsset, 'display_name' | 'house_key' | 'house'>): string {
  return house.display_name || house.house_key || house.house;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) && sanitizeHref(value) !== '#';
}

export function houseEventIssues(event: HouseEvent, today: string): HouseEventIssue[] {
  const issues: HouseEventIssue[] = [];
  const hosts = event.houses ?? [];
  const upcoming = event.event_date >= today;

  if (hosts.length === 0) {
    issues.push({ id: 'no_host', level: 'warn', message: 'No host House is linked, so no House page lists it.' });
  }
  const otherYear = hosts.filter((house) => house.academic_year_start !== event.academic_year_start);
  if (otherYear.length > 0) {
    issues.push({ id: 'host_other_year', level: 'warn', message: `${otherYear.map(hostLabel).join(', ')} belongs to another academic year.` });
  }
  const hidden = hosts.filter((house) => !house.is_active);
  if (hidden.length > 0) {
    issues.push({
      id: 'host_not_public',
      level: 'warn',
      message: `${hidden.map(hostLabel).join(', ')} ${hidden.length === 1 ? 'is' : 'are'} not public yet (inactive profile). Check the House Reveal before publishing an event that names ${hidden.length === 1 ? 'it' : 'them'}.`,
    });
  }
  if (event.rsvp_url && !isHttpUrl(event.rsvp_url)) {
    issues.push({ id: 'rsvp_unsafe', level: 'warn', message: 'The RSVP link is not a web address, so the public page hides it.' });
  }
  const image = event.image_thumbnail_url || event.image_url;
  if (image && !/^https:\/\//i.test(image.trim()) && !image.trim().startsWith('/')) {
    issues.push({ id: 'image_unsupported', level: 'warn', message: 'The image link is not an https or site address and may not load.' });
  }
  if (!event.is_published && !upcoming) {
    issues.push({ id: 'draft_past', level: 'warn', message: 'Still a draft, and its date has passed.' });
  } else if (!event.is_published && daysBetween(today, event.event_date) <= 6) {
    const days = daysBetween(today, event.event_date);
    issues.push({ id: 'draft_soon', level: 'warn', message: days === 0 ? 'Happens today and is still a draft.' : `Happens in ${days} day${days === 1 ? '' : 's'} and is still a draft.` });
  }
  if (upcoming) {
    if (!event.start_time) issues.push({ id: 'no_time', level: 'warn', message: 'No start time yet.' });
    if (!event.location?.trim()) issues.push({ id: 'no_location', level: 'warn', message: 'No location yet.' });
    if (!event.rsvp_url) issues.push({ id: 'no_rsvp', level: 'note', message: 'No RSVP link (optional).' });
  }
  return issues;
}

function startKey(event: HouseEvent) {
  return `${event.event_date} ${event.start_time ?? '99:99'} ${event.title}`;
}

export function eventsInView(events: readonly HouseEvent[], view: HouseEventView, today: string): HouseEvent[] {
  const ascending = (a: HouseEvent, b: HouseEvent) => startKey(a).localeCompare(startKey(b));
  switch (view) {
    case 'attention':
      return events
        .filter((event) => (!event.is_published || event.event_date >= today) && houseEventIssues(event, today).some((issue) => issue.level === 'warn'))
        .sort(ascending);
    case 'drafts':
      return events.filter((event) => !event.is_published).sort(ascending);
    case 'upcoming':
      return events.filter((event) => event.is_published && event.event_date >= today).sort(ascending);
    case 'past':
      return events.filter((event) => event.is_published && event.event_date < today).sort((a, b) => ascending(b, a));
  }
}

/** `hostId` null = every House. A collab event matches each of its hosts. */
export function filterByHost(events: readonly HouseEvent[], hostId: string | null): HouseEvent[] {
  if (!hostId) return [...events];
  return events.filter((event) => hostIdsOf(event).includes(hostId));
}

/** Drafts and published events in the next seven days, today included. */
export function thisWeek(events: readonly HouseEvent[], today: string): HouseEvent[] {
  const end = addDaysToDateOnly(today, 6);
  return events
    .filter((event) => event.event_date >= today && event.event_date <= end)
    .sort((a, b) => startKey(a).localeCompare(startKey(b)));
}

export function countsByHouse(events: readonly HouseEvent[], profiles: readonly HousePageAsset[]): HouseCount[] {
  return profiles.map((profile) => {
    const hosted = filterByHost(events, profile.id);
    return { profile, published: hosted.filter((event) => event.is_published).length, drafts: hosted.filter((event) => !event.is_published).length };
  });
}
