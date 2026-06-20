import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useEventAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkInWithCode = useCallback(async (code: string) => {
    try {
      setLoading(true);
      setError(null);

      // Submit only the raw code. The server looks up the event via the
      // admin-only event_check_in_secrets table (SECURITY DEFINER), so the
      // client never reads or receives a stored check-in code.
      const { data, error: rpcError } = await supabase
        .rpc('check_in_to_event', { p_code: code });

      if (rpcError) {
        console.error('Error calling check_in_to_event:', rpcError);
        throw rpcError;
      }

      if (!data?.success) {
        throw new Error(data?.error ?? 'Failed to check in');
      }

      return data as { success: true; event_name: string; points_earned: number };
    } catch (err) {
      console.error('Error in checkInWithCode:', err);
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
          id,
          event_id,
          user_id,
          points_earned,
          check_in_type,
          checked_in_at,
          events!inner (
            id,
            name,
            description,
            date,
            location,
            points,
            event_type,
            check_in_form_url,
            image_url,
            thumbnail_url,
            is_code_expired,
            is_published
          )
        `)
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false });

      if (error) {
        console.error('Error fetching attendance:', error);
        throw error;
      }

      // Transform the data to ensure event is a single object
      const transformedData = data?.map(record => ({
        ...record,
        event: record.events[0]
      }));

      return transformedData;
    } catch (err) {
      console.error('Error in getUserAttendance:', err);
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
