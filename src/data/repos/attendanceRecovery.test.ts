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
    p_keep_original: false,
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

it('searches by email or by name without letting the term malform the filter', async () => {
  supabaseMock.setDefault('members', { data: [], error: null });
  await attendanceRecoveryRepository.searchMembers('Kevin.Le@ucsd.edu');
  await attendanceRecoveryRepository.searchMembers('Le,(x)');
  const [byEmail, byName] = supabaseMock.queriesFor('members');
  expect(byEmail.calls).toContainEqual({ method: 'ilike', args: ['email', '%Kevin.Le@ucsd.edu%'] });
  expect(byName.calls).toContainEqual({ method: 'ilike', args: ['first_name', '%Le%'] });
  expect(byName.calls.some((call) => call.method === 'or')).toBe(false);
});

it('checks existing attendance for exactly the event and members shown', async () => {
  supabaseMock.setDefault('member_event_attendance', { data: [{ member_id: 'm1', points_earned: 10 }], error: null });
  await attendanceRecoveryRepository.getEventAttendance('event-1', ['m1', 'm1', 'm2']);
  expect(supabaseMock.filtersFor('member_event_attendance')).toEqual(expect.arrayContaining([['event_id', 'event-1']]));
  expect(supabaseMock.queriesFor('member_event_attendance')[0].calls).toContainEqual({ method: 'in', args: ['member_id', ['m1', 'm2']] });
});
