import { useQuery } from 'react-query';
import { supabase } from '../lib/supabase';
import { Event } from '../types';

export function useEvents() {
  const { data: events = [], isLoading: loading, error, refetch: refreshEvents } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { events, loading, error, refreshEvents };
} 