import { useQuery } from 'react-query';
import { ResourceLink } from '../types';
import { resourceLinksRepository } from '../data/repos/resourceLinks';

export const RESOURCE_LINKS_QUERY_KEY = ['resource-links', 'admin'];

export function useResourceLinks() {
  const {
    data: resources = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<ResourceLink[]>({
    queryKey: RESOURCE_LINKS_QUERY_KEY,
    queryFn: () => resourceLinksRepository.getAll(),
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  });

  return { resources, loading, error, refetch };
}
