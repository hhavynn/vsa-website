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

      console.log('Starting check-in process:', { eventId, code });

      // Get the event to verify the code and get points
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      console.log('Event fetch result:', { event, eventError });

      if (eventError) {
        console.error('Error fetching event:', eventError);
        throw eventError;
      }
      if (!event) {
        console.error('Event not found');
        throw new Error('Event not found');
      }
      if (event.is_code_expired) {
        console.error('Code expired');
        throw new Error('Check-in code has expired');
      }
      if (event.check_in_code !== code) {
        console.error('Invalid code:', { provided: code, expected: event.check_in_code });
        throw new Error('Invalid check-in code');
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Current user:', { user, userError });

      if (userError) {
        console.error('Error getting user:', userError);
        throw userError;
      }
      if (!user) {
        console.error('No user found');
        throw new Error('User not authenticated');
      }

      // Check if user has already checked in
      const { data: existingCheckIn, error: checkInError } = await supabase
        .from('event_attendance')
        .select('id, event_id, user_id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Existing check-in check:', { existingCheckIn, checkInError });

      if (checkInError) {
        console.error('Error checking existing check-in:', checkInError);
        throw checkInError;
      }
      if (existingCheckIn) {
        console.error('Already checked in');
        throw new Error('You have already checked in to this event');
      }

      console.log('Recording attendance with points:', event.points);

      // Record the attendance
      const { data: insertData, error: insertError } = await supabase
        .from('event_attendance')
        .insert({
          event_id: eventId,
          user_id: user.id,
          points_earned: event.points,
          check_in_type: 'code'
        })
        .select()
        .single();

      console.log('Insert result:', { insertData, insertError });

      if (insertError) {
        console.error('Error inserting attendance:', insertError);
        throw insertError;
      }

      // Get current points
      const { data: currentPoints, error: currentPointsError } = await supabase
        .from('user_points')
        .select('points')
        .eq('user_id', user.id)
        .single();

      console.log('Current points:', { currentPoints, currentPointsError });

      if (currentPointsError && currentPointsError.code !== 'PGRST116') {
        console.error('Error getting current points:', currentPointsError);
        throw currentPointsError;
      }

      const currentTotal = currentPoints?.points || 0;
      const newTotal = currentTotal + event.points;

      console.log('Updating points:', { currentTotal, newTotal, pointsToAdd: event.points });

      // Update user's total points
      const { data: pointsData, error: pointsError } = await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          points: newTotal
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      console.log('Points update result:', { pointsData, pointsError });

      if (pointsError) {
        console.error('Error updating points:', pointsError);
        throw pointsError;
      }

      console.log('Successfully checked in');
      return true;
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

      // The Supabase client automatically sets the Accept header to 'application/json'
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

      console.log('Fetching attendance for user:', userId);

      // First try a simple query to see if we can get any data
      const { data: simpleData, error: simpleError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('user_id', userId);

      console.log('Simple query result:', { simpleData, simpleError });

      // Then try the full query
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
            check_in_code,
            is_code_expired
          )
        `)
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false });

      console.log('Full query result:', { data, error });

      if (error) {
        console.error('Error fetching attendance:', error);
        throw error;
      }

      // Transform the data to ensure event is a single object
      const transformedData = data?.map(record => ({
        ...record,
        event: record.events[0] // Take the first event from the array
      }));

      console.log('Transformed data:', transformedData);

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