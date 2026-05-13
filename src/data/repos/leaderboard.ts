import { supabase } from '../../lib/supabase';
import { HouseAllTimePoints, HouseRecentActivity, HouseYearlyPoints, MemberYearlyPoints } from '../../types';
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

  async getYearlyHouseLeaderboard(academicYearStart: number): Promise<HouseYearlyPoints[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_yearly_points')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('total_points', { ascending: false });

      if (error) throw error;
      return (data ?? []) as HouseYearlyPoints[];
    }, 'Failed to fetch yearly house standings');
  }

  async getAllTimeHouseLeaderboard(): Promise<HouseAllTimePoints[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_all_time_points')
        .select('*')
        .order('total_points', { ascending: false });

      if (error) throw error;
      return (data ?? []) as HouseAllTimePoints[];
    }, 'Failed to fetch all-time house standings');
  }

  async getRecentHouseActivity(academicYearStart: number, limit: number = 8): Promise<HouseRecentActivity[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_recent_activity')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('latest_activity_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as HouseRecentActivity[];
    }, 'Failed to fetch recent house activity');
  }

  async getYearsWithData(): Promise<number[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('member_yearly_points')
        .select('academic_year_start')
        .order('academic_year_start', { ascending: false });

      if (error) throw error;

      const uniqueYears = Array.from(new Set((data ?? []).map((row) => row.academic_year_start)))
        .filter((year): year is number => typeof year === 'number')
        .sort((a, b) => b - a);
      return uniqueYears;
    }, 'Failed to fetch years with data');
  }
}

export const leaderboardRepository = new LeaderboardRepository();
