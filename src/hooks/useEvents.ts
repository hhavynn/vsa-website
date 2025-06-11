import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Event } from '../types';

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;

      // Transform the data to match our Event type
      const transformedEvents: Event[] = (data || []).map(event => ({
        id: event.id,
        title: event.name,
        description: event.description || '',
        date: event.date,
        location: event.location || '',
        points: event.points,
        created_at: event.created_at,
        updated_at: event.updated_at,
        check_in_form_url: event.check_in_form_url || '',
        event_type: event.event_type || 'general_event'
      }));

      setEvents(transformedEvents);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch events'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refreshEvents: fetchEvents };
} 