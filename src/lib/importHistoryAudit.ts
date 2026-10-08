// Read-only reconciliation of historical attendance imports (import_jobs /
// import_job_rows) against what was actually recorded. Pure: callers pass in
// evidence rows (see scripts/audit-import-history.sql, which mirrors this
// classification in SQL for admins without a dev environment) and get back a
// report keyed by stable internal ids. Nothing here reads or writes the database,
// and no member names or emails appear in the output.
//
// A flag is a reason to look, not a verdict. Fuzzy name similarity alone never
// proves two rows are the same person, and never proves they are different.

export type HistoricalCategory =
  | 'confirmed_missing'
  | 'suspected_missing'
  | 'possible_incorrect_match'
  | 'legitimate'
  | 'insufficient_evidence'
  | 'no_issue';

export type HistoricalPriority = 'high' | 'medium' | 'low';

export type HistoricalKind =
  | 'created_row_without_member'
  | 'attendance_row_absent'
  | 'no_new_member_path'
  | 'identity_conflict_unresolved'
  | 'multiple_candidates_unresolved'
  | 'unresolved_review'
  | 'candidate_already_attended'
  | 'already_recorded'
  | 'duplicate_row'
  | 'duplicate_name_only'
  | 'skipped_without_attendance'
  | 'intentional_skip'
  | 'invalid_row'
  | 'email_conflict_match'
  | 'weak_name_match'
  | 'context_mismatch_match'
  | 'missing_audit_metadata'
  | 'ok';

/** An admin's explicit per-row choice, from either audit format. */
export type ManualDecision = 'match' | 'new' | 'skip';

/**
 * Reads the admin decision from match_details. Rows written since #518 carry
 * `manual_decision: { kind: 'match' | 'new' | 'skip' }`; older rows carry
 * `manual_override: 'force-match' | 'mark-new'`.
 */
export function manualDecisionFromDetails(details: unknown): ManualDecision | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const record = details as Record<string, unknown>;
  const current = record.manual_decision;
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    const kind = (current as Record<string, unknown>).kind;
    if (kind === 'match' || kind === 'new' || kind === 'skip') return kind;
  }
  if (record.manual_override === 'force-match') return 'match';
  if (record.manual_override === 'mark-new') return 'new';
  return null;
}

/** One audit row plus the evidence the SQL/DB lookup gathered. Booleans only; no PII. */
export interface HistoricalRowEvidence {
  rowId: string;
  importJobId: string;
  eventId: string | null;
  sourceRowIndex: number;
  decision: 'matched' | 'created' | 'skipped_duplicate' | 'review' | 'error';
  /** match_details.match_reason; null on the earliest audit rows. */
  matchReason: string | null;
  /** match_details.final_reason, e.g. skipped_by_admin, duplicate_member_in_file (since #518). */
  finalReason: string | null;
  matchMethod: string | null;
  manualDecision: ManualDecision | null;
  nameScore: number | null;
  candidateCount: number;
  /** match_details.can_mark_new; null when not recorded. */
  canMarkNew: boolean | null;
  hasCsvEmail: boolean;
  attendanceMemberId: string | null;
  /** For rows that credited a member: does member_event_attendance still hold that pair? null = not applicable. */
  attendanceRecordExists: boolean | null;
  /** The member the importer resolved this row to has attendance for the event in the ledger. */
  matchedMemberAttended: boolean;
  /** Some member whose stored email equals this row's email has attendance for the event. */
  emailMemberAttended: boolean;
  /** A near-name candidate (or the suggested member) has attendance. Similarity only; not identity. */
  candidateAttended: boolean;
  /**
   * Another row for the same event, in a completed job, with the SAME EMAIL, credited a member who
   * still has attendance in the ledger. Names alone never count: two people can share one.
   */
  resolvedElsewhere: boolean;
  /** For skipped duplicates: an earlier row of the same file with ledger attendance, matched by email or by name only. */
  duplicateTwinAttended: 'email' | 'name' | null;
  /** Some member already carries this row's email. */
  emailInMembers: boolean;
  /** Members whose normalized full name equals this row's name. */
  exactNameMembers: number;
  /** Matched member's stored email differs from the row's. */
  emailConflictWithMatched: boolean;
  /** Both differing emails are UCSD addresses: one person rarely has two, so this is the stronger signal. */
  emailConflictBothSchool: boolean;
  yearDiffers: boolean;
  collegeDiffers: boolean;
}

