import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { EventAttendance } from '../types';

export function useEventAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkInWithCode = useCallback(async (eventId: string, code: string) => {
    try {
      setLoading(true);
      setError(null);

      // Get the event to verify the code and get points
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      if (!event) throw new Error('Event not found');
      if (event.is_code_expired) throw new Error('Check-in code has expired');
      if (event.check_in_code !== code) throw new Error('Invalid check-in code');

      // Check if user has already checked in
      const { data: existingCheckIn, error: checkInError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (checkInError && checkInError.code !== 'PGRST116') throw checkInError;
      if (existingCheckIn) throw new Error('You have already checked in to this event');

      // Record the attendance
      const { error: insertError } = await supabase
        .from('event_attendance')
        .insert({
          event_id: eventId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          points_earned: event.points,
          check_in_type: 'code'
        });

      if (insertError) throw insertError;

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check in'));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const manuallyCheckIn = useCallback(async (eventId: string, userId: string, points: number) => {
    try {
      setLoading(true);
      setError(null);

      // Check if user has already checked in
      const { data: existingCheckIn, error: checkInError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      if (checkInError && checkInError.code !== 'PGRST116') throw checkInError;
      if (existingCheckIn) throw new Error('User has already checked in to this event');

      // Record the attendance
      const { error: insertError } = await supabase
        .from('event_attendance')
        .insert({
          event_id: eventId,
          user_id: userId,
          points_earned: points,
          check_in_type: 'manual',
          checked_in_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (insertError) throw insertError;

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check in'));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEventAttendance = useCallback(async (eventId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('event_attendance')
        .select(`
          *,
          user:user_id (
            email,
            user_profiles (
              first_name,
              last_name
            )
          )
        `)
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false });

      if (error) throw error;

      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch attendance'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserAttendance = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('event_attendance')
        .select(`
          *,
          event:event_id (
            name,
            date,
            event_type,
            points
          )
        `)
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false });

      if (error) throw error;

      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch attendance'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    checkInWithCode,
    manuallyCheckIn,
    getEventAttendance,
    getUserAttendance
  };
} 