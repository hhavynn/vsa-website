import { useQuery, useMutation, useQueryClient } from 'react-query';
import { externalEventsRepository, ExternalEventFilters } from '../data/repos/externalEvents';
import { ExternalEvent } from '../types';

export function useExternalEvents(filters: ExternalEventFilters = {}) {
  const { data: events = [], isLoading: loading, error, refetch: refreshEvents } = useQuery<ExternalEvent[]>({
    queryKey: ['external-events', filters],
    queryFn: () => externalEventsRepository.getEvents(filters),
    staleTime: 5 * 60 * 1000,
  });

  return { events, loading, error, refreshEvents };
}

export function useAdminExternalEvents() {
  const { data: events = [], isLoading: loading, error, refetch: refreshEvents } = useQuery<ExternalEvent[]>({
    queryKey: ['admin-external-events'],
    queryFn: () => externalEventsRepository.getAllEvents(),
    staleTime: 5 * 60 * 1000,
  });

  return { events, loading, error, refreshEvents };
}

export function useExternalEvent(id: string) {
  return useQuery({
    queryKey: ['external-event', id],
    queryFn: () => externalEventsRepository.getEventById(id),
    enabled: !!id,
  });
}

export function useUpsertExternalEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (event: Partial<ExternalEvent>) => externalEventsRepository.upsertEvent(event),
    onSuccess: () => {
      queryClient.invalidateQueries(['external-events']);
      queryClient.invalidateQueries(['admin-external-events']);
    },
  });
}

export function useDeleteExternalEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => externalEventsRepository.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['external-events']);
      queryClient.invalidateQueries(['admin-external-events']);
    },
  });
}

/** Listings for the given events, keyed by event id. Only external events need one. */
export function useLinkedExternalListings(eventIds: string[]) {
  const key = eventIds.join(',');
  const { data } = useQuery<Map<string, ExternalEvent>>({
    queryKey: ['external-events', 'linked', key],
    queryFn: () => externalEventsRepository.getListingsBySourceEventIds(eventIds),
    enabled: eventIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return data ?? EMPTY_LISTINGS;
}

const EMPTY_LISTINGS = new Map<string, ExternalEvent>();
