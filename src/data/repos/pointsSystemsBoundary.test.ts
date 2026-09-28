/**
 * Boundary between the two points systems (#310). See the table at the top of
 * docs/leaderboard-system.md.
 *
 * The public leaderboard (leaderboard.ts) must never read the check-in tables,
 * and the check-in repository (points.ts) must never read the leaderboard's.
 * Every method on each repository is discovered by reflection and invoked, so a
 * new method that crosses the line fails here without being registered.
 */

import { leaderboardRepository, LeaderboardRepository } from './leaderboard';
import { pointsRepository, PointsRepository } from './points';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const CHECK_IN_TABLES = ['event_attendance', 'user_points', 'rpc:check_in_to_event'];
const LEADERBOARD_TABLES = [
  'member_event_attendance',
  'members',
  'member_yearly_points',
  'house_member_yearly_points',
  'house_member_all_time_points',
  'house_yearly_points',
  'house_all_time_points',
  'house_recent_activity',
  'member_event_history',
];

// Arguments for any method; the mock returns empty data, so values only need
// to satisfy the call.
const ARGS = [2025, 10, 0];

// Methods that throw by design before querying anything.
const DISABLED = new Set(['addPoints']);

// Methods that dereference a single user_points row before their later
// queries: give them one, so every query they make is actually exercised.
const USER_POINTS_ROW = { user_id: 'user-1', points: 5, last_updated: '2026-09-01T00:00:00Z' };
const FIXTURES: Record<string, () => void> = {
  getPointsStats: () => supabaseMock.queueResult('user_points', { data: USER_POINTS_ROW, error: null }),
  getUserRank: () => supabaseMock.queueResult('user_points', { data: USER_POINTS_ROW, error: null }),
};

async function tablesTouchedBy(repository: object, method: string): Promise<string[]> {
  supabaseMock.reset();
  FIXTURES[method]?.();
  const fn = (repository as Record<string, (...args: unknown[]) => unknown>)[method];
  if (DISABLED.has(method)) {
    await expect(Promise.resolve().then(() => fn.apply(repository, ARGS))).rejects.toThrow();
  } else {
    // An unexpected throw would stop the method before its later queries and
    // hide a boundary crossing there, so it fails the test instead.
    await fn.apply(repository, ARGS);
  }
  return supabaseMock.queries().map((query) => query.table);
}

const methodsOf = (prototype: object) =>
  Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor');

describe('the two points systems stay separate (#310)', () => {
  it.each(methodsOf(LeaderboardRepository.prototype))('leaderboard.%s never reads the check-in tables', async (method) => {
    const touched = await tablesTouchedBy(leaderboardRepository, method);
    expect(touched.filter((table) => CHECK_IN_TABLES.includes(table))).toEqual([]);
  });

  it.each(methodsOf(PointsRepository.prototype))('points.%s never reads the leaderboard tables', async (method) => {
    const touched = await tablesTouchedBy(pointsRepository, method);
    expect(touched.filter((table) => LEADERBOARD_TABLES.includes(table))).toEqual([]);
  });

  it('actually exercises each repository (no vacuous pass)', async () => {
    expect(await tablesTouchedBy(leaderboardRepository, 'getYearlyLeaderboard')).toContain('member_yearly_points');
    expect(await tablesTouchedBy(pointsRepository, 'getUserPoints')).toContain('user_points');
    // With its fixture, getPointsStats runs to the end, through all four of its queries.
    expect(await tablesTouchedBy(pointsRepository, 'getPointsStats')).toEqual(['user_points', 'event_attendance', 'user_points', 'user_points']);
  });
});
