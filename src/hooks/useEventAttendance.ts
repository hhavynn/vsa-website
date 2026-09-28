// Points system: CHECK-IN (event_attendance + user_points, written by the
// check_in_to_event RPC and admin manual check-in) — not the public leaderboard,
// which never reads these tables. See docs/leaderboard-system.md (top).
// Known repo-layer deviation, not a sanctioned exception. AGENTS.md requires all
// Supabase access to go through src/data/repos/; this hook queries directly for
// historical reasons. vsa-architecture-contract records it as an open legacy
// deviation, with moving it into pointsRepository as candidate cleanup (#234).
// Do not copy this pattern elsewhere.
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Shape of the jsonb returned by public.check_in_to_event.
type CheckInRpcResult = {
  success: boolean;
  error?: string;
  event_name?: string;
  points_earned?: number;
};

export function useEventAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkInWithCode = useCallback(async (code: string) => {
    try {
      setLoading(true);
      setError(null);

      // Delegate all validation and point attribution to the server-side RPC.
      // The server identifies the caller via auth.uid(), resolves the event
      // from the privately-stored code, validates event state, inserts
      // attendance, and updates user_points — the client never knows which
      // event a code belongs to or reads the stored code itself.
      const { data, error: rpcError } = await supabase
        .rpc('check_in_to_event', { p_code: code });
      const result = data as CheckInRpcResult | null;

      if (rpcError) {
        console.error('Error calling check_in_to_event:', rpcError);
        throw rpcError;
      }

      if (!result?.success) {
        return { success: false as const, error: result?.error ?? 'Failed to check in' };
      }

      return { success: true as const, eventName: result.event_name };
    } catch (err) {
      console.error('Error in checkInWithCode:', err);
      setError(err instanceof Error ? err : new Error('Failed to check in'));
      return { success: false as const, error: 'Failed to check in' };
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

      // events is a many-to-one join, so PostgREST returns an object, not an array.
      const transformedData = data?.map(record => ({
        ...record,
        event: record.events
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
