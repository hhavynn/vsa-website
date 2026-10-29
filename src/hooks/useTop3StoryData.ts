import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { buildTopNStoryEntries, selectTopNMembers, type StoryLimit, type TopNStoryEntry } from '../lib/story/topNStory';
import type { MemberHouseBadge } from '../types';
import { buildAcademicYearOptions, resolveDefaultLeaderboardYear } from '../utils/leaderboardYears';
import { useAcademicTerms } from './useAcademicTerms';
import { useIndividualLeaderboard } from './useIndividualLeaderboard';
import { useLeaderboardYears } from './useLeaderboardYears';
import { useMemberAvatars } from './useMemberAvatars';

export interface Top3StoryData {
  academicYearStart: number | null;
  entries: TopNStoryEntry[];
  loading: boolean;
  error: unknown;
  excludedBoundaryTie?: number;
  excludedRank?: number | null;
}

/**
 * Uses the exact published individual leaderboard, default year and
 * comparator. Only the selected Top N receives single-member House badge
 * reads; there is no private House standings or new scoring path.
 */
export function useTop3StoryData(limit: StoryLimit = 3): Top3StoryData {
  const { terms, loading: termsLoading } = useAcademicTerms();
  const { yearsWithData, loading: yearsLoading } = useLeaderboardYears();
  const yearsReady = !termsLoading && !yearsLoading;

  const academicYearStart = useMemo(
    () => (yearsReady ? resolveDefaultLeaderboardYear(buildAcademicYearOptions(terms, yearsWithData)) : null),
    [yearsReady, terms, yearsWithData],
  );

  const { data: members, isLoading: membersLoading, error } = useIndividualLeaderboard(academicYearStart);
  const avatars = useMemberAvatars();

  const selection = useMemo(() => selectTopNMembers(members ?? [], limit), [members, limit]);
  const topIds = useMemo(() => selection.selected.map((member) => member.id), [selection]);

  const { data: houses, isLoading: housesLoading } = useQuery(
    ['top-n-story-houses', academicYearStart, topIds.join(',')],
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
    () => buildTopNStoryEntries(selection, { avatars, houses }),
    [selection, avatars, houses],
  );

  return {
    academicYearStart,
    entries,
    excludedBoundaryTie: selection.excludedBoundaryTie,
    excludedRank: selection.excludedRank,
    loading: !yearsReady || (academicYearStart !== null && membersLoading) || (topIds.length > 0 && housesLoading),
    error,
  };
}
