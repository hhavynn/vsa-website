import { useQuery } from 'react-query';
import { internCohortRepository } from '../data/repos/internCohort';
import { InternCohortMember, PublicInternCohortMember } from '../types';

export function usePublishedInternCohort(academicYearStart: number | null) {
  const {
    data: members = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<PublicInternCohortMember[]>({
    queryKey: ['intern-cohort', 'published', academicYearStart],
    queryFn: () => academicYearStart ? internCohortRepository.getPublishedMembers(academicYearStart) : Promise.resolve([]),
    enabled: academicYearStart !== null,
    staleTime: 5 * 60 * 1000,
  });

  return { members, loading, error, refetch };
}

export function useAdminInternCohort(academicYearStart: number | null) {
  const {
    data: members = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<InternCohortMember[]>({
    queryKey: ['intern-cohort', 'admin', academicYearStart],
    queryFn: () => academicYearStart ? internCohortRepository.getAdminMembers(academicYearStart) : Promise.resolve([]),
    enabled: academicYearStart !== null,
    staleTime: 30 * 1000,
  });

  return { members, loading, error, refetch };
}
