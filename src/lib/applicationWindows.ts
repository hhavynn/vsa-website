// Shared application-window logic for the three surfaces that talk about a
// window's timing: the admin Applications page, the homepage "closing soon"
// notice, and the Admin Overview attention queue. Pure: no I/O, no hooks, so
// every rule here can be pinned by a unit test and cannot drift between pages.
//
// It deliberately builds on lib/applicationLinks.ts (getApplicationStatus,
// maskTargetUrl, the San Diego date helpers) instead of re-implementing window
// gating. Authority: AGENTS.md § "Domain-critical facts"; vsa-seasonal-operations.
import { ApplicationKey, ApplicationLink, ApplicationStatus, PublicApplicationLink } from '../types';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';
import { getApplicationStatus, maskTargetUrl } from './applicationLinks';

const VSA_TIME_ZONE = 'America/Los_Angeles';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far ahead a window counts as "closing soon" (homepage notice and admin
 * attention queue) or "opening soon" (admin attention queue). One constant so the
 * public notice and the admin queue can never disagree about what "soon" means.
 */
export const CLOSING_SOON_DAYS = 7;
export const OPENING_SOON_DAYS = 7;

// ─── Pacific-time display ────────────────────────────────────────────────────

/**
 * "Oct 8, 2026, 11:59 PM PT". Always San Diego time, always labelled, so an admin
 * (or student) traveling elsewhere cannot read it as their local time. Built from
 * parts rather than Intl's one-string output so the spacing is stable across
 * ICU versions.
 */
export function formatPacificDateTime(value: string | Date | null | undefined, options: { withYear?: boolean } = {}): string {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VSA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(parsed);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const date = options.withYear === false ? `${get('month')} ${get('day')}` : `${get('month')} ${get('day')}, ${get('year')}`;
  return `${date}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()} PT`;
}

// ─── Admin window state ──────────────────────────────────────────────────────

export type WindowState = 'open' | 'scheduled' | 'closed' | 'disabled' | 'misconfigured';

export const WINDOW_STATE_LABELS: Record<WindowState, string> = {
  open: 'Open',
  scheduled: 'Scheduled',
  closed: 'Closed',
  disabled: 'Disabled',
  misconfigured: 'Needs fixing',
};

export interface WindowIssue {
  code: 'invalid_schedule' | 'close_before_open' | 'invalid_url' | 'placeholder_url';
  /** Errors block publishing and fail the window closed; warnings are shown but never block. */
  severity: 'error' | 'warning';
  message: string;
}

export interface WindowFacts {
  open_at: string | null | undefined;
  due_at: string | null | undefined;
  is_enabled: boolean;
  target_url: string | null | undefined;
}

/** A complete https:// URL with a host. Anything else can never be a public link. */
export function isValidFormUrl(value: string | null | undefined): boolean {
  const url = (value ?? '').trim();
  if (!/^https:\/\//i.test(url)) return false;
  try {
    return Boolean(new URL(url).host);
  } catch {
    return false;
  }
}

/** The migration seeds example.com placeholders; they must be replaced before a window goes live. */
function isPlaceholderUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return /(^|\.)example\.(com|org|net)$/.test(host) || host.endsWith('.invalid');
  } catch {
    return false;
  }
}

function parseInstant(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : Number.NaN;
}

export function validateApplicationWindow(facts: WindowFacts): WindowIssue[] {
  const issues: WindowIssue[] = [];
  const open = parseInstant(facts.open_at);
  const due = parseInstant(facts.due_at);

  if (Number.isNaN(open) || Number.isNaN(due)) {
    issues.push({ code: 'invalid_schedule', severity: 'error', message: 'The open or close time is missing or invalid, so this window stays closed.' });
  } else if (due <= open) {
    issues.push({ code: 'close_before_open', severity: 'error', message: 'The close time must be after the open time, so this window stays closed.' });
  }

  const url = (facts.target_url ?? '').trim();
  if (!isValidFormUrl(url)) {
    issues.push({
      code: 'invalid_url',
      // A disabled window never shows a button, so a bad URL there is a heads-up, not a fault.
      severity: facts.is_enabled ? 'error' : 'warning',
      message: url ? 'The target URL must be a complete https:// link.' : 'There is no target URL, so no Apply button could show.',
    });
  } else if (isPlaceholderUrl(url)) {
    issues.push({ code: 'placeholder_url', severity: 'warning', message: 'The target URL still looks like a placeholder. Replace it with the real form.' });
  }
  return issues;
}

