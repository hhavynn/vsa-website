import { useQuery } from 'react-query';
import { eventsRepository, EventFilters, EventWithAttendance } from '../data/repos/events';

export function useEvents(filters?: EventFilters) {
  const {
    data: events = [],
    isLoading: loading,
    error,
    refetch: refreshEvents,
  } = useQuery<EventWithAttendance[]>({
    queryKey: ['events', filters],
    queryFn: () => eventsRepository.getEvents(filters),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  return { events, loading, error, refreshEvents };
}
