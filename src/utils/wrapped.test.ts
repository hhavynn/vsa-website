import {
  buildPublicHouseStandings,
  countEventsInWindow,
  formatStatNumber,
  pickHouseWinner,
  roundToFriendlyFloor,
  sortHouseStandings,
  sumCommunityPoints,
} from './wrapped';
import { HouseYearlyPoints } from '../types';

function makeHouse(overrides: Partial<HouseYearlyPoints> = {}): HouseYearlyPoints {
  return {
    house: 'Bowser',
    house_profile_id: 'hp1',
    display_name: 'House Bowser',
    image_url: null,
    accent_color: '#f97316',
    academic_year_start: 2025,
    academic_year_end: 2026,
    total_points: 100,
    events_attended: 20,
    unique_events: 10,
    unique_members: 40,
    average_points_per_member: 2.5,
    latest_activity_at: null,
    ...overrides,
  };
}

describe('countEventsInWindow', () => {
  it('counts events inside the date-only window inclusively', () => {
    const events = [
      { date: '2025-07-01T00:00:00+00:00' },
      { date: '2025-10-15T19:00:00+00:00' },
      { date: '2026-06-30T00:00:00+00:00' },
      { date: '2026-07-01T00:00:00+00:00' }, // next year
      { date: '2025-06-30T00:00:00+00:00' }, // previous year
    ];
    expect(countEventsInWindow(events, '2025-07-01', '2026-06-30')).toBe(3);
  });

  it('returns 0 for empty input', () => {
    expect(countEventsInWindow([], '2025-07-01', '2026-06-30')).toBe(0);
  });
});

describe('house standings helpers', () => {
  const houses = [
    makeHouse({ house: 'Boo', total_points: 250 }),
    makeHouse({ house: 'Bowser', total_points: 400 }),
    makeHouse({ house: 'Toad', total_points: 300 }),
  ];

  it('sorts standings by total points descending without mutating input', () => {
    const sorted = sortHouseStandings(houses);
    expect(sorted.map((h) => h.house)).toEqual(['Bowser', 'Toad', 'Boo']);
    expect(houses[0].house).toBe('Boo');
  });

  it('picks the winner with the most points', () => {
    expect(pickHouseWinner(houses)?.house).toBe('Bowser');
  });

  it('returns null winner when there are no meaningful standings', () => {
    expect(pickHouseWinner([])).toBeNull();
    expect(pickHouseWinner([makeHouse({ total_points: 0 })])).toBeNull();
  });

  it('sums community points across houses', () => {
    expect(sumCommunityPoints(houses)).toBe(950);
    expect(sumCommunityPoints([])).toBe(0);
  });
});

describe('buildPublicHouseStandings', () => {
  it('injects official 2025–2026 placeholder rows when the view is empty', () => {
    const standings = buildPublicHouseStandings([], 2025);
    expect(standings).toHaveLength(4);
    // House Chair's official public totals — same overrides as /leaderboard.
    expect(pickHouseWinner(standings)?.house).toBe('Bowser');
    expect(pickHouseWinner(standings)?.total_points).toBe(247);
    expect(sumCommunityPoints(standings)).toBe(247 + 215 + 158 + 125);
  });

  it('applies overrides on top of calculated rows for the override year', () => {
    const standings = buildPublicHouseStandings(
      [makeHouse({ house: 'Boo', total_points: 999, academic_year_start: 2025 })],
      2025
    );
    expect(standings[0].total_points).toBe(125);
  });

  it('leaves non-override years untouched', () => {
    const rows = [makeHouse({ house: 'Boo', total_points: 999, academic_year_start: 2026 })];
    expect(buildPublicHouseStandings(rows, 2026)).toEqual(rows);
    expect(buildPublicHouseStandings([], 2026)).toEqual([]);
  });
});

describe('stat formatting', () => {
  it('formats large numbers with separators', () => {
    expect(formatStatNumber(12345)).toBe('12,345');
    expect(formatStatNumber(7)).toBe('7');
  });

  it('rounds to a friendly floor for headline stats', () => {
    expect(roundToFriendlyFloor(12481)).toBe(12000);
    expect(roundToFriendlyFloor(987)).toBe(980);
    expect(roundToFriendlyFloor(150)).toBe(150);
    expect(roundToFriendlyFloor(42)).toBe(42);
  });
});