export interface AdminWindowState {
  state: WindowState;
  /** The public view's status for this row (what the database would report). */
  status: ApplicationStatus;
  issues: WindowIssue[];
  /** True when students can reach the form URL right now (the database view's rule: enabled, inside its dates, URL present). */
  isPublic: boolean;
}

export function getAdminWindowState(facts: WindowFacts, now: Date = new Date()): AdminWindowState {
  const issues = validateApplicationWindow(facts);
  const status = getApplicationStatus(facts.open_at ?? '', facts.due_at ?? '', facts.is_enabled, now);
  const hasError = issues.some((issue) => issue.severity === 'error');
  // Whether students can reach the form is decided by the database view, which
  // only looks at enabled + dates (+ a non-empty URL). It does not validate the URL,
  // so a legacy row with a bad link can be live while still being flagged here.
  // Say so rather than reporting "not public" for something students can open.
  const isPublic = status === 'open' && (facts.target_url ?? '').trim() !== '';
  const state: WindowState = hasError
    ? 'misconfigured'
    : status === 'open'
      ? 'open'
      : status === 'not_open'
        ? 'scheduled'
        : status === 'closed'
          ? 'closed'
          : 'disabled';
  if (isPublic && hasError) {
    return {
      state,
      status,
      isPublic,
      issues: issues.map((issue) =>
        issue.code === 'invalid_url' ? { ...issue, message: 'This window is live, but its link is not a valid https:// URL. Fix it or disable the window.' } : issue,
      ),
    };
  }
  return { state, status, issues, isPublic };
}

/** True when the open time has already passed, so enabling the window opens it immediately. */
export function opensInThePast(openAt: string | null | undefined, now: Date = new Date()): boolean {
  const open = parseInstant(openAt);
  return !Number.isNaN(open) && open < now.getTime();
}

// ─── Public projection (preview) ─────────────────────────────────────────────

type ProjectableWindow = Pick<
  ApplicationLink,
  'application_key' | 'title' | 'description' | 'button_label' | 'target_url' | 'open_at' | 'due_at' | 'is_enabled' | 'before_open_message' | 'after_close_message' | 'sort_order'
> & { id?: string; updated_at?: string };

/**
 * What the public_application_links view would return for this row at `now`:
 * the same getApplicationStatus / maskTargetUrl pair the real site uses, so a
 * preview cannot disagree with production gating. `assumeEnabled` previews a
 * disabled window as if the admin switched it on.
 */
export function projectPublicApplicationLink(
  row: ProjectableWindow,
  now: Date = new Date(),
  options: { assumeEnabled?: boolean } = {},
): PublicApplicationLink {
  const isEnabled = options.assumeEnabled ? true : row.is_enabled;
  const status = getApplicationStatus(row.open_at, row.due_at, isEnabled, now);
  return {
    id: row.id ?? 'preview',
    application_key: row.application_key,
    title: row.title,
    description: row.description,
    button_label: row.button_label,
    target_url: maskTargetUrl(status, row.target_url),
    status,
    open_at: row.open_at,
    due_at: row.due_at,
    is_enabled: isEnabled,
    before_open_message: row.before_open_message,
    after_close_message: row.after_close_message,
    sort_order: row.sort_order,
    updated_at: row.updated_at ?? new Date(now).toISOString(),
  };
}

// ─── Closing / opening soon ──────────────────────────────────────────────────

export interface WindowTiming {
  application_key: ApplicationKey;
  open_at: string;
  due_at: string;
  is_enabled: boolean;
}

export interface ClosingSoonWindow<T extends WindowTiming> {
  row: T;
  dueAt: Date;
  /** Whole San Diego calendar days from today to the due date (0 = closes today). */
  daysUntilClose: number;
  /** "House Applications close tomorrow" */
  headline: string;
}

const SHORT_NAMES: Record<ApplicationKey, string> = {
  ace_application: 'ACE Applications',
  house_fall: 'House Applications',
  house_winter: 'House Applications',
  house_spring: 'House Applications',
  intern_application: 'Intern Applications',
  cabinet_application: 'Cabinet Applications',
  vcn_stage_ninja_interest: 'Stage Ninja Interest Forms',
  vcn_props_team_interest: 'Props Team Interest Forms',
  wnc_team_form: 'WNC Team Forms',
};

