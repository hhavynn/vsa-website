import { useQuery } from 'react-query';
import { getPublicMemberRoles } from '../data/repos/memberRoles';
import type { PublicMemberRole } from '../lib/memberRoles';

/**
 * One bounded bulk request for the currently visible leaderboard members,
 * podium and opened profile. Cache identity is year + the sorted member IDs,
 * never just the person's display name.
 *
 * The All-Time view deliberately omits year-specific leadership titles instead
 * of misrepresenting an archived position as current.
 */
export function usePublishedLeaderboardRoles(
  academicYearStart: number | 'all' | null,
  memberIds: readonly string[],
) {
  const ids = Array.from(new Set(memberIds.filter(Boolean))).sort();
  return useQuery<Map<string, PublicMemberRole[]>, unknown>(
    ['public-leaderboard-roles', academicYearStart, ids],
    () => getPublicMemberRoles(academicYearStart as number, ids),
    {
      enabled: typeof academicYearStart === 'number' && ids.length > 0,
      staleTime: 5 * 60 * 1000,
      cacheTime: 15 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
}
