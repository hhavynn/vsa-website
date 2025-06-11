import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function usePoints() {
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setPoints(0);
      setLoading(false);
      return;
    }

    async function fetchPoints() {
      try {
        const { data, error } = await supabase
          .from('user_points')
          .select('points')
          .eq('user_id', user?.id)
          .single();

        if (error) throw error;
        setPoints(data?.points || 0);
      } catch (error) {
        console.error('Error fetching points:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPoints();
  }, [user]);

  const addPoints = async (amount: number) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          points: points + amount,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      setPoints(data.points);
    } catch (error) {
      console.error('Error adding points:', error);
    }
  };

  return { points, loading, addPoints };
} 