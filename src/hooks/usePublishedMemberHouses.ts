import { useQuery } from '@tanstack/react-query';
import { houseMembershipsRepository, type PublicMemberHouse } from '../data/repos/houseMemberships';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';

const MAX_VISIBLE_HOUSE_IDS = 100;

/** Preserve every distinct visible member, chunking pages of 100 plus podium/modal IDs. */
export function batchVisibleHouseMemberIds(visibleIds: readonly string[]): string[][] {
  const ids = Array.from(new Set(visibleIds)).sort();
  const batches: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += MAX_VISIBLE_HOUSE_IDS) {
    batches.push(ids.slice(offset, offset + MAX_VISIBLE_HOUSE_IDS));
  }
  return batches;
}

/** Fails the whole optional House badge read if any chunk fails; never shows a partial roster. */
export function usePublishedMemberHouses(
  academicYearStart: number | 'all' | null,
  visibleIds: readonly string[],
  enabled = true,
) {
  const batches = batchVisibleHouseMemberIds(visibleIds);
  const ids = batches.flat();
  const onDate = getLosAngelesDateOnly();
  return useQuery<Map<string, PublicMemberHouse>>({
    queryKey: ['public', 'visible-member-houses', academicYearStart, onDate, ids],
    queryFn: async () => {
      const parts = await Promise.all(batches.map((chunk) =>
        houseMembershipsRepository.getPublishedHousesForMemberIds(academicYearStart as number, chunk, onDate),
      ));
      return new Map(parts.flatMap((part) => Array.from(part.entries())));
    },
    enabled: enabled && typeof academicYearStart === 'number' && ids.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}
