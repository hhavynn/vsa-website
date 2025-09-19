import { useQuery, useMutation, useQueryClient } from 'react-query';
import { eventsRepository, EventFilters } from '../data/repos/events';
import { EventWithAttendance } from '../data/repos/events';
import { CreateEventFormData, UpdateEventFormData } from '../schemas';

export function useEvents(filters?: EventFilters) {
  const { data: events = [], isLoading: loading, error, refetch: refreshEvents } = useQuery<EventWithAttendance[]>({
    queryKey: ['events', filters],
    queryFn: () => eventsRepository.getEvents(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  return { events, loading, error, refreshEvents };
}

export function useEvent(id: string, userId?: string) {
  return useQuery({
    queryKey: ['event', id, userId],
    queryFn: () => eventsRepository.getEventById(id, userId),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpcomingEvents(limit: number = 5) {
  return useQuery({
    queryKey: ['events', 'upcoming', limit],
    queryFn: () => eventsRepository.getUpcomingEvents(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEventsByType(eventType: string, limit?: number) {
  return useQuery({
    queryKey: ['events', 'type', eventType, limit],
    queryFn: () => eventsRepository.getEventsByType(eventType as any, limit),
    enabled: !!eventType,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEventStats() {
  return useQuery({
    queryKey: 'event-stats',
    queryFn: () => eventsRepository.getEventStats(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventData: CreateEventFormData) => eventsRepository.createEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: 'event-stats' });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...eventData }: { id: string } & UpdateEventFormData) =>
      eventsRepository.updateEvent(id, eventData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] });
      queryClient.invalidateQueries({ queryKey: 'event-stats' });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eventsRepository.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: 'event-stats' });
    },
  });
}

export function useCheckInEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, userId, checkInType, code }: {
      eventId: string;
      userId: string;
      checkInType: 'code' | 'manual';
      code?: string;
    }) => eventsRepository.checkInUser(eventId, userId, checkInType, code),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
} 