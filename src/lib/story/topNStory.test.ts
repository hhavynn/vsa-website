import type { MemberHouseBadge } from '../../types';
import { STORY_HEIGHT, STORY_SAFE_BOTTOM, STORY_SAFE_TOP } from './storyCanvas';
import { topNRowBounds } from './drawTopNStory';
import {
  buildTopNStoryEntries,
  formatTopNFileName,
  selectTopNMembers,
  storyPresetForLimit,
} from './topNStory';
import { TOP3_STORY_PRESETS } from './top3Story';

const member = (id: string, points: number, events = 1) => ({
  id, first_name: id, last_name: 'Fictional', points, events_attended: events,
});

describe('Top N member story from the published comparator (#629)', () => {
  it('does not mutate the source and selects 0, 1, 3, 5 or 10 valid rows', () => {
    const input = Array.from({ length: 11 }, (_, i) => member(String(i + 1), 110 - i * 10));
    const before = input.map((m) => m.id);
    expect(selectTopNMembers([], 3).selected).toHaveLength(0);
    expect(selectTopNMembers(input.slice(0, 1), 3).selected).toHaveLength(1);
    expect(selectTopNMembers(input, 3).selected).toHaveLength(3);
    expect(selectTopNMembers(input, 5).selected).toHaveLength(5);
    expect(selectTopNMembers(input, 10).selected).toHaveLength(10);
    expect(input.map((m) => m.id)).toEqual(before);
    expect(selectTopNMembers([member('zero', 0), member('negative', -2)], 10).selected).toEqual([]);
  });

  it('uses points then events and stable names within true ties', () => {
    const selected = selectTopNMembers([
      member('Ana', 100, 1), member('Bao', 100, 3), member('Chi', 100, 3), member('Dee', 10),
    ], 5).selected;
    expect(selected.map((m) => [m.id, m.rank, m.tiedCount])).toEqual([
      ['Bao', 1, 2], ['Chi', 1, 2], ['Ana', 3, 1], ['Dee', 4, 1],
    ]);
  });

  it('excludes entire boundary-spanning ties rather than inventing a cut', () => {
    const members = [
      member('first', 100),
      member('second', 90),
      member('tie-a', 80), member('tie-b', 80), member('tie-c', 80),
      member('last', 10),
    ];
    const top3 = selectTopNMembers(members, 3);
    expect(top3.selected.map((m) => m.id)).toEqual(['first', 'second']);
    expect(top3.excludedBoundaryTie).toBe(3);
    expect(top3.excludedRank).toBe(3);
    expect(selectTopNMembers(members, 5).selected).toHaveLength(5);
    expect(selectTopNMembers(Array.from({ length: 11 }, (_, i) => member(String(i), 5)), 10)).toMatchObject({
      excludedBoundaryTie: 11, excludedRank: 1, selected: [],
    });
  });

  it('formats approved avatar and House badges without any private member fields', () => {
    const badge = { house: 'Boo', display_name: 'Fictional House', house_profile_id: 'fake', accent_color: '#abcdef' } as MemberHouseBadge;
    const selected = selectTopNMembers([member('one', 75), member('two', 60)], 5);
    const entries = buildTopNStoryEntries(selected, {
      avatars: new Map([['one', 'https://example.org/avatar.png']]),
      houses: new Map([['one', badge]]),
    });
    expect(entries[0]).toMatchObject({
      rank: 1, name: 'one Fictional', pointsLabel: '75',
      avatarUrl: 'https://example.org/avatar.png', house: { name: 'Fictional House', color: '#abcdef' },
    });
    expect(entries[1].avatarUrl).toBeNull();
    expect(entries[1].house).toBeNull();
    expect(JSON.stringify(entries)).not.toContain('email');
  });

  it('keeps Top 3 headline presets unchanged and encodes N/cohort/year/theme in new file names', () => {
    expect(storyPresetForLimit(TOP3_STORY_PRESETS[0], 3)).toBe(TOP3_STORY_PRESETS[0]);
    expect(storyPresetForLimit(TOP3_STORY_PRESETS[0], 10).headline).toEqual(['Current', 'Top 10']);
    expect(formatTopNFileName(2026, 5, 'crown', 'dark'))
      .toBe('vsa-public-leaderboard-top5-2026-27-crown-dark.png');
  });

  it('fits 3/5/10 tied-member list cards within Instagram-safe space without collisions', () => {
    for (const n of [3, 5, 10] as const) {
      const rects = topNRowBounds(n, n);
      expect(rects).toHaveLength(n);
      expect(rects[0].top).toBeGreaterThanOrEqual(STORY_SAFE_TOP);
      expect(rects[n - 1].bottom).toBeLessThanOrEqual(STORY_HEIGHT - STORY_SAFE_BOTTOM - 80);
      rects.slice(1).forEach((rect, i) => expect(rect.top).toBeGreaterThan(rects[i].bottom));
    }
  });
});
