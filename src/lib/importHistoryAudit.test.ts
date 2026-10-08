import fs from 'fs';
import path from 'path';
import {
  buildReconciliationReport,
  manualDecisionFromDetails,
  classifyHistoricalRow,
  flaggedRowsToCsv,
  HistoricalJobSummary,
  HistoricalRowEvidence,
  jobDiscrepancies,
} from './importHistoryAudit';

let seq = 0;
function row(overrides: Partial<HistoricalRowEvidence> = {}): HistoricalRowEvidence {
  seq += 1;
  return {
    rowId: `row-${seq}`,
    importJobId: 'job-1',
    eventId: 'event-1',
    sourceRowIndex: seq,
    decision: 'review',
    matchReason: 'ambiguous_match',
    finalReason: 'skipped_unresolved_review',
    matchMethod: 'fuzzy_name',
    manualDecision: null,
    nameScore: 85,
    candidateCount: 1,
    canMarkNew: false,
    hasCsvEmail: true,
    attendanceMemberId: null,
    attendanceRecordExists: null,
    matchedMemberAttended: false,
    emailMemberAttended: false,
    candidateAttended: false,
    resolvedElsewhere: false,
    duplicateTwinAttended: null,
    emailInMembers: false,
    exactNameMembers: 0,
    emailConflictWithMatched: false,
    emailConflictBothSchool: false,
    yearDiffers: false,
    collegeDiffers: false,
    ...overrides,
  };
}

const job = (overrides: Partial<HistoricalJobSummary> = {}): HistoricalJobSummary => ({
  importJobId: 'job-1', eventId: 'event-1', totalRows: 10, matchedRows: 5, createdMembers: 2,
  createdAttendanceCount: 7, status: 'completed', ...overrides,
});

