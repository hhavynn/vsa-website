import { useMutation, useQuery, useQueryClient } from 'react-query';
import { eventRecapsRepository, EventRecapFormData } from '../data/repos/eventRecaps';
import { EventRecap } from '../types';

export function useEventRecap(eventId?: string) {
  const queryClient = useQueryClient();

  const {
    data: recap = null,
    isLoading: loading,
    error,
    refetch,
  } = useQuery<EventRecap | null>({
    queryKey: ['event-recap', eventId],
    queryFn: () => eventRecapsRepository.getRecapForEvent(eventId as string),
    enabled: !!eventId,
    staleTime: 30 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      values,
      userId,
      existingRecapId,
    }: {
      values: EventRecapFormData;
      userId: string;
      existingRecapId?: string;
    }) => eventRecapsRepository.saveRecapForEvent(eventId as string, values, userId, existingRecapId),
    onSuccess: (savedRecap) => {
      queryClient.setQueryData(['event-recap', eventId], savedRecap);
      queryClient.invalidateQueries(['event-recaps', 'ids']);
    },
  });

  return {
    recap,
    loading,
    error,
    refetch,
    saveRecap: saveMutation.mutateAsync,
    saving: saveMutation.isLoading,
  };
}

export function useEventRecapEventIds(eventIds: string[]) {
  const uniqueEventIds = Array.from(new Set(eventIds)).sort();

  const {
    data = [],
    isLoading: loading,
    error,
  } = useQuery<string[]>({
    queryKey: ['event-recaps', 'ids', uniqueEventIds],
    queryFn: () => eventRecapsRepository.getRecapEventIds(uniqueEventIds),
    enabled: uniqueEventIds.length > 0,
    staleTime: 30 * 1000,
  });

  return {
    recapEventIds: new Set(data),
    loading,
    error,
  };
}
