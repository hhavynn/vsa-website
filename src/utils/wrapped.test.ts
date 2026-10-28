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

  // Characterization (#293). LEADERBOARD system (house_yearly_points); not the
  // check-in system. sortHouseStandings returns an ordered list; callers derive
  // rank from position (index + 1), so order is the only thing pinned here.
  describe('sortHouseStandings edge cases', () => {
    it('keeps input order for Houses tied on points (stable sort)', () => {
      const tied = [
        makeHouse({ house: 'Toad', total_points: 50 }),
        makeHouse({ house: 'Boo', total_points: 50 }),
        makeHouse({ house: 'Bowser', total_points: 50 }),
      ];
      expect(sortHouseStandings(tied).map((h) => h.house)).toEqual(['Toad', 'Boo', 'Bowser']);
      expect(sortHouseStandings([...tied].reverse()).map((h) => h.house)).toEqual(['Bowser', 'Boo', 'Toad']);
    });

    it('keeps tied Houses in input order within a larger list', () => {
      const mixed = [
        makeHouse({ house: 'Toad', total_points: 10 }),
        makeHouse({ house: 'Boo', total_points: 30 }),
        makeHouse({ house: 'Bowser', total_points: 10 }),
        makeHouse({ house: 'Donkey Kong', total_points: 30 }),
      ];
      expect(sortHouseStandings(mixed).map((h) => h.house)).toEqual(['Boo', 'Donkey Kong', 'Toad', 'Bowser']);
    });

    it('places a House with zero points last but keeps it in the list', () => {
      const withZero = [
        makeHouse({ house: 'Boo', total_points: 0 }),
        makeHouse({ house: 'Bowser', total_points: 7 }),
      ];
      expect(sortHouseStandings(withZero).map((h) => h.house)).toEqual(['Bowser', 'Boo']);
    });

    it('treats a missing total_points as zero', () => {
      const missing = makeHouse({ house: 'Boo' });
      Reflect.deleteProperty(missing, 'total_points');
      const sorted = sortHouseStandings([missing, makeHouse({ house: 'Toad', total_points: 1 })]);
      expect(sorted.map((h) => h.house)).toEqual(['Toad', 'Boo']);
    });

    it('returns an empty list for an empty input', () => {
      expect(sortHouseStandings([])).toEqual([]);
    });

    it('picks the first-listed House as winner when positive totals tie', () => {
      const tied = [
        makeHouse({ house: 'Toad', total_points: 50 }),
        makeHouse({ house: 'Boo', total_points: 50 }),
      ];
      expect(pickHouseWinner(tied)?.house).toBe('Toad');
    });

    it('returns no winner when every House is at zero', () => {
      expect(pickHouseWinner([makeHouse({ total_points: 0 }), makeHouse({ house: 'Boo', total_points: 0 })])).toBeNull();
    });
  });
});

describe('buildPublicHouseStandings after House scoring embargo', () => {
  it('never fabricates historical House score rows when the view is empty', () => {
    expect(buildPublicHouseStandings([], 2025)).toEqual([]);
  });

  it('does not replace calculated values with a historical public override', () => {
    const rows = [makeHouse({ house: 'synthetic-house', total_points: 7, academic_year_start: 2025 })];
    expect(buildPublicHouseStandings(rows, 2025)).toEqual(rows);
    expect(rows[0].total_points).toBe(7);
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
