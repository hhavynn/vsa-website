import { supabase } from '../../lib/supabase';
import { ValidationError, withErrorHandling } from '../errors';

export interface UserPoints {
  id: string;
  user_id: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export class PointsRepository {
  async getUserPoints(userId: string): Promise<UserPoints> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return this.initializeUserPoints(userId);

      return data;
    }, 'Failed to fetch user points');
  }

  async initializeUserPoints(userId: string): Promise<UserPoints> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_points')
        .insert([{ user_id: userId, total_points: 0 }])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new ValidationError('Failed to initialize user points');

      return data;
    }, 'Failed to initialize user points');
  }

  async addPoints(userId: string, points: number): Promise<void> {
    return withErrorHandling(async () => {
      if (points <= 0) {
        throw new ValidationError('Points must be positive');
      }

      const current = await this.getUserPoints(userId);
      const { error } = await supabase
        .from('user_points')
        .update({
          total_points: current.total_points + points,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
    }, 'Failed to add points');
  }
}

export const pointsRepository = new PointsRepository();
