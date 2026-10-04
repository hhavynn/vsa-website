// Content Health: the findings behind /admin/content-health and the one
// "content health issues" count on the Admin Overview. Pure: it takes rows the
// Overview already read plus one small cache table, and returns findings. Healthy
// content produces nothing.
//
// Two kinds of finding:
//  - derived, computed here from rows (a draft event whose date passed, a public
//    event with no location, an empty album, stale Ask VSA knowledge);
//  - link failures, read from `content_health_state`, which a weekly job fills
//    (scripts/check-content-links.ts). The browser never contacts external hosts.
//
// Nothing here fixes, hides, or deletes anything. An admin may ACKNOWLEDGE a
// finding; the acknowledgement is bound to a fingerprint of the condition (the row's
// updated_at, or the URL plus when its failure began) and expires, so a changed or
// recurring problem comes back on its own instead of staying dismissed forever.
//
// Privacy: findings carry public content names, generic reasons and admin paths.
// No member data, emails, notes, chat logs, or submissions are ever inputs.
import {
  KnowledgeEntityApplication,
  KnowledgeEntityEvent,
  KnowledgeFreshnessRow,
  KnowledgeFreshnessResult,
  evaluateKnowledgeFreshness,
} from './aiKnowledgeFreshness';
import { formatAcademicYear } from './academicTerms';
import { LinkUsage, isConfirmedLinkFailure } from './contentLinkResult';

export type HealthSeverity = 'high' | 'medium' | 'low';

export type HealthArea = 'events' | 'gallery' | 'program' | 'ask_vsa' | 'cabinet' | 'houses' | 'vcn' | 'settings' | 'resources';

export const HEALTH_AREA_LABELS: Record<HealthArea, string> = {
  events: 'Event',
  gallery: 'Gallery album',
  program: 'Program content',
  ask_vsa: 'Ask VSA knowledge',
  cabinet: 'Cabinet',
  houses: 'House',
  vcn: 'VCN',
  settings: 'Site settings',
  resources: 'Resource',
};

export const HEALTH_CHECK_IDS = [
  'draft-event-past',
  'event-missing-fields',
  'gallery-empty',
  'program-incomplete',
  'program-stale-year',
  'ask-vsa-stale',
  'link-failed',
] as const;
export type HealthCheckId = (typeof HEALTH_CHECK_IDS)[number];

export const HEALTH_LINKS = {
  draftEvents: '/admin/events?filter=draft',
  events: '/admin/events',
  gallery: '/admin/gallery',
  program: '/admin/content',
  askVsa: '/admin/ai-knowledge?filter=review',
  page: '/admin/content-health',
} as const;

/** Drafts older than this are treated as abandoned, not forgotten. */
export const DRAFT_EVENT_LOOKBACK_DAYS = 90;
/** An album younger than this may still be mid-creation. */
export const GALLERY_GRACE_DAYS = 2;
/** How long an acknowledgement lasts if nothing about the finding changes. */
export const ACKNOWLEDGEMENT_DAYS = 60;
/** The weekly link check is "overdue" after this long. */
export const LINK_CHECK_OVERDUE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface HealthEventRow {
  id?: string | null;
  name?: string | null;
  date: string;
  end_date?: string | null;
  is_published: boolean | null;
  image_url?: string | null;
  location?: string | null;
  updated_at?: string | null;
}

export interface HealthGalleryRow {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  google_photos_url?: string | null;
  created_at?: string | null;
}

export interface HealthProgramRow {
  id?: string | null;
  page_key?: string | null;
  section_key?: string | null;
  title?: string | null;
  body?: string | null;
  status?: string | null;
  is_published: boolean | null;
  primary_link_label?: string | null;
  primary_link_url?: string | null;
  secondary_link_label?: string | null;
  secondary_link_url?: string | null;
  updated_at?: string | null;
}

export interface LinkCheckStateRow {
  kind: 'link_check';
  subject_key: string;
  check_status: string;
  http_status: number | null;
  failure_reason: string | null;
  checked_at: string | null;
  failing_since: string | null;
  consecutive_failures: number | null;
  detail: unknown;
}

export interface AcknowledgementStateRow {
  kind: 'acknowledgement';
  subject_key: string;
  fingerprint: string | null;
  acknowledged_at: string | null;
  expires_at: string | null;
}

