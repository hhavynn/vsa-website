// Application URL masking — closed or future application URLs must never be exposed
// publicly. maskTargetUrl() here mirrors the SQL masking in the public_application_links
// view; both must agree. Authority: AGENTS.md § "Domain-critical facts";
// vsa-seasonal-operations § 2 (public_application_links view masking logic).
import { ApplicationKey, ApplicationStatus } from '../types';
import { losAngelesDateTimeToIso } from '../utils/losAngelesDate';

const VSA_TIME_ZONE = 'America/Los_Angeles';

// Ordered list of the application keys this MVP supports, with human-readable
// labels for admin dropdowns and public display.
export const APPLICATION_KEY_OPTIONS: { key: ApplicationKey; label: string }[] = [
  { key: 'ace_application', label: 'ACE Application' },
  { key: 'house_fall', label: 'House Application — Fall' },
  { key: 'house_winter', label: 'House Application — Winter' },
  { key: 'house_spring', label: 'House Application — Spring' },
  { key: 'intern_application', label: 'Intern Application' },
  { key: 'cabinet_application', label: 'Cabinet Application' },
  { key: 'vcn_stage_ninja_interest', label: 'VCN Stage Ninja Interest' },
  { key: 'vcn_props_team_interest', label: 'VCN Props Team Interest' },
  { key: 'wnc_team_form', label: 'WNC Team Form' },
];

export const APPLICATION_KEYS: ApplicationKey[] = APPLICATION_KEY_OPTIONS.map((o) => o.key);

const KEY_LABELS: Record<ApplicationKey, string> = APPLICATION_KEY_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option.label;
    return acc;
  },
  {} as Record<ApplicationKey, string>,
);

export function applicationKeyLabel(key: ApplicationKey): string {
  return KEY_LABELS[key] ?? key;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  disabled: 'Disabled',
  not_open: 'Not open yet',
  open: 'Open',
  closed: 'Closed',
};

// Default before-open / after-close fallback copy per application key. Admins can
// override these per row; these are used as form defaults and component fallbacks.
export const DEFAULT_APPLICATION_MESSAGES: Record<
  ApplicationKey,
  { before: string; after: string }
> = {
  ace_application: {
    before: 'ACE applications will be released later.',
    after: 'ACE applications have closed. Check back next year.',
  },
  house_fall: {
    before: 'House applications will be released closer to the next House cycle.',
    after: 'House applications have closed. Check back next quarter.',
  },
  house_winter: {
    before: 'House applications will be released closer to the next House cycle.',
    after: 'House applications have closed. Check back next quarter.',
  },
  house_spring: {
    before: 'House applications will be released closer to the next House cycle.',
    after: 'House applications have closed. Check back next quarter.',
  },
  intern_application: {
    before: 'Intern applications will be released later.',
    after: 'Intern applications have closed. Check back next year.',
  },
  cabinet_application: {
    before: 'Cabinet applications will be released later.',
    after: 'Cabinet applications have closed. Check back next year.',
  },
  vcn_stage_ninja_interest: {
    before: 'Stage Ninja interest forms will be released closer to VCN.',
    after: 'Stage Ninja interest forms have closed for this cycle.',
  },
  vcn_props_team_interest: {
    before: 'Props team interest forms will be released closer to VCN.',
    after: 'Props team interest forms have closed for this cycle.',
  },
  wnc_team_form: {
    before: "WNC team forms will be released closer to Wild 'N Culture.",
    after: 'WNC team forms have closed for this cycle.',
  },
};

/**
 * Compute the live status of an application window. Mirrors the SQL logic in the
 * public_application_links view so the admin screen and tests agree with the DB.
 */
export function getApplicationStatus(
  openAt: string | Date,
  dueAt: string | Date,
  isEnabled: boolean,
  now: Date = new Date(),
): ApplicationStatus {
  if (!isEnabled) return 'disabled';

  const open = openAt instanceof Date ? openAt.getTime() : new Date(openAt).getTime();
  const due = dueAt instanceof Date ? dueAt.getTime() : new Date(dueAt).getTime();
  const current = now.getTime();

  if (Number.isNaN(open) || Number.isNaN(due)) return 'disabled';
  if (current < open) return 'not_open';
  if (current > due) return 'closed';
  return 'open';
}

/**
 * Frontend masking guard: a target URL is only ever exposed while the window is
 * open. Mirrors the SQL masking in public_application_links as defense in depth.
 */
export function maskTargetUrl(
  status: ApplicationStatus,
  targetUrl: string | null,
): string | null {
  return status === 'open' ? targetUrl : null;
}

/**
 * When an admin selects a due date but does not edit the time, the close time
 * defaults to 11:59 PM local time on that date. Accepts a 'YYYY-MM-DD' string or
 * a Date and returns a Date at 23:59:00 local time.
 */
export function defaultDueDateTime(date: string | Date): Date {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0, 0);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date for defaultDueDateTime: ${date}`);
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 0, 0);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 0, 0);
}

/**
 * Combine a 'YYYY-MM-DD' date and an optional 'HH:mm' time, both read as San
 * Diego wall-clock time, into an ISO timestamp (#274). When the time is missing,
 * fallbackTime is used (e.g. '23:59' for a due date, '00:00' for an open date).
 * Returns null when the date is empty or malformed, so a bad input can never
 * produce a window that opens.
 *
 * Interpreting the input in the admin's device timezone (the old behaviour)
 * shifted every window by hours for anyone editing outside Pacific time.
 */
export function combineLocalDateTime(
  date: string,
  time: string,
  fallbackTime: string,
): string | null {
  if (!date) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!dateMatch) return null;
  const [, year, month, day] = dateMatch.map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  const effectiveTime = time && time.trim().length > 0 ? time.trim() : fallbackTime;
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(effectiveTime);
  if (!timeMatch) return null;
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return null;

  const pad = (value: number) => String(value).padStart(2, '0');
  const wallClock = { date: date.trim(), time: `${pad(hours)}:${pad(minutes)}` };
  const iso = losAngelesDateTimeToIso(wallClock.date, wallClock.time);

  // A time inside the spring-forward gap (e.g. 2:30 AM on the March DST day)
  // doesn't exist in San Diego and converts to a different wall-clock time,
  // which could open a window an hour early. Reject anything that doesn't
  // round-trip.
  const roundTrip = splitLocalDateTime(iso);
  if (roundTrip.date !== wallClock.date || roundTrip.time !== wallClock.time) return null;
  return iso;
}

/** Split an ISO timestamp into San Diego 'YYYY-MM-DD' and 'HH:mm' parts for inputs. */
export function splitLocalDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VSA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsed);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/**
 * Friendly date/time for public display, always in San Diego time with the zone
 * shown ("Oct 1, 2026, 11:59 PM PDT"), so a visitor elsewhere reads the real
 * deadline rather than a silently converted one.
 */
export function formatApplicationDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: VSA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(parsed);
}
