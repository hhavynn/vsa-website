import { useQuery } from 'react-query';
import { supabase } from '../lib/supabase';
import { leaderboardRepository } from '../data/repos/leaderboard';

export type SelectedYear = number | 'all';

export interface FindMyPointsEntry {
  member_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  college: string | null;
  graduation_year: string | null;
  house: string | null;
  total_points: number;
  events_attended: number;
  all_time_points: number;
  rank: number;
}

export function useFindMyPoints(selectedYear: SelectedYear | null) {
  return useQuery<FindMyPointsEntry[]>({
    queryKey: ['find-my-points', selectedYear],
    enabled: selectedYear !== null,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (selectedYear === null) return [];

      if (selectedYear === 'all') {
        const { data, error } = await supabase
          .from('members')
          .select('id, first_name, last_name, college, year, house, points, events_attended')
          .order('points', { ascending: false });
        if (error) throw error;

        return (data ?? []).map((m: any, idx: number) => ({
          member_id: m.id,
          first_name: m.first_name ?? '',
          last_name: m.last_name ?? '',
          full_name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
          college: m.college ?? null,
          graduation_year: m.year ?? null,
          house: m.house ?? null,
          total_points: m.points ?? 0,
          events_attended: m.events_attended ?? 0,
          all_time_points: m.points ?? 0,
          rank: idx + 1,
        }));
      }

      const yearly = await leaderboardRepository.getYearlyLeaderboard(selectedYear);

      // Build an enrichment map of member_id -> { house, all-time points }.
      // We fetch the full members table here (bounded, small) instead of
      // .in(id, [...big list]) because PostgREST rejects URLs longer than
      // ~8KB and the yearly leaderboard can easily exceed that.
      const enrichment = new Map<string, { house: string | null; allTime: number }>();
      if (yearly.length > 0) {
        const { data: enrichRows, error: enrichError } = await supabase
          .from('members')
          .select('id, house, points');
        if (enrichError) throw enrichError;
        for (const row of enrichRows ?? []) {
          enrichment.set((row as any).id, {
            house: (row as any).house ?? null,
            allTime: (row as any).points ?? 0,
          });
        }
      }

      return yearly.map((m, idx) => {
        const extra = enrichment.get(m.member_id);
        return {
          member_id: m.member_id,
          first_name: m.first_name ?? '',
          last_name: m.last_name ?? '',
          full_name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
          college: m.college ?? null,
          graduation_year: m.graduation_year ?? null,
          house: extra?.house ?? null,
          total_points: m.total_points,
          events_attended: m.events_attended,
          all_time_points: extra?.allTime ?? m.total_points,
          rank: idx + 1,
        };
      });
    },
  });
}
