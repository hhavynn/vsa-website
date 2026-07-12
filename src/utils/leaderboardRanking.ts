// Ranking comparators for the individual leaderboard. Extracted so the
// ordering (a protected-domain concern) is defined once and unit-tested,
// rather than duplicated inline across the two data-load paths in
// Leaderboard.tsx.

export interface PointsRankable {
  points: number;
  events_attended: number;
}

/**
 * Comparator for the individual **points** leaderboard: most points first,
 * ties broken by most events attended. Used with `Array.prototype.sort`
 * (descending — returns negative when `a` should rank ahead of `b`).
 */
export function comparePointsThenEvents(a: PointsRankable, b: PointsRankable): number {
  return b.points - a.points || b.events_attended - a.events_attended;
}
