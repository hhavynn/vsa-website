// Data shaping for the admin "Top 3 Story" graphic. Reads rows that the public
// leaderboard already shows (member_yearly_points via useIndividualLeaderboard)
// and orders them with the public comparator -- it never computes points.

import { HOUSE_COLORS, normalizeHouse } from '../../constants/houses';
import type { MemberHouseBadge } from '../../types';
import { comparePointsThenEvents } from '../../utils/leaderboardRanking';
import type { MemberAvatarMap } from '../memberPhotos';
import type { StoryTheme } from './storyCanvas';

export interface Top3SourceMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  points: number;
  events_attended: number;
}

export interface StoryHouse {
  name: string;
  color: string;
}

export interface Top3StoryEntry {
  rank: 1 | 2 | 3;
  memberId: string;
  name: string;
  points: number;
  pointsLabel: string;
  avatarUrl: string | null;
  house: StoryHouse | null;
}

export interface Top3StoryPreset {
  id: 'current' | 'heating' | 'crown';
  headline: [string, string];
}

export const TOP3_STORY_PRESETS: readonly Top3StoryPreset[] = [
  { id: 'current', headline: ['Current', 'Top 3'] },
  { id: 'heating', headline: ['Heating', 'up'] },
  { id: 'crown', headline: ['Take the', 'crown'] },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Public leaderboard order (points, then events), members with points only. */
export function selectTop3Members<T extends Top3SourceMember>(members: readonly T[]): T[] {
  return members
    .filter((member) => member.points > 0)
    .sort(comparePointsThenEvents)
    .slice(0, 3);
}

export function formatStoryName(member: Pick<Top3SourceMember, 'first_name' | 'last_name'>): string {
  return `${member.first_name ?? ''} ${member.last_name ?? ''}`.replace(/\s+/g, ' ').trim() || 'VSA Member';
}

export function formatStoryPoints(points: number): string {
  return Math.round(points).toLocaleString('en-US');
}

/** 2026 → "2026–27" */
export function formatStoryYearLabel(academicYearStart: number): string {
  return `${academicYearStart}–${String(academicYearStart + 1).slice(-2)}`;
}

export function formatStoryFileName(academicYearStart: number, presetId: Top3StoryPreset['id'], theme: StoryTheme): string {
  return `vsa-top3-story-${academicYearStart}-${String(academicYearStart + 1).slice(-2)}-${presetId}-${theme}.png`;
}

/** House pill for the story: the view's accent color, else the House constant. */
export function toStoryHouse(badge: MemberHouseBadge | null | undefined): StoryHouse | null {
  if (!badge) return null;
  const houseName = normalizeHouse(badge.house);
  const name = badge.display_name?.trim() || houseName || badge.house?.trim();
  if (!name) return null;
  const color = badge.accent_color && HEX_COLOR.test(badge.accent_color.trim())
    ? badge.accent_color.trim()
    : houseName
      ? HOUSE_COLORS[houseName]
      : '#3bbdb5';
  return { name, color };
}

export function buildTop3StoryEntries(
  members: readonly Top3SourceMember[],
  { avatars, houses }: { avatars: MemberAvatarMap; houses?: ReadonlyMap<string, MemberHouseBadge | null> },
): Top3StoryEntry[] {
  return selectTop3Members(members).map((member, index) => ({
    rank: (index + 1) as Top3StoryEntry['rank'],
    memberId: member.id,
    name: formatStoryName(member),
    points: member.points,
    pointsLabel: formatStoryPoints(member.points),
    avatarUrl: avatars.get(member.id) ?? null,
    house: toStoryHouse(houses?.get(member.id)),
  }));
}
