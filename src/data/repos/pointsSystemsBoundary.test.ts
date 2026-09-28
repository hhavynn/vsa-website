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
  'member_event_history',
];

// Arguments for any method; the mock returns empty data, so values only need
// to satisfy the call.
const ARGS = [2025, 10, 0];

async function tablesTouchedBy(repository: object, method: string): Promise<string[]> {
  supabaseMock.reset();
  const fn = (repository as Record<string, (...args: unknown[]) => unknown>)[method];
  try {
    await fn.apply(repository, ARGS);
  } catch {
    // Disabled methods (e.g. pointsRepository.addPoints) throw by design.
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
  });
});
