import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { memberLookupRepository } from '../data/repos/memberLookup';
import { MemberOption, buildMemberNameIndex } from '../lib/memberLinkMatching';

export const MEMBER_DIRECTORY_QUERY_KEY = ['member-directory'] as const;

/** Admin-only: every public_members row, for exact-name link suggestions. */
export function useMemberDirectory(enabled = true) {
  const { data: members = [], isLoading: loading, error } = useQuery<MemberOption[]>({
    queryKey: MEMBER_DIRECTORY_QUERY_KEY,
    queryFn: () => memberLookupRepository.listMemberDirectory(),
    enabled,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const nameIndex = useMemo(() => buildMemberNameIndex(members), [members]);

  return { members, byId, nameIndex, loading, error };
}
