import { useQuery } from 'react-query';
import { leaderboardRepository } from '../data/repos/leaderboard';

export interface IndividualLeaderboardMember {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  points: number;
  events_attended: number;
  user_id?: string | null;
}

export function useIndividualLeaderboard(year: number | 'all' | null) {
  return useQuery<IndividualLeaderboardMember[], unknown>(
    ['individual-leaderboard', year],
    async () => {
      if (year === null) return [];
      if (year === 'all') {
        return await leaderboardRepository.getAllTimeLeaderboard() as IndividualLeaderboardMember[];
      }

      const data = await leaderboardRepository.getYearlyLeaderboard(year);
      return data.map((member) => ({
        id: member.member_id,
        first_name: member.first_name,
        last_name: member.last_name,
        college: member.college,
        year: member.graduation_year,
        points: member.total_points,
        events_attended: member.events_attended,
        user_id: member.user_id,
      }));
    },
    {
      enabled: year !== null,
      // Raw members changes require private-table read access; refresh the existing public projection instead.
      refetchInterval: year === 'all' ? 30_000 : false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: year === 'all',
      refetchOnReconnect: year === 'all',
      cacheTime: 0,
      retry: false,
    },
  );
}
