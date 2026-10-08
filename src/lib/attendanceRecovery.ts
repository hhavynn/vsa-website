// Historical attendance recovery: turns the database's per-row evidence
// (admin_import_recovery_findings) and recovery history (import_recovery_actions)
// into findings an admin can act on, and describes exactly what each action will
// write. Pure; the repository talks to Supabase and the database function
// admin_recover_import_row performs every write in one transaction.
//
// Nothing here picks a member. Candidates are shown, never preselected, and a
// flag is a reason to look, not a verdict (see importHistoryAudit.ts).
import {
  ClassifiedRow,
  HistoricalCategory,
  HistoricalKind,
  HistoricalRowEvidence,
  ManualDecision,
  classifyHistoricalRow,
} from './importHistoryAudit';

// ─── Shapes ─────────────────────────────────────────────────────────────────

/** One element of admin_import_recovery_findings(). */
export interface RecoveryFindingRecord {
  row_id: string;
  import_job_id: string;
  job_status: 'completed' | 'failed';
  job_created_at: string;
  event_id: string | null;
  event_name: string | null;
  event_date: string | null;
  source_row_index: number;
  decision: HistoricalRowEvidence['decision'];
  display_name: string | null;
  csv_email: string | null;
  csv_college: string | null;
  csv_year: string | null;
  attendance_member_id: string | null;
  matched_member_id: string | null;
  match_reason: string | null;
  final_reason: string | null;
  match_method: string | null;
  manual_decision: string | null;
  name_score: number | null;
  candidate_count: number;
  can_mark_new: boolean | null;
  has_csv_email: boolean;
  attendance_exists: boolean | null;
  matched_member_attended: boolean;
  email_member_attended: boolean;
  candidate_attended: boolean;
  resolved_elsewhere: boolean;
  duplicate_twin_attended: 'email' | 'name' | null;
  email_in_members: boolean;
  exact_name_members: number;
  email_conflict: boolean;
  email_conflict_both_school: boolean;
  year_differs: boolean;
  college_differs: boolean;
}

export type RecoveryActionKind = 'restore' | 'create_member' | 'reassign' | 'dismiss' | 'needs_info' | 'reopen';
export type RecoveryStatus = 'open' | 'recovered' | 'dismissed' | 'needs_info';
export type RecoveryOutcome =
  | 'attendance_added'
  | 'already_recorded'
  | 'moved'
  | 'added_kept_original'
  | 'dismissed'
  | 'needs_info'
  | 'reopened';
export type DismissReason = 'intentional_skip' | 'legitimate_duplicate' | 'not_actionable';

/** One row of import_recovery_actions. */
export interface RecoveryActionRecord {
  id: string;
  request_id: string;
  import_job_row_id: string;
  previous_action_id: string | null;
  action: RecoveryActionKind;
  resulting_status: RecoveryStatus;
  outcome: RecoveryOutcome;
  event_id: string | null;
  member_id: string | null;
  from_member_id: string | null;
  created_member: boolean;
  attendance_id: string | null;
  points_awarded: number;
  removed_attendance: unknown;
  reason_code: string | null;
  note: string | null;
  actor_user_id: string | null;
  created_at: string;
}

export type RecoveryBucket = 'unresolved' | 'needs_info' | 'recovered' | 'dismissed';

export interface RecoveryFinding {
  record: RecoveryFindingRecord;
  classification: ClassifiedRow;
  latestAction: RecoveryActionRecord | null;
  status: RecoveryStatus;
  bucket: RecoveryBucket;
  /** The sheet row an officer would look for (header is row 1). */
  sheetRow: number;
}

// ─── Evidence → classification ──────────────────────────────────────────────

function manualDecision(value: string | null): ManualDecision | null {
  return value === 'match' || value === 'new' || value === 'skip' ? value : null;
}

export function toEvidence(record: RecoveryFindingRecord): HistoricalRowEvidence {
  return {
    rowId: record.row_id,
    importJobId: record.import_job_id,
    eventId: record.event_id,
    sourceRowIndex: record.source_row_index,
    decision: record.decision,
    matchReason: record.match_reason,
    finalReason: record.final_reason,
    matchMethod: record.match_method,
    manualDecision: manualDecision(record.manual_decision),
    nameScore: typeof record.name_score === 'number' ? record.name_score : null,
    candidateCount: record.candidate_count ?? 0,
    canMarkNew: typeof record.can_mark_new === 'boolean' ? record.can_mark_new : null,
    hasCsvEmail: !!record.has_csv_email,
    attendanceMemberId: record.attendance_member_id,
    attendanceRecordExists: record.attendance_exists,
    matchedMemberAttended: !!record.matched_member_attended,
    emailMemberAttended: !!record.email_member_attended,
    candidateAttended: !!record.candidate_attended,
    resolvedElsewhere: !!record.resolved_elsewhere,
    duplicateTwinAttended: record.duplicate_twin_attended,
    emailInMembers: !!record.email_in_members,
    exactNameMembers: record.exact_name_members ?? 0,
    emailConflictWithMatched: !!record.email_conflict,
    emailConflictBothSchool: !!record.email_conflict_both_school,
    yearDiffers: !!record.year_differs,
    collegeDiffers: !!record.college_differs,
  };
}

