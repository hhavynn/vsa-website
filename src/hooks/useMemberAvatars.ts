import { useQuery } from 'react-query';
import { photoRequestsRepository } from '../data/repos/photoRequests';
import { MemberAvatarMap, NO_MEMBER_AVATARS } from '../lib/memberPhotos';

export const MEMBER_AVATARS_QUERY_KEY = ['member-avatars', 'public'] as const;

/**
 * Every public surface shares this one cached bulk query instead of fetching
 * avatars per person. Fail-soft: an error yields an empty map so callers fall
 * back to local photos or initials.
 */
export function useMemberAvatars(): MemberAvatarMap {
  const { data } = useQuery(
    MEMBER_AVATARS_QUERY_KEY,
    () => photoRequestsRepository.getPublicMemberAvatars(),
    {
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
      retry: 1,
    },
  );
  return data ?? NO_MEMBER_AVATARS;
}
