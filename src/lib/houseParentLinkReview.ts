import type { HouseParentLink } from '../data/repos/houseParents';
import { houseParentNameVariants } from './housePlacementImport';
import { buildMemberNameIndex, findExactMemberMatch, normalizeMemberName, type MemberOption } from './memberLinkMatching';

export type HouseParentReviewState = 'linked' | 'unlinked' | 'ambiguous' | 'duplicate-stale';

export interface HouseParentReview {
  parent: HouseParentLink;
  state: HouseParentReviewState;
  reason: string | null;
  candidateCount: number;
}

/**
 * Admin-only review of canonical identity links. This does NOT grant or publish
 * House Parent roles and must not read/write House membership or point tables.
 */
export function reviewHouseParents(
  parents: readonly HouseParentLink[],
  directory: readonly MemberOption[],
): HouseParentReview[] {
  const byId = new Map(directory.map((member) => [member.id, member]));
  const byName = buildMemberNameIndex(directory);
  const appearances = new Map<string, Set<string>>();
  for (const parent of parents) {
    if (!parent.member_id) continue;
    const houses = appearances.get(parent.member_id) ?? new Set<string>();
    houses.add(parent.house_profile_id);
    appearances.set(parent.member_id, houses);
  }

  return parents.map((parent) => {
    if (parent.member_id) {
      const linked = byId.get(parent.member_id);
      if (!linked) return { parent, state: 'duplicate-stale', reason: 'Linked member not found in the canonical directory. Recheck after a merge or deletion.', candidateCount: 0 };
      if ((appearances.get(parent.member_id)?.size ?? 0) > 1) {
        return { parent, state: 'duplicate-stale', reason: 'Same member is linked as a parent for multiple Houses this year. Verify whether this is intentional.', candidateCount: 0 };
      }
      const validNames = houseParentNameVariants(parent.display_name).some((name) =>
        normalizeMemberName(name) === normalizeMemberName(linked.fullName));
      if (!validNames) return { parent, state: 'duplicate-stale', reason: 'Published parent name differs from the linked member. Verify this identity before using it for badges.', candidateCount: 0 };
      return { parent, state: 'linked', reason: null, candidateCount: 0 };
    }

    const candidates = new Set<string>();
    for (const name of houseParentNameVariants(parent.display_name)) {
      const match = findExactMemberMatch(name, byName);
      if (match.kind === 'unique') candidates.add(match.member.id);
      if (match.kind === 'ambiguous') match.members.forEach((member) => candidates.add(member.id));
    }
    if (candidates.size > 1) return { parent, state: 'ambiguous', reason: 'Multiple canonical members match. Confirm the right person manually.', candidateCount: candidates.size };
    return { parent, state: 'unlinked', reason: candidates.size === 0 ? 'No exact member found. Search manually.' : 'One exact candidate — verify before linking.', candidateCount: candidates.size };
  });
}