export interface HistoricalJobSummary {
  importJobId: string;
  eventId: string | null;
  totalRows: number;
  matchedRows: number;
  createdMembers: number;
  createdAttendanceCount: number;
  status: 'completed' | 'failed';
}

export interface ClassifiedRow {
  rowId: string;
  importJobId: string;
  eventId: string | null;
  sourceRowIndex: number;
  category: HistoricalCategory;
  kind: HistoricalKind;
  priority: HistoricalPriority;
  reason: string;
  nextAction: string;
}

const HIGH_NAME_SCORE = 90;

function result(
  row: HistoricalRowEvidence,
  category: HistoricalCategory,
  kind: HistoricalKind,
  priority: HistoricalPriority,
  reason: string,
  nextAction: string,
): ClassifiedRow {
  return {
    rowId: row.rowId,
    importJobId: row.importJobId,
    eventId: row.eventId,
    sourceRowIndex: row.sourceRowIndex,
    category,
    kind,
    priority,
    reason,
    nextAction,
  };
}

/** Identity-strong evidence that this person's attendance is already in the ledger. */
function personAlreadyRecorded(row: HistoricalRowEvidence): boolean {
  return row.emailMemberAttended || row.resolvedElsewhere;
}

function matchBasis(row: HistoricalRowEvidence): string {
  if (row.manualDecision === 'match') return 'an admin-chosen match';
  if (row.matchMethod === 'exact_name') return 'an automatic exact-name match';
  return 'a fuzzy match';
}

function classifyRecorded(row: HistoricalRowEvidence): ClassifiedRow {
  if (row.decision === 'created' && !row.attendanceMemberId) {
    if (personAlreadyRecorded(row)) {
      return result(row, 'legitimate', 'already_recorded', 'low',
        'Row was meant to create a member but nothing was linked; a member with this email has attendance for the event.',
        'None.');
    }
    return result(row, 'confirmed_missing', 'created_row_without_member', 'high',
      'Row was recorded as a new member, but no member or attendance was linked and no member with this email has attendance for the event.',
      'Review the stored source row, then create the member (or link an existing one) and add attendance once.');
  }
  if (row.decision === 'matched' && !row.attendanceMemberId) {
    // Since #518: a second row resolving to a member another row already credits writes nothing itself.
    if (row.matchedMemberAttended) {
      return result(row, 'legitimate', 'duplicate_row', 'low',
        'Another row in this file credited the same member, who has attendance for the event.', 'None.');
    }
    return result(row, 'confirmed_missing', 'attendance_row_absent', 'high',
      'The row resolved to a member, but neither it nor any other row left attendance for that member in the ledger.',
      'Check Admin Members history for deletion or merge before restoring.');
  }
  if (row.attendanceMemberId && row.attendanceRecordExists === false) {
    return result(row, 'confirmed_missing', 'attendance_row_absent', 'high',
      'The import recorded attendance for a member, but that attendance row no longer exists.',
      'Check Admin Members history for deletion or merge before restoring.');
  }

  // Only rows the importer did not resolve by a unique email can carry identity risk. Before #518 a
  // unique exact name auto-matched even when the email or college disagreed, so those are scored too.
  const guessed = row.matchMethod === 'fuzzy_name' || row.manualDecision === 'match';
  const nameBased = guessed || row.matchMethod === 'exact_name';
  let score = 0;
  const notes: string[] = [];
  if (nameBased && row.emailConflictWithMatched) {
    // A school address against a personal one is usually the same student; two school addresses rarely are.
    score += row.emailConflictBothSchool ? 3 : 2;
    notes.push(row.emailConflictBothSchool ? "the row's school email differs from the matched member's school email" : "the row's email differs from the matched member's email");
  }
  if (guessed && row.nameScore !== null && row.nameScore < HIGH_NAME_SCORE) { score += 2; notes.push('the name similarity was weak'); }
  if (guessed && row.yearDiffers) { score += 1; notes.push('the academic year differs'); }
  if (nameBased && row.collegeDiffers) { score += 1; notes.push('the college differs'); }
  if (row.manualDecision === 'match' && row.candidateCount > 1) { score += 1; notes.push('several members were candidates'); }

  if (score === 0) return result(row, 'no_issue', 'ok', 'low', 'No conflicting identity evidence.', 'None.');

  const kind: HistoricalKind = nameBased && row.emailConflictWithMatched ? 'email_conflict_match'
    : guessed && row.nameScore !== null && row.nameScore < HIGH_NAME_SCORE ? 'weak_name_match'
    : 'context_mismatch_match';
  const priority: HistoricalPriority = score >= 3 ? 'high' : score === 2 ? 'medium' : 'low';
  return result(row, 'possible_incorrect_match', kind, priority,
    `Attendance went to an existing member on ${matchBasis(row)}, and ${notes.join('; ')}. This is not proof of a wrong match.`,
    'Compare the stored source row with the member profile; correct only if they are clearly different people.');
}

