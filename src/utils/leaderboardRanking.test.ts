import {
  comparePointsThenEvents,
  getLeaderboardGap,
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
