import type { Event } from '../types';
import { getEventDateOnly } from './eventTime';
import { addDaysToDateOnly, isExistingLosAngelesWallClock, losAngelesDateTimeToIso } from '../utils/losAngelesDate';

type PublicCalendarEvent = Pick<Event, 'id' | 'name' | 'description' | 'date' | 'end_date' | 'start_time' | 'end_time' | 'location' | 'is_published'>;

function escapeIcs(value: string): string {
  // RFC 5545 TEXT escaping. Never let descriptions inject a new VCALENDAR
  // property, even if they contain CR, LF, commas, backslashes or semicolons.
  return value.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function utcIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function allDayPart(day: string): string {
  return day.replace(/-/g, '');
}

function foldLine(line: string): string {
  // RFC 5545 folding counts UTF-8 octets, not JS UTF-16 characters.
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (octets + length > 75) {
      lines.push(current);
      current = ' ' + character;
      octets = 1 + length;
    } else {
      current += character;
      octets += length;
    }
  }
  lines.push(current);
  return lines.join('\r\n');
}

function eventLines(event: PublicCalendarEvent, stamp: string): string[] {
  const date = getEventDateOnly(event.date, event.start_time);
  const endDay = event.end_date && event.end_date > date ? event.end_date : date;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcs(event.id)}@vsaatucsd.com`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeIcs(event.name)}`,
  ];

  if (event.start_time && isExistingLosAngelesWallClock(date, event.start_time)) {
    const start = losAngelesDateTimeToIso(date, event.start_time);
    lines.push(`DTSTART:${utcIcsDate(start)}`);
    if (event.end_time && isExistingLosAngelesWallClock(endDay, event.end_time)) {
      const end = losAngelesDateTimeToIso(endDay, event.end_time);
      if (Date.parse(end) > Date.parse(start)) lines.push(`DTEND:${utcIcsDate(end)}`);
    }
  } else {
    // If no reliable start time exists, represent the event as all-day rather
    // than inventing a clock time. The end of a DATE range is exclusive.
    lines.push(`DTSTART;VALUE=DATE:${allDayPart(date)}`);
    lines.push(`DTEND;VALUE=DATE:${allDayPart(addDaysToDateOnly(endDay, 1))}`);
  }

  if (event.location?.trim()) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  if (event.description?.trim()) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  lines.push('END:VEVENT');
  return lines;
}

/**
 * A one-time local export of *published* VSA events, not a subscribable feed.
 * The only serialized fields are event id/name/date/time/location/public
 * description. Do not add check-in secrets, attendance or admin notes.
 */
export function buildPublicEventIcs(events: ReadonlyArray<PublicCalendarEvent>, now: Date = new Date()): string {
  const stamp = utcIcsDate(now.toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VSA at UCSD//Public Events Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:VSA at UCSD Events',
  ];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.is_published !== true || !event.id || seen.has(event.id)) continue;
    seen.add(event.id);
    lines.push(...eventLines(event, stamp));
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function downloadPublicEventIcs(events: ReadonlyArray<PublicCalendarEvent>): void {
  const content = buildPublicEventIcs(events);
  const fileUrl = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = fileUrl;
  anchor.download = 'vsa-public-events.ics';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revocation after the click task avoids truncating the download in Safari.
  window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
}
