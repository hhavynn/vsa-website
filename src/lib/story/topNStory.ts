// Read-only Top N story projection. All points and eligibility come from the
// existing published individual leaderboard; this module never calculates points.
import type { MemberHouseBadge } from '../../types';
import { assignTiedRanks, compareMemberNames, comparePointsThenEvents, isWithinTop } from '../../utils/leaderboardRanking';
import type { MemberAvatarMap } from '../memberPhotos';
import type { StoryTheme } from './storyCanvas';
import { formatStoryName, formatStoryPoints, toStoryHouse, type Top3SourceMember, type Top3StoryEntry, type Top3StoryPreset } from './top3Story';

export type StoryLimit = 3 | 5 | 10;
export const STORY_LIMITS: readonly StoryLimit[] = [3, 5, 10];

export interface TopNSelection<T extends Top3SourceMember> {
  selected: Array<T & { rank: number; tiedCount: number }>;
  /** The excluded tie group crosses the last available position. */
  excludedBoundaryTie: number;
  excludedRank: number | null;
}

/**
 * Preserve the public points/events comparator and stable name order.
 * A tie group spanning the requested boundary is excluded WHOLE, not split,
 * with a visible explanation in the story dialog.
 */
export function selectTopNMembers<T extends Top3SourceMember>(members: readonly T[], limit: StoryLimit): TopNSelection<T> {
  const ranked = assignTiedRanks(
    members.filter((member) => member.points > 0),
    comparePointsThenEvents,
    (a, b) => compareMemberNames(a, b) || a.id.localeCompare(b.id),
  );
  const crossing = ranked.filter((member) => member.rank <= limit && !isWithinTop(member, limit));
  return {
    selected: ranked.filter((member) => isWithinTop(member, limit)),
    excludedBoundaryTie: crossing.length,
    excludedRank: crossing[0]?.rank ?? null,
  };
}

export type TopNStoryEntry = Top3StoryEntry & { tiedCount?: number };

export function buildTopNStoryEntries(
  selection: TopNSelection<Top3SourceMember>,
  { avatars, houses }: { avatars: MemberAvatarMap; houses?: ReadonlyMap<string, MemberHouseBadge | null> },
): TopNStoryEntry[] {
  return selection.selected.map((member) => ({
    rank: member.rank,
    tiedCount: member.tiedCount,
    memberId: member.id,
    name: formatStoryName(member),
    points: member.points,
    pointsLabel: formatStoryPoints(member.points),
    avatarUrl: avatars.get(member.id) ?? null,
    house: toStoryHouse(houses?.get(member.id)),
  }));
}

export function formatTopNFileName(year: number, limit: StoryLimit, preset: Top3StoryPreset['id'], theme: StoryTheme): string {
  return `vsa-public-leaderboard-top${limit}-${year}-${String(year + 1).slice(-2)}-${preset}-${theme}.png`;
}

export function storyPresetForLimit(preset: Top3StoryPreset, limit: StoryLimit): Top3StoryPreset {
  return preset.id === 'current' && limit !== 3
    ? { ...preset, headline: ['Current', `Top ${limit}`] }
    : preset;
}
