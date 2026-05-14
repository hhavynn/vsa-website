import { useQuery } from 'react-query';
import { AceFamily, AceFamilyMember } from '../types';
import { aceFamiliesRepository } from '../data/repos/aceFamilies';

export function usePublishedAceFamilies(academicYearStart?: number | null) {
  const {
    data: families = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<AceFamily[]>({
    queryKey: ['ace-families', 'published', academicYearStart ?? null],
    queryFn: () =>
      aceFamiliesRepository.getPublishedFamilies(
        typeof academicYearStart === 'number' ? academicYearStart : undefined,
      ),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  return { families, loading, error, refetch };
}

export function useAllPublishedAceFamilyMembers() {
  const {
    data: members = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<AceFamilyMember[]>({
    queryKey: ['ace-family-members', 'published', 'all'],
    queryFn: () => aceFamiliesRepository.getAllPublishedMembers(),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  return { members, loading, error, refetch };
}

export function usePublishedAceFamilyMembers(familyId: string | null) {
  const {
    data: members = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<AceFamilyMember[]>({
    queryKey: ['ace-family-members', 'published', familyId],
    queryFn: () =>
      familyId ? aceFamiliesRepository.getPublishedMembersForFamily(familyId) : Promise.resolve([]),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  return { members, loading, error, refetch };
}

export function useAdminAceFamilies(academicYearStart: number | null) {
  const {
    data: families = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<AceFamily[]>({
    queryKey: ['ace-families', 'admin', academicYearStart],
    queryFn: () =>
      academicYearStart === null
        ? Promise.resolve([])
        : aceFamiliesRepository.getAdminFamilies(academicYearStart),
    enabled: academicYearStart !== null,
    staleTime: 30 * 1000,
  });

  return { families, loading, error, refetch };
}

export function useAdminAceFamilyMembers(familyId: string | null) {
  const {
    data: members = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<AceFamilyMember[]>({
    queryKey: ['ace-family-members', 'admin', familyId],
    queryFn: () =>
      familyId ? aceFamiliesRepository.getAdminMembersForFamily(familyId) : Promise.resolve([]),
    enabled: !!familyId,
    staleTime: 30 * 1000,
  });

  return { members, loading, error, refetch };
}
