import { rankPublishedCohort } from './memberCohorts';
import type { IndividualLeaderboardMember } from '../hooks/useIndividualLeaderboard';

const p = (id: string, points: number, events_attended: number, last_name = id): IndividualLeaderboardMember => ({
  id, first_name: 'Example', last_name, points, events_attended, college: null, year: null,
});
const members = [
  p('board', 100, 10),
  p('intern', 80, 8),
  p('dual', 80, 8),
  p('general', 80, 8),
  p('zero', 0, 0),
];
describe('current-year Board vs Members competition (#628)', () => {
  it('reuses canonical member IDs and the same point/event values without mutating source records', () => {
    const before = JSON.stringify(members);
    const ids = new Set(['board', 'dual']);
    const board = rankPublishedCohort(members, ids, 'board', 'points');
    const general = rankPublishedCohort(members, ids, 'members', 'points');
    expect(board.map((m) => [m.id, m.rank, m.points])).toEqual([['board', 1, 100], ['dual', 2, 80]]);
    expect(general.map((m) => m.id)).toEqual(['general', 'intern', 'zero']);
    expect(general.slice(0, 2).map((m) => [m.rank, m.tiedCount])).toEqual([[1, 2], [1, 2]]);
    expect(JSON.stringify(members)).toBe(before);
    expect(new Set([...board, ...general].map((m) => m.id)).size).toBe(members.length);
  });
  it('uses the site event comparator without a global-rank spillover', () => {
    const board = rankPublishedCohort(members, new Set(['board', 'dual']), 'board', 'events');
    expect(board.map((m) => [m.id, m.rank])).toEqual([['board', 1], ['dual', 2]]);
  });
  it('supports a different verified Board roster for a previous academic year', () => {
    expect(rankPublishedCohort(members, new Set(['intern']), 'board', 'points').map((m) => m.id)).toEqual(['intern']);
    expect(rankPublishedCohort(members, new Set<string>(), 'board', 'points')).toEqual([]);
  });
});
