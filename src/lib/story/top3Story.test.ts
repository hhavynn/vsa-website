import type { MemberHouseBadge } from '../../types';
import {
  buildTop3StoryEntries,
  formatStoryFileName,
  formatStoryName,
  formatStoryPoints,
  formatStoryYearLabel,
  selectTop3Members,
  toStoryHouse,
  TOP3_STORY_PRESETS,
} from './top3Story';

const member = (id: string, points: number, events = 1, first: string | null = id, last: string | null = 'Nguyen') => ({
  id,
  first_name: first,
  last_name: last,
  points,
  events_attended: events,
});

const badge = (overrides: Partial<MemberHouseBadge> = {}): MemberHouseBadge => ({
  house: 'Bowser',
  house_profile_id: 'hp-1',
  display_name: 'House Bowser',
  accent_color: '#123456',
  ...overrides,
});

describe('selectTop3Members', () => {
  it('orders by points with the public tiebreak (more events wins) and keeps three', () => {
    const top = selectTop3Members([
      member('a', 40, 2),
      member('b', 90, 3),
      member('c', 40, 5),
      member('d', 70, 1),
      member('e', 10, 9),
    ]);
    expect(top.map((m) => m.id)).toEqual(['b', 'd', 'c']);
  });

  it('drops members with no points and returns fewer than three when needed', () => {
    expect(selectTop3Members([member('a', 0), member('b', 12)]).map((m) => m.id)).toEqual(['b']);
    expect(selectTop3Members([])).toEqual([]);
  });

  it('does not mutate the source rows', () => {
    const rows = [member('a', 1), member('b', 5)];
    selectTop3Members(rows);
    expect(rows.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('formatting', () => {
  it('formats names, collapsing blanks and falling back when empty', () => {
    expect(formatStoryName({ first_name: ' Minh  Anh ', last_name: 'Tran' })).toBe('Minh Anh Tran');
    expect(formatStoryName({ first_name: 'Bao', last_name: null })).toBe('Bao');
    expect(formatStoryName({ first_name: null, last_name: '' })).toBe('VSA Member');
  });

  it('formats points with thousands separators', () => {
    expect(formatStoryPoints(1240)).toBe('1,240');
    expect(formatStoryPoints(85)).toBe('85');
  });

  it('formats the academic year label and file name', () => {
    expect(formatStoryYearLabel(2026)).toBe('2026–27');
    expect(formatStoryYearLabel(2099)).toBe('2099–00');
    expect(formatStoryFileName(2026, 'crown', 'light')).toBe('vsa-top3-story-2026-27-crown-light.png');
  });
});

describe('toStoryHouse', () => {
  it('uses the view accent color when it is a hex color', () => {
    expect(toStoryHouse(badge())).toEqual({ name: 'House Bowser', color: '#123456' });
  });

  it('falls back to the House constant color, then teal', () => {
    expect(toStoryHouse(badge({ accent_color: null, house: 'Toad', display_name: '' }))).toEqual({ name: 'Toad', color: '#ef4444' });
    expect(toStoryHouse(badge({ accent_color: 'var(--x)', house: 'Mystery', display_name: 'Mystery' }))).toEqual({ name: 'Mystery', color: '#3bbdb5' });
  });

  it('returns null when there is no badge', () => {
    expect(toStoryHouse(null)).toBeNull();
    expect(toStoryHouse(undefined)).toBeNull();
  });
});

describe('buildTop3StoryEntries', () => {
  it('ranks, formats, and attaches only public avatars and House badges', () => {
    const entries = buildTop3StoryEntries(
      [member('a', 1240, 4, 'An'), member('b', 980, 2, 'Bao'), member('c', 980, 1, 'Chi'), member('d', 5)],
      {
        avatars: new Map([['a', 'https://img/a.webp']]),
        houses: new Map([['b', badge()], ['c', null]]),
      },
    );

    expect(entries).toEqual([
      { rank: 1, memberId: 'a', name: 'An Nguyen', points: 1240, pointsLabel: '1,240', avatarUrl: 'https://img/a.webp', house: null },
      { rank: 2, memberId: 'b', name: 'Bao Nguyen', points: 980, pointsLabel: '980', avatarUrl: null, house: { name: 'House Bowser', color: '#123456' } },
      { rank: 3, memberId: 'c', name: 'Chi Nguyen', points: 980, pointsLabel: '980', avatarUrl: null, house: null },
    ]);
  });
});

describe('TOP3_STORY_PRESETS', () => {
  it('offers distinct, non-empty headline presets', () => {
    expect(TOP3_STORY_PRESETS.length).toBeGreaterThanOrEqual(2);
    expect(new Set(TOP3_STORY_PRESETS.map((p) => p.id)).size).toBe(TOP3_STORY_PRESETS.length);
    TOP3_STORY_PRESETS.forEach((p) => {
      expect(p.headline.every((line) => line.trim().length > 0)).toBe(true);
    });
  });
});
