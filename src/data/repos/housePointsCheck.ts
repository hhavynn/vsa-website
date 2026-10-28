// Protected domain — points / House membership. Read-only House points
// reconciliation (#622) through admin_house_points_reconciliation: it measures
// how a year's ledger credits reach the House views and never writes. There is
// deliberately no client-side points math here.
import { supabase } from '../../lib/supabase';
import { ValidationError, withErrorHandling } from '../errors';

export interface HousePointsCheckSummary {
  academic_year_start: number;
  year_credits: number;
  credits_earning_house_points: number;
  credits_member_has_no_house_this_year: number;
  credits_outside_membership_interval: number;
  credits_before_house_start: number;
  credits_event_without_term_near_year: number;
  credits_on_inactive_house_profile: number;
  credits_attributed_to_two_houses: number;
  overlapping_memberships: number;
  members_transferred_this_year: number;
  future_dated_memberships: number;
  pacific_vs_utc_boundary_credits: number;
  house_member_vs_house_total_mismatch: number;
  recomputed_vs_view_mismatch: number;
}

export interface HousePointsCheckHouse {
  house_profile_id: string;
  display_name: string | null;
  view_house_points: number | null;
  view_member_points_sum: number;
  membership_rows: number;
}

export interface HousePointsCheck {
  summary: HousePointsCheckSummary;
  houses: HousePointsCheckHouse[];
  checkedAt: string;
}

export const POINTS_CHECK_UNAVAILABLE =
  'The House points check is not available yet. Ask a site administrator to apply database migration 20261028070000.';

export const housePointsCheckRepository = {
  async getCheck(academicYearStart: number): Promise<HousePointsCheck> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_house_points_reconciliation', { p_year: academicYearStart });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') throw new ValidationError(POINTS_CHECK_UNAVAILABLE, 'year');
        throw error;
      }
      const result = (data ?? {}) as { summary?: HousePointsCheckSummary; houses?: HousePointsCheckHouse[]; checked_at?: string };
      if (!result.summary) throw new ValidationError('The House points check returned no result.', 'year');
      return { summary: result.summary, houses: result.houses ?? [], checkedAt: result.checked_at ?? new Date().toISOString() };
    }, 'Failed to run the House points check');
  },
};
