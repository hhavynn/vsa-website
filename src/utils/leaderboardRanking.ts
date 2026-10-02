// Ranking rules for the individual and House member leaderboards and Find My
// Points. Extracted so the ordering and tie handling (a protected-domain
// concern) are defined once and unit-tested, so every surface shows the same
// rank for the same member.

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

export interface RankPlacement {
  /** Standard competition rank: tied members share the rank of the first in their group (1, 2, 2, 4). */
  rank: number;
  /** Members sharing this rank, including this one. 1 means not tied. */
  tiedCount: number;
}

/**
 * Sorts by `compare` and assigns standard competition ranks. Members
 * `compare` treats as equal share a rank, and `displayOrder` gives them a
 * stable order within the tie so the list doesn't reshuffle between loads.
 */
export function assignTiedRanks<T>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
  displayOrder: (a: T, b: T) => number
): Array<T & RankPlacement> {
  const sorted = [...items].sort((a, b) => compare(a, b) || displayOrder(a, b));
  const ranked: Array<T & RankPlacement> = [];

  let groupStart = 0;
  while (groupStart < sorted.length) {
    let groupEnd = groupStart + 1;
    while (groupEnd < sorted.length && compare(sorted[groupStart], sorted[groupEnd]) === 0) groupEnd += 1;

    for (let i = groupStart; i < groupEnd; i += 1) {
      ranked.push({ ...sorted[i], rank: groupStart + 1, tiedCount: groupEnd - groupStart });
    }
    groupStart = groupEnd;
  }

  return ranked;
}

interface NamedMember {
  first_name?: string | null;
  last_name?: string | null;
}

/** Alphabetical by last name, then first name. Used to order members within a tie. */
export function compareMemberNames(a: NamedMember, b: NamedMember): number {
  const options = { sensitivity: 'base' } as const;
  return (
    (a.last_name ?? '').localeCompare(b.last_name ?? '', 'en', options) ||
    (a.first_name ?? '').localeCompare(b.first_name ?? '', 'en', options)
  );
}

/** "T6" for a shared rank, "#6" otherwise. */
export function formatRank({ rank, tiedCount }: RankPlacement): string {
  return `${tiedCount > 1 ? 'T' : '#'}${rank.toLocaleString('en-US')}`;
}

/**
 * True when the member's whole tie group fits inside the top `n`, so a
 * 95-way tie for 6th doesn't make everyone "Top 10".
 */
export function isWithinTop({ rank, tiedCount }: RankPlacement, n: number): boolean {
  return rank + tiedCount - 1 <= n;
}
