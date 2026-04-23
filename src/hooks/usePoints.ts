import { useMutation, useQuery, useQueryClient } from 'react-query';
import { pointsRepository } from '../data/repos/points';
import { useAuth } from './useAuth';

export function useUserPoints() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-points', user?.id],
    queryFn: () => pointsRepository.getUserPoints(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

function useAddPoints() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ points }: { points: number }) => pointsRepository.addPoints(user!.id, points),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-points', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function usePoints() {
  const { data: userPoints, isLoading: loading, error, refetch } = useUserPoints();
  const addPointsMutation = useAddPoints();

  const addPoints = async (amount: number, eventId?: string) => {
    if (!eventId) {
      throw new Error('Event ID is required for adding points');
    }

    return addPointsMutation.mutateAsync({ points: amount });
  };

  return {
    points: userPoints?.total_points || 0,
    loading,
    error,
    addPoints,
    refreshPoints: refetch,
  };
}