describe('classifyHistoricalRow', () => {
  it('flags a legitimate attendee skipped for a similar name with no way to create them', () => {
    const result = classifyHistoricalRow(row());
    expect(result.category).toBe('suspected_missing');
    expect(result.kind).toBe('no_new_member_path');
    expect(result.priority).toBe('high');
    expect(result.reason).not.toMatch(/confirmed/i);
  });

  it('treats a skipped duplicate row as legitimate only when its twin left attendance by email', () => {
    const byEmail = classifyHistoricalRow(row({ decision: 'skipped_duplicate', matchReason: 'duplicate_row', duplicateTwinAttended: 'email' }));
    expect(byEmail).toMatchObject({ category: 'legitimate', kind: 'duplicate_row' });
    const byName = classifyHistoricalRow(row({ decision: 'skipped_duplicate', matchReason: 'duplicate_row', duplicateTwinAttended: 'name' }));
    expect(byName).toMatchObject({ category: 'insufficient_evidence', kind: 'duplicate_name_only' });
    const neither = classifyHistoricalRow(row({ decision: 'skipped_duplicate', matchReason: 'duplicate_row' }));
    expect(neither).toMatchObject({ category: 'insufficient_evidence', kind: 'skipped_without_attendance' });
  });

  it('treats an explicit admin skip as intentional, in either audit format', () => {
    expect(classifyHistoricalRow(row({ finalReason: 'skipped_by_admin' }))).toMatchObject({ category: 'legitimate', kind: 'intentional_skip' });
    expect(classifyHistoricalRow(row({ manualDecision: 'skip' }))).toMatchObject({ category: 'legitimate', kind: 'intentional_skip' });
  });

  it('does not treat a same-name or uncredited row elsewhere as resolution', () => {
    // resolvedElsewhere is email + ledger only; without it a name twin proves nothing.
    expect(classifyHistoricalRow(row({ resolvedElsewhere: false })).category).toBe('suspected_missing');
    expect(classifyHistoricalRow(row({ resolvedElsewhere: true }))).toMatchObject({ category: 'legitimate', kind: 'already_recorded' });
  });

  it('treats a skipped row whose member already has attendance as already recorded', () => {
    const skipped = classifyHistoricalRow(row({ decision: 'skipped_duplicate', matchReason: 'already_imported', matchedMemberAttended: true }));
    expect(skipped).toMatchObject({ category: 'legitimate', kind: 'already_recorded' });
    const unresolved = classifyHistoricalRow(row({ emailMemberAttended: true }));
    expect(unresolved).toMatchObject({ category: 'legitimate', kind: 'already_recorded' });
  });

  it('does not call a skipped row missing when only a similar-name member attended', () => {
    const result = classifyHistoricalRow(row({ candidateAttended: true }));
    expect(result.category).toBe('insufficient_evidence');
    expect(result.nextAction).toMatch(/not add attendance on name similarity/i);
  });

  it('reports missing audit metadata as insufficient evidence', () => {
    expect(classifyHistoricalRow(row({ matchReason: null }))).toMatchObject({
      category: 'insufficient_evidence', kind: 'missing_audit_metadata',
    });
  });

  it('confirms a created row that produced no member and no attendance', () => {
    const result = classifyHistoricalRow(row({ decision: 'created', matchReason: null, attendanceMemberId: null }));
    expect(result).toMatchObject({ category: 'confirmed_missing', kind: 'created_row_without_member', priority: 'high' });
  });

  it('confirms recorded attendance that no longer exists', () => {
    const result = classifyHistoricalRow(row({ decision: 'matched', attendanceMemberId: 'm-1', attendanceRecordExists: false }));
    expect(result).toMatchObject({ category: 'confirmed_missing', kind: 'attendance_row_absent' });
  });

  it('flags a fuzzy match with a conflicting email as a possible incorrect match, high priority', () => {
    const result = classifyHistoricalRow(row({
      decision: 'matched', matchMethod: 'fuzzy_name', attendanceMemberId: 'm-1', attendanceRecordExists: true,
      emailConflictWithMatched: true, emailConflictBothSchool: true, nameScore: 95,
    }));
    expect(result).toMatchObject({ category: 'possible_incorrect_match', kind: 'email_conflict_match', priority: 'high' });
    expect(result.reason).toMatch(/not proof/i);
  });

  it('flags a weak-name force match at medium and leaves a clean match alone', () => {
    const weak = classifyHistoricalRow(row({
      decision: 'matched', manualDecision: 'match', attendanceMemberId: 'm-1', attendanceRecordExists: true, nameScore: 82,
    }));
    expect(weak).toMatchObject({ category: 'possible_incorrect_match', kind: 'weak_name_match', priority: 'medium' });
    const clean = classifyHistoricalRow(row({
      decision: 'matched', matchMethod: 'email', attendanceMemberId: 'm-1', attendanceRecordExists: true, nameScore: 100,
    }));
    expect(clean.category).toBe('no_issue');
  });

  it('scores a legacy exact-name match whose email or college disagrees', () => {
    const base = { decision: 'matched' as const, matchMethod: 'exact_name', nameScore: 100, attendanceMemberId: 'm-1', attendanceRecordExists: true };
    expect(classifyHistoricalRow(row({ ...base, emailConflictWithMatched: true, emailConflictBothSchool: true }))).toMatchObject({
      category: 'possible_incorrect_match', kind: 'email_conflict_match', priority: 'high',
    });
    // School vs personal address: usually one student with two emails, so lower priority.
    expect(classifyHistoricalRow(row({ ...base, emailConflictWithMatched: true }))).toMatchObject({
      category: 'possible_incorrect_match', kind: 'email_conflict_match', priority: 'medium',
    });
    expect(classifyHistoricalRow(row({ ...base, collegeDiffers: true }))).toMatchObject({
      category: 'possible_incorrect_match', kind: 'context_mismatch_match', priority: 'low',
    });
    // A changed year alone is normal for a returning student matched by exact name.
    expect(classifyHistoricalRow(row({ ...base, yearDiffers: true })).category).toBe('no_issue');
  });

  it('scores a post-#518 admin match among several candidates', () => {
    const result = classifyHistoricalRow(row({
      decision: 'matched', matchMethod: 'fuzzy_name', manualDecision: 'match', nameScore: 95, candidateCount: 3,
      attendanceMemberId: 'm-1', attendanceRecordExists: true,
    }));
    expect(result).toMatchObject({ category: 'possible_incorrect_match', priority: 'low' });
    expect(result.reason).toMatch(/admin-chosen/);
  });

  it('accepts a matched row that credits nothing only when the member has ledger attendance', () => {
    const base = { decision: 'matched' as const, matchMethod: 'email', finalReason: 'duplicate_member_in_file', attendanceMemberId: null };
    expect(classifyHistoricalRow(row({ ...base, matchedMemberAttended: true }))).toMatchObject({ category: 'legitimate', kind: 'duplicate_row' });
    expect(classifyHistoricalRow(row({ ...base, matchedMemberAttended: false }))).toMatchObject({ category: 'confirmed_missing', kind: 'attendance_row_absent' });
  });
});