const FLAGGED: ReadonlySet<HistoricalCategory> = new Set<HistoricalCategory>([
  'confirmed_missing', 'suspected_missing', 'possible_incorrect_match', 'insufficient_evidence',
]);

/**
 * The latest entry per import row. History is a chain (each entry names its
 * predecessor, and the database allows one successor per entry), so the latest
 * is the entry no other entry points back to.
 */
export function latestActionByRow(actions: readonly RecoveryActionRecord[]): Map<string, RecoveryActionRecord> {
  const superseded = new Set(actions.map((action) => action.previous_action_id).filter((id): id is string => !!id));
  const latest = new Map<string, RecoveryActionRecord>();
  actions.forEach((action) => {
    if (!superseded.has(action.id)) latest.set(action.import_job_row_id, action);
  });
  return latest;
}

function bucketFor(status: RecoveryStatus, category: HistoricalCategory): RecoveryBucket {
  if (status === 'recovered') return 'recovered';
  if (status === 'dismissed') return 'dismissed';
  if (status === 'needs_info' || category === 'insufficient_evidence') return 'needs_info';
  return 'unresolved';
}

/**
 * Flagged rows, plus any row that already has recovery history (a recovered row
 * can stop being flagged once its attendance exists, and must stay visible).
 */
export function buildFindings(
  records: readonly RecoveryFindingRecord[],
  actions: readonly RecoveryActionRecord[],
): RecoveryFinding[] {
  const latest = latestActionByRow(actions);
  return records
    .map((record): RecoveryFinding => {
      const classification = classifyHistoricalRow(toEvidence(record));
      const latestAction = latest.get(record.row_id) ?? null;
      const status: RecoveryStatus = latestAction?.resulting_status ?? 'open';
      return {
        record,
        classification,
        latestAction,
        status,
        bucket: bucketFor(status, classification.category),
        sheetRow: record.source_row_index + 2,
      };
    })
    .filter((finding) => finding.latestAction || FLAGGED.has(finding.classification.category));
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface FindingFilters {
  bucket: RecoveryBucket;
  eventId: string;
  importJobId: string;
  kind: HistoricalKind | '';
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function filterFindings(findings: readonly RecoveryFinding[], filters: FindingFilters): RecoveryFinding[] {
  return findings
    .filter((finding) =>
      finding.bucket === filters.bucket
      && (!filters.eventId || finding.record.event_id === filters.eventId)
      && (!filters.importJobId || finding.record.import_job_id === filters.importJobId)
      && (!filters.kind || finding.classification.kind === filters.kind))
    .sort((a, b) =>
      PRIORITY_ORDER[a.classification.priority] - PRIORITY_ORDER[b.classification.priority]
      || a.record.job_created_at.localeCompare(b.record.job_created_at)
      || a.record.source_row_index - b.record.source_row_index);
}

export function countByBucket(findings: readonly RecoveryFinding[]): Record<RecoveryBucket, number> {
  const counts: Record<RecoveryBucket, number> = { unresolved: 0, needs_info: 0, recovered: 0, dismissed: 0 };
  findings.forEach((finding) => { counts[finding.bucket] += 1; });
  return counts;
}

// ─── What an admin may do ───────────────────────────────────────────────────

/** True when this row currently credits a member whose attendance is in the ledger. */
export function rowCreditsMember(record: RecoveryFindingRecord): boolean {
  return !!record.attendance_member_id && record.attendance_exists === true;
}

/**
 * Mirrors the database function's rules so the UI only offers actions it will
 * accept. The database checks them again; this is not the safety boundary.
 */
export function allowedActions(finding: RecoveryFinding): RecoveryActionKind[] {
  if (finding.status === 'recovered') return [];
  if (finding.status === 'dismissed') return ['reopen'];
  const { record } = finding;
  const canWrite = record.job_status === 'completed' && !!record.event_id;
  const actions: RecoveryActionKind[] = [];
  if (canWrite) {
    if (rowCreditsMember(record)) actions.push('reassign');
    else actions.push('restore', 'create_member');
  }
  actions.push('dismiss', 'needs_info');
  if (finding.status === 'needs_info') actions.push('reopen');
  return actions;
}

export const ACTION_LABELS: Record<RecoveryActionKind, string> = {
  restore: 'Match existing member',
  create_member: 'Create separate member',
  reassign: 'Correct incorrect match',
  dismiss: 'Dismiss finding',
  needs_info: 'Needs more information',
  reopen: 'Reopen finding',
};

export const DISMISS_REASONS: ReadonlyArray<{ value: DismissReason; label: string; hint: string }> = [
  { value: 'intentional_skip', label: 'Intentionally skipped', hint: 'The row should never have counted (test entry, officer, not an attendee).' },
  { value: 'legitimate_duplicate', label: 'Legitimate duplicate', hint: 'The same person is already credited for this event.' },
  { value: 'not_actionable', label: 'Not actionable', hint: 'Nothing can or should change. Explain why.' },
];

export const BUCKET_LABELS: Record<RecoveryBucket, string> = {
  unresolved: 'Unresolved',
  needs_info: 'Needs more information',
  recovered: 'Recovered',
  dismissed: 'Dismissed',
};

export const OUTCOME_LABELS: Record<RecoveryOutcome, string> = {
  attendance_added: 'Attendance restored',
  already_recorded: 'Already recorded, nothing added',
  moved: 'Attendance moved',
  added_kept_original: 'Correct member added, original kept',
  dismissed: 'Dismissed',
  needs_info: 'On hold',
  reopened: 'Reopened',
};

const KIND_LABELS: Partial<Record<HistoricalKind, string>> = {
  created_row_without_member: 'Recorded as new, never created',
  attendance_row_absent: 'Attendance missing from ledger',
  no_new_member_path: 'Skipped: could not create new member',
  identity_conflict_unresolved: 'Skipped: email/name conflict',
  multiple_candidates_unresolved: 'Skipped: several candidates',
  unresolved_review: 'Skipped: unresolved review',
  candidate_already_attended: 'Similar member already attended',
  duplicate_name_only: 'Skipped as same-name duplicate',
  skipped_without_attendance: 'Skipped duplicate, no attendance',
  invalid_row: 'Row without a name',
  missing_audit_metadata: 'Missing audit details',
  email_conflict_match: 'Matched despite different email',
  weak_name_match: 'Weak name match',
  context_mismatch_match: 'College/year mismatch',
};

export function kindLabel(kind: HistoricalKind): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}

// ─── Plans and the exact changes they make ──────────────────────────────────

export interface MemberSnapshot {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  college: string | null;
  year: string | null;
  points: number;
  events_attended: number;
}

export interface NewMemberInput {
  first_name: string;
  last_name: string;
  email: string;
  college: string;
  year: string;
}

export type RecoveryPlan =
  | { action: 'restore'; member: MemberSnapshot; memberAttended: boolean }
  | { action: 'create_member'; newMember: NewMemberInput }
  | { action: 'reassign'; from: MemberSnapshot; fromPointsEarned: number; to: MemberSnapshot; toAttended: boolean; keepOriginal: boolean; note: string }
  | { action: 'dismiss'; reason: DismissReason; note: string }
  | { action: 'needs_info'; note: string }
  | { action: 'reopen'; note: string };

export function memberName(member: Pick<MemberSnapshot, 'first_name' | 'last_name'>): string {
  return `${member.first_name} ${member.last_name}`.replace(/\s+/g, ' ').trim();
}

const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

function creditLines(member: MemberSnapshot, eventName: string, points: number, attended: boolean): string[] {
  if (attended) {
    return [`No attendance added: ${memberName(member)} already has attendance for ${eventName}, so no points are awarded.`];
  }
  return [
    `Add attendance: ${memberName(member)} × ${eventName}, ${pts(points)}.`,
    `${memberName(member)}'s total recalculates by trigger: ${member.points} → ${member.points + points} points, ${member.events_attended} → ${member.events_attended + 1} events.`,
  ];
}

/**
 * The database changes an action will make, one line each, shown before the
 * admin confirms. `eventPoints` is the event's current point value.
 */
export function describeRecoveryPlan(plan: RecoveryPlan, eventName: string, eventPoints: number): string[] {
  const history = 'Append a recovery history entry and an Admin activity entry (who, when, what, why).';
  switch (plan.action) {
    case 'restore':
      return [
        ...creditLines(plan.member, eventName, eventPoints, plan.memberAttended),
        history,
        'No member profile, other attendance, or import record changes.',
      ];
    case 'create_member': {
      const email = plan.newMember.email.trim();
      const details = [plan.newMember.college.trim(), plan.newMember.year.trim()].filter(Boolean).join(', ');
      return [
        `Create member: ${`${plan.newMember.first_name} ${plan.newMember.last_name}`.replace(/\s+/g, ' ').trim()}${email ? ` <${email.toLowerCase()}>` : ', no email'}${details ? ` (${details})` : ''}.`,
        `Add attendance: the new member × ${eventName}, ${pts(eventPoints)}. Their total starts at ${pts(eventPoints)}, 1 event.`,
        history,
        'No existing member is changed or merged.',
      ];
    }
    case 'reassign': {
      const lines = plan.keepOriginal
        ? [`Keep ${memberName(plan.from)}'s attendance for ${eventName}.`]
        : [
            `Remove attendance: ${memberName(plan.from)} × ${eventName} (${pts(plan.fromPointsEarned)}). Their total recalculates by trigger: ${plan.from.points} → ${Math.max(0, plan.from.points - plan.fromPointsEarned)} points, ${plan.from.events_attended} → ${Math.max(0, plan.from.events_attended - 1)} events.`,
          ];
      return [
        ...lines,
        ...creditLines(plan.to, eventName, eventPoints, plan.toAttended),
        plan.keepOriginal ? history : `${history} The removed attendance is saved in the entry so it can be restored.`,
        'Both changes commit together or not at all.',
      ];
    }
    case 'dismiss':
      return [`Mark the finding dismissed (${DISMISS_REASONS.find((r) => r.value === plan.reason)?.label ?? plan.reason}).`, 'No attendance or member changes.', history];
    case 'needs_info':
      return ['Put the finding on hold until more information is available.', 'No attendance or member changes.', history];
    case 'reopen':
      return ['Return the finding to Unresolved.', 'No attendance or member changes.', history];
  }
}

// ─── Validation the form enforces before the confirmation step ──────────────

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validatePlan(plan: RecoveryPlan): string | null {
  switch (plan.action) {
    case 'create_member': {
      const first = plan.newMember.first_name.trim();
      const last = plan.newMember.last_name.trim();
      if (!first || !last) return 'Enter a first and last name.';
      if (first.length > 100 || last.length > 100) return 'Names are limited to 100 characters.';
      const email = plan.newMember.email.trim();
      if (email && !EMAIL.test(email)) return 'Enter a valid email, or leave it blank.';
      return null;
    }
    case 'reassign':
      if (plan.from.id === plan.to.id) return 'Choose a different member from the one currently credited.';
      if (!plan.keepOriginal && !plan.note.trim()) return 'Record why the original member did not attend.';
      return null;
    case 'dismiss':
      if (plan.reason === 'not_actionable' && !plan.note.trim()) return 'Explain why this finding is not actionable.';
      return null;
    case 'needs_info':
      if (!plan.note.trim()) return 'Note what information is missing.';
      return null;
    default:
      return null;
  }
}

// ─── Errors from admin_recover_import_row ───────────────────────────────────

/** The database reports an email already on file as hint `email_in_use:<member id>`. */
export function emailConflictMemberId(error: unknown): string | null {
  const hint = error && typeof error === 'object' ? (error as { hint?: unknown }).hint : null;
  if (typeof hint !== 'string' || !hint.startsWith('email_in_use:')) return null;
  return hint.slice('email_in_use:'.length) || null;
}

export function isStaleFinding(error: unknown): boolean {
  const hint = error && typeof error === 'object' ? (error as { hint?: unknown }).hint : null;
  return hint === 'stale_finding' || hint === 'finding_closed';
}

/**
 * Idempotency key for one confirmed action. Generated once when the admin
 * reaches the confirmation step and reused for retries of that step, so a
 * retried request after a lost response replays instead of writing twice.
 */
export function newRequestId(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Splits a sheet name into first and last for the Create form (the admin can edit both). */
export function splitDisplayName(name: string | null): { first_name: string; last_name: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts[parts.length - 1] };
}

/** Member ids the audit row points at: candidates, the matched and the credited member. */
export function relatedMemberIds(record: RecoveryFindingRecord, matchDetails: unknown): string[] {
  const ids = new Set<string>();
  if (matchDetails && typeof matchDetails === 'object' && !Array.isArray(matchDetails)) {
    const candidates = (matchDetails as Record<string, unknown>).candidate_member_ids;
    if (Array.isArray(candidates)) candidates.forEach((id) => { if (typeof id === 'string') ids.add(id); });
    const suggested = (matchDetails as Record<string, unknown>).suggested_member_id;
    if (typeof suggested === 'string') ids.add(suggested);
  }
  if (record.matched_member_id) ids.add(record.matched_member_id);
  if (record.attendance_member_id) ids.add(record.attendance_member_id);
  return Array.from(ids);
}
