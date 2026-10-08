import fs from 'fs';
import path from 'path';
import {
  buildReconciliationReport,
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
    matchMethod: 'fuzzy_name',
    manualOverride: null,
    nameScore: 85,
    candidateCount: 1,
    canMarkNew: false,
    hasCsvEmail: true,
    attendanceMemberId: null,
    attendanceRecordExists: null,
    emailMemberAttended: false,
    candidateAttended: false,
    resolvedElsewhere: false,
    emailInMembers: false,
    exactNameMembers: 0,
    emailConflictWithMatched: false,
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

  it('treats a skipped duplicate row as legitimate', () => {
    const result = classifyHistoricalRow(row({ decision: 'skipped_duplicate', matchReason: 'duplicate_row' }));
    expect(result).toMatchObject({ category: 'legitimate', kind: 'duplicate_row' });
  });

  it('treats a skipped row whose member already has attendance as already recorded', () => {
    const skipped = classifyHistoricalRow(row({ decision: 'skipped_duplicate', matchReason: 'already_imported' }));
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
      emailConflictWithMatched: true, nameScore: 95,
    }));
    expect(result).toMatchObject({ category: 'possible_incorrect_match', kind: 'email_conflict_match', priority: 'high' });
    expect(result.reason).toMatch(/not proof/i);
  });

  it('flags a weak-name force match at medium and leaves a clean match alone', () => {
    const weak = classifyHistoricalRow(row({
      decision: 'matched', manualOverride: 'force-match', attendanceMemberId: 'm-1', attendanceRecordExists: true, nameScore: 82,
    }));
    expect(weak).toMatchObject({ category: 'possible_incorrect_match', kind: 'weak_name_match', priority: 'medium' });
    const clean = classifyHistoricalRow(row({
      decision: 'matched', matchMethod: 'email', attendanceMemberId: 'm-1', attendanceRecordExists: true, nameScore: 100,
    }));
    expect(clean.category).toBe('no_issue');
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
    row({ importJobId: 'job-1', decision: 'skipped_duplicate', matchReason: 'duplicate_row' }),
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
