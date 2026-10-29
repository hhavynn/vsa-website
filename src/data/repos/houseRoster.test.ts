/**
 * Private House roster repository (#652): two admin RPCs; a missing function is
 * a plain "apply the migration" message and other errors are surfaced, never
 * an empty roster.
 */
import { houseRosterRepository, HOUSE_ROSTER_UNAVAILABLE } from './houseRoster';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('reads the roster through the admin RPC', async () => {
  supabaseMock.queueResult('rpc:admin_house_roster', {
    data: { house: { id: 'hp', display_name: 'Rarity', is_active: true, academic_year_start: 2026 }, window: { term_label: 'Fall 2026' }, members: [], checked_at: '2026-10-28T00:00:00Z' },
    error: null,
  });
  await expect(houseRosterRepository.getRoster('hp', 't')).resolves.toEqual({
    house: { id: 'hp', displayName: 'Rarity', isActive: true, academicYearStart: 2026 }, termLabel: 'Fall 2026', dated: true, members: [], checkedAt: '2026-10-28T00:00:00Z',
  });
  expect(supabaseMock.queriesFor('rpc:admin_house_roster')[0].calls[0].args).toEqual([{ p_house_profile_id: 'hp', p_term_id: 't' }]);
});

it('reads one member\'s events through the admin RPC', async () => {
  supabaseMock.queueResult('rpc:admin_house_member_attendance', { data: { events: [] }, error: null });
  await expect(houseRosterRepository.getMemberAttendance('m', 2026)).resolves.toEqual([]);
  expect(supabaseMock.queriesFor('rpc:admin_house_member_attendance')[0].calls[0].args).toEqual([{ p_member_id: 'm', p_year: 2026 }]);
});

it('explains a missing function and surfaces other errors', async () => {
  supabaseMock.queueResult('rpc:admin_house_roster', { data: null, error: postgrestError('missing', 'PGRST202') });
  await expect(houseRosterRepository.getRoster('hp', null)).rejects.toThrow(HOUSE_ROSTER_UNAVAILABLE);
  supabaseMock.queueResult('rpc:admin_house_roster', { data: null, error: postgrestError('denied', '42501') });
  await expect(houseRosterRepository.getRoster('hp', null)).rejects.toBeTruthy();
  supabaseMock.queueResult('rpc:admin_house_member_attendance', { data: {}, error: null });
  await expect(houseRosterRepository.getMemberAttendance('m', 2026)).rejects.toThrow(/returned no result/);
});
