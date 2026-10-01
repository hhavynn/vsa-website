import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { buildTop3StoryEntries, selectTop3Members, type Top3StoryEntry } from '../lib/story/top3Story';
import type { MemberHouseBadge } from '../types';
import { buildAcademicYearOptions, resolveDefaultLeaderboardYear } from '../utils/leaderboardYears';
import { useAcademicTerms } from './useAcademicTerms';
import { useIndividualLeaderboard } from './useIndividualLeaderboard';
import { useLeaderboardYears } from './useLeaderboardYears';
import { useMemberAvatars } from './useMemberAvatars';

export interface Top3StoryData {
  academicYearStart: number | null;
  entries: Top3StoryEntry[];
  loading: boolean;
  error: unknown;
}

/**
 * The public leaderboard's default year and its Top 3, with the same public
 * avatars and House badges the leaderboard shows. Read-only: no new point math.
 */
export function useTop3StoryData(): Top3StoryData {
  const { terms, loading: termsLoading } = useAcademicTerms();
  const { yearsWithData, loading: yearsLoading } = useLeaderboardYears();
  const yearsReady = !termsLoading && !yearsLoading;

  const academicYearStart = useMemo(
    () => (yearsReady ? resolveDefaultLeaderboardYear(buildAcademicYearOptions(terms, yearsWithData)) : null),
    [yearsReady, terms, yearsWithData],
  );

  const { data: members, isLoading: membersLoading, error } = useIndividualLeaderboard(academicYearStart);
  const avatars = useMemberAvatars();

  const topIds = useMemo(() => selectTop3Members(members ?? []).map((member) => member.id), [members]);

  const { data: houses, isLoading: housesLoading } = useQuery(
    ['top3-story-houses', academicYearStart, topIds.join(',')],
    async () => {
      const year = academicYearStart as number;
      const badges = await Promise.all(
        topIds.map(async (id) => [id, await leaderboardRepository.getMemberHouseBadge(id, year).catch(() => null)] as const),
      );
      return new Map<string, MemberHouseBadge | null>(badges);
    },
    { enabled: academicYearStart !== null && topIds.length > 0, staleTime: 60_000, retry: false },
  );

  const entries = useMemo(
    () => buildTop3StoryEntries(members ?? [], { avatars, houses }),
    [members, avatars, houses],
  );

  return {
    academicYearStart,
    entries,
    loading: !yearsReady || (academicYearStart !== null && membersLoading) || (topIds.length > 0 && housesLoading),
    error,
  };
}
