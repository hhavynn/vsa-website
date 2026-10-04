// Deterministic staleness rules for Ask VSA knowledge rows. Pure: no I/O, so
// every rule is pinned by a unit test and the same answer appears on
// /admin/ai-knowledge, the Content Health page, the Admin Overview count and the
// Launch Checklist.
//
// Curated knowledge stays human-reviewed. Nothing here edits, deactivates, or
// fills a row from other tables; it only says WHEN a person should look again
// and WHY. Evergreen rows ('stable') are never flagged for being old.
import { formatAcademicYear } from './academicTerms';

export type FreshnessSeverity = 'high' | 'medium' | 'low';

export type FreshnessIssueCode =
  | 'expired'
  | 'expiring_soon'
  | 'prior_year'
  | 'review_overdue'
  | 'linked_missing'
  | 'linked_unpublished_event'
  | 'linked_event_past'
  | 'linked_window_closed'
  | 'linked_changed'
  | 'year_unrecognised';

export const KNOWLEDGE_LINKED_ENTITY_TYPES = ['application', 'event'] as const;
export type KnowledgeLinkedEntityType = (typeof KNOWLEDGE_LINKED_ENTITY_TYPES)[number];

/** The columns the rules read. A subset of an `ai_knowledge_base` row. */
export interface KnowledgeFreshnessRow {
  id: string;
  title: string;
  source_type?: string | null;
  is_public: boolean | null;
  is_active: boolean | null;
  freshness?: string | null;
  academic_year?: string | null;
  valid_until?: string | null;
  last_verified_at?: string | null;
  created_at?: string | null;
  linked_entity_type?: string | null;
  linked_entity_key?: string | null;
}

export interface KnowledgeEntityApplication {
  application_key: string;
  due_at: string;
  updated_at?: string | null;
}

export interface KnowledgeEntityEvent {
  id: string;
  date: string;
  end_date?: string | null;
  is_published: boolean | null;
  updated_at?: string | null;
}

/**
 * What a linked row is compared against. A `null` list means that source could
 * not be read, so the entity rules are skipped rather than guessed; a loaded
 * list that lacks the key means the entity no longer exists.
 */
export interface KnowledgeFreshnessContext {
  now: Date;
  /** The academic year that is current right now (start year), or null when unknown. */
  currentAcademicYearStart: number | null;
  applications: KnowledgeEntityApplication[] | null;
  events: KnowledgeEntityEvent[] | null;
}

export interface FreshnessIssue {
  code: FreshnessIssueCode;
  severity: FreshnessSeverity;
  reason: string;
  /** True when marking the row reviewed cannot clear it: the date, link, or label itself has to change. */
  needsEdit?: boolean;
}

export type FreshnessStatus = 'current' | 'review_due' | 'stale';

export interface KnowledgeFreshnessResult {
  rowId: string;
  status: FreshnessStatus;
  /** The worst issue's severity; null when current. */
  severity: FreshnessSeverity | null;
  issues: FreshnessIssue[];
  /** One line for lists: the worst reason, plus how many more. */
  headline: string | null;
  /** True when "Mark reviewed" can clear it. An expired date needs a new date or deactivation instead. */
  clearedByReview: boolean;
}

export const EXPIRING_SOON_DAYS = 14;
/** Days after the last review before a row of that freshness is due again. `stable` never is. */
export const REVIEW_CADENCE_DAYS: Readonly<Record<string, number>> = {
  event_live: 14,
  quarterly: 90,
  yearly: 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVERITY_RANK: Record<FreshnessSeverity, number> = { high: 3, medium: 2, low: 1 };

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Start year of "2026-2027" (also "2026"); null when it is not a year label. */
export function parseKnowledgeYear(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^(\d{4})(?:\s*[-–/]\s*\d{2,4})?$/);
  return match ? Number(match[1]) : null;
}

/** September 1, 00:00 Pacific, of the academic year's start year: when its content should have been revisited. */
function academicYearBeganMs(startYear: number): number {
  return Date.UTC(startYear, 8, 1, 7);
}

export function knowledgeSeverityRank(severity: FreshnessSeverity | null): number {
  return severity ? SEVERITY_RANK[severity] : 0;
}

