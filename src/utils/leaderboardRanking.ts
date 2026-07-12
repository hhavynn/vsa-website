// Ranking comparators for the individual leaderboard. Extracted so the
// ordering (a protected-domain concern) is defined once and unit-tested,
// rather than duplicated inline across the two data-load paths in
// Leaderboard.tsx.

export interface PointsRankable {
  points: number;
  events_attended: number;
}

export type LeaderboardMetric = 'points' | 'events';

export type LeaderboardGap =
  | { metric: 'tie' }
  | { metric: Exclude<LeaderboardMetric, 'tie'>; value: number };

/**
 * Comparator for the individual **points** leaderboard: most points first,
 * ties broken by most events attended. Used with `Array.prototype.sort`
 * (descending — returns negative when `a` should rank ahead of `b`).
 */
export function comparePointsThenEvents(a: PointsRankable, b: PointsRankable): number {
  return b.points - a.points || b.events_attended - a.events_attended;
}

export function getLeaderboardGap(
  above: PointsRankable,
  current: PointsRankable,
  metric: LeaderboardMetric
): LeaderboardGap {
  const valueGap = (metric === 'points' ? above.points - current.points : above.events_attended - current.events_attended);
  if (valueGap > 0) return { metric, value: valueGap };

  if (metric === 'points') {
    const eventsGap = above.events_attended - current.events_attended;
    if (eventsGap > 0) return { metric: 'events', value: eventsGap };
  }

  return { metric: 'tie' };
}
