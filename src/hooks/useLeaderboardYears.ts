import { useQuery } from 'react-query';
import { leaderboardRepository } from '../data/repos/leaderboard';

export function useLeaderboardYears() {
  const {
    data: yearsWithData = [],
    isLoading: loading,
    error,
  } = useQuery<number[]>({
    queryKey: ['leaderboard-years'],
    queryFn: () => leaderboardRepository.getYearsWithData(),
    staleTime: 5 * 60 * 1000,
  });

  return { yearsWithData, loading, error };
}
