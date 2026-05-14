import { useQuery } from 'react-query';
import { ProgramContent, ProgramPageKey, ProgramSectionKey } from '../types';
import { programContentRepository } from '../data/repos/programContent';

export function useProgramContent(
  pageKey: ProgramPageKey,
  sectionKey: ProgramSectionKey = 'current_cycle',
) {
  const {
    data = null,
    isLoading: loading,
    error,
    refetch,
  } = useQuery<ProgramContent | null>({
    queryKey: ['program-content', 'published', pageKey, sectionKey],
    queryFn: () => programContentRepository.getPublishedContent(pageKey, sectionKey),
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  });

  return { content: data, loading, error, refetch };
}

export function useAllProgramContent() {
  const {
    data = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<ProgramContent[]>({
    queryKey: ['program-content', 'all'],
    queryFn: () => programContentRepository.getAllContent(),
    staleTime: 30 * 1000,
  });

  return { content: data, loading, error, refetch };
}
