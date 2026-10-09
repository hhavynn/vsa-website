import { attendanceRecoveryRepository } from './attendanceRecovery';
import { DatabaseError } from '../errors';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('sends every write through the single recovery function with the reviewed state', async () => {
  supabaseMock.setDefault('rpc:admin_recover_import_row', {
    data: { action_id: 'a1', status: 'recovered', outcome: 'attendance_added', points_awarded: 10, replayed: false },
    error: null,
  });
  await attendanceRecoveryRepository.recover({
    requestId: 'req-1',
    rowId: 'row-1',
    action: 'restore',
    expectedPreviousActionId: null,
    memberId: 'm1',
    note: '   ',
  });
  expect(supabaseMock.queriesFor('rpc:admin_recover_import_row')[0].calls[0].args[0]).toEqual({
    p_request_id: 'req-1',
    p_row_id: 'row-1',
    p_action: 'restore',
    p_expected_previous_action_id: null,
    p_member_id: 'm1',
    p_from_member_id: null,
    p_new_member: null,
    p_reason_code: null,
    p_note: null,
  });
  // No direct table writes from the client.
  expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  expect(supabaseMock.queriesFor('import_recovery_actions')).toHaveLength(0);
});

it('keeps the database hint so the UI can name the member holding an email', async () => {
  supabaseMock.setDefault('rpc:admin_recover_import_row', {
    data: null,
    error: postgrestError('A member already has this email.', 'P0001', '', 'email_in_use:m5'),
  });
  const failure = attendanceRecoveryRepository.recover({
    requestId: 'req-2', rowId: 'row-2', action: 'create_member', expectedPreviousActionId: null,
    newMember: { first_name: 'Kev', last_name: 'Le', email: 'kevin.le@ucsd.edu', college: '', year: '' },
  });
  await expect(failure).rejects.toBeInstanceOf(DatabaseError);
  await expect(failure).rejects.toMatchObject({ code: 'P0001', hint: 'email_in_use:m5' });
});

it('reads findings from the admin function as one array', async () => {
  supabaseMock.setDefault('rpc:admin_import_recovery_findings', { data: [{ row_id: 'r1' }], error: null });
  await expect(attendanceRecoveryRepository.listFindingRecords()).resolves.toEqual([{ row_id: 'r1' }]);
});

it('pages recovery history past the row cap', async () => {
  const page = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
  supabaseMock.queueResult('import_recovery_actions', { data: page, error: null });
  supabaseMock.queueResult('import_recovery_actions', { data: [{ id: 'last' }], error: null });
  await expect(attendanceRecoveryRepository.listActions()).resolves.toHaveLength(1001);
  expect(supabaseMock.queriesFor('import_recovery_actions')).toHaveLength(2);
});

// Attendee emails and names must travel in a POST body (supabase.rpc), never in
// a GET filter on members, where they would land in the Supabase API logs.
function rpcArgs(fn: string): unknown[] {
  return supabaseMock.queriesFor(`rpc:${fn}`).map((query) => query.calls[0].args[0]);
}

it('looks members up by email through the POST lookup function, normalized and de-duplicated', async () => {
  const kevin = { id: 'm1', first_name: 'Kevin', last_name: 'Le', email: 'kevin.le@ucsd.edu' };
  supabaseMock.setDefault('rpc:admin_lookup_members', { data: [kevin], error: null });
  await expect(attendanceRecoveryRepository.getMembersByEmails([' Kevin.Le@UCSD.edu ', 'kevin.le@ucsd.edu', 'a_b,(c)@x.edu', ''])).resolves.toEqual([kevin]);
  expect(rpcArgs('admin_lookup_members')).toEqual([{ p_emails: ['kevin.le@ucsd.edu', 'a_b,(c)@x.edu'], p_surnames: [] }]);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('looks members up by surname through the POST lookup function', async () => {
  supabaseMock.setDefault('rpc:admin_lookup_members', { data: [], error: null });
  await attendanceRecoveryRepository.findMembersBySurnames(['Nguyen', ' nguyen', 'Tran%', '']);
  expect(rpcArgs('admin_lookup_members')).toEqual([{ p_emails: [], p_surnames: ['nguyen', 'tran%'] }]);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('splits large lookups under the function cap and returns each member once', async () => {
  const shared = { id: 'm1', first_name: 'An', last_name: 'Nguyen', email: null };
  supabaseMock.queueResult('rpc:admin_lookup_members', { data: [shared], error: null });
  supabaseMock.queueResult('rpc:admin_lookup_members', { data: [shared, { ...shared, id: 'm2' }], error: null });
  const surnames = Array.from({ length: 501 }, (_, i) => `name${i}`);
  await expect(attendanceRecoveryRepository.findMembersBySurnames(surnames)).resolves.toHaveLength(2);
  const calls = rpcArgs('admin_lookup_members') as Array<{ p_surnames: string[] }>;
  expect(calls.map((args) => args.p_surnames.length)).toEqual([500, 1]);
});

it('skips the lookup call when there is nothing to look up', async () => {
  await expect(attendanceRecoveryRepository.getMembersByEmails(['  '])).resolves.toEqual([]);
  await expect(attendanceRecoveryRepository.findMembersBySurnames([])).resolves.toEqual([]);
  expect(supabaseMock.queriesFor('rpc:admin_lookup_members')).toHaveLength(0);
});

it('surfaces a refused lookup as a database error instead of an empty result', async () => {
  supabaseMock.setDefault('rpc:admin_lookup_members', { data: null, error: postgrestError('Only admins can look up members', '42501') });
  await expect(attendanceRecoveryRepository.getMembersByEmails(['kevin.le@ucsd.edu'])).rejects.toBeInstanceOf(DatabaseError);
});

it('searches by email or by name through the POST search function', async () => {
  supabaseMock.setDefault('rpc:admin_search_members', { data: [{ id: 'm1' }], error: null });
  await expect(attendanceRecoveryRepository.searchMembers('Kevin.Le@ucsd.edu')).resolves.toEqual([{ id: 'm1' }]);
  await attendanceRecoveryRepository.searchMembers('Le,(x)', 25);
  expect(rpcArgs('admin_search_members')).toEqual([
    { p_query: 'Kevin.Le@ucsd.edu', p_limit: 10 },
    { p_query: 'Le,(x)', p_limit: 25 },
  ]);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('does not call search for a query under two characters', async () => {
  await expect(attendanceRecoveryRepository.searchMembers(' a,( ')).resolves.toEqual([]);
  expect(supabaseMock.queriesFor('rpc:admin_search_members')).toHaveLength(0);
});

it('checks existing attendance for exactly the event and members shown', async () => {
  supabaseMock.setDefault('member_event_attendance', { data: [{ member_id: 'm1', points_earned: 10 }], error: null });
  await attendanceRecoveryRepository.getEventAttendance('event-1', ['m1', 'm1', 'm2']);
  expect(supabaseMock.filtersFor('member_event_attendance')).toEqual(expect.arrayContaining([['event_id', 'event-1']]));
  expect(supabaseMock.queriesFor('member_event_attendance')[0].calls).toContainEqual({ method: 'in', args: ['member_id', ['m1', 'm2']] });
});
