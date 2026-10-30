import type { IndividualLeaderboardMember } from '../hooks/useIndividualLeaderboard';
import { assignTiedRanks, comparePointsThenEvents, compareMemberNames, type RankPlacement } from '../utils/leaderboardRanking';

export type LeaderboardCohort = 'members' | 'board';
export type CohortRankedMember = IndividualLeaderboardMember & RankPlacement;

/** Apply the site's SAME ordering rules to each independently numbered cohort.
 * No points or attendance are mutated. Member identity is strictly canonical ID.
 */
export function rankPublishedCohort(
  members: readonly IndividualLeaderboardMember[],
  boardMemberIds: ReadonlySet<string>,
  cohort: LeaderboardCohort,
  metric: 'points' | 'events',
): CohortRankedMember[] {
  const group = members.filter((member) => boardMemberIds.has(member.id) === (cohort === 'board'));
  return assignTiedRanks(
    group,
    metric === 'points' ? comparePointsThenEvents : (a, b) => b.events_attended - a.events_attended,
    (a, b) => compareMemberNames(a, b) || a.id.localeCompare(b.id),
  );
}
