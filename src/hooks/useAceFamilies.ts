import { useQuery } from '@tanstack/react-query';
import { AceFamily, AceFamilyMember } from '../types';
import { aceFamiliesRepository, type AcePickupEvidenceRow } from '../data/repos/aceFamilies';
import { AceMemberLinkRef } from '../lib/aceMemberLinks';

export function usePublishedAceFamilies(academicYearStart?: number | null) {
  const {
    data: families = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<AceFamily[]>({
    queryKey: ['ace-families', 'published', academicYearStart ?? null],
    queryFn: () => aceFamiliesRepository.getPublishedFamilies({ strict: true }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
    queryFn: () => aceFamiliesRepository.getAllPublishedMembers({ strict: true }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
    gcTime: 10 * 60 * 1000,
  });

  return { members, loading, error, refetch };
}

export function useAdminAceFamilies() {
  const {
    data: families = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<AceFamily[]>({
    queryKey: ['ace-families', 'admin'],
    queryFn: () => aceFamiliesRepository.getAdminFamilies(),
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

export const ACE_MEMBER_LINKS_QUERY_KEY = ['ace-member-links'] as const;

export function useAceMemberLinks(enabled = true) {
  const { data: links = [], isSuccess: ready } = useQuery<AceMemberLinkRef[]>({
    queryKey: ACE_MEMBER_LINKS_QUERY_KEY,
    queryFn: () => aceFamiliesRepository.getAllMemberLinks(),
    enabled,
    staleTime: 30 * 1000,
  });

  return { links, ready };
}

/**
 * Admin-only, family-scoped evidence. Never reuse a public ACE query key.
 * Fail closed: callers must wait for ready rather than treating [] as proof.
 */
export function useAcePickupEvidence(familyId: string | null) {
  const { data, isSuccess, isLoading, error, refetch } = useQuery<AcePickupEvidenceRow[]>({
    queryKey: ['ace-pickup-evidence', 'admin', familyId],
    queryFn: () => familyId
      ? aceFamiliesRepository.listPickupEvidenceForFamily(familyId)
      : Promise.resolve([]),
    enabled: !!familyId,
    staleTime: 0,
    gcTime: 0,
  });

  return {
    evidence: data ?? [],
    ready: !!familyId && isSuccess,
    loading: !!familyId && isLoading,
    error,
    refetch,
  };
}
