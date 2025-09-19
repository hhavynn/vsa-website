import { supabase } from '../clients/supabase';
import { withErrorHandling, NotFoundError, ValidationError } from '../errors';

export interface UserPoints {
  id: string;
  user_id: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface PointsLeaderboardEntry {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  total_points: number;
  rank: number;
}

export interface PointsHistoryEntry {
  id: string;
  event_id: string;
  event_name: string;
  points_earned: number;
  check_in_type: 'code' | 'manual';
  checked_in_at: string;
}

export interface PointsStats {
  total_points: number;
  events_attended: number;
  average_points_per_event: number;
  rank: number;
  total_users: number;
}

export class PointsRepository {
  /**
   * Get user's total points
   */
  async getUserPoints(userId: string): Promise<UserPoints> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (!data) {
        // Create initial points record if it doesn't exist
        return this.initializeUserPoints(userId);
      }

      return data;
    }, 'Failed to fetch user points');
  }

  /**
   * Initialize user points (called when user doesn't have a points record)
   */
  async initializeUserPoints(userId: string): Promise<UserPoints> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_points')
        .insert([{
          user_id: userId,
          total_points: 0,
        }])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new ValidationError('Failed to initialize user points');

      return data;
    }, 'Failed to initialize user points');
  }

  /**
   * Add points to user (typically called after event check-in)
   */
  async addPoints(userId: string, points: number, eventId: string): Promise<void> {
    return withErrorHandling(async () => {
      if (points <= 0) {
        throw new ValidationError('Points must be positive');
      }

      // Use a transaction-like approach by updating the points
      const { data: currentPoints, error: fetchError } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      const newTotal = (currentPoints?.total_points || 0) + points;

      const { error: updateError } = await supabase
        .from('user_points')
        .update({
          total_points: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    }, 'Failed to add points');
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 10, offset: number = 0): Promise<PointsLeaderboardEntry[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select(`
          user_id,
          total_points,
          user_profiles!inner(
            first_name,
            last_name,
            avatar_url
          )
        `)
        .order('total_points', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      if (!data) return [];

      return data.map((entry, index) => ({
        user_id: entry.user_id,
        first_name: entry.user_profiles.first_name,
        last_name: entry.user_profiles.last_name,
        avatar_url: entry.user_profiles.avatar_url,
        total_points: entry.total_points,
        rank: offset + index + 1,
      }));
    }, 'Failed to fetch leaderboard');
  }

  /**
   * Get user's points history
   */
  async getPointsHistory(userId: string, limit: number = 20): Promise<PointsHistoryEntry[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('event_attendance')
        .select(`
          id,
          event_id,
          points_earned,
          check_in_type,
          checked_in_at,
          events!inner(
            name
          )
        `)
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!data) return [];

      return data.map(entry => ({
        id: entry.id,
        event_id: entry.event_id,
        event_name: entry.events.name,
        points_earned: entry.points_earned,
        check_in_type: entry.check_in_type,
        checked_in_at: entry.checked_in_at,
      }));
    }, 'Failed to fetch points history');
  }

  /**
   * Get user's points statistics
   */
  async getPointsStats(userId: string): Promise<PointsStats> {
    return withErrorHandling(async () => {
      // Get user's total points
      const userPoints = await this.getUserPoints(userId);

      // Get user's attendance count
      const { count: eventsAttended } = await supabase
        .from('event_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get total number of users for ranking
      const { count: totalUsers } = await supabase
        .from('user_points')
        .select('*', { count: 'exact', head: true });

      // Get user's rank
      const { data: rankData } = await supabase
        .from('user_points')
        .select('user_id')
        .gte('total_points', userPoints.total_points);

      const averagePointsPerEvent = eventsAttended 
        ? userPoints.total_points / eventsAttended 
        : 0;

      return {
        total_points: userPoints.total_points,
        events_attended: eventsAttended || 0,
        average_points_per_event: Math.round(averagePointsPerEvent * 100) / 100,
        rank: rankData ? rankData.length : 1,
        total_users: totalUsers || 0,
      };
    }, 'Failed to fetch points statistics');
  }

  /**
   * Get user's rank
   */
  async getUserRank(userId: string): Promise<number> {
    return withErrorHandling(async () => {
      const userPoints = await this.getUserPoints(userId);

      const { data, error } = await supabase
        .from('user_points')
        .select('user_id')
        .gte('total_points', userPoints.total_points);

      if (error) throw error;

      return data ? data.length : 1;
    }, 'Failed to fetch user rank');
  }

  /**
   * Get top users by points
   */
  async getTopUsers(limit: number = 5): Promise<PointsLeaderboardEntry[]> {
    return this.getLeaderboard(limit, 0);
  }

  /**
   * Get points distribution stats (for admin)
   */
  async getPointsDistribution(): Promise<{
    average_points: number;
    median_points: number;
    max_points: number;
    min_points: number;
    total_users: number;
  }> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points')
        .order('total_points', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          average_points: 0,
          median_points: 0,
          max_points: 0,
          min_points: 0,
          total_users: 0,
        };
      }

      const points = data.map(entry => entry.total_points);
      const total = points.reduce((sum, point) => sum + point, 0);
      const average = total / points.length;
      const median = points[Math.floor(points.length / 2)];
      const max = Math.max(...points);
      const min = Math.min(...points);

      return {
        average_points: Math.round(average * 100) / 100,
        median_points: median,
        max_points: max,
        min_points: min,
        total_users: points.length,
      };
    }, 'Failed to fetch points distribution');
  }
}

// Export a singleton instance
export const pointsRepository = new PointsRepository();