function classifySkippedDuplicate(row: HistoricalRowEvidence): ClassifiedRow {
  if (row.matchedMemberAttended || personAlreadyRecorded(row) || row.duplicateTwinAttended === 'email') {
    return result(row, 'legitimate', row.matchReason === 'duplicate_row' ? 'duplicate_row' : 'already_recorded', 'low',
      'Skipped as a duplicate, and the same person has attendance for the event in the ledger.', 'None.');
  }
  if (row.duplicateTwinAttended === 'name') {
    return result(row, 'insufficient_evidence', 'duplicate_name_only', 'low',
      'Skipped because an earlier row in the same file had the same name. That row has attendance, but a shared name does not prove it is the same person.',
      'Compare the two stored source rows; add attendance only if they are different people.');
  }
  return result(row, 'insufficient_evidence', 'skipped_without_attendance', 'medium',
    'Skipped as a duplicate, but no attendance for this person exists in the ledger.',
    'Find the row it duplicated; if that row was also skipped, review both together.');
}

function classifyUnresolved(row: HistoricalRowEvidence): ClassifiedRow {
  if (row.finalReason === 'skipped_by_admin' || row.manualDecision === 'skip') {
    return result(row, 'legitimate', 'intentional_skip', 'low',
      'An admin explicitly chose to skip this row.', 'None, unless the admin’s reason is in doubt.');
  }
  if (row.finalReason === 'invalid_row_no_name') {
    return result(row, 'insufficient_evidence', 'invalid_row', 'low',
      'The row had no name, so the importer could not use it.', 'Check the stored source row for an email; otherwise nothing is recoverable.');
  }
  if (row.matchReason === null) {
    return result(row, 'insufficient_evidence', 'missing_audit_metadata', 'medium',
      'This skipped row has no recorded match reason, so the importer’s reasoning cannot be reconstructed.',
      'Use the stored source row only; confirm identity manually.');
  }
  if (personAlreadyRecorded(row)) {
    return result(row, 'legitimate', 'already_recorded', 'low',
      'A member with this email has attendance for the event in the ledger.',
      'None.');
  }
  if (row.candidateAttended) {
    return result(row, 'insufficient_evidence', 'candidate_already_attended', 'medium',
      'A similarly named member has attendance for this event. That is either this person (already recorded) or a different person who also attended.',
      'Compare email, college and year before deciding; do not add attendance on name similarity alone.');
  }
  if (row.matchReason === 'email_name_conflict' || row.matchReason === 'duplicate_email_conflict') {
    return result(row, 'suspected_missing', 'identity_conflict_unresolved', 'medium',
      'The email conflicted with the name or with several members, and no attendance exists for the event.',
      'Resolve the member identity first, then add attendance once.');
  }
  if (row.canMarkNew === false && row.hasCsvEmail && row.candidateCount <= 1 && !row.emailInMembers && row.exactNameMembers === 0) {
    return result(row, 'suspected_missing', 'no_new_member_path', 'high',
      'The email is unknown to the roster and no member has this exact name; the only option the old importer offered was to force-match one near-name candidate, so a genuinely new attendee could only be skipped.',
      'Review the stored source row; if this is a new person, create a member and add attendance once.');
  }
  if (row.candidateCount > 1 || row.exactNameMembers > 1) {
    return result(row, 'suspected_missing', 'multiple_candidates_unresolved', 'medium',
      'Several members could be this person and no attendance exists for the event.',
      'Choose the correct member (or create a new one) using email, college and year.');
  }
  return result(row, 'suspected_missing', 'unresolved_review', 'medium',
    'The row was left unresolved and nothing shows attendance for this person at the event.',
    'Review the stored source row and decide: match, create, or intentional skip.');
}