/** Plural, headline-ready name ("House Applications"), so "close"/"open" always agrees. */
export function applicationShortName(key: ApplicationKey): string {
  return SHORT_NAMES[key] ?? key;
}

function dayNumber(dateOnly: string): number {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Calendar days from `from` to `to` on the San Diego calendar (not 24-hour blocks). */
export function pacificDaysBetween(from: Date, to: Date): number {
  return dayNumber(getLosAngelesDateOnly(to)) - dayNumber(getLosAngelesDateOnly(from));
}

/** "today" / "tomorrow" / "in 3 days" for a San Diego calendar-day distance. */
export function relativeDayPhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function closingHeadline(key: ApplicationKey, dueAt: Date, now: Date): string {
  return `${applicationShortName(key)} close ${relativeDayPhrase(pacificDaysBetween(now, dueAt))}`;
}

export function openingHeadline(key: ApplicationKey, openAt: Date, now: Date): string {
  return `${applicationShortName(key)} open ${relativeDayPhrase(pacificDaysBetween(now, openAt))}`;
}

/** The instant the homepage notice starts showing for a window due at `dueAt`. */
export function closingSoonStartsAt(dueAt: string | Date, days: number = CLOSING_SOON_DAYS): Date {
  return new Date(new Date(dueAt).getTime() - days * DAY_MS);
}

/**
 * Windows that are open right now and due within `days`, soonest first. By default
 * one per program name (House Fall/Winter/Spring share one; the soonest wins), which
 * is what a public headline wants; the admin queue counts every window.
 * Status is recomputed from the dates against `now`, never trusted from a cached
 * row, so a window that closed since the fetch drops out instead of lingering.
 */
export function getClosingSoon<T extends WindowTiming>(
  rows: T[],
  now: Date = new Date(),
  days: number = CLOSING_SOON_DAYS,
  options: { dedupeByName?: boolean } = {},
): ClosingSoonWindow<T>[] {
  const { dedupeByName = true } = options;
  const horizon = now.getTime() + days * DAY_MS;
  const seen = new Set<string>();
  return rows
    .filter((row) => getApplicationStatus(row.open_at, row.due_at, row.is_enabled, now) === 'open')
    .map((row) => ({ row, dueAt: new Date(row.due_at) }))
    .filter(({ dueAt }) => dueAt.getTime() <= horizon)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .filter(({ row }) => {
      if (!dedupeByName) return true;
      const name = applicationShortName(row.application_key);
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map(({ row, dueAt }) => ({
      row,
      dueAt,
      daysUntilClose: Math.max(0, pacificDaysBetween(now, dueAt)),
      headline: closingHeadline(row.application_key, dueAt, now),
    }));
}

export interface OpeningSoonWindow<T extends WindowTiming> {
  row: T;
  openAt: Date;
  headline: string;
}

/** Enabled windows that have not opened yet but will within `days`, soonest first. */
export function getOpeningSoon<T extends WindowTiming>(rows: T[], now: Date = new Date(), days: number = OPENING_SOON_DAYS): OpeningSoonWindow<T>[] {
  const horizon = now.getTime() + days * DAY_MS;
  return rows
    .filter((row) => getApplicationStatus(row.open_at, row.due_at, row.is_enabled, now) === 'not_open')
    .map((row) => ({ row, openAt: new Date(row.open_at) }))
    .filter(({ openAt }) => openAt.getTime() <= horizon)
    .sort((a, b) => a.openAt.getTime() - b.openAt.getTime())
    .map(({ row, openAt }) => ({ row, openAt, headline: openingHeadline(row.application_key, openAt, now) }));
}

/**
 * The homepage notice's rows: open, due within the shared closing-soon horizon,
 * and carrying a usable form link. A row without a URL (masked, or never set) is
 * dropped rather than shown as an Apply button that goes nowhere; a future or
 * closed window has no URL in the public projection, so it can never qualify.
 */
export function getClosingSoonNotices<T extends WindowTiming & { target_url: string | null }>(
  rows: T[],
  now: Date = new Date(),
  days: number = CLOSING_SOON_DAYS,
): Array<ClosingSoonWindow<T> & { url: string }> {
  return getClosingSoon(
    rows.filter((row) => isValidFormUrl(row.target_url)),
    now,
    days,
  ).map((entry) => ({ ...entry, url: entry.row.target_url!.trim() }));
}
