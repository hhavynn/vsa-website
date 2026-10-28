/**
 * Attendance status repository (#653): one admin RPC to read, one to record a
 * statement; a missing function becomes a plain "apply the migration" message
 * and every other error is surfaced, never turned into an empty list.
 */
import { attendanceReadinessRepository, ATTENDANCE_READINESS_UNAVAILABLE } from './attendanceReadiness';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('reads through the admin RPC with year and term', async () => {
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', {
    data: { events: [], total_events: 0, truncated: false, checked_at: '2026-10-28T00:00:00Z' }, error: null,
  });
  await expect(attendanceReadinessRepository.getReadiness(2026, 'term')).resolves.toEqual({ events: [], totalEvents: 0, truncated: false, checkedAt: '2026-10-28T00:00:00Z' });
  expect(supabaseMock.queriesFor('rpc:admin_event_attendance_readiness')[0].calls[0].args).toEqual([{ p_year: 2026, p_term_id: 'term' }]);
});

it('explains a missing function instead of returning nothing', async () => {
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', { data: null, error: postgrestError('missing', 'PGRST202') });
  await expect(attendanceReadinessRepository.getReadiness(2026, null)).rejects.toThrow(ATTENDANCE_READINESS_UNAVAILABLE);
});

it('surfaces a permission error and a malformed result', async () => {
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', { data: null, error: postgrestError('denied', '42501') });
  await expect(attendanceReadinessRepository.getReadiness(2026, null)).rejects.toBeTruthy();
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', { data: {}, error: null });
  await expect(attendanceReadinessRepository.getReadiness(2026, null)).rejects.toThrow(/returned no result/);
});

it('records a statement through the admin RPC', async () => {
  supabaseMock.queueResult('rpc:admin_attest_event_attendance', { data: {}, error: null });
  await attendanceReadinessRepository.attest('ev', 'no_signin', 'Rained out');
  expect(supabaseMock.queriesFor('rpc:admin_attest_event_attendance')[0].calls[0].args).toEqual([{ p_event_id: 'ev', p_status: 'no_signin', p_note: 'Rained out' }]);
});
