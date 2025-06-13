import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function usePoints() {
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchPoints = useCallback(async () => {
    if (!user) {
      setPoints(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // First try to get existing points
      const { data, error } = await supabase
        .from('user_points')
        .select('points')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No points record exists, create one
          const { data: newData, error: insertError } = await supabase
            .from('user_points')
            .insert({
              user_id: user.id,
              points: 0
            })
            .select()
            .single();

          if (insertError) throw insertError;
          setPoints(newData.points);
        } else {
          throw error;
        }
      } else {
        setPoints(data.points);
      }
    } catch (error) {
      console.error('Error fetching points:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const addPoints = async (amount: number) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          points: points + amount
        })
        .select()
        .single();

      if (error) throw error;
      setPoints(data.points);
    } catch (error) {
      console.error('Error adding points:', error);
    }
  };

  return { points, loading, addPoints, refreshPoints: fetchPoints };
} 