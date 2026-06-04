import { ApplicationKey, ApplicationStatus } from '../types';

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
 * Combine a local 'YYYY-MM-DD' date and an optional 'HH:mm' time into an ISO
 * timestamp. When the time is missing, fallbackTime is used (e.g. '23:59' for a
 * due date, '00:00' for an open date). Returns null when the date is empty.
 */
export function combineLocalDateTime(
  date: string,
  time: string,
  fallbackTime: string,
): string | null {
  if (!date) return null;

  const effectiveTime = time && time.trim().length > 0 ? time : fallbackTime;
  const [hours, minutes] = effectiveTime.split(':').map((part) => Number(part));
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;

  const [, year, month, day] = match;
  const combined = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number.isNaN(hours) ? 0 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
    0,
    0,
  );

  if (Number.isNaN(combined.getTime())) return null;
  return combined.toISOString();
}

/** Split an ISO timestamp into local 'YYYY-MM-DD' and 'HH:mm' parts for inputs. */
export function splitLocalDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };

  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  const time = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  return { date, time };
}

/** Friendly date/time for public display (no extra date library). */
export function formatApplicationDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}
