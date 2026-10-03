/**
 * Repository-layer characterization tests for LeaderboardRepository (#291, #293).
 *
 * POINTS SYSTEM COVERED: the LEADERBOARD system (member_event_attendance ->
 * member_yearly_points / house_* views, plus public_members for all-time). This
 * is NOT the check-in system (event_attendance + user_points); the two are not
 * unified. See docs/leaderboard-system.md.
 *
 * These pin what the repository does TODAY: which view or table each method
 * reads, which filters it applies, how rows are mapped, and how a database
 * failure surfaces. They are characterization tests, not statements of
 * preferred behaviour. The mock records the query chain, so "did it read the
 * public view and filter by year?" is a real assertion rather than a replay of
 * canned data.
 *
 * Row ORDER is deliberately not asserted from the database side: the mock
 * replays rows as queued, so the only ordering claim made here is that
 * `.order()` was requested with the stated column and direction.
 *
 * All names and ids below are made up.
 */

import { leaderboardRepository } from './leaderboard';
import { DatabaseError } from '../errors';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => {
  supabaseMock.reset();
});

/** Every recorded chain call against a table, flattened across its queries. */
function callsFor(table: string): Array<{ method: string; args: unknown[] }> {
  return supabaseMock.queriesFor(table).flatMap((q) => q.calls);
}

function orderCalls(table: string): unknown[][] {
  return callsFor(table)
    .filter((c) => c.method === 'order')
    .map((c) => c.args);
}

function selectArg(table: string): string {
  const select = callsFor(table).find((c) => c.method === 'select');
  return String(select?.args[0]);
}

function limitArgs(table: string): unknown[] {
  return callsFor(table)
    .filter((c) => c.method === 'limit')
    .map((c) => c.args[0]);
}

const denied = () => postgrestError('permission denied for view', '42501');

const memberRow = {
  member_id: 'member-aaa',
  first_name: 'Test',
  last_name: 'Member',
  college: 'Test College',
  graduation_year: '2027',
  academic_year_start: 2025,
  academic_year_end: 2026,
  total_points: 12,
  events_attended: 4,
};

const houseRow = {
  house: 'test-house',
  house_profile_id: 'house-profile-1',
  display_name: 'Test House',
  image_url: null,
  accent_color: '#112233',
  academic_year_start: 2025,
  academic_year_end: 2026,
  total_points: 40,
  events_attended: 9,
  unique_events: 5,
  unique_members: 7,
  average_points_per_member: null,
  latest_activity_at: null,
};