export function classifyHistoricalRow(row: HistoricalRowEvidence): ClassifiedRow {
  switch (row.decision) {
    case 'matched':
    case 'created':
      return classifyRecorded(row);
    case 'skipped_duplicate':
      return classifySkippedDuplicate(row);
    case 'review':
      return classifyUnresolved(row);
    default:
      return result(row, 'insufficient_evidence', 'missing_audit_metadata', 'medium',
        'The row was recorded as an error.', 'Inspect the job error and re-run the row through the importer.');
  }
}

export interface JobDiscrepancy {
  importJobId: string;
  eventId: string | null;
  expectedAttendance: number;
  recordedAttendance: number;
  /** Rows whose member already had attendance, or that collided on the same member. Explains it; not itself a loss. */
  shortfall: number;
}

/** matched rows + members created should equal attendance written; a shortfall means rows collapsed onto existing attendance. */
export function jobDiscrepancies(jobs: readonly HistoricalJobSummary[]): JobDiscrepancy[] {
  return jobs
    .filter((job) => job.status === 'completed')
    .map((job) => {
      const expected = job.matchedRows + job.createdMembers;
      return {
        importJobId: job.importJobId,
        eventId: job.eventId,
        expectedAttendance: expected,
        recordedAttendance: job.createdAttendanceCount,
        shortfall: expected - job.createdAttendanceCount,
      };
    })
    .filter((item) => item.shortfall !== 0);
}

export interface ReconciliationReport {
  jobsExamined: number;
  eventsExamined: number;
  eventsWithFlags: number;
  totalSourceRows: number;
  attendanceRecorded: number;
  alreadyRecordedRows: number;
  duplicateRows: number;
  unresolvedRows: number;
  byCategory: Record<HistoricalCategory, number>;
  discrepancies: JobDiscrepancy[];
  /** Flagged rows only (everything except no_issue / legitimate), highest priority first. */
  flagged: ClassifiedRow[];
}

const PRIORITY_ORDER: Record<HistoricalPriority, number> = { high: 0, medium: 1, low: 2 };
const FLAGGED: ReadonlySet<HistoricalCategory> = new Set<HistoricalCategory>([
  'confirmed_missing', 'suspected_missing', 'possible_incorrect_match', 'insufficient_evidence',
]);

/** Pure and idempotent: the inputs are not mutated and repeated calls return equal output. */
export function buildReconciliationReport(
  jobs: readonly HistoricalJobSummary[],
  rows: readonly HistoricalRowEvidence[],
): ReconciliationReport {
  const classified = rows.map(classifyHistoricalRow);
  const byCategory: Record<HistoricalCategory, number> = {
    confirmed_missing: 0, suspected_missing: 0, possible_incorrect_match: 0,
    legitimate: 0, insufficient_evidence: 0, no_issue: 0,
  };
  classified.forEach((item) => { byCategory[item.category] += 1; });

  const flagged = classified
    .filter((item) => FLAGGED.has(item.category))
    .sort((a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      || a.importJobId.localeCompare(b.importJobId)
      || a.sourceRowIndex - b.sourceRowIndex);

  const events = new Set(jobs.map((job) => job.eventId).filter((id): id is string => !!id));
  const flaggedEvents = new Set(flagged.map((item) => item.eventId).filter((id): id is string => !!id));

  return {
    jobsExamined: jobs.length,
    eventsExamined: events.size,
    eventsWithFlags: flaggedEvents.size,
    totalSourceRows: jobs.reduce((sum, job) => sum + job.totalRows, 0),
    attendanceRecorded: jobs.reduce((sum, job) => sum + (job.status === 'completed' ? job.createdAttendanceCount : 0), 0),
    alreadyRecordedRows: classified.filter((item) => item.kind === 'already_recorded').length,
    duplicateRows: classified.filter((item) => item.kind === 'duplicate_row').length,
    unresolvedRows: rows.filter((row) => row.decision === 'review').length,
    byCategory,
    discrepancies: jobDiscrepancies(jobs),
    flagged,
  };
}

/** Export for sharing: ids, enums and counts only. No names, emails or raw rows. */
export function flaggedRowsToCsv(flagged: readonly ClassifiedRow[]): string {
  const header = ['category', 'priority', 'kind', 'event_id', 'import_job_id', 'import_job_row_id', 'source_row', 'reason', 'next_action'];
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = flagged.map((item) =>
    [item.category, item.priority, item.kind, item.eventId ?? '', item.importJobId, item.rowId, String(item.sourceRowIndex + 2), item.reason, item.nextAction]
      .map(cell)
      .join(','));
  return [header.join(','), ...lines].join('\n');
}