export function evaluateKnowledgeFreshness(row: KnowledgeFreshnessRow, context: KnowledgeFreshnessContext): KnowledgeFreshnessResult {
  const current: KnowledgeFreshnessResult = { rowId: row.id, status: 'current', severity: null, issues: [], headline: null, clearedByReview: true };
  // An inactive or private row is not an answer source, so it cannot be a wrong one.
  if (row.is_public !== true || row.is_active !== true) return current;

  const nowMs = context.now.getTime();
  const reviewedMs = toMs(row.last_verified_at) ?? toMs(row.created_at);
  const issues: FreshnessIssue[] = [];
  const archive = row.source_type === 'historical_archive';

  // 1. Time-bound: the date is the fact. Retrieval already skips expired rows, so
  //    this is a gap in what the assistant can answer, not a wrong answer.
  const validUntilMs = toMs(row.valid_until);
  if (validUntilMs !== null) {
    if (validUntilMs <= nowMs) {
      issues.push({ code: 'expired', severity: 'medium', needsEdit: true, reason: `Time-bound fact expired ${formatDay(validUntilMs - 1)}; Ask VSA no longer uses it. Renew the date or deactivate it.` });
    } else if (validUntilMs - nowMs <= EXPIRING_SOON_DAYS * DAY_MS && (reviewedMs === null || reviewedMs < validUntilMs - EXPIRING_SOON_DAYS * DAY_MS)) {
      const days = Math.max(1, Math.ceil((validUntilMs - nowMs) / DAY_MS));
      issues.push({ code: 'expiring_soon', severity: 'low', reason: `Time-bound fact expires in ${plural(days, 'day')} (${formatDay(validUntilMs - 1)}).` });
    }
  }

  // 2. Year-specific content from a prior cycle. Archive rows are about the past on purpose.
  const yearStart = parseKnowledgeYear(row.academic_year);
  const currentStart = context.currentAcademicYearStart;
  if (!archive && row.freshness !== 'stable' && yearStart !== null && currentStart !== null && yearStart < currentStart) {
    const began = academicYearBeganMs(currentStart);
    const confirmedSinceRollover = reviewedMs !== null && reviewedMs >= began;
    if (!confirmedSinceRollover) {
      // The current year comes from the active term, which can be switched before September 1.
      // A review made before the year began does not count, so say what to do instead.
      const early = nowMs < began;
      issues.push({
        code: 'prior_year',
        severity: 'high',
        needsEdit: early,
        reason: `Year-specific content from ${formatAcademicYear(yearStart)}; the current year is ${formatAcademicYear(currentStart)} and it has not been reviewed since the new year began.${early ? ' Update the year label once the content is revised.' : ''}`,
      });
    }
  }

  // A label this check cannot read would silently skip the rule above, so say so.
  const label = row.academic_year?.trim();
  if (!archive && row.freshness !== 'stable' && label && yearStart === null) {
    issues.push({
      code: 'year_unrecognised',
      severity: 'low',
      needsEdit: true,
      reason: `The academic year "${label}" is not in the form 2026-2027, so staleness cannot be checked. Edit the label.`,
    });
  }

  // 3. Review cadence, only for content that is meant to change.
  const cadence = row.freshness ? REVIEW_CADENCE_DAYS[row.freshness] : undefined;
  if (!archive && cadence !== undefined && reviewedMs !== null && nowMs - reviewedMs > cadence * DAY_MS) {
    const days = Math.floor((nowMs - reviewedMs) / DAY_MS);
    issues.push({ code: 'review_overdue', severity: 'low', reason: `Marked ${row.freshness?.replace('_', ' ')}; last reviewed ${formatDay(reviewedMs)} (${plural(days, 'day')} ago).` });
  }

  // 4. A linked public entity that moved on after the last review.
  issues.push(...linkedEntityIssues(row, context, reviewedMs));

  if (issues.length === 0) return current;
  issues.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const worst = issues[0];
  const others = issues.length - 1;
  return {
    rowId: row.id,
    status: worst.severity === 'low' ? 'review_due' : 'stale',
    severity: worst.severity,
    issues,
    headline: others > 0 ? `${worst.reason} (+${others} more)` : worst.reason,
    // Reviewing cannot fix a missing or expired thing; the content or its link must change.
    clearedByReview: !issues.some((issue) => issue.needsEdit),
  };
}

