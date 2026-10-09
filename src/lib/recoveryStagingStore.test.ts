import { buildFindings, RecoveryFindingRecord } from './attendanceRecovery';
import { STAGING_TTL_MS, clearStaged, loadStaged, saveStaged } from './recoveryStagingStore';
import { stageDecision } from './recoveryWorkspace';

const record = {
  row_id: 'r1', import_job_id: 'job-1', job_status: 'completed', job_created_at: '2026-05-23T00:00:00Z', event_id: 'ev-1',
  event_name: 'Fall GBM', event_date: null, source_row_index: 0, decision: 'review', display_name: 'Linh Tran', csv_email: null,
  csv_college: null, csv_year: null, attendance_member_id: null, matched_member_id: null, match_reason: 'ambiguous_match',
  final_reason: null, match_method: null, manual_decision: null, name_score: null, candidate_count: 0, can_mark_new: true,
  has_csv_email: false, attendance_exists: null, matched_member_attended: false, email_member_attended: false,
  candidate_attended: false, resolved_elsewhere: false, duplicate_twin_attended: null, email_in_members: false,
  exact_name_members: 0, email_conflict: false, email_conflict_both_school: false, year_differs: false, college_differs: false,
  recovered_credit_present: null, original_credit_present: null, created_member_id: null, candidate_member_ids: [],
} as RecoveryFindingRecord;
const decision = stageDecision(buildFindings([record], [])[0], { kind: 'needs_info', note: 'need sheet' });

beforeEach(() => window.sessionStorage.clear());

it('round-trips one admin’s staged work in this tab only', () => {
  saveStaged('admin-a', [decision], 1_000);
  expect(window.localStorage.length).toBe(0);
  expect(loadStaged('admin-a', 2_000)).toEqual([decision]);
});

it('expires after the TTL and removes other admins’ work on load', () => {
  saveStaged('admin-a', [decision], 1_000);
  saveStaged('admin-b', [decision], 1_000);
  expect(loadStaged('admin-b', 1_000 + STAGING_TTL_MS + 1)).toEqual([]);
  expect(window.sessionStorage.length).toBe(0);
});

it('drops malformed or tampered entries instead of trusting them', () => {
  window.sessionStorage.setItem('vsa.recovery-staging.v1.admin-a', JSON.stringify({
    savedAt: 1_000,
    decisions: [decision, { ...decision, rowId: 'other' }, { kind: 'restore' }, 'junk'],
  }));
  expect(loadStaged('admin-a', 2_000)).toEqual([decision]);
  window.sessionStorage.setItem('vsa.recovery-staging.v1.admin-a', '{not json');
  expect(loadStaged('admin-a', 2_000)).toEqual([]);
});

it('clears on request, and removes the key when nothing is staged', () => {
  saveStaged('admin-a', [decision], 1_000);
  saveStaged('admin-a', [], 1_000);
  expect(window.sessionStorage.length).toBe(0);
  saveStaged('admin-a', [decision], 1_000);
  clearStaged();
  expect(window.sessionStorage.length).toBe(0);
});