describe('manualDecisionFromDetails', () => {
  it('reads the current manual_decision object and the legacy manual_override string', () => {
    expect(manualDecisionFromDetails({ manual_decision: { kind: 'match', memberId: 'm-1' } })).toBe('match');
    expect(manualDecisionFromDetails({ manual_decision: { kind: 'skip' } })).toBe('skip');
    expect(manualDecisionFromDetails({ manual_decision: null, manual_override: 'force-match' })).toBe('match');
    expect(manualDecisionFromDetails({ manual_override: 'mark-new' })).toBe('new');
    expect(manualDecisionFromDetails({ manual_override: null })).toBeNull();
    expect(manualDecisionFromDetails(null)).toBeNull();
    expect(manualDecisionFromDetails([])).toBeNull();
  });
});

describe('buildReconciliationReport', () => {
  const jobs = [
    job(),
    job({ importJobId: 'job-2', totalRows: 4, matchedRows: 2, createdMembers: 0, createdAttendanceCount: 1 }),
    job({ importJobId: 'job-3', eventId: 'event-1', totalRows: 3, matchedRows: 3, createdMembers: 0, createdAttendanceCount: 3 }),
  ];
  const rows = [
    row({ importJobId: 'job-1' }),
    row({ importJobId: 'job-1', decision: 'skipped_duplicate', matchReason: 'duplicate_row', duplicateTwinAttended: 'email' }),
    row({ importJobId: 'job-2', decision: 'matched', matchMethod: 'email', attendanceMemberId: 'm-2', attendanceRecordExists: true, nameScore: 100 }),
    row({ importJobId: 'job-2', matchReason: null }),
  ];

  it('summarises jobs, events and categories using ids only', () => {
    const report = buildReconciliationReport(jobs, rows);
    expect(report.jobsExamined).toBe(3);
    expect(report.eventsExamined).toBe(1);
    expect(report.totalSourceRows).toBe(17);
    expect(report.unresolvedRows).toBe(2);
    expect(report.duplicateRows).toBe(1);
    expect(report.byCategory.suspected_missing).toBe(1);
    expect(report.byCategory.insufficient_evidence).toBe(1);
    expect(report.flagged[0].priority).toBe('high');
    expect(report.eventsWithFlags).toBe(1);
  });

  it('counts several imports of the same event as one event and surfaces header shortfalls', () => {
    const report = buildReconciliationReport(jobs, rows);
    expect(report.discrepancies).toEqual([
      { importJobId: 'job-2', eventId: 'event-1', expectedAttendance: 2, recordedAttendance: 1, shortfall: 1 },
    ]);
    expect(jobDiscrepancies([job({ status: 'failed', createdAttendanceCount: 0 })])).toEqual([]);
  });

  it('is repeatable and does not mutate its input', () => {
    const before = JSON.stringify({ jobs, rows });
    const first = buildReconciliationReport(jobs, rows);
    const second = buildReconciliationReport(jobs, rows);
    expect(second).toEqual(first);
    expect(JSON.stringify({ jobs, rows })).toBe(before);
  });

  it('exports flagged rows without names, emails or raw cells', () => {
    const csv = flaggedRowsToCsv(buildReconciliationReport(jobs, rows).flagged);
    expect(csv.split('\n')[0]).toBe('category,priority,kind,event_id,import_job_id,import_job_row_id,source_row,reason,next_action');
    expect(csv).not.toMatch(/@/);
    expect(csv.split('\n').length).toBe(3);
  });
});

describe('scripts/audit-import-history.sql', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../scripts/audit-import-history.sql'), 'utf8')
    .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

  it('contains no mutating or privilege-changing statements', () => {
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|merge|copy)\b/i);
  });

  it('never selects names, emails or raw rows into the output', () => {
    // Internal CTEs may compare names/emails; the final column-0 SELECT is what leaves the database.
    const finalSelect = sql.slice(sql.lastIndexOf('\nselect'));
    expect(finalSelect).toMatch(/from classified/);
    expect(finalSelect).not.toMatch(/display_name|csv_email|raw_row|first_name|last_name|\bemail\b/i);
  });
});