function linkedEntityIssues(row: KnowledgeFreshnessRow, context: KnowledgeFreshnessContext, reviewedMs: number | null): FreshnessIssue[] {
  const type = row.linked_entity_type;
  const key = row.linked_entity_key?.trim();
  if (!type || !key) return [];
  const nowMs = context.now.getTime();
  const issues: FreshnessIssue[] = [];
  const editedAfterReview = (updatedAt: string | null | undefined) => {
    const updatedMs = toMs(updatedAt);
    return updatedMs !== null && reviewedMs !== null && updatedMs > reviewedMs ? updatedMs : null;
  };

  if (type === 'application') {
    if (context.applications === null) return [];
    // A key can have several windows (one per year); the newest is the one the fact is about.
    const windows = context.applications.filter((candidate) => candidate.application_key === key);
    if (windows.length === 0) return [{ code: 'linked_missing', severity: 'high', needsEdit: true, reason: `The linked application window "${key}" no longer exists.` }];
    const latest = windows.reduce((best, candidate) => ((toMs(candidate.due_at) ?? 0) > (toMs(best.due_at) ?? 0) ? candidate : best));
    const dueMs = toMs(latest.due_at);
    if (dueMs !== null && dueMs <= nowMs && (reviewedMs === null || reviewedMs < dueMs)) {
      issues.push({ code: 'linked_window_closed', severity: 'medium', reason: `The linked application window closed ${formatDay(dueMs)}, after this was last reviewed.` });
    }
    const editedMs = windows.reduce<number | null>((newest, candidate) => {
      const at = editedAfterReview(candidate.updated_at);
      return at !== null && (newest === null || at > newest) ? at : newest;
    }, null);
    if (editedMs !== null) issues.push({ code: 'linked_changed', severity: 'medium', reason: `The linked application window was edited ${formatDay(editedMs)}, after this was last reviewed.` });
  } else if (type === 'event') {
    if (context.events === null) return [];
    const event = context.events.find((candidate) => candidate.id === key);
    if (!event) return [{ code: 'linked_missing', severity: 'high', needsEdit: true, reason: 'The linked event no longer exists.' }];
    if (event.is_published !== true) {
      return [{ code: 'linked_unpublished_event', severity: 'high', needsEdit: true, reason: 'The linked event is not published, but this snippet is public. Deactivate it or publish the event.' }];
    }
    const eventMs = toMs(event.end_date) ?? toMs(event.date);
    if (eventMs !== null && eventMs + DAY_MS <= nowMs && (reviewedMs === null || reviewedMs < eventMs + DAY_MS)) {
      issues.push({ code: 'linked_event_past', severity: 'medium', reason: `The linked event took place ${formatDay(eventMs)}, after this was last reviewed.` });
    }
    const editedMs = editedAfterReview(event.updated_at);
    if (editedMs !== null) issues.push({ code: 'linked_changed', severity: 'medium', reason: `The linked event was edited ${formatDay(editedMs)}, after this was last reviewed.` });
  }
  return issues;
}

export interface KnowledgeFreshnessSummary {
  total: number;
  stale: number;
  reviewDue: number;
  high: number;
}

export function evaluateAllKnowledge(rows: readonly KnowledgeFreshnessRow[], context: KnowledgeFreshnessContext): Map<string, KnowledgeFreshnessResult> {
  return new Map(rows.map((row) => [row.id, evaluateKnowledgeFreshness(row, context)]));
}

export function summarizeKnowledgeFreshness(results: Iterable<KnowledgeFreshnessResult>): KnowledgeFreshnessSummary {
  const summary: KnowledgeFreshnessSummary = { total: 0, stale: 0, reviewDue: 0, high: 0 };
  for (const result of Array.from(results)) {
    if (result.status === 'current') continue;
    summary.total += 1;
    if (result.status === 'stale') summary.stale += 1;
    else summary.reviewDue += 1;
    if (result.severity === 'high') summary.high += 1;
  }
  return summary;
}

/** Most urgent first; within a severity, the longest since it was reviewed. */
export function compareByUrgency(
  a: { result: KnowledgeFreshnessResult; reviewedAt: string | null },
  b: { result: KnowledgeFreshnessResult; reviewedAt: string | null },
): number {
  const bySeverity = knowledgeSeverityRank(b.result.severity) - knowledgeSeverityRank(a.result.severity);
  if (bySeverity !== 0) return bySeverity;
  return (toMs(a.reviewedAt) ?? 0) - (toMs(b.reviewedAt) ?? 0);
}
