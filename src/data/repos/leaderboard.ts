import { supabase } from '../../lib/supabase';
import { HouseAllTimePoints, HouseMemberRankEntry, HouseRecentActivity, HouseYearlyPoints, MemberYearlyPoints } from '../../types';
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

  async getHouseMemberRankings(academicYearStart: number | 'all'): Promise<Map<string, HouseMemberRankEntry[]>> {
    return withErrorHandling(async () => {
      if (academicYearStart === 'all') {
        const { data, error } = await supabase
          .from('members')
          .select('id, first_name, last_name, college, year, points, events_attended, house')
          .not('house', 'is', null)
          .order('points', { ascending: false });
        if (error) throw error;

        const byHouse = new Map<string, HouseMemberRankEntry[]>();
        for (const m of (data ?? []) as any[]) {
          if (!m.house) continue;
          const entry: HouseMemberRankEntry = {
            member_id: m.id,
            first_name: m.first_name ?? '',
            last_name: m.last_name ?? '',
            college: m.college ?? null,
            graduation_year: m.year ?? null,
            total_points: m.points ?? 0,
            events_attended: m.events_attended ?? 0,
          };
          const arr = byHouse.get(m.house) ?? [];
          arr.push(entry);
          byHouse.set(m.house, arr);
        }
        return byHouse;
      }

      const [yearlyResult, memberResult] = await Promise.all([
        supabase
          .from('member_yearly_points')
          .select('*')
          .eq('academic_year_start', academicYearStart)
          .order('total_points', { ascending: false }),
        supabase.from('members').select('id, house'),
      ]);
      if (yearlyResult.error) throw yearlyResult.error;
      if (memberResult.error) throw memberResult.error;

      const houseMap = new Map<string, string | null>();
      for (const row of (memberResult.data ?? []) as any[]) {
        houseMap.set(row.id, row.house ?? null);
      }

      const byHouse = new Map<string, HouseMemberRankEntry[]>();
      for (const m of (yearlyResult.data ?? []) as any[]) {
        const house = houseMap.get(m.member_id);
        if (!house) continue;
        const entry: HouseMemberRankEntry = {
          member_id: m.member_id,
          first_name: m.first_name ?? '',
          last_name: m.last_name ?? '',
          college: m.college ?? null,
          graduation_year: m.graduation_year ?? null,
          total_points: m.total_points ?? 0,
          events_attended: m.events_attended ?? 0,
        };
        const arr = byHouse.get(house) ?? [];
        arr.push(entry);
        byHouse.set(house, arr);
      }
      return byHouse;
    }, 'Failed to fetch house member rankings');
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
