// Protected domain — House membership / points. Private House roster and
// member attendance drilldown (#652) through admin_house_roster and
// admin_house_member_attendance. Names and counts only (no contact details);
// there is deliberately no client-side points math.
import { supabase } from '../../lib/supabase';
import { ValidationError, withErrorHandling } from '../errors';

export interface RosterMember {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  start_date: string;
  end_date: string | null;
  /** Separate memberships in this House this year (more than 1 = left and came back). */
  stints: number;
  joined_in_period: boolean;
  other_house_memberships: number;
  credited_attendance: number;
  last_credited_at: string | null;
  events_attended: number;
}

export interface HouseRoster {
  house: { id: string; displayName: string; isActive: boolean; academicYearStart: number };
  termLabel: string | null;
  /** False when the chosen term has no dates: the roster then covers the whole year. */
  dated: boolean;
  members: RosterMember[];
  checkedAt: string;
}

export type AttendanceReason =
  | 'counted' | 'overlapping_houses' | 'before_house_start' | 'no_house' | 'house_not_public' | 'no_points' | 'no_term' | 'no_date' | 'before_ledger';

export interface MemberAttendanceEvent {
  event_id: string;
  name: string;
  date: string | null;
  term_label: string | null;
  points_earned: number;
  house_name: string | null;
  reason: AttendanceReason;
}

export const HOUSE_ROSTER_UNAVAILABLE =
  'House rosters are not available yet. Ask a site administrator to apply database migration 20261028075801.';

function unavailable(code: string | undefined) {
  return code === 'PGRST202' || code === '42883';
}

export const houseRosterRepository = {
  async getRoster(houseProfileId: string, termId: string | null): Promise<HouseRoster> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_house_roster', { p_house_profile_id: houseProfileId, p_term_id: termId });
      if (error) {
        if (unavailable(error.code)) throw new ValidationError(HOUSE_ROSTER_UNAVAILABLE, 'house');
        throw error;
      }
      const result = (data ?? {}) as {
        house?: { id: string; display_name: string; is_active: boolean; academic_year_start: number };
        window?: { term_label: string | null; dated?: boolean };
        members?: RosterMember[];
        checked_at?: string;
      };
      if (!result.house || !Array.isArray(result.members)) throw new ValidationError('The House roster returned no result.', 'house');
      return {
        house: { id: result.house.id, displayName: result.house.display_name, isActive: result.house.is_active, academicYearStart: result.house.academic_year_start },
        termLabel: result.window?.term_label ?? null,
        dated: result.window?.dated !== false,
        members: result.members,
        checkedAt: result.checked_at ?? new Date().toISOString(),
      };
    }, 'Failed to read the House roster');
  },

  async getMemberAttendance(memberId: string, academicYearStart: number): Promise<MemberAttendanceEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('admin_house_member_attendance', { p_member_id: memberId, p_year: academicYearStart });
      if (error) {
        if (unavailable(error.code)) throw new ValidationError(HOUSE_ROSTER_UNAVAILABLE, 'member');
        throw error;
      }
      const result = (data ?? {}) as { events?: MemberAttendanceEvent[] };
      if (!Array.isArray(result.events)) throw new ValidationError('Member attendance returned no result.', 'member');
      return result.events;
    }, 'Failed to read member attendance');
  },
};
