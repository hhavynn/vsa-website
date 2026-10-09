import { act, renderHook } from '@testing-library/react';
import { buildFindings, RecoveryFindingRecord } from '../lib/attendanceRecovery';
import { stageDecision } from '../lib/recoveryWorkspace';
import { useStagedRecovery } from './useStagedRecovery';

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
const storedFor = (userId: string) => window.sessionStorage.getItem(`vsa.recovery-staging.v1.${userId}`);

function signedInWithStagedWork() {
  const view = renderHook(({ userId }: { userId: string | null }) => useStagedRecovery(userId), {
    initialProps: { userId: 'admin-1' as string | null },
  });
  act(() => view.result.current.stage(decision));
  return view;
}

beforeEach(() => window.sessionStorage.clear());

it('keeps staged work, in memory and in this tab, while the session has ended and the page is held', () => {
  const { result, rerender } = signedInWithStagedWork();

  rerender({ userId: null });

  expect(result.current.count).toBe(1);
  expect(result.current.canUndo).toBe(true);
  expect(storedFor('admin-1')).not.toBeNull();
});

it('resumes untouched when the same admin signs back in', () => {
  const { result, rerender } = signedInWithStagedWork();

  rerender({ userId: null });
  rerender({ userId: 'admin-1' });

  expect(result.current.list).toEqual([decision]);
  expect(result.current.canUndo).toBe(true);
  expect(storedFor('admin-1')).not.toBeNull();
});

it.each([
  ['directly', ['admin-2']],
  ['after the session ended', [null, 'admin-2']],
])('drops the previous admin’s staged work when a different admin takes over %s', (_, sequence) => {
  const { result, rerender } = signedInWithStagedWork();

  sequence.forEach((userId) => rerender({ userId }));

  expect(result.current.count).toBe(0);
  expect(result.current.canUndo).toBe(false);
  expect(storedFor('admin-1')).toBeNull();
});
