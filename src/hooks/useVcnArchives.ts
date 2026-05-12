import { useQuery } from 'react-query';
import { VCNArchive } from '../types';
import { vcnArchivesRepository } from '../data/repos/vcnArchives';

export function usePublishedVcnArchives() {
  const {
    data: archives = [],
    isLoading: loading,
    error,
    refetch: refreshArchives,
  } = useQuery<VCNArchive[]>({
    queryKey: ['vcn-archives', 'published'],
    queryFn: () => vcnArchivesRepository.getPublishedArchives(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
  });

  return { archives, loading, error, refreshArchives };
}

export function useAllVcnArchives() {
  const {
    data: archives = [],
    isLoading: loading,
    error,
    refetch: refreshArchives,
  } = useQuery<VCNArchive[]>({
    queryKey: ['vcn-archives', 'all'],
    queryFn: () => vcnArchivesRepository.getAllArchives(),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  return { archives, loading, error, refreshArchives };
}
