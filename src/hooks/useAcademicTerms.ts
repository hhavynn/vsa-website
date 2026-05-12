import { useQuery } from 'react-query';
import { academicTermsRepository } from '../data/repos/academicTerms';
import { AcademicTerm } from '../types';

export function useAcademicTerms() {
  const {
    data: terms = [],
    isLoading: loading,
    error,
    refetch: refreshTerms,
  } = useQuery<AcademicTerm[]>({
    queryKey: ['academic-terms'],
    queryFn: () => academicTermsRepository.getTerms(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 20 * 60 * 1000,
  });

  return { terms, loading, error, refreshTerms };
}
