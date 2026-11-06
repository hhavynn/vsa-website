import { useQuery } from '@tanstack/react-query';
import { getPublishedBoardMemberIds } from '../data/repos/memberRoles';

/** Read only the explicitly linked, published Board category in one year.
 * Missing/unpublished data is an error, not an empty set of officers. */
export function usePublishedBoardRoster(year: number | 'all' | null) {
  return useQuery<Set<string>, unknown>({
    queryKey: ['published-board-member-ids', year],
    queryFn: () => getPublishedBoardMemberIds(year as number),
    enabled: typeof year === 'number',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
