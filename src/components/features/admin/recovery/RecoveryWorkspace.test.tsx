import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { RecoveryWorkspace } from './RecoveryWorkspace';
import { attendanceRecoveryRepository, RecoverRequest } from '../../../../data/repos/attendanceRecovery';
import { DatabaseError, NetworkError } from '../../../../data/errors';
import type { MemberSnapshot, RecoveryActionRecord, RecoveryFindingRecord } from '../../../../lib/attendanceRecovery';

jest.mock('../../../../data/repos/attendanceRecovery', () => ({
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
    findMembersBySurnames: jest.fn(),
    getMembersByEmails: jest.fn(),
    listRoster: jest.fn(),
    getEventAttendanceMemberIds: jest.fn(),
    getAttendanceForMembers: jest.fn(),
    getEventsPoints: jest.fn(),
  },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('../MemberAttendanceModal', () => ({ MemberAttendanceModal: () => null }));

const repo = attendanceRecoveryRepository as jest.Mocked<typeof attendanceRecoveryRepository>;

// Synthetic people only.
const base: RecoveryFindingRecord = {
  row_id: 'r-linh', import_job_id: 'job-1', job_status: 'completed', job_created_at: '2026-05-23T00:00:00Z',
  event_id: 'ev-1', event_name: 'Fall GBM', event_date: '2026-05-22T12:00:00Z', source_row_index: 1,
  decision: 'review', display_name: 'Linh Tran', csv_email: 'linh.tran@ucsd.edu', csv_college: 'Revelle', csv_year: '2nd',
  attendance_member_id: null, matched_member_id: null, match_reason: 'ambiguous_match', final_reason: null, match_method: null,
  manual_decision: null, name_score: 92, candidate_count: 2, can_mark_new: true, has_csv_email: true, attendance_exists: null,
  matched_member_attended: false, email_member_attended: false, candidate_attended: false, resolved_elsewhere: false,
  duplicate_twin_attended: null, email_in_members: true, exact_name_members: 2, email_conflict: false,
  email_conflict_both_school: false, year_differs: false, college_differs: false, recovered_credit_present: null,
  original_credit_present: null, created_member_id: null, candidate_member_ids: ['m-linh', 'm-linh2'],
};
const rows: RecoveryFindingRecord[] = [
  base,
  { ...base, row_id: 'r-bao', source_row_index: 2, display_name: 'Bao Vo', csv_email: 'bao.new@gmail.com', candidate_count: 0, candidate_member_ids: [], email_in_members: false, exact_name_members: 0 },
  { ...base, row_id: 'r-anna', source_row_index: 3, display_name: 'Anna Pham', csv_email: 'anna.p@gmail.com', candidate_count: 1, candidate_member_ids: ['m-anna'], email_in_members: false, exact_name_members: 0 },
  { ...base, row_id: 'r-kim', source_row_index: 4, decision: 'skipped_duplicate', display_name: 'Kim Ho', csv_email: null, has_csv_email: false, candidate_count: 0, candidate_member_ids: [], email_in_members: false, exact_name_members: 0 },
  {
    ...base, row_id: 'r-wrong', source_row_index: 5, decision: 'matched', display_name: 'Kevin Lee', csv_email: 'kevlee@ucsd.edu',
    attendance_member_id: 'm-le', matched_member_id: 'm-le', attendance_exists: true, match_method: 'fuzzy_name', name_score: 70,
    email_conflict: true, email_conflict_both_school: true, candidate_count: 1, candidate_member_ids: ['m-lee'], email_in_members: true, exact_name_members: 1,
  },
  { ...base, row_id: 'r-vy', import_job_id: 'job-2', event_id: 'ev-2', event_name: 'Winter Social', event_date: '2026-01-10T12:00:00Z', source_row_index: 1, display_name: 'Vy Do', csv_email: 'vy@gmail.com', candidate_count: 0, candidate_member_ids: [], email_in_members: false, exact_name_members: 0 },
];

const member = (id: string, first: string, last: string, email: string, points = 10, college = 'Revelle'): MemberSnapshot => ({
  id, first_name: first, last_name: last, email, college, year: '2nd', points, events_attended: 1,
});
let members: MemberSnapshot[] = [];
let attendedEv1 = new Set<string>();
let actions: RecoveryActionRecord[] = [];

function resetData() {
  members = [
    member('m-linh', 'Linh', 'Tran', 'linh.tran@ucsd.edu', 20),
    member('m-linh2', 'Linh', 'Tran', 'linh.t@gmail.com', 5, 'Muir'),
    member('m-anna', 'Ana', 'Pham', 'ana@ucsd.edu'),
    member('m-le', 'Kevin', 'Le', 'kevin.le@ucsd.edu'),
    member('m-lee', 'Kevin', 'Lee', 'kevlee@ucsd.edu', 0),
  ];
  attendedEv1 = new Set(['m-le']);
  actions = [];
}

function okResult(request: RecoverRequest, overrides = {}) {
  return {
    action_id: `act-${request.rowId}`, status: request.action === 'reassign' ? 'investigating' : request.action === 'dismiss' ? 'dismissed' : request.action === 'needs_info' ? 'needs_info' : 'recovered',
    outcome: request.action === 'dismiss' ? 'dismissed' : request.action === 'needs_info' ? 'needs_info' : request.action === 'reassign' ? 'correct_member_credited' : 'attendance_added',
    member_id: request.memberId ?? null, from_member_id: request.fromMemberId ?? null, created_member: request.action === 'create_member',
    attendance_id: 'att', points_awarded: ['restore', 'create_member', 'reassign'].includes(request.action) ? 10 : 0, replayed: false, ...overrides,
  } as Awaited<ReturnType<typeof repo.recover>>;
}

let records: RecoveryFindingRecord[] = rows;

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  resetData();
  records = rows;
  repo.listFindingRecords.mockImplementation(async () => records);
  repo.listActions.mockImplementation(async () => actions);
  repo.getMembers.mockImplementation(async (ids) => members.filter((m) => ids.includes(m.id)));
  repo.findMembersBySurnames.mockImplementation(async (terms) => members.filter((m) => terms.some((t) => m.last_name.toLowerCase().endsWith(t))));
  repo.getMembersByEmails.mockImplementation(async (emails) => members.filter((m) => emails.map((e) => e.toLowerCase()).includes((m.email ?? '').toLowerCase())));
  repo.listRoster.mockImplementation(async () => members);
  repo.getEventAttendanceMemberIds.mockImplementation(async (eventId) => (eventId === 'ev-1' ? Array.from(attendedEv1) : []));
  repo.getEventAttendance.mockImplementation(async (eventId, ids) => (eventId === 'ev-1' ? ids.filter((id) => attendedEv1.has(id)).map((id) => ({ member_id: id, points_earned: 10 })) : []));
  repo.getEventsPoints.mockImplementation(async (ids) => new Map(ids.map((id) => [id, id === 'ev-2' ? 15 : 10])));
  repo.getAttendanceForMembers.mockImplementation(async (ids) => members.filter((m) => ids.includes(m.id)).map((m) => ({ member_id: m.id, event_id: 'x', points_earned: m.points })));
  repo.searchMembers.mockImplementation(async (query) => members.filter((m) => `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(query.toLowerCase())));
  repo.getRowDetail.mockImplementation(async (id) => ({ id, raw_row: {}, match_details: {}, display_name: null, csv_email: null, csv_college: null, csv_year: null }));
  repo.getRecentAttendance.mockResolvedValue([]);
  repo.getEventPoints.mockResolvedValue(10);
  repo.recover.mockImplementation(async (request) => okResult(request));
});

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><RecoveryWorkspace /></QueryClientProvider>);
  return { client, invalidate };
}

const findRow = (name: string) => screen.findByRole('row', { name: new RegExp(`^${name},`) });
const toolbar = () => screen.getByRole('region', { name: 'Batch actions' });
/** The per-row result line in the batch result. */
const resultLine = (dialog: HTMLElement, label: RegExp) =>
  within(dialog).getByText((_, element) => element?.tagName === 'LI' && label.test(element.textContent ?? ''));

async function waitForLookups(name = 'Linh Tran') {
  const row = await findRow(name);
  await waitFor(() => expect(within(row).queryByText('Loading members…')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'false'));
  return row;
}

async function stageMatch(name: string, option: RegExp, search?: string) {
  const row = await findRow(name);
  fireEvent.click(within(row).getByRole('button', { name: /^Match…|^Credit correct…/ }));
  if (search) fireEvent.change(within(row).getByRole('combobox'), { target: { value: search } });
  fireEvent.click(await within(row).findByRole('option', { name: option }));
  fireEvent.click(within(row).getByRole('checkbox', { name: /verified/ }));
  fireEvent.click(within(row).getByRole('button', { name: /Stage (match|correction)/ }));
}

async function stageCreate(name: string, email?: string) {
  const row = await findRow(name);
  fireEvent.click(within(row).getByRole('button', { name: 'New member…' }));
  if (email !== undefined) fireEvent.change(within(row).getByLabelText('Email (optional)'), { target: { value: email } });
  const different = within(row).queryByRole('checkbox', { name: /different person from every member listed/ });
  if (different) fireEvent.click(different);
  fireEvent.click(within(row).getByRole('checkbox', { name: /new person who is not already a member/ }));
  fireEvent.click(within(row).getByRole('button', { name: 'Stage new member' }));
}

async function stageHold(name: string, note = 'Need the sheet') {
  const row = await findRow(name);
  fireEvent.click(within(row).getByRole('button', { name: 'Hold…' }));
  fireEvent.change(within(row).getByLabelText(/What is missing/), { target: { value: note } });
  fireEvent.click(within(row).getByRole('button', { name: 'Stage hold' }));
}

async function openReview() {
  fireEvent.click(within(toolbar()).getByRole('button', { name: /Review & apply/ }));
  const dialog = await screen.findByRole('alertdialog');
  await within(dialog).findByText(/Checked against the database/);
  return dialog;
}

async function applyReview(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /reviewed these/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: /^Apply \d+ change/ }));
  await within(dialog).findByText(/Batch result/);
}

// 1
it('stages several inline decisions at once without writing anything', async () => {
  renderWorkspace();
  await waitForLookups();
  await stageMatch('Linh Tran', /linh\.tran@ucsd\.edu/);
  await stageCreate('Bao Vo');
  const kim = await findRow('Kim Ho');
  fireEvent.click(within(kim).getByRole('button', { name: 'Dismiss…' }));
  fireEvent.click(within(kim).getByRole('radio', { name: /Intentionally skipped/ }));
  fireEvent.click(within(kim).getByRole('button', { name: 'Stage dismissal' }));

  expect(toolbar()).toHaveTextContent('3 staged');
  expect(within(await findRow('Linh Tran')).getByText('Match → Linh Tran')).toBeInTheDocument();
  expect(within(await findRow('Bao Vo')).getByText('New member: Bao Vo')).toBeInTheDocument();
  expect(within(await findRow('Kim Ho')).getByText('Dismiss: Intentionally skipped')).toBeInTheDocument();
  expect(repo.recover).not.toHaveBeenCalled();
});

// 2
it('undoes one staged decision without losing the others, and can undo the undo', async () => {
  renderWorkspace();
  await waitForLookups();
  await stageCreate('Bao Vo');
  await stageHold('Kim Ho');
  await stageHold('Anna Pham');
  fireEvent.click(within(await findRow('Kim Ho')).getByRole('button', { name: 'Undo' }));
  expect(toolbar()).toHaveTextContent('2 staged');
  expect(within(await findRow('Bao Vo')).getByText('New member: Bao Vo')).toBeInTheDocument();
  expect(within(await findRow('Anna Pham')).getByText(/Hold:/)).toBeInTheDocument();
  fireEvent.click(within(toolbar()).getByRole('button', { name: 'Undo last' }));
  expect(toolbar()).toHaveTextContent('3 staged');
});

// 3
it('keeps staged work when switching events, and it survives a remount in this tab', async () => {
  const { client } = renderWorkspace();
  await waitForLookups();
  await stageCreate('Bao Vo');
  fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'ev-2' } });
  await stageCreate('Vy Do');
  expect(toolbar()).toHaveTextContent('2 staged across 2 events');
  expect(screen.getByRole('option', { name: /Fall GBM .* 1 staged/ })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'ev-1' } });
  expect(within(await findRow('Bao Vo')).getByText('New member: Bao Vo')).toBeInTheDocument();

  // Navigating away and back (unmount/remount) resumes the staged work.
  const { unmount } = render(<QueryClientProvider client={client}><RecoveryWorkspace /></QueryClientProvider>);
  unmount();
  expect(JSON.parse(window.sessionStorage.getItem('vsa.recovery-staging.v1.admin-1') ?? '{}').decisions).toHaveLength(2);
});

// 4
it('applies a batch of valid recoveries through the per-row writer with frozen requests, then refreshes once', async () => {
  const { invalidate } = renderWorkspace();
  await waitForLookups();
  await stageMatch('Linh Tran', /linh\.tran@ucsd\.edu/);
  await stageCreate('Bao Vo');
  await stageHold('Kim Ho');
  const staged = JSON.parse(window.sessionStorage.getItem('vsa.recovery-staging.v1.admin-1') ?? '{}').decisions as Array<{ rowId: string; payload: RecoverRequest }>;

  const dialog = await openReview();
  expect(within(dialog).getByText('Existing members receiving missing attendance (1)')).toBeInTheDocument();
  expect(within(dialog).getByText('New members to be created (1)')).toBeInTheDocument();
  expect(within(dialog).getByText('Add attendance: Linh Tran × Fall GBM, 10 points (expected).')).toBeInTheDocument();
  expect(within(dialog).getByText(/Linh Tran: 20 → 30 pts/)).toBeInTheDocument();
  expect(within(dialog).getByText((_, element) => element?.tagName === 'DIV' && element.textContent === 'Attendance removed0')).toBeInTheDocument();

  await applyReview(dialog);
  expect(repo.recover).toHaveBeenCalledTimes(3);
  const sent = repo.recover.mock.calls.map(([request]) => request);
  expect(sent).toEqual(expect.arrayContaining(staged.map((d) => d.payload)));
  expect(within(dialog).getByText(/Applied all 3 changes\. 20 points awarded\. 1 member created\./)).toBeInTheDocument();
  expect(within(dialog).getByText(/cached total matches their attendance/)).toBeInTheDocument();
  expect(toolbar()).toHaveTextContent('0 staged');
  const keys = invalidate.mock.calls.map(([key]) => JSON.stringify(key));
  expect(keys.filter((k) => k === '["attendance-recovery"]')).toHaveLength(1);
  expect(keys).toEqual(expect.arrayContaining(['["individual-leaderboard"]', '["house-detail","standings"]']));
});

// 5
it('reports mixed success and failure per row and keeps only the failures staged', async () => {
  repo.recover.mockImplementation(async (request) => {
    if (request.rowId === 'r-kim') throw new DatabaseError('Rows from a failed import cannot be recovered here; re-run the import', 'P0001');
    return okResult(request);
  });
  renderWorkspace();
  await waitForLookups();
  await stageCreate('Bao Vo');
  await stageHold('Kim Ho');
  await stageHold('Anna Pham');
  const dialog = await openReview();
  await applyReview(dialog);
  expect(within(dialog).getByText(/Applied 2 of 3 changes\. 1 failed; those rows stay staged\./)).toBeInTheDocument();
  expect(resultLine(dialog, /Kim Ho \(row 6\)/)).toHaveTextContent(/failed: Rows from a failed import/);
  expect(toolbar()).toHaveTextContent('1 staged');
  expect(toolbar()).toHaveTextContent('1 need attention');
  expect(within(await findRow('Kim Ho')).getByText(/Not applied: Rows from a failed import/)).toBeInTheDocument();
});

// 6
it('treats already-recorded attendance as no points and requires an explicit acknowledgement', async () => {
  renderWorkspace();
  const anna = await waitForLookups('Anna Pham');
  fireEvent.click(within(anna).getByRole('button', { name: 'Match…' }));
  fireEvent.change(within(anna).getByRole('combobox'), { target: { value: 'Kevin Le' } });
  fireEvent.click(await within(anna).findByRole('option', { name: /kevin\.le@ucsd\.edu/ }));
  expect(within(anna).getByText(/Kevin Le already has attendance for this event/)).toBeInTheDocument();
  fireEvent.click(within(anna).getByRole('checkbox', { name: /verified/ }));
  fireEvent.click(within(anna).getByRole('button', { name: 'Stage match' }));

  const dialog = await openReview();
  expect(within(dialog).getByText('Already-recorded attendance (no points) (1)')).toBeInTheDocument();
  expect(within(dialog).getByText(/No attendance added: Kevin Le already has Fall GBM/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /reviewed these/ }));
  expect(within(dialog).getByRole('button', { name: /^Apply 0 changes/ })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /permanent for this finding/ }));
  expect(within(dialog).getByRole('button', { name: /^Apply 1 change/ })).toBeEnabled();
});

// 7
it('shows enough evidence to tell identical names apart and never preselects a suggestion', async () => {
  renderWorkspace();
  const row = await waitForLookups();
  expect(within(row).getAllByText('Identical name to another member').length).toBeGreaterThan(0);
  fireEvent.click(within(row).getByRole('button', { name: 'Match…' }));
  const options = await within(row).findAllByRole('option');
  expect(options).toHaveLength(2);
  expect(options[0]).toHaveTextContent('Email matches the row');
  expect(options[1]).toHaveTextContent('Different email');
  expect(options[1]).toHaveTextContent('College differs');
  expect(within(row).queryByText('Confirm the match')).not.toBeInTheDocument();
  fireEvent.click(options[1]);
  expect(within(row).getByRole('button', { name: 'Stage match' })).toBeDisabled();
});

// 8
it('blocks new members whose email is duplicated in the batch or already on file', async () => {
  renderWorkspace();
  await waitForLookups();
  await stageCreate('Bao Vo', 'same@x.com');
  await stageCreate('Anna Pham', 'same@x.com');
  fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'ev-2' } });
  await stageCreate('Vy Do', 'kevlee@ucsd.edu');
  const dialog = await openReview();
  expect(within(dialog).getByText('Cannot be safely applied (3)')).toBeInTheDocument();
  expect(within(dialog).getAllByText(/Another staged new member has this email/)).toHaveLength(2);
  expect(within(dialog).getByText(/Kevin Lee already has this email/)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /^Apply 0 changes/ })).toBeDisabled();
});

// 9
it('asks to re-confirm when the member changed before submission', async () => {
  renderWorkspace();
  await waitForLookups();
  await stageMatch('Linh Tran', /linh\.tran@ucsd\.edu/);
  members = members.map((m) => (m.id === 'm-linh' ? { ...m, college: 'Sixth' } : m));
  const dialog = await openReview();
  expect(within(dialog).getByText(/changed since you staged this/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: /I re-verified/ }));
  expect(await within(dialog).findByText('Existing members receiving missing attendance (1)')).toBeInTheDocument();
  await applyReview(dialog);
  expect(repo.recover).toHaveBeenCalledWith(expect.objectContaining({ rowId: 'r-linh', memberId: 'm-linh' }));
});

// 10
it('blocks a row another admin acted on, and reports a conflict that happens during apply', async () => {
  renderWorkspace();
  await waitForLookups();
  await stageHold('Kim Ho');
  await stageHold('Anna Pham');
  actions = [{
    id: 'act-other', request_id: 'req-other', import_job_row_id: 'r-kim', previous_action_id: null, action: 'dismiss', resulting_status: 'dismissed',
    outcome: 'dismissed', event_id: 'ev-1', member_id: null, from_member_id: null, created_member: false, attendance_id: null,
    points_awarded: 0, reason_code: 'intentional_skip', note: null, actor_user_id: 'admin-2', created_at: '2026-10-08T00:00:00Z',
  }];
  repo.recover.mockImplementation(async (request) => {
    if (request.rowId === 'r-anna') throw new DatabaseError('This finding changed since you opened it. Refresh and review it again.', 'P0001', '', 'stale_finding');
    return okResult(request);
  });
  const dialog = await openReview();
  expect(within(dialog).getByText(/Changed since you staged it/)).toBeInTheDocument();
  await applyReview(dialog);
  expect(repo.recover).toHaveBeenCalledTimes(1);
  expect(resultLine(dialog, /Anna Pham \(row 5\)/)).toHaveTextContent(/conflict: This finding changed/);
});

// 11
it('never writes twice on repeated submissions: a lost response is replayed or recognized as applied', async () => {
  repo.recover.mockRejectedValueOnce(new NetworkError('fetch failed'));
  renderWorkspace();
  await waitForLookups();
  await stageHold('Kim Ho');
  let dialog = await openReview();
  await applyReview(dialog);
  expect(within(dialog).getByText(/1 with no answer/)).toBeInTheDocument();
  const firstRequest = repo.recover.mock.calls[0][0];
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(within(await findRow('Kim Ho')).getByText(/No answer last time/)).toBeInTheDocument();
  expect(within(await findRow('Kim Ho')).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();

  // Second submission: it never reached the database, so the same request is sent again.
  repo.recover.mockImplementationOnce(async (request) => okResult(request, { replayed: true }));
  dialog = await openReview();
  await applyReview(dialog);
  expect(repo.recover.mock.calls[1][0]).toEqual(firstRequest);
  expect(within(dialog).getByText(/had already been applied, so nothing was written twice/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

  // Third case: the write committed but the answer was lost; the history proves it.
  repo.recover.mockRejectedValueOnce(new NetworkError('fetch failed'));
  await stageHold('Anna Pham');
  dialog = await openReview();
  await applyReview(dialog);
  const lost = repo.recover.mock.calls[2][0];
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  actions = [{
    id: 'act-lost', request_id: lost.requestId, import_job_row_id: 'r-anna', previous_action_id: null, action: 'needs_info', resulting_status: 'needs_info',
    outcome: 'needs_info', event_id: 'ev-1', member_id: null, from_member_id: null, created_member: false, attendance_id: null,
    points_awarded: 0, reason_code: 'more_info_needed', note: 'Need the sheet', actor_user_id: 'admin-1', created_at: '2026-10-08T00:00:00Z',
  }];
  fireEvent.click(within(toolbar()).getByRole('button', { name: /Review & apply/ }));
  const third = await screen.findByRole('alertdialog');
  expect(await within(third).findByText(/already applied earlier \(the response was lost\)/)).toBeInTheDocument();
  expect(repo.recover).toHaveBeenCalledTimes(3);
});

// 12
it('handles a risky incorrect-match row in a batch without removing the original credit', async () => {
  renderWorkspace();
  await waitForLookups('Kevin Lee');
  const wrong = await findRow('Kevin Lee');
  expect(within(wrong).getByText('Possible incorrect original match')).toBeInTheDocument();
  expect(within(wrong).queryByRole('button', { name: 'Match…' })).not.toBeInTheDocument();
  await stageMatch('Kevin Lee', /kevlee@ucsd\.edu/);
  expect(within(await findRow('Kevin Lee')).getByText(/Credit Kevin Lee; keep original for investigation/)).toBeInTheDocument();
  await stageMatch('Linh Tran', /linh\.tran@ucsd\.edu/);
  const dialog = await openReview();
  expect(within(dialog).getByText(/Incorrect matches: correct member credited, original kept for investigation \(1\)/)).toBeInTheDocument();
  expect(within(dialog).getByText("Keep Kevin Le's attendance and flag it for investigation. Nothing is removed.")).toBeInTheDocument();
  await applyReview(dialog);
  expect(repo.recover).toHaveBeenCalledWith(expect.objectContaining({ action: 'reassign', memberId: 'm-lee', fromMemberId: 'm-le' }));
  expect(repo.recover.mock.calls.every(([r]) => ['reassign', 'restore'].includes(r.action))).toBe(true);
});

// 13
it('shows a permission error to non-admins instead of an empty workspace, and reports a refused write as failed', async () => {
  repo.listFindingRecords.mockRejectedValueOnce(new DatabaseError('Insufficient permissions', '42501'));
  const { unmount } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RecoveryWorkspace /></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent("You don't have permission to do that.");
  expect(screen.queryByRole('region', { name: 'Batch actions' })).not.toBeInTheDocument();
  unmount();

  repo.recover.mockRejectedValue(new DatabaseError('Only admins can recover historical attendance', '42501'));
  renderWorkspace();
  await waitForLookups();
  await stageHold('Kim Ho');
  const dialog = await openReview();
  await applyReview(dialog);
  expect(resultLine(dialog, /Kim Ho \(row 6\)/)).toHaveTextContent("failed: You don't have permission to do that.");
});

// 14
it('supports keyboard review without hijacking typing, and labels everything for screen readers', async () => {
  renderWorkspace();
  const first = await waitForLookups();
  expect(screen.getByRole('grid', { name: 'Findings for Fall GBM' })).toBeInTheDocument();
  act(() => first.focus());
  fireEvent.keyDown(first, { key: 'j' });
  const second = screen.getAllByRole('row')[2];
  expect(second).toHaveFocus();
  fireEvent.keyDown(second, { key: 'x' });
  expect(within(second).getByRole('checkbox', { name: /^Select / })).toBeChecked();
  fireEvent.keyDown(second, { key: 'n' });
  const note = within(second).getByLabelText(/What is missing/);
  expect(note).toHaveFocus();
  fireEvent.keyDown(note, { key: 'j' });
  expect(note).toHaveFocus();
  fireEvent.keyDown(note, { key: 'Escape' });
  expect(within(second).queryByLabelText(/What is missing/)).not.toBeInTheDocument();
  fireEvent.keyDown(second, { key: '?' });
  expect(screen.getByLabelText('Keyboard shortcuts')).toBeInTheDocument();
  fireEvent.keyDown(second, { key: 'k' });
  expect(screen.getAllByRole('row')[1]).toHaveFocus();
});

// 15
it('handles hundreds of findings with pagination and batched lookups, not per-row requests', async () => {
  records = Array.from({ length: 300 }, (_, i) => ({
    ...base, row_id: `big-${i}`, source_row_index: i, display_name: `Person ${i} Nguyen`, csv_email: `p${i}@gmail.com`,
    candidate_member_ids: i % 3 === 0 ? ['m-linh'] : [], candidate_count: i % 3 === 0 ? 1 : 0, email_in_members: i % 5 === 0, exact_name_members: 0,
  }));
  renderWorkspace();
  await screen.findByText('Rows 1–50 of 300');
  expect(screen.getAllByRole('row')).toHaveLength(51);
  await waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'false'));
  expect(repo.getMembers.mock.calls.length).toBeLessThanOrEqual(2);
  expect(repo.findMembersBySurnames.mock.calls.length).toBeLessThanOrEqual(2);
  expect(repo.getEventAttendanceMemberIds).toHaveBeenCalledTimes(1);
  expect(within(toolbar()).getByRole('button', { name: 'Select visible (50)' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('Rows 51–100 of 300')).toBeInTheDocument();
});

// 16
it('keeps progress counters accurate and shows the applied changes in recovery history', async () => {
  renderWorkspace();
  await waitForLookups();
  const counts = screen.getByLabelText('Counts for this event');
  expect(counts).toHaveTextContent('5 total');
  // Insufficient-evidence rows (Kim Ho) start under "needs more information".
  expect(counts).toHaveTextContent('4 unresolved');
  expect(counts).toHaveTextContent('1 need info');
  expect(screen.getByRole('progressbar', { name: 'Fall GBM completion' })).toHaveAttribute('aria-valuenow', '0');
  await stageHold('Anna Pham');
  expect(counts).toHaveTextContent('1 staged');

  // After apply, the refetched history moves the row to "needs info".
  repo.recover.mockImplementation(async (request) => {
    actions = [{
      id: 'act-new', request_id: request.requestId, import_job_row_id: request.rowId, previous_action_id: null, action: 'needs_info',
      resulting_status: 'needs_info', outcome: 'needs_info', event_id: 'ev-1', member_id: null, from_member_id: null, created_member: false,
      attendance_id: null, points_awarded: 0, reason_code: 'more_info_needed', note: 'Need the sheet', actor_user_id: 'admin-1', created_at: '2026-10-08T01:00:00Z',
    }];
    return okResult(request);
  });
  const dialog = await openReview();
  await applyReview(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.getByLabelText('Counts for this event')).toHaveTextContent('2 need info'));
  expect(screen.getByLabelText('Counts for this event')).toHaveTextContent('3 unresolved');
  expect(screen.getByLabelText('Counts for this event')).toHaveTextContent('0 staged');
  fireEvent.click(screen.getByRole('tab', { name: 'Recovery history' }));
  expect(screen.getByRole('list', { name: 'Recovery history' })).toHaveTextContent(/On hold · Anna Pham · Fall GBM · row 5/);
});

it('stages homogeneous bulk decisions only for qualifying rows and says why others were skipped', async () => {
  renderWorkspace();
  await waitForLookups();
  fireEvent.click(within(toolbar()).getByRole('button', { name: 'Select visible (5)' }));
  fireEvent.click(within(toolbar()).getByRole('button', { name: 'New members…' }));
  expect(toolbar()).toHaveTextContent('New members for selected: 1 of 5 selected rows qualify');
  fireEvent.click(within(toolbar()).getByText(/4 skipped/));
  expect(toolbar()).toHaveTextContent(/Kim Ho \(row 6\): No email on the row/);
  fireEvent.click(within(toolbar()).getByRole('button', { name: 'Stage for 1 row' }));
  expect(within(toolbar()).getByRole('alert')).toHaveTextContent('Confirm these attendees are new people.');
  fireEvent.click(within(toolbar()).getByRole('checkbox', { name: /confirm each is a new person/ }));
  fireEvent.click(within(toolbar()).getByRole('button', { name: 'Stage for 1 row' }));
  expect(toolbar()).toHaveTextContent('1 staged');
  expect(within(await findRow('Bao Vo')).getByText('New member: Bao Vo')).toBeInTheDocument();

  fireEvent.click(within(toolbar()).getByRole('button', { name: 'Select visible (5)' }));
  fireEvent.click(within(toolbar()).getByRole('button', { name: 'Hold…' }));
  fireEvent.change(within(toolbar()).getByLabelText(/What is missing/), { target: { value: 'Need officer confirmation' } });
  fireEvent.click(within(toolbar()).getByRole('button', { name: /Stage for 5 rows/ }));
  expect(toolbar()).toHaveTextContent('5 staged');
  expect(repo.recover).not.toHaveBeenCalled();
});
