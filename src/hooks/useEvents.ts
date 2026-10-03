import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from 'react-query';
import { eventsRepository, EventFilters } from '../data/repos/events';
import { Event } from '../types';
import { CreateEventFormData, UpdateEventFormData } from '../schemas';

export function useEvents(filters?: EventFilters) {
  const { data: events = [], isLoading: loading, error, refetch: refreshEvents } = useQuery<Event[]>({
    queryKey: ['events', filters],
    queryFn: () => eventsRepository.getEvents(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  return { events, loading, error, refreshEvents };
}

export const EVENTS_PAGE_SIZE = 9;

export function usePublishedPastEventArchiveAvailability(dateTo: string) {
  return useQuery({
    queryKey: ['events', 'archive-availability', dateTo],
    queryFn: () => eventsRepository.getPublishedPastEventArchiveAvailability(dateTo),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
}

export function useInfiniteEvents(filters: Omit<EventFilters, 'limit' | 'offset'> = {}) {
  return useInfiniteQuery<Event[]>({
    queryKey: ['events', 'infinite', filters],
    queryFn: ({ pageParam = 0 }) =>
      eventsRepository.getEvents({
        ...filters,
        limit: EVENTS_PAGE_SIZE,
        offset: pageParam * EVENTS_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === EVENTS_PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Dormant hooks — available for future use, backed by eventsRepository
function useUpcomingEvents(limit: number = 5) {
  return useQuery({
    queryKey: ['events', 'upcoming', limit],
    queryFn: () => eventsRepository.getUpcomingEvents(limit),
    staleTime: 5 * 60 * 1000,
  });
}

function useEventsByType(eventType: string, limit?: number) {
  return useQuery({
    queryKey: ['events', 'type', eventType, limit],
    queryFn: () => eventsRepository.getEventsByType(eventType as any, limit),
    enabled: !!eventType,
    staleTime: 5 * 60 * 1000,
  });
}

function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventData: CreateEventFormData) => eventsRepository.createEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...eventData }: { id: string } & UpdateEventFormData) =>
      eventsRepository.updateEvent(id, eventData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] });
    },
  });
}

function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eventsRepository.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/* eslint-enable @typescript-eslint/no-unused-vars */