export interface CheckRunStateRow {
  kind: 'check_run';
  subject_key: string;
  checked_at: string | null;
  detail: unknown;
}

export type ContentHealthStateRow = LinkCheckStateRow | AcknowledgementStateRow | CheckRunStateRow;

export interface ContentHealthSources {
  now: Date;
  /** The academic year that is current (start year), or null when unknown. */
  currentAcademicYearStart: number | null;
  events: HealthEventRow[] | null;
  gallery: HealthGalleryRow[] | null;
  programContent: HealthProgramRow[] | null;
  ai: KnowledgeFreshnessRow[] | null;
  applications: KnowledgeEntityApplication[] | null;
  /** The cache table. `null` = not readable (migration not applied, or the read failed). */
  state: ContentHealthStateRow[] | null;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export interface ContentHealthFinding {
  /** Stable per finding; the key an acknowledgement is stored under. */
  key: string;
  check: HealthCheckId;
  severity: HealthSeverity;
  area: HealthArea;
  /** "Event image", "Gallery album": what kind of content is affected. */
  contentType: string;
  /** The public name of the content. */
  title: string;
  reason: string;
  /** Extra line, e.g. the broken URL without its query string. */
  detail?: string;
  /** The admin page that fixes it. */
  fixPath: string;
  /** When this was last checked: the scan time, or the link check's own time. */
  checkedAt: string;
  /** Changes when the underlying condition changes; an acknowledgement only holds while it matches. */
  fingerprint: string;
  /** Ask VSA findings are cleared by marking the row reviewed, not by acknowledging. */
  acknowledgeable: boolean;
}

export interface AcknowledgedFinding {
  finding: ContentHealthFinding;
  acknowledgedAt: string | null;
  expiresAt: string | null;
}

export interface ContentHealthReport {
  generatedAt: string;
  /** Needs attention now, most urgent first. */
  findings: ContentHealthFinding[];
  /** Known and accepted for now. Not counted. */
  acknowledged: AcknowledgedFinding[];
  counts: { total: number; high: number; medium: number; low: number };
  /** Sources that could not be read, so a clean report is never claimed over a failed check. */
  unchecked: string[];
  links: { available: boolean; lastRunAt: string | null; lastRun: { checked: number; failed: number; skipped: number } | null; overdue: boolean };
  /** Ask VSA knowledge results by row id, for pages that show per-row status. */
  knowledge: Map<string, KnowledgeFreshnessResult>;
}

export const EMPTY_CONTENT_HEALTH_COUNTS = { total: 0, high: 0, medium: 0, low: 0 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const text = (value: string | null | undefined) => (typeof value === 'string' ? value.trim() : '');
const blank = (value: string | null | undefined) => text(value) === '';
const toMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
};

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
}

const SEVERITY_RANK: Record<HealthSeverity, number> = { high: 3, medium: 2, low: 1 };

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Placeholder text that should never ship: not "TBD", which is a fair thing for a date to say. */
const PLACEHOLDER = /lorem ipsum|\bplaceholder\b|\bTODO\b|\bFIXME\b|\[(?:insert|add|your)[^\]]*\]|example\.com/i;
const YEAR_SPAN = /\b(20\d{2})\s*[-–—/]\s*(20\d{2}|\d{2})\b/g;

/** The newest academic-year span in `value` if every span in it is from before `currentStart`. */
export function stalePriorYearSpan(value: string, currentStart: number): number | null {
  let newest: number | null = null;
  YEAR_SPAN.lastIndex = 0;
  let match: RegExpExecArray | null = YEAR_SPAN.exec(value);
  while (match) {
    const start = Number(match[1]);
    const end = match[2].length === 2 ? Math.floor(start / 100) * 100 + Number(match[2]) : Number(match[2]);
    // "2025-10" is the start of a date, not a school year.
    if (end !== start + 1) {
      match = YEAR_SPAN.exec(value);
      continue;
    }
    // A span that reaches the current year (or beyond) means the text is about now; leave it alone.
    if (start >= currentStart) return null;
    newest = newest === null ? start : Math.max(newest, start);
    match = YEAR_SPAN.exec(value);
  }
  return newest;
}

/** The URL for display: host and path only, so a signed-URL token is never shown. */
export function displayUrl(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

const LINK_REASON_TEXT: Record<string, string> = {
  http_404: 'returns 404 (not found)',
  http_410: 'is gone (410)',
  http_4xx: 'returns an error',
  http_5xx: 'is returning a server error',
  missing_local_file: 'file is missing from the site',
  not_an_image: 'does not return an image',
  timeout: 'did not respond in time',
  network_error: 'could not be reached',
};

const TABLE_AREA: Record<string, HealthArea> = {
  events: 'events',
  gallery_events: 'gallery',
  cabinet_members: 'cabinet',
  house_page_assets: 'houses',
  vcn_archives: 'vcn',
  program_content: 'program',
  site_settings: 'settings',
  resource_links: 'resources',
  ai_knowledge_base: 'ask_vsa',
};

function parseUsages(detail: unknown): LinkUsage[] {
  if (!Array.isArray(detail)) return [];
  return detail.filter(
    (item): item is LinkUsage =>
      !!item && typeof item === 'object' && typeof (item as LinkUsage).table === 'string' && typeof (item as LinkUsage).path === 'string' && typeof (item as LinkUsage).label === 'string',
  );
}

// ─── Derived checks ──────────────────────────────────────────────────────────

function eventFindings(events: HealthEventRow[], now: Date, checkedAt: string): ContentHealthFinding[] {
  const findings: ContentHealthFinding[] = [];
  const nowMs = now.getTime();
  for (const event of events) {
    const id = text(event.id);
    if (!id) continue;
    const title = text(event.name) || 'Untitled event';
    const dateMs = toMs(event.end_date) ?? toMs(event.date);
    if (dateMs === null) continue;
    const fingerprint = text(event.updated_at) || 'no-updated-at';

    if (event.is_published === false) {
      if (dateMs + DAY_MS < nowMs && nowMs - dateMs <= DRAFT_EVENT_LOOKBACK_DAYS * DAY_MS) {
        findings.push({
          key: `draft-event-past:${id}`,
          check: 'draft-event-past',
          severity: 'medium',
          area: 'events',
          contentType: 'Event',
          title,
          reason: `Still a draft, but it was scheduled for ${formatDay(dateMs)}. Publish it, or remove it if it never happened.`,
          fixPath: HEALTH_LINKS.draftEvents,
          checkedAt,
          fingerprint,
          acknowledgeable: true,
        });
      }
      continue;
    }

    // Published and still ahead of us (a one-day grace so today's event counts).
    if (event.is_published === true && dateMs + DAY_MS >= nowMs) {
      const missing: string[] = [];
      if (blank(event.location)) missing.push('location');
      if (blank(event.image_url)) missing.push('cover image');
      if (missing.length > 0) {
        findings.push({
          key: `event-missing-fields:${id}`,
          check: 'event-missing-fields',
          severity: blank(event.location) ? 'medium' : 'low',
          area: 'events',
          contentType: 'Event',
          title,
          reason: `Public upcoming event has no ${joinList(missing)}.`,
          fixPath: HEALTH_LINKS.events,
          checkedAt,
          fingerprint,
          acknowledgeable: true,
        });
      }
    }
  }
  return findings;
}

function galleryFindings(gallery: HealthGalleryRow[], now: Date, checkedAt: string): ContentHealthFinding[] {
  const findings: ContentHealthFinding[] = [];
  for (const album of gallery) {
    const id = text(album.id);
    if (!id) continue;
    // The public gallery links each album to its Google Photos album; without that link the card goes nowhere.
    if (!blank(album.google_photos_url)) continue;
    const createdMs = toMs(album.created_at);
    if (createdMs !== null && now.getTime() - createdMs < GALLERY_GRACE_DAYS * DAY_MS) continue;
    findings.push({
      key: `gallery-empty:${id}`,
      check: 'gallery-empty',
      severity: 'medium',
      area: 'gallery',
      contentType: 'Gallery album',
      title: text(album.title) || text(album.name) || 'Untitled album',
      reason: 'Public album has no Google Photos link, so visitors cannot see any photos.',
      fixPath: HEALTH_LINKS.gallery,
      checkedAt,
      fingerprint: text(album.created_at) || 'empty',
      acknowledgeable: true,
    });
  }
  return findings;
}

function programFindings(rows: HealthProgramRow[], currentStart: number | null, checkedAt: string): ContentHealthFinding[] {
  const findings: ContentHealthFinding[] = [];
  for (const row of rows) {
    const id = text(row.id);
    if (!id || row.is_published !== true || row.status === 'hidden') continue;
    const title = text(row.title) || [text(row.page_key), text(row.section_key)].filter(Boolean).join(' / ') || 'Program section';
    const fingerprint = text(row.updated_at) || 'no-updated-at';
    const base = { area: 'program' as const, contentType: 'Program content', title, fixPath: HEALTH_LINKS.program, checkedAt, fingerprint, acknowledgeable: true };
    const copy = [row.title, row.body, row.primary_link_label, row.secondary_link_label].map(text).join('\n');

    if (blank(row.title) && blank(row.body)) {
      findings.push({ ...base, key: `program-incomplete:${id}:empty`, check: 'program-incomplete', severity: 'medium', reason: 'Published, but it has no title or text.' });
    } else if (PLACEHOLDER.test(copy)) {
      findings.push({ ...base, key: `program-incomplete:${id}:placeholder`, check: 'program-incomplete', severity: 'medium', reason: 'Published text still looks like placeholder copy.' });
    }
    const buttonWithoutLink = (!blank(row.primary_link_label) && blank(row.primary_link_url)) || (!blank(row.secondary_link_label) && blank(row.secondary_link_url));
    if (buttonWithoutLink) {
      findings.push({ ...base, key: `program-incomplete:${id}:button`, check: 'program-incomplete', severity: 'medium', reason: 'A published button has a label but no link.' });
    }

    if (currentStart !== null) {
      const stale = stalePriorYearSpan(copy, currentStart);
      if (stale !== null) {
        findings.push({
          ...base,
          key: `program-stale-year:${id}`,
          check: 'program-stale-year',
          severity: 'low',
          reason: `Mentions ${formatAcademicYear(stale)}, but the current year is ${formatAcademicYear(currentStart)}.`,
        });
      }
    }
  }
  return findings;
}

function knowledgeFindings(results: Map<string, KnowledgeFreshnessResult>, rows: KnowledgeFreshnessRow[], checkedAt: string): ContentHealthFinding[] {
  const findings: ContentHealthFinding[] = [];
  for (const row of rows) {
    const result = results.get(row.id);
    if (!result || result.status === 'current' || !result.severity || !result.headline) continue;
    findings.push({
      key: `ask-vsa-stale:${row.id}`,
      check: 'ask-vsa-stale',
      severity: result.severity,
      area: 'ask_vsa',
      contentType: 'Ask VSA knowledge',
      title: text(row.title) || 'Untitled snippet',
      reason: result.headline,
      fixPath: HEALTH_LINKS.askVsa,
      checkedAt,
      fingerprint: result.issues.map((issue) => issue.code).join(','),
      acknowledgeable: false,
    });
  }
  return findings;
}

function linkFindings(rows: LinkCheckStateRow[]): ContentHealthFinding[] {
  const findings: ContentHealthFinding[] = [];
  for (const row of rows) {
    if (!isConfirmedLinkFailure(row) || !row.checked_at) continue;
    const usages = parseUsages(row.detail);
    const first = usages[0];
    const isImage = usages.some((usage) => usage.kind === 'image');
    const area = first ? TABLE_AREA[first.table] ?? 'events' : 'events';
    const what = isImage ? 'image' : 'link';
    const reasonText = (row.failure_reason && LINK_REASON_TEXT[row.failure_reason]) || 'could not be verified';
    const more = usages.length > 1 ? ` and ${usages.length - 1} more` : '';
    findings.push({
      key: `link-failed:${row.subject_key}`,
      check: 'link-failed',
      // A dead image is a broken picture on a public page; a dead link is a dead end.
      severity: isImage ? 'high' : 'medium',
      area,
      contentType: `${HEALTH_AREA_LABELS[area]} ${what}`,
      title: first ? `${first.label}${more}` : displayUrl(row.subject_key),
      reason: `The ${what} ${reasonText}.`,
      detail: displayUrl(row.subject_key),
      fixPath: first?.path ?? HEALTH_LINKS.events,
      checkedAt: row.checked_at,
      fingerprint: `${row.subject_key}|${row.failing_since ?? ''}`,
      acknowledgeable: true,
    });
  }
  return findings;
}

// ─── The report ──────────────────────────────────────────────────────────────

function isAcknowledged(ack: AcknowledgementStateRow | undefined, finding: ContentHealthFinding, nowMs: number): boolean {
  if (!ack || !finding.acknowledgeable || !ack.fingerprint) return false;
  if (ack.fingerprint !== finding.fingerprint) return false;
  const expiresMs = toMs(ack.expires_at);
  return expiresMs === null || expiresMs > nowMs;
}

export function compareFindings(a: ContentHealthFinding, b: ContentHealthFinding): number {
  return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.contentType.localeCompare(b.contentType) || a.title.localeCompare(b.title);
}

export function buildContentHealthReport(sources: ContentHealthSources): ContentHealthReport {
  const { now } = sources;
  const generatedAt = now.toISOString();
  const unchecked: string[] = [];
  const all: ContentHealthFinding[] = [];

  if (sources.events === null) unchecked.push('events');
  else all.push(...eventFindings(sources.events, now, generatedAt));

  if (sources.gallery === null) unchecked.push('gallery');
  else all.push(...galleryFindings(sources.gallery, now, generatedAt));

  if (sources.programContent === null) unchecked.push('program content');
  else all.push(...programFindings(sources.programContent, sources.currentAcademicYearStart, generatedAt));

  const knowledge = new Map<string, KnowledgeFreshnessResult>();
  if (sources.ai === null) unchecked.push('Ask VSA knowledge');
  else {
    const context = {
      now,
      currentAcademicYearStart: sources.currentAcademicYearStart,
      applications: sources.applications,
      events: sources.events === null ? null : toEntityEvents(sources.events),
    };
    for (const row of sources.ai) knowledge.set(row.id, evaluateKnowledgeFreshness(row, context));
    all.push(...knowledgeFindings(knowledge, sources.ai, generatedAt));
  }

  const state = sources.state ?? [];
  const checkRun = state.find((row): row is CheckRunStateRow => row.kind === 'check_run');
  all.push(...linkFindings(state.filter((row): row is LinkCheckStateRow => row.kind === 'link_check')));

  const acks = new Map(state.filter((row): row is AcknowledgementStateRow => row.kind === 'acknowledgement').map((row) => [row.subject_key, row]));
  const findings: ContentHealthFinding[] = [];
  const acknowledged: AcknowledgedFinding[] = [];
  const nowMs = now.getTime();
  for (const finding of all) {
    const ack = acks.get(finding.key);
    if (isAcknowledged(ack, finding, nowMs)) acknowledged.push({ finding, acknowledgedAt: ack?.acknowledged_at ?? null, expiresAt: ack?.expires_at ?? null });
    else findings.push(finding);
  }
  findings.sort(compareFindings);
  acknowledged.sort((a, b) => compareFindings(a.finding, b.finding));

  const lastRunAt = checkRun?.checked_at ?? null;
  const lastRunMs = toMs(lastRunAt);
  const detail = checkRun?.detail && typeof checkRun.detail === 'object' ? (checkRun.detail as Record<string, unknown>) : null;
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

  return {
    generatedAt,
    findings,
    acknowledged,
    counts: {
      total: findings.length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    unchecked,
    links: {
      available: sources.state !== null,
      lastRunAt,
      lastRun: detail ? { checked: count(detail.checked), failed: count(detail.failed), skipped: count(detail.skipped) } : null,
      overdue: lastRunMs !== null && nowMs - lastRunMs > LINK_CHECK_OVERDUE_DAYS * DAY_MS,
    },
    knowledge,
  };
}

function toEntityEvents(events: HealthEventRow[]): KnowledgeEntityEvent[] {
  return events
    .filter((event): event is HealthEventRow & { id: string } => !!event.id)
    .map((event) => ({ id: event.id, date: event.date, end_date: event.end_date ?? null, is_published: event.is_published, updated_at: event.updated_at ?? null }));
}

/** The acknowledgement to store for a finding: bound to its fingerprint, expiring on its own. */
export function buildAcknowledgement(finding: ContentHealthFinding, now: Date = new Date()) {
  return {
    subject_key: finding.key,
    fingerprint: finding.fingerprint,
    expires_at: new Date(now.getTime() + ACKNOWLEDGEMENT_DAYS * DAY_MS).toISOString(),
  };
}

/** "6 content health issues": what the Overview shows. Counts only. */
export function contentHealthHeadline(counts: { total: number }): string {
  return `${counts.total} content health ${counts.total === 1 ? 'issue' : 'issues'}`;
}