describe('LeaderboardRepository.getYearlyLeaderboard', () => {
  it('reads the member_yearly_points view, filtered to the year, ordered by total_points desc', async () => {
    supabaseMock.queueResult('member_yearly_points', { data: [memberRow], error: null });

    const result = await leaderboardRepository.getYearlyLeaderboard(2025);

    expect(result).toEqual([memberRow]);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['member_yearly_points']);
    expect(supabaseMock.filtersFor('member_yearly_points')).toEqual([['academic_year_start', 2025]]);
    expect(orderCalls('member_yearly_points')).toEqual([['total_points', { ascending: false }]]);
  });

  it('never reads the member_event_attendance base table', async () => {
    await leaderboardRepository.getYearlyLeaderboard(2025);

    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('returns rows untouched, including zero-point and null-field members', async () => {
    const sparse = { ...memberRow, member_id: 'member-bbb', college: null, graduation_year: null, total_points: 0, events_attended: 0 };
    supabaseMock.queueResult('member_yearly_points', { data: [memberRow, sparse], error: null });

    const result = await leaderboardRepository.getYearlyLeaderboard(2025);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(sparse);
  });

  it('returns [] for an empty result', async () => {
    supabaseMock.queueResult('member_yearly_points', { data: [], error: null });
    await expect(leaderboardRepository.getYearlyLeaderboard(2025)).resolves.toEqual([]);
  });

  it('returns [] when data is null', async () => {
    supabaseMock.queueResult('member_yearly_points', { data: null, error: null });
    await expect(leaderboardRepository.getYearlyLeaderboard(2025)).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('member_yearly_points', { data: null, error: denied() });
    await expect(leaderboardRepository.getYearlyLeaderboard(2025)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('past-year reproducibility: the same queued rows give identical results and always filter on the requested year', async () => {
    const rows = [memberRow, { ...memberRow, member_id: 'member-bbb', total_points: 3, events_attended: 1 }];
    supabaseMock.queueResult('member_yearly_points', { data: rows, error: null });
    supabaseMock.queueResult('member_yearly_points', { data: rows, error: null });

    const first = await leaderboardRepository.getYearlyLeaderboard(2024);
    const second = await leaderboardRepository.getYearlyLeaderboard(2024);

    expect(second).toEqual(first);
    const yearFilters = supabaseMock
      .filtersFor('member_yearly_points')
      .filter(([column]) => column === 'academic_year_start');
    expect(yearFilters).toEqual([
      ['academic_year_start', 2024],
      ['academic_year_start', 2024],
    ]);
    // Never silently swapped for the current academic year.
    const currentYear = new Date().getFullYear();
    expect(yearFilters.map(([, value]) => value)).not.toContain(currentYear);
    expect(yearFilters.map(([, value]) => value)).not.toContain(currentYear - 1);
  });
});

describe('LeaderboardRepository.getAllTimeLeaderboard', () => {
  const publicRow = {
    id: 'member-aaa',
    first_name: 'Test',
    last_name: 'Member',
    college: null,
    year: null,
    points: 30,
    events_attended: null,
  };

  it('reads public_members (not member_yearly_points), ordered by points desc', async () => {
    supabaseMock.queueResult('public_members', { data: [publicRow], error: null });

    const result = await leaderboardRepository.getAllTimeLeaderboard();

    expect(result).toEqual([publicRow]);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['public_members']);
    expect(supabaseMock.queriesFor('member_yearly_points')).toHaveLength(0);
    expect(orderCalls('public_members')).toEqual([['points', { ascending: false }]]);
  });

  it('selects an explicit public column list that excludes user_id and email', async () => {
    await leaderboardRepository.getAllTimeLeaderboard();

    const columns = selectArg('public_members')
      .split(',')
      .map((c) => c.trim());
    expect(columns).toEqual(['id', 'first_name', 'last_name', 'college', 'year', 'points', 'events_attended']);
    expect(columns).not.toContain('*');
    expect(columns).not.toContain('user_id');
    expect(columns).not.toContain('email');
  });

  it('applies no year filter (all-time)', async () => {
    await leaderboardRepository.getAllTimeLeaderboard();
    expect(supabaseMock.filtersFor('public_members')).toEqual([]);
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('public_members', { data: [], error: null });
    supabaseMock.queueResult('public_members', { data: null, error: null });

    await expect(leaderboardRepository.getAllTimeLeaderboard()).resolves.toEqual([]);
    await expect(leaderboardRepository.getAllTimeLeaderboard()).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('public_members', { data: null, error: denied() });
    await expect(leaderboardRepository.getAllTimeLeaderboard()).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getYearlyHouseLeaderboard', () => {
  it('reads house_yearly_points, filtered to the year, ordered by total_points desc, with no limit', async () => {
    supabaseMock.queueResult('house_yearly_points', { data: [houseRow], error: null });

    const result = await leaderboardRepository.getYearlyHouseLeaderboard(2025);

    expect(result).toEqual([houseRow]);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['house_yearly_points']);
    expect(supabaseMock.filtersFor('house_yearly_points')).toEqual([['academic_year_start', 2025]]);
    expect(orderCalls('house_yearly_points')).toEqual([['total_points', { ascending: false }]]);
    expect(supabaseMock.usedMethod('house_yearly_points', 'limit')).toBe(false);
  });

  it('keeps a House with zero points and null optional fields', async () => {
    const empty = { ...houseRow, house: 'quiet-house', total_points: 0, events_attended: 0, unique_events: 0, unique_members: 0 };
    supabaseMock.queueResult('house_yearly_points', { data: [houseRow, empty], error: null });

    const result = await leaderboardRepository.getYearlyHouseLeaderboard(2025);

    expect(result.map((h) => h.house)).toEqual(['test-house', 'quiet-house']);
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('house_yearly_points', { data: [], error: null });
    supabaseMock.queueResult('house_yearly_points', { data: null, error: null });

    await expect(leaderboardRepository.getYearlyHouseLeaderboard(2025)).resolves.toEqual([]);
    await expect(leaderboardRepository.getYearlyHouseLeaderboard(2025)).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('house_yearly_points', { data: null, error: denied() });
    await expect(leaderboardRepository.getYearlyHouseLeaderboard(2025)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getTopYearlyHouseStandings', () => {
  it('reads house_yearly_points for the year, ordered by total_points desc, default limit 3', async () => {
    supabaseMock.queueResult('house_yearly_points', { data: [houseRow], error: null });

    const result = await leaderboardRepository.getTopYearlyHouseStandings(2025);

    expect(result).toEqual([houseRow]);
    expect(supabaseMock.filtersFor('house_yearly_points')).toEqual([['academic_year_start', 2025]]);
    expect(orderCalls('house_yearly_points')).toEqual([['total_points', { ascending: false }]]);
    expect(limitArgs('house_yearly_points')).toEqual([3]);
  });

  it('honours a custom limit', async () => {
    await leaderboardRepository.getTopYearlyHouseStandings(2024, 5);

    expect(limitArgs('house_yearly_points')).toEqual([5]);
    expect(supabaseMock.filtersFor('house_yearly_points')).toEqual([['academic_year_start', 2024]]);
  });

  it('selects an explicit column list rather than *', async () => {
    await leaderboardRepository.getTopYearlyHouseStandings(2025);

    const columns = selectArg('house_yearly_points')
      .split(',')
      .map((c) => c.trim());
    expect(columns).not.toContain('*');
    expect(columns).toEqual(
      expect.arrayContaining(['house', 'house_profile_id', 'display_name', 'total_points', 'unique_members', 'latest_activity_at'])
    );
    expect(columns).not.toContain('user_id');
    expect(columns).not.toContain('email');
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('house_yearly_points', { data: [], error: null });
    supabaseMock.queueResult('house_yearly_points', { data: null, error: null });

    await expect(leaderboardRepository.getTopYearlyHouseStandings(2025)).resolves.toEqual([]);
    await expect(leaderboardRepository.getTopYearlyHouseStandings(2025)).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('house_yearly_points', { data: null, error: denied() });
    await expect(leaderboardRepository.getTopYearlyHouseStandings(2025)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getAllTimeHouseLeaderboard', () => {
  it('reads house_all_time_points ordered by total_points desc, with no year filter', async () => {
    supabaseMock.queueResult('house_all_time_points', { data: [houseRow], error: null });

    const result = await leaderboardRepository.getAllTimeHouseLeaderboard();

    expect(result).toEqual([houseRow]);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['house_all_time_points']);
    expect(supabaseMock.filtersFor('house_all_time_points')).toEqual([]);
    expect(orderCalls('house_all_time_points')).toEqual([['total_points', { ascending: false }]]);
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('house_all_time_points', { data: [], error: null });
    supabaseMock.queueResult('house_all_time_points', { data: null, error: null });

    await expect(leaderboardRepository.getAllTimeHouseLeaderboard()).resolves.toEqual([]);
    await expect(leaderboardRepository.getAllTimeHouseLeaderboard()).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('house_all_time_points', { data: null, error: denied() });
    await expect(leaderboardRepository.getAllTimeHouseLeaderboard()).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getRecentHouseActivity', () => {
  const activityRow = {
    house: 'test-house',
    house_profile_id: 'house-profile-1',
    display_name: 'Test House',
    image_url: null,
    accent_color: null,
    event_id: 'event-1',
    event_name: 'Test Mixer',
    event_date: '2025-11-15',
    academic_year_start: 2025,
    academic_year_end: 2026,
    total_points: 6,
    contributing_members: 3,
    latest_activity_at: null,
  };

  it('reads house_recent_activity for the year, ordered by latest_activity_at desc, default limit 8', async () => {
    supabaseMock.queueResult('house_recent_activity', { data: [activityRow], error: null });

    const result = await leaderboardRepository.getRecentHouseActivity(2025);

    expect(result).toEqual([activityRow]);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['house_recent_activity']);
    expect(supabaseMock.filtersFor('house_recent_activity')).toEqual([['academic_year_start', 2025]]);
    expect(orderCalls('house_recent_activity')).toEqual([['latest_activity_at', { ascending: false }]]);
    expect(limitArgs('house_recent_activity')).toEqual([8]);
  });

  it('honours a custom limit', async () => {
    await leaderboardRepository.getRecentHouseActivity(2024, 2);
    expect(limitArgs('house_recent_activity')).toEqual([2]);
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('house_recent_activity', { data: [], error: null });
    supabaseMock.queueResult('house_recent_activity', { data: null, error: null });

    await expect(leaderboardRepository.getRecentHouseActivity(2025)).resolves.toEqual([]);
    await expect(leaderboardRepository.getRecentHouseActivity(2025)).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('house_recent_activity', { data: null, error: denied() });
    await expect(leaderboardRepository.getRecentHouseActivity(2025)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getHouseMemberRankings', () => {
  const rankingRow = {
    house: 'test-house',
    house_profile_id: 'house-profile-1',
    display_name: 'Test House',
    image_url: 'https://example.test/house.png',
    accent_color: '#112233',
    member_id: 'member-aaa',
    first_name: 'Test',
    last_name: 'Member',
    college: 'Test College',
    graduation_year: '2027',
    academic_year_start: 2025,
    academic_year_end: 2026,
    total_points: 12,
    events_attended: 4,
    unique_events: 3,
    latest_activity_at: '2025-12-01T00:00:00Z',
  };

  describe('source selection', () => {
    it('numeric year reads house_member_yearly_points with the year filter and total_points desc', async () => {
      await leaderboardRepository.getHouseMemberRankings(2025);

      expect(supabaseMock.queries().map((q) => q.table)).toEqual(['house_member_yearly_points']);
      expect(supabaseMock.filtersFor('house_member_yearly_points')).toEqual([['academic_year_start', 2025]]);
      expect(orderCalls('house_member_yearly_points')).toEqual([['total_points', { ascending: false }]]);
    });

    it("'all' reads house_member_all_time_points with NO year filter, ordered by year then points", async () => {
      await leaderboardRepository.getHouseMemberRankings('all');

      expect(supabaseMock.queries().map((q) => q.table)).toEqual(['house_member_all_time_points']);
      expect(supabaseMock.filtersFor('house_member_all_time_points')).toEqual([]);
      expect(orderCalls('house_member_all_time_points')).toEqual([
        ['academic_year_start', { ascending: false }],
        ['total_points', { ascending: false }],
      ]);
    });
  });

  describe('row mapping and grouping', () => {
    it('maps a complete row field-for-field', async () => {
      supabaseMock.queueResult('house_member_yearly_points', { data: [rankingRow], error: null });

      const result = await leaderboardRepository.getHouseMemberRankings(2025);

      expect(Array.from(result.keys())).toEqual(['house-profile-1']);
      expect(result.get('house-profile-1')).toEqual([rankingRow]);
    });

    it('groups by house_profile_id and keeps rows for different Houses apart', async () => {
      const other = { ...rankingRow, house: 'other-house', house_profile_id: 'house-profile-2', display_name: 'Other House', member_id: 'member-bbb' };
      const second = { ...rankingRow, member_id: 'member-ccc', total_points: 2 };
      supabaseMock.queueResult('house_member_yearly_points', { data: [rankingRow, other, second], error: null });

      const result = await leaderboardRepository.getHouseMemberRankings(2025);

      expect(Array.from(result.keys()).sort()).toEqual(['house-profile-1', 'house-profile-2']);
      expect(result.get('house-profile-1')?.map((m) => m.member_id)).toEqual(['member-aaa', 'member-ccc']);
      expect(result.get('house-profile-2')?.map((m) => m.member_id)).toEqual(['member-bbb']);
    });

    it('falls back to the house slug as the group key when house_profile_id is missing or empty', async () => {
      const noProfile = { ...rankingRow, house_profile_id: null };
      const emptyProfile = { ...rankingRow, member_id: 'member-bbb', house_profile_id: '' };
      supabaseMock.queueResult('house_member_yearly_points', { data: [noProfile, emptyProfile], error: null });

      const result = await leaderboardRepository.getHouseMemberRankings(2025);

      expect(Array.from(result.keys())).toEqual(['test-house']);
      expect(result.get('test-house')).toHaveLength(2);
      // The entry itself reports an empty profile id rather than the fallback key.
      expect(result.get('test-house')?.[0].house_profile_id).toBe('');
    });

    it('skips rows that have neither house_profile_id nor house', async () => {
      const orphan = { ...rankingRow, member_id: 'member-orphan', house: null, house_profile_id: null };
      const blank = { ...rankingRow, member_id: 'member-blank', house: '', house_profile_id: '' };
      supabaseMock.queueResult('house_member_yearly_points', { data: [orphan, blank, rankingRow], error: null });

      const result = await leaderboardRepository.getHouseMemberRankings(2025);

      const all = Array.from(result.values()).flat();
      expect(all.map((m) => m.member_id)).toEqual(['member-aaa']);
    });

    it('defaults null points/events to 0 and null names to empty strings', async () => {
      const sparse = {
        house: 'test-house',
        house_profile_id: 'house-profile-1',
        display_name: null,
        member_id: 'member-sparse',
        first_name: null,
        last_name: null,
        college: null,
        graduation_year: null,
        academic_year_start: 2025,
        academic_year_end: 2026,
        total_points: null,
        events_attended: null,
        unique_events: null,
      };
      supabaseMock.queueResult('house_member_yearly_points', { data: [sparse], error: null });

      const [entry] = (await leaderboardRepository.getHouseMemberRankings(2025)).get('house-profile-1') ?? [];

      expect(entry).toMatchObject({
        first_name: '',
        last_name: '',
        total_points: 0,
        events_attended: 0,
        unique_events: 0,
        college: null,
        graduation_year: null,
        image_url: null,
        accent_color: null,
        latest_activity_at: null,
      });
    });

    it('falls back display_name to the house slug, then to an empty string', async () => {
      const noDisplay = { ...rankingRow, display_name: null };
      const nothing = { ...rankingRow, member_id: 'member-bbb', house: null, display_name: null };
      supabaseMock.queueResult('house_member_yearly_points', { data: [noDisplay, nothing], error: null });

      const [first, second] = (await leaderboardRepository.getHouseMemberRankings(2025)).get('house-profile-1') ?? [];

      expect(first.display_name).toBe('test-house');
      expect(second.house).toBe('');
      expect(second.display_name).toBe('');
    });

    it('keeps zero-point members in their House', async () => {
      const zero = { ...rankingRow, member_id: 'member-zero', total_points: 0, events_attended: 0, unique_events: 0 };
      supabaseMock.queueResult('house_member_yearly_points', { data: [zero], error: null });

      const result = await leaderboardRepository.getHouseMemberRankings(2025);

      expect(result.get('house-profile-1')?.[0].total_points).toBe(0);
    });

    it('returns an empty Map for empty and for null data', async () => {
      supabaseMock.queueResult('house_member_yearly_points', { data: [], error: null });
      supabaseMock.queueResult('house_member_all_time_points', { data: null, error: null });

      const yearly = await leaderboardRepository.getHouseMemberRankings(2025);
      const allTime = await leaderboardRepository.getHouseMemberRankings('all');

      expect(yearly).toBeInstanceOf(Map);
      expect(yearly.size).toBe(0);
      expect(allTime.size).toBe(0);
    });
  });

  it('rejects with a DatabaseError on a database error (yearly and all-time)', async () => {
    supabaseMock.queueResult('house_member_yearly_points', { data: null, error: denied() });
    supabaseMock.queueResult('house_member_all_time_points', { data: null, error: denied() });

    await expect(leaderboardRepository.getHouseMemberRankings(2025)).rejects.toBeInstanceOf(DatabaseError);
    await expect(leaderboardRepository.getHouseMemberRankings('all')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getMemberEventHistory', () => {
  const historyRow = {
    member_id: 'member-aaa',
    event_id: 'event-1',
    event_name: 'Test Mixer',
    event_date: '2025-11-15',
    event_end_date: null,
    event_type: 'mixer',
    points_earned: 2,
    academic_year_start: 2025,
    academic_year_end: 2026,
  };

  it('reads only the member_event_history view, filtered by member, ordered by event_date desc', async () => {
    supabaseMock.queueResult('member_event_history', { data: [historyRow], error: null });

    const result = await leaderboardRepository.getMemberEventHistory('member-aaa');

    expect(result).toEqual([historyRow]);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['member_event_history']);
    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
    expect(orderCalls('member_event_history')).toEqual([['event_date', { ascending: false }]]);
  });

  it('filters by member only when no year is passed', async () => {
    await leaderboardRepository.getMemberEventHistory('member-aaa');
    expect(supabaseMock.filtersFor('member_event_history')).toEqual([['member_id', 'member-aaa']]);
  });

  it('adds the academic_year_start filter when a numeric year is passed', async () => {
    await leaderboardRepository.getMemberEventHistory('member-aaa', 2025);
    expect(supabaseMock.filtersFor('member_event_history')).toEqual([
      ['member_id', 'member-aaa'],
      ['academic_year_start', 2025],
    ]);
  });

  it('treats year 0 as a number and still filters on it', async () => {
    await leaderboardRepository.getMemberEventHistory('member-aaa', 0);
    expect(supabaseMock.filtersFor('member_event_history')).toContainEqual(['academic_year_start', 0]);
  });

  it('keeps history rows with null year fields', async () => {
    const undated = { ...historyRow, academic_year_start: null, academic_year_end: null, event_end_date: null };
    supabaseMock.queueResult('member_event_history', { data: [undated], error: null });

    await expect(leaderboardRepository.getMemberEventHistory('member-aaa')).resolves.toEqual([undated]);
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('member_event_history', { data: [], error: null });
    supabaseMock.queueResult('member_event_history', { data: null, error: null });

    await expect(leaderboardRepository.getMemberEventHistory('member-aaa')).resolves.toEqual([]);
    await expect(leaderboardRepository.getMemberEventHistory('member-aaa')).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('member_event_history', { data: null, error: denied() });
    await expect(leaderboardRepository.getMemberEventHistory('member-aaa')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getMemberHouseBadge', () => {
  const badgeRow = {
    house: 'test-house',
    house_profile_id: 'house-profile-1',
    display_name: 'Test House',
    accent_color: '#112233',
    academic_year_start: 2025,
    latest_activity_at: '2025-12-01T00:00:00Z',
  };

  it('numeric year reads house_member_yearly_points, filtered by member and year, limit 1', async () => {
    supabaseMock.queueResult('house_member_yearly_points', { data: [badgeRow], error: null });

    const result = await leaderboardRepository.getMemberHouseBadge('member-aaa', 2025);

    expect(result).toEqual(badgeRow);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['house_member_yearly_points']);
    expect(supabaseMock.filtersFor('house_member_yearly_points')).toEqual([
      ['member_id', 'member-aaa'],
      ['academic_year_start', 2025],
    ]);
    expect(limitArgs('house_member_yearly_points')).toEqual([1]);
  });

  it("'all' reads house_member_all_time_points, filtered by member only (no year), limit 1", async () => {
    supabaseMock.queueResult('house_member_all_time_points', { data: [badgeRow], error: null });

    const result = await leaderboardRepository.getMemberHouseBadge('member-aaa', 'all');

    expect(result).toEqual(badgeRow);
    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['house_member_all_time_points']);
    expect(supabaseMock.filtersFor('house_member_all_time_points')).toEqual([['member_id', 'member-aaa']]);
    expect(limitArgs('house_member_all_time_points')).toEqual([1]);
  });

  it('orders newest year first, then most recent activity, before taking one row', async () => {
    await leaderboardRepository.getMemberHouseBadge('member-aaa', 'all');

    expect(orderCalls('house_member_all_time_points')).toEqual([
      ['academic_year_start', { ascending: false }],
      ['latest_activity_at', { ascending: false, nullsFirst: false }],
    ]);
  });

  it('selects an explicit column list rather than *', async () => {
    await leaderboardRepository.getMemberHouseBadge('member-aaa', 2025);

    expect(selectArg('house_member_yearly_points')).not.toContain('*');
    expect(selectArg('house_member_yearly_points')).not.toContain('member_id');
  });

  it('returns the first row when the view returns several', async () => {
    const older = { ...badgeRow, house: 'older-house', academic_year_start: 2024 };
    supabaseMock.queueResult('house_member_all_time_points', { data: [badgeRow, older], error: null });

    await expect(leaderboardRepository.getMemberHouseBadge('member-aaa', 'all')).resolves.toEqual(badgeRow);
  });

  it('returns null for a member in no House (empty and null data)', async () => {
    supabaseMock.queueResult('house_member_yearly_points', { data: [], error: null });
    supabaseMock.queueResult('house_member_yearly_points', { data: null, error: null });

    await expect(leaderboardRepository.getMemberHouseBadge('member-aaa', 2025)).resolves.toBeNull();
    await expect(leaderboardRepository.getMemberHouseBadge('member-aaa', 2025)).resolves.toBeNull();
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('house_member_yearly_points', { data: null, error: denied() });
    await expect(leaderboardRepository.getMemberHouseBadge('member-aaa', 2025)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('LeaderboardRepository.getYearsWithData', () => {
  it('reads academic_year_start from member_yearly_points, requesting newest first', async () => {
    await leaderboardRepository.getYearsWithData();

    expect(supabaseMock.queries().map((q) => q.table)).toEqual(['member_yearly_points']);
    expect(selectArg('member_yearly_points')).toBe('academic_year_start');
    expect(orderCalls('member_yearly_points')).toEqual([['academic_year_start', { ascending: false }]]);
  });

  it('de-dupes and sorts descending regardless of the order returned', async () => {
    supabaseMock.queueResult('member_yearly_points', {
      data: [
        { academic_year_start: 2023 },
        { academic_year_start: 2025 },
        { academic_year_start: 2023 },
        { academic_year_start: 2024 },
        { academic_year_start: 2025 },
      ],
      error: null,
    });

    await expect(leaderboardRepository.getYearsWithData()).resolves.toEqual([2025, 2024, 2023]);
  });

  it('ignores null, undefined and non-number years (including numeric strings)', async () => {
    supabaseMock.queueResult('member_yearly_points', {
      data: [
        { academic_year_start: 2025 },
        { academic_year_start: null },
        {},
        { academic_year_start: '2024' },
      ],
      error: null,
    });

    await expect(leaderboardRepository.getYearsWithData()).resolves.toEqual([2025]);
  });

  it('returns [] for empty and for null data', async () => {
    supabaseMock.queueResult('member_yearly_points', { data: [], error: null });
    supabaseMock.queueResult('member_yearly_points', { data: null, error: null });

    await expect(leaderboardRepository.getYearsWithData()).resolves.toEqual([]);
    await expect(leaderboardRepository.getYearsWithData()).resolves.toEqual([]);
  });

  it('rejects with a DatabaseError on a database error', async () => {
    supabaseMock.queueResult('member_yearly_points', { data: null, error: denied() });
    await expect(leaderboardRepository.getYearsWithData()).rejects.toBeInstanceOf(DatabaseError);
  });
});
