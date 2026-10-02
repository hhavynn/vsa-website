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
      // Cached leaderboard data is considered fresh for 5 minutes.
      // It refreshes on a later query trigger/remount/invalidation rather than continuous polling.
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnReconnect: false,
      retry: false,
    },
  );
}
