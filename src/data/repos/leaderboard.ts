import { supabase } from '../../lib/supabase';
import { MemberYearlyPoints } from '../../types';
import { withErrorHandling } from '../errors';

export class LeaderboardRepository {
  async getYearlyLeaderboard(academicYearStart: number): Promise<MemberYearlyPoints[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('member_yearly_points')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('total_points', { ascending: false });

      if (error) throw error;
      return (data ?? []) as MemberYearlyPoints[];
    }, 'Failed to fetch yearly leaderboard');
  }

  async getAllTimeLeaderboard(): Promise<any[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, college, year, points, events_attended, user_id')
        .order('points', { ascending: false });

      if (error) throw error;
      return data ?? [];
    }, 'Failed to fetch all-time leaderboard');
  }
}

export const leaderboardRepository = new LeaderboardRepository();
