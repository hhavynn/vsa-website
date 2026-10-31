/** Read-only House points diagnostic: server owns ALL point arithmetic. */
import { housePointsCheckRepository, POINTS_CHECK_UNAVAILABLE } from './housePointsCheck';
import { DatabaseError, ValidationError } from '../errors';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const summary = {
  academic_year_start: 2026,
  year_credits: 50,
  credits_earning_house_points: 35,
  credits_member_has_no_house_this_year: 15,
  credits_outside_membership_interval: 0,
  credits_before_house_start: 0,
  credits_event_without_term_near_year: 0,
  credits_on_inactive_house_profile: 0,
  credits_attributed_to_two_houses: 0,
  overlapping_memberships: 0,
  members_transferred_this_year: 0,
  future_dated_memberships: 0,
  pacific_vs_utc_boundary_credits: 0,
  house_member_vs_house_total_mismatch: 0,
  recomputed_vs_view_mismatch: 0,
};

describe('admin-only House points reconciliation repository (#291)', () => {
  it('returns the server-produced summary and rows without client points calculations', async () => {
    const houses = [{
      house_profile_id: 'fictional-profile', display_name: 'Fictional House',
      view_house_points: 35, view_member_points_sum: 35, membership_rows: 3,
    }];
    supabaseMock.setDefault('rpc:admin_house_points_reconciliation', {
      data: { summary, houses, checked_at: '2026-10-30T00:00:00Z' }, error: null,
    });
    await expect(housePointsCheckRepository.getCheck(2026)).resolves.toEqual({
      summary, houses, checkedAt: '2026-10-30T00:00:00Z',
    });
    expect(supabaseMock.queriesFor('rpc:admin_house_points_reconciliation')[0].calls)
      .toEqual([{ method: 'rpc', args: [{ p_year: 2026 }] }]);
    expect(supabaseMock.queriesFor('house_member_yearly_points')).toHaveLength(0);
    expect(supabaseMock.queriesFor('house_member_all_time_points')).toHaveLength(0);
    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
    expect(supabaseMock.queriesFor('house_memberships')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('retains a real zero-credit check, empty house array, and missing timestamp fallback', async () => {
    supabaseMock.setDefault('rpc:admin_house_points_reconciliation', {
      data: { summary: { ...summary, year_credits: 0 } }, error: null,
    });
    const result = await housePointsCheckRepository.getCheck(2026);
    expect(result.summary.year_credits).toBe(0);
    expect(result.houses).toEqual([]);
    expect(Date.parse(result.checkedAt)).not.toBeNaN();
  });

  it.each(['PGRST202', '42883'])('names the missing migration for RPC code %s', async (code) => {
    supabaseMock.queueResult('rpc:admin_house_points_reconciliation', {
      data: null, error: postgrestError('synthetic function missing', code),
    });
    await expect(housePointsCheckRepository.getCheck(2026))
      .rejects.toMatchObject({ name: 'ValidationError', message: POINTS_CHECK_UNAVAILABLE });
  });

  it('refuses malformed or missing summary instead of interpreting an outage as zero', async () => {
    supabaseMock.queueResult('rpc:admin_house_points_reconciliation', { data: null, error: null });
    await expect(housePointsCheckRepository.getCheck(2026))
      .rejects.toBeInstanceOf(ValidationError);
    supabaseMock.queueResult('rpc:admin_house_points_reconciliation', {
      data: { houses: [{ house_profile_id: 'fictional-profile' }] }, error: null,
    });
    await expect(housePointsCheckRepository.getCheck(2026))
      .rejects.toThrow('The House points check returned no result.');
  });

  it('propagates denied admin RPC with the original SQLSTATE, no alternate read', async () => {
    supabaseMock.queueResult('rpc:admin_house_points_reconciliation', {
      data: null, error: postgrestError('synthetic denied', '42501'),
    });
    await expect(housePointsCheckRepository.getCheck(2026))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(supabaseMock.queries()).toHaveLength(1);
    expect(supabaseMock.queriesFor('rpc:admin_house_points_reconciliation')).toHaveLength(1);
  });
});
