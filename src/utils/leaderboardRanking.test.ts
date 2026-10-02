import {
  assignTiedRanks,
  compareMemberNames,
  comparePointsThenEvents,
  formatRank,
  getLeaderboardGap,
  isWithinTop,
  PointsRankable,
} from './leaderboardRanking';

const m = (points: number, events_attended: number): PointsRankable => ({
  points,
  events_attended,
});

describe('comparePointsThenEvents', () => {
  it('ranks higher points first regardless of events attended', () => {
    const sorted = [m(10, 1), m(30, 0), m(20, 99)].sort(comparePointsThenEvents);
    expect(sorted.map((x) => x.points)).toEqual([30, 20, 10]);
  });

  it('breaks ties on points by events attended (more events ranks higher)', () => {
    const a = m(20, 5);
    const b = m(20, 12);
    const c = m(20, 8);
    const sorted = [a, b, c].sort(comparePointsThenEvents);
    expect(sorted.map((x) => x.events_attended)).toEqual([12, 8, 5]);
  });

  it('treats members equal on both points and events as tied (comparator returns 0)', () => {
    expect(comparePointsThenEvents(m(15, 3), m(15, 3))).toBe(0);
  });

  it('applies the events tiebreaker only within equal-points groups', () => {
    // Two point tiers; within each tier events attended decides order.
    const sorted = [
      m(20, 2), // tier 20
      m(30, 1), // tier 30
      m(20, 9), // tier 20 — most events in its tier
      m(30, 4), // tier 30 — most events in its tier
    ].sort(comparePointsThenEvents);
    expect(sorted).toEqual([m(30, 4), m(30, 1), m(20, 9), m(20, 2)]);
  });

  it('uses the events-attended gap instead of calling equal-point members tied', () => {
    expect(getLeaderboardGap(m(20, 8), m(20, 5), 'points')).toEqual({
      metric: 'events',
      value: 3,
    });
  });

  it('calls points leaderboard entries tied only when points and events attended match', () => {
    expect(getLeaderboardGap(m(20, 8), m(20, 8), 'points')).toEqual({
      metric: 'tie',
    });
  });

  it('preserves the displayed metric for ordinary gaps and event-tab ties', () => {
    expect(getLeaderboardGap(m(25, 2), m(20, 99), 'points')).toEqual({
      metric: 'points',
      value: 5,
    });
    expect(getLeaderboardGap(m(25, 3), m(20, 3), 'events')).toEqual({
      metric: 'tie',
    });
  });
});

interface TestMember extends PointsRankable {
  id: string;
  first_name: string;
  last_name: string;
}

const member = (id: string, last_name: string, points: number, events_attended: number): TestMember => ({
  id,
  first_name: id,
  last_name,
  points,
  events_attended,
});

const rankMembers = (members: TestMember[]) =>
  assignTiedRanks(members, comparePointsThenEvents, compareMemberNames).map(({ id, rank, tiedCount }) => ({
    id,
    rank,
    tiedCount,
  }));

describe('assignTiedRanks', () => {
  it('gives every member rank 1 when everyone is tied', () => {
    expect(rankMembers([member('a', 'A', 5, 1), member('b', 'B', 5, 1), member('c', 'C', 5, 1)])).toEqual([
      { id: 'a', rank: 1, tiedCount: 3 },
      { id: 'b', rank: 1, tiedCount: 3 },
      { id: 'c', rank: 1, tiedCount: 3 },
    ]);
  });

  it('skips ranks after a tie at the top (1, 1, 3)', () => {
    expect(rankMembers([member('c', 'C', 5, 1), member('a', 'A', 9, 2), member('b', 'B', 9, 2)])).toEqual([
      { id: 'a', rank: 1, tiedCount: 2 },
      { id: 'b', rank: 1, tiedCount: 2 },
      { id: 'c', rank: 3, tiedCount: 1 },
    ]);
  });

  it('ranks a single member after a large tie by the number of people ahead', () => {
    const tied = Array.from({ length: 95 }, (_, i) => member(`t${i}`, `T${String(i).padStart(2, '0')}`, 3, 1));
    const ahead = Array.from({ length: 5 }, (_, i) => member(`a${i}`, `A${i}`, 20 - i, 4));
    const ranked = rankMembers([member('last', 'Z', 1, 1), ...tied, ...ahead]);

    expect(ranked.slice(0, 5).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(ranked.slice(5, 100).map((r) => `${r.rank}/${r.tiedCount}`))).toEqual(new Set(['6/95']));
    expect(ranked[100]).toEqual({ id: 'last', rank: 101, tiedCount: 1 });
  });

  it('keeps the events tiebreaker as a real rank difference', () => {
    expect(rankMembers([member('a', 'A', 10, 2), member('b', 'B', 10, 5)])).toEqual([
      { id: 'b', rank: 1, tiedCount: 1 },
      { id: 'a', rank: 2, tiedCount: 1 },
    ]);
  });

  it('orders tied members alphabetically by last name, then first name, regardless of input order', () => {
    const input = [member('zoe', 'Nguyen', 4, 1), member('anh', 'Tran', 4, 1), member('bao', 'Nguyen', 4, 1)];
    const forward = rankMembers(input).map((r) => r.id);
    const reversed = rankMembers([...input].reverse()).map((r) => r.id);
    expect(forward).toEqual(['bao', 'zoe', 'anh']);
    expect(reversed).toEqual(forward);
  });

  it('does not mutate the input array', () => {
    const input = [member('b', 'B', 1, 1), member('a', 'A', 9, 1)];
    assignTiedRanks(input, comparePointsThenEvents, compareMemberNames);
    expect(input.map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('formatRank', () => {
  it('prefixes shared ranks with T and solo ranks with #', () => {
    expect(formatRank({ rank: 6, tiedCount: 95 })).toBe('T6');
    expect(formatRank({ rank: 6, tiedCount: 1 })).toBe('#6');
  });
});

describe('isWithinTop', () => {
  it('requires the whole tie group to fit inside the top n', () => {
    expect(isWithinTop({ rank: 10, tiedCount: 1 }, 10)).toBe(true);
    expect(isWithinTop({ rank: 9, tiedCount: 2 }, 10)).toBe(true);
    expect(isWithinTop({ rank: 9, tiedCount: 3 }, 10)).toBe(false);
    expect(isWithinTop({ rank: 6, tiedCount: 95 }, 10)).toBe(false);
    expect(isWithinTop({ rank: 11, tiedCount: 1 }, 10)).toBe(false);
  });
});
