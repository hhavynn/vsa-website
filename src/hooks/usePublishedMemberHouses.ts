import { useQuery } from 'react-query';
import { houseMembershipsRepository, type PublicMemberHouse } from '../data/repos/houseMemberships';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';

/** One safe, year-specific batch for the visible page/podium; no individual RPC waterfall. */
export function usePublishedMemberHouses(
  academicYearStart: number | 'all' | null,
  visibleIds: readonly string[],
  enabled = true,
) {
  const ids = Array.from(new Set(visibleIds)).sort();
  const onDate = getLosAngelesDateOnly();
  return useQuery<Map<string, PublicMemberHouse>>({
    queryKey: ['public', 'visible-member-houses', academicYearStart, onDate, ids],
    queryFn: () => houseMembershipsRepository.getPublishedHousesForMemberIds(
      academicYearStart as number, ids, onDate,
    ),
    enabled: enabled && typeof academicYearStart === 'number' && ids.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}
