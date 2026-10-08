import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { HistoricalRecoveryPanel } from './HistoricalRecoveryPanel';
import { attendanceRecoveryRepository } from '../../../data/repos/attendanceRecovery';
import { DatabaseError, NetworkError } from '../../../data/errors';
import type { MemberSnapshot, RecoveryActionRecord, RecoveryFindingRecord } from '../../../lib/attendanceRecovery';

jest.mock('../../../data/repos/attendanceRecovery', () => ({
  attendanceRecoveryRepository: {
    listFindingRecords: jest.fn(),
    listActions: jest.fn(),
    getRowDetail: jest.fn(),
    getMembers: jest.fn(),
    searchMembers: jest.fn(),
    getEventAttendance: jest.fn(),
    getRecentAttendance: jest.fn(),
    getEventPoints: jest.fn(),
    recover: jest.fn(),
  },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('./MemberAttendanceModal', () => ({
  MemberAttendanceModal: ({ memberId, onClose }: { memberId: string; onClose: () => void }) => (
    <div role="dialog" aria-label="Admin Members attendance">
      Attendance editor for {memberId}
      <button type="button" onClick={onClose}>Close editor</button>
    </div>
  ),
}));

const repo = attendanceRecoveryRepository as jest.Mocked<typeof attendanceRecoveryRepository>;

// Synthetic people only.
const base: RecoveryFindingRecord = {
  row_id: 'row-skip', import_job_id: 'job-1', job_status: 'completed', job_created_at: '2026-05-23T00:00:00Z',
  event_id: 'event-1', event_name: 'Fall GBM', event_date: '2026-05-22T12:00:00Z', source_row_index: 4,
  decision: 'review', display_name: 'Linh Tran', csv_email: 'linh.new@gmail.com', csv_college: 'Revelle', csv_year: '2nd',
  attendance_member_id: null, matched_member_id: null, match_reason: 'ambiguous_match', final_reason: null, match_method: null,
  manual_decision: null, name_score: 88, candidate_count: 1, can_mark_new: false, has_csv_email: true, attendance_exists: null,
  matched_member_attended: false, email_member_attended: false, candidate_attended: false, resolved_elsewhere: false,
  duplicate_twin_attended: null, email_in_members: false, exact_name_members: 0, email_conflict: false,
  email_conflict_both_school: false, year_differs: false, college_differs: false, recovered_credit_present: null,
};
const wrongMatch: RecoveryFindingRecord = {
  ...base, row_id: 'row-wrong', source_row_index: 7, decision: 'matched', display_name: 'Kevin Lee', csv_email: 'kevlee@ucsd.edu',
  attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: true, match_method: 'fuzzy_name', name_score: 70,
  email_conflict: true, email_conflict_both_school: true,
};
const otherEvent: RecoveryFindingRecord = { ...base, row_id: 'row-other', event_id: 'event-2', event_name: 'Winter Social', import_job_id: 'job-2', display_name: 'Bao Vo' };
const recovered: RecoveryFindingRecord = { ...base, row_id: 'row-done', display_name: 'Anna Pham', email_member_attended: true, recovered_credit_present: true };

const member = (id: string, first: string, last: string, email: string, points = 20): MemberSnapshot => ({
  id, first_name: first, last_name: last, email, college: 'Revelle', year: '2nd', points, events_attended: 2,
});
const linh = member('m-linh', 'Linh', 'Tran', 'linh.tran@ucsd.edu');
const lynn = member('m-lynn', 'Lynn', 'Tran', 'lynn.tran@ucsd.edu', 5);
const kevinLe = member('m-le', 'Kevin', 'Le', 'kevin.le@ucsd.edu', 10);
const kevinLee = member('m-lee', 'Kevin', 'Lee', 'kevlee@ucsd.edu', 0);
const members = [linh, lynn, kevinLe, kevinLee];

const doneAction: RecoveryActionRecord = {
  id: 'act-1', request_id: 'req-old', import_job_row_id: 'row-done', previous_action_id: null, action: 'restore',
  resulting_status: 'recovered', outcome: 'attendance_added', event_id: 'event-1', member_id: 'm-anna', from_member_id: null,
  created_member: false, attendance_id: 'att-1', points_awarded: 10, reason_code: 'identity_confirmed',
  note: null, actor_user_id: 'admin-1', created_at: '2026-10-08T01:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  repo.listFindingRecords.mockResolvedValue([base, wrongMatch, otherEvent, recovered]);
  repo.listActions.mockResolvedValue([doneAction]);
  repo.getRowDetail.mockImplementation(async (id) => ({
    id, raw_row: { Name: 'Linh Tran', Email: 'linh.new@gmail.com' }, display_name: null, csv_email: null, csv_college: null, csv_year: null,
    match_details: id === 'row-skip' ? { candidate_member_ids: ['m-linh', 'm-lynn'] } : { candidate_member_ids: ['m-lee'] },
  }));
  repo.getMembers.mockImplementation(async (ids) => members.filter((m) => ids.includes(m.id)));
  repo.getEventAttendance.mockImplementation(async (_event, ids) => (ids.includes('m-le') ? [{ member_id: 'm-le', points_earned: 10 }] : []));
  repo.getRecentAttendance.mockResolvedValue([]);
  repo.searchMembers.mockResolvedValue([]);
  repo.getEventPoints.mockResolvedValue(10);
  repo.recover.mockResolvedValue({
    action_id: 'act-2', status: 'recovered', outcome: 'attendance_added', member_id: 'm-linh', from_member_id: null,
    created_member: false, attendance_id: 'att-2', points_awarded: 10, replayed: false,
  });
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><HistoricalRecoveryPanel /></QueryClientProvider>);
}

async function openFinding(name: string) {
  const row = await screen.findByRole('listitem', { name });
  fireEvent.click(within(row).getByRole('button', { name: /Review|View/ }));
  return screen.findByRole('alertdialog');
}

async function chooseRestoreTo(dialog: HTMLElement, memberLabel: RegExp) {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Match existing member' }));
  const radio = await within(dialog).findByRole('radio', { name: memberLabel });
  fireEvent.click(radio);
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /verified this is the same person/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  await within(dialog).findByText('Exact database changes');
}

it('groups findings by status and filters by event and issue type', async () => {
  renderPanel();
  expect(await screen.findByRole('tab', { name: /Unresolved 3/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: /Recovered 1/ })).toBeInTheDocument();
  expect(screen.getByText('Linh Tran')).toBeInTheDocument();
  expect(screen.queryByText('Anna Pham')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'event-2' } });
  expect(screen.getByText('Bao Vo')).toBeInTheDocument();
  expect(screen.queryByText('Linh Tran')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Event'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Issue type'), { target: { value: 'email_conflict_match' } });
  expect(screen.getByText('Kevin Lee')).toBeInTheDocument();
  expect(screen.queryByText('Linh Tran')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Issue type'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('tab', { name: /Recovered 1/ }));
  expect(screen.getByText('Anna Pham')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Recovery history' }));
  expect(screen.getByText(/Attendance restored/)).toBeInTheDocument();
  expect(screen.getByText(/10 points awarded/)).toBeInTheDocument();
});

it('restores a skipped attendee only after identity and change confirmation, then refreshes', async () => {
  const invalidateSpy = jest.spyOn(QueryClient.prototype, 'invalidateQueries');
  renderPanel();
  const dialog = await openFinding('Linh Tran');
  expect(within(dialog).getByText(/Fall GBM · May 22, 2026/)).toBeInTheDocument();
  expect(within(dialog).getByText(/sheet row 6/)).toBeInTheDocument();
  expect(within(dialog).getByText('Unresolved: no member was credited for this row.')).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Match existing member' }));
  const radios = await within(dialog).findAllByRole('radio');
  expect(radios).toHaveLength(2);
  radios.forEach((radio) => expect(radio).not.toBeChecked());

  fireEvent.click(within(dialog).getByRole('radio', { name: /Linh Tran/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Confirm that you verified the identity');
  expect(repo.recover).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('checkbox', { name: /verified this is the same person/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  await within(dialog).findByText('Exact database changes');
  expect(within(dialog).getByText('Add attendance: Linh Tran × Fall GBM, 10 points.')).toBeInTheDocument();
  expect(within(dialog).getByText(/20 → 30 points/)).toBeInTheDocument();
  expect(within(dialog).getAllByText(/no attendance for this event/).length).toBeGreaterThan(0);

  const apply = within(dialog).getByRole('button', { name: 'Apply' });
  expect(apply).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /reviewed these changes/ }));
  fireEvent.click(apply);

  await waitFor(() => expect(repo.recover).toHaveBeenCalledTimes(1));
  expect(repo.recover.mock.calls[0][0]).toMatchObject({
    rowId: 'row-skip', action: 'restore', expectedPreviousActionId: null, memberId: 'm-linh', fromMemberId: null,
  });
  expect(repo.recover.mock.calls[0][0].requestId).toMatch(/^[0-9a-f-]{36}$/);
  await waitFor(() => expect(repo.listFindingRecords).toHaveBeenCalledTimes(2));
  expect(repo.listActions).toHaveBeenCalledTimes(2);
  // Home's House standings preview and the leaderboards are refreshed too.
  const invalidated = invalidateSpy.mock.calls.map(([key]) => JSON.stringify(key));
  expect(invalidated).toEqual(expect.arrayContaining(['["home"]', '["individual-leaderboard"]', '["house-detail","standings"]', '["leaderboard-years"]']));
});

it('retries with the same request id after a lost response, so nothing is written twice', async () => {
  repo.recover.mockRejectedValueOnce(new NetworkError('fetch failed'));
  renderPanel();
  const dialog = await openFinding('Linh Tran');
  await chooseRestoreTo(dialog, /Linh Tran/);
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /reviewed these changes/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't reach the server");

  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(repo.recover).toHaveBeenCalledTimes(2));
  expect(repo.recover.mock.calls[1][0].requestId).toBe(repo.recover.mock.calls[0][0].requestId);
});

it('stops when another admin changed the finding first', async () => {
  repo.recover.mockRejectedValueOnce(new DatabaseError('This finding changed since you opened it. Refresh and review it again.', 'P0001', '', 'stale_finding'));
  renderPanel();
  const dialog = await openFinding('Linh Tran');
  await chooseRestoreTo(dialog, /Linh Tran/);
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /reviewed these changes/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('changed since you opened it');
  expect(within(dialog).getByRole('button', { name: 'Apply' })).toBeDisabled();
});

it('shows that an already-credited member gets no second credit', async () => {
  renderPanel();
  repo.getEventAttendance.mockResolvedValue([{ member_id: 'm-linh', points_earned: 10 }]);
  const dialog = await openFinding('Linh Tran');
  await chooseRestoreTo(dialog, /Linh Tran/);
  expect(within(dialog).getByText(/No attendance added: Linh Tran already has attendance for Fall GBM/)).toBeInTheDocument();
});

it('creates a separate member only after confirming they differ from every suggestion, and blocks a held email', async () => {
  repo.searchMembers.mockResolvedValue([member('m-other', 'Linh', 'Tran', 'linh.new@gmail.com')]);
  renderPanel();
  const dialog = await openFinding('Linh Tran');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create separate member' }));
  expect(await within(dialog).findByLabelText('First name')).toHaveValue('Linh');
  expect(within(dialog).getByLabelText('Email (optional)')).toHaveValue('linh.new@gmail.com');

  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('different person from the suggested members');

  fireEvent.click(within(dialog).getByRole('checkbox', { name: /different person from every suggested member/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  expect(await within(dialog).findByText('This email belongs to an existing member:')).toBeInTheDocument();
  expect(repo.recover).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Create without email' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  expect(await within(dialog).findByText('Create member: Linh Tran, no email (Revelle, 2nd).')).toBeInTheDocument();
});

it('corrects a wrong match without removing the original credit, and flags it for investigation', async () => {
  renderPanel();
  const dialog = await openFinding('Kevin Lee');
  expect(await within(dialog).findByText('Credited to')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Match existing member' })).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Correct incorrect match' }));
  fireEvent.click(await within(dialog).findByRole('radio', { name: /Kevin Lee/ }));
  expect(within(dialog).queryByRole('radio', { name: /Remove it/ })).not.toBeInTheDocument();
  expect(within(dialog).getByText(/keeps their attendance/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /sheet row belongs/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  await within(dialog).findByText('Exact database changes');
  expect(within(dialog).getByText("Keep Kevin Le's attendance for Fall GBM and flag it for investigation. Nothing is removed.")).toBeInTheDocument();
  expect(within(dialog).getByText('Add attendance: Kevin Lee × Fall GBM, 10 points.')).toBeInTheDocument();
  expect(within(dialog).queryByText(/Remove attendance/)).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('checkbox', { name: /reviewed these changes/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(repo.recover).toHaveBeenCalled());
  expect(repo.recover.mock.calls[0][0]).toMatchObject({ action: 'reassign', memberId: 'm-lee', fromMemberId: 'm-le' });
  expect(repo.recover.mock.calls[0][0]).not.toHaveProperty('keepOriginal');
});

it('resolves an investigation only after the original credit is gone, via the Admin Members editor', async () => {
  const flagged: RecoveryActionRecord = {
    ...doneAction, id: 'act-flag', import_job_row_id: 'row-wrong', action: 'reassign', resulting_status: 'investigating',
    outcome: 'correct_member_credited', member_id: 'm-lee', from_member_id: 'm-le', reason_code: 'wrong_member_credited',
  };
  repo.listActions.mockResolvedValue([doneAction, flagged]);
  renderPanel();
  fireEvent.click(await screen.findByRole('tab', { name: /Original credit to investigate 1/ }));
  const dialog = await openFinding('Kevin Lee');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve investigation' }));
  fireEvent.click(within(dialog).getByRole('radio', { name: /original member did not attend/ }));
  fireEvent.change(within(dialog).getByLabelText(/Evidence for this decision/), { target: { value: 'Kevin Le was away' } });
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Review changes' })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  // The ledger still holds Kevin Le's credit (getEventAttendance mock), so the plan is refused.
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Remove it in Admin Members first');
  expect(repo.recover).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('button', { name: /Open Kevin Le's attendance in Admin Members/ }));
  expect(await screen.findByRole('dialog', { name: 'Admin Members attendance' })).toHaveTextContent('m-le');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
  expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
});

it('blocks identity decisions until candidate lookups load, and on failure offers a retry', async () => {
  let rejectMembers: (error: Error) => void = () => undefined;
  repo.getMembers.mockImplementation(() => new Promise((_resolve, reject) => { rejectMembers = reject; }));
  renderPanel();
  const dialog = await openFinding('Linh Tran');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create separate member' }));
  expect(within(dialog).getByRole('button', { name: 'Review changes' })).toBeDisabled();
  expect(within(dialog).getByText('Loading member details…')).toBeInTheDocument();

  rejectMembers(new Error('network down'));
  expect(await within(dialog).findByText(/identity cannot be checked/)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Review changes' })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  expect(repo.recover).not.toHaveBeenCalled();
});

it('dismissing does not wait for identity lookups', async () => {
  repo.getMembers.mockImplementation(() => new Promise(() => undefined));
  renderPanel();
  const dialog = await openFinding('Linh Tran');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Dismiss finding' }));
  expect(within(dialog).getByRole('button', { name: 'Review changes' })).toBeEnabled();
});

it('dismisses with a preserved reason', async () => {
  repo.recover.mockResolvedValue({
    action_id: 'act-3', status: 'dismissed', outcome: 'dismissed', member_id: null, from_member_id: null,
    created_member: false, attendance_id: null, points_awarded: 0, replayed: false,
  });
  renderPanel();
  const dialog = await openFinding('Linh Tran');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Dismiss finding' }));
  fireEvent.click(within(dialog).getByRole('radio', { name: /Legitimate duplicate/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  await within(dialog).findByText('No attendance or member changes.');
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /reviewed these changes/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(repo.recover).toHaveBeenCalled());
  expect(repo.recover.mock.calls[0][0]).toMatchObject({ action: 'dismiss', reasonCode: 'legitimate_duplicate' });
});

it('flags a recovered finding whose credit was later removed, and lets it reopen', async () => {
  repo.listFindingRecords.mockResolvedValue([{ ...recovered, recovered_credit_present: false }]);
  renderPanel();
  fireEvent.click(await screen.findByRole('tab', { name: /Recovered 1/ }));
  expect(screen.getByText(/later removed in Admin Members/)).toBeInTheDocument();
  const dialog = await openFinding('Anna Pham');
  expect(within(dialog).getByRole('button', { name: 'Reopen finding' })).toBeInTheDocument();
});

it('shows recovered findings read-only', async () => {
  renderPanel();
  fireEvent.click(await screen.findByRole('tab', { name: /Recovered 1/ }));
  const dialog = await openFinding('Anna Pham');
  expect(within(dialog).getByText(/This finding is recovered/)).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Review changes' })).not.toBeInTheDocument();
});

it('reports a permission failure instead of showing an empty list', async () => {
  repo.listFindingRecords.mockRejectedValue(new DatabaseError('Insufficient permissions', '42501'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent("You don't have permission to do that.");
});

it('asks for the different-person confirmation when same-name members exist but the audit listed no candidates', async () => {
  const bao = member('m-bao', 'Bao', 'Vo', 'bao@ucsd.edu');
  repo.listFindingRecords.mockResolvedValue([{ ...otherEvent, exact_name_members: 1, candidate_count: 0 }]);
  repo.getRowDetail.mockResolvedValue({
    id: 'row-other', raw_row: {}, match_details: {}, display_name: null, csv_email: null, csv_college: null, csv_year: null,
  });
  repo.searchMembers.mockImplementation(async (query) => (query === 'Bao Vo' ? [bao, member('m-bao-2', 'Baoan', 'Vo', 'baoan@ucsd.edu')] : []));
  renderPanel();
  const dialog = await openFinding('Bao Vo');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create separate member' }));
  expect(await within(dialog).findByText('Suggested matches')).toBeInTheDocument();
  expect(within(dialog).queryByText('Baoan Vo')).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('different person from the suggested members');
  expect(repo.recover).not.toHaveBeenCalled();
});
