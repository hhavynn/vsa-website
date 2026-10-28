// Protected domain — House membership / points. CRC House overview (#651)
// through admin_house_overview: per-House roster, participation and private
// standing, aggregates only. There is deliberately no client-side points math.
import { supabase } from '../../lib/supabase';
import { ValidationError, withErrorHandling } from '../errors';

export interface HouseOverviewHouse {
  house_profile_id: string;
  house_key: string;
  display_name: string;
  accent_color: string | null;
  is_active: boolean;
  roster_members: number;
  /** Null for the whole year (no window start to compare with). */
  joined_in_window: number | null;
  participating_members: number;
  credited_attendance: number;
  window_latest_activity_at: string | null;
  year_total_points: number | null;
  year_unique_members: number | null;
  year_latest_activity_at: string | null;
  rank: number | null;
  /** Whole-year window only: the window credits equal house_yearly_points. */
  matches_view: boolean | null;
  parents_listed: number;
  parents_linked: number;
  hosted_events: number;
  overlapping_members: number;
}

export interface HouseOverview {
  houses: HouseOverviewHouse[];
  /** dated: false when the chosen term has no dates (rosters and House events then cover the whole year). */
  window: { termId: string | null; termLabel: string | null; startsOn: string | null; endsOn: string | null; dated: boolean };
  distinctHouseEvents: number;
  checkedAt: string;
}

export const HOUSE_OVERVIEW_UNAVAILABLE =
  'The House overview is not available yet. Ask a site administrator to apply database migration 20261028075724.';

export const houseOverviewRepository = {
  async getOverview(academicYearStart: number, termId: string | null): Promise<HouseOverview> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_house_overview', { p_year: academicYearStart, p_term_id: termId });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') throw new ValidationError(HOUSE_OVERVIEW_UNAVAILABLE, 'year');
        throw error;
      }
      const result = (data ?? {}) as {
        houses?: HouseOverviewHouse[];
        window?: { term_id: string | null; term_label: string | null; starts_on: string | null; ends_on: string | null; dated?: boolean };
        distinct_house_events?: number;
        checked_at?: string;
      };
      if (!Array.isArray(result.houses)) throw new ValidationError('The House overview returned no result.', 'year');
      return {
        houses: result.houses,
        window: {
          termId: result.window?.term_id ?? null,
          termLabel: result.window?.term_label ?? null,
          startsOn: result.window?.starts_on ?? null,
          endsOn: result.window?.ends_on ?? null,
          dated: result.window?.dated !== false,
        },
        distinctHouseEvents: result.distinct_house_events ?? 0,
        checkedAt: result.checked_at ?? new Date().toISOString(),
      };
    }, 'Failed to read the House overview');
  },
};
