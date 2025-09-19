import { useQuery, useMutation, useQueryClient } from 'react-query';
import { pointsRepository, PointsStats, PointsHistoryEntry, PointsLeaderboardEntry } from '../data/repos/points';
import { useAuth } from './useAuth';

export function useUserPoints() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-points', user?.id],
    queryFn: () => pointsRepository.getUserPoints(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePointsStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['points-stats', user?.id],
    queryFn: () => pointsRepository.getPointsStats(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePointsHistory(limit: number = 20) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['points-history', user?.id, limit],
    queryFn: () => pointsRepository.getPointsHistory(user!.id, limit),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaderboard(limit: number = 10, offset: number = 0) {
  return useQuery({
    queryKey: ['leaderboard', limit, offset],
    queryFn: () => pointsRepository.getLeaderboard(limit, offset),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useTopUsers(limit: number = 5) {
  return useQuery({
    queryKey: ['top-users', limit],
    queryFn: () => pointsRepository.getTopUsers(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserRank() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-rank', user?.id],
    queryFn: () => pointsRepository.getUserRank(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePointsDistribution() {
  return useQuery({
    queryKey: 'points-distribution',
    queryFn: () => pointsRepository.getPointsDistribution(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useAddPoints() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ points, eventId }: { points: number; eventId: string }) =>
      pointsRepository.addPoints(user!.id, points, eventId),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user-points', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['points-stats', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['points-history', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['user-rank', user?.id] });
    },
  });
}

// Legacy hook for backward compatibility
export function usePoints() {
  const { data: userPoints, isLoading: loading, error, refetch } = useUserPoints();
  
  const addPointsMutation = useAddPoints();
  
  const addPoints = async (amount: number, eventId?: string) => {
    if (!eventId) {
      throw new Error('Event ID is required for adding points');
    }
    
    return addPointsMutation.mutateAsync({ points: amount, eventId });
  };

  return { 
    points: userPoints?.total_points || 0, 
    loading, 
    error, 
    addPoints, 
    refreshPoints: refetch 
  };
} 