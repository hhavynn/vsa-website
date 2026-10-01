import type { AceFamilyMember } from '../types';
import { isRenamed } from './memberPhotos';
import { MemberNameIndex, MemberOption, findExactMemberMatch } from './memberLinkMatching';

/** An ACE node that already holds a canonical member link. */
export interface AceMemberLinkRef {
  nodeId: string;
  memberId: string;
  nodeName: string;
  familyName: string | null;
}

/**
 * - recommended: exactly one member has this exact name and nobody else uses it
 * - ambiguous: several members share the name; an admin must pick
 * - conflict: the only match is already linked to another node, or is the
 *   only match for several unlinked nodes; never bulk-linked
 * - none: no member record (historical/alumni people stay name-only)
 */
export type AceLinkReviewStatus = 'recommended' | 'ambiguous' | 'conflict' | 'none';

export interface AceLinkReviewItem {
  node: AceFamilyMember;
  status: AceLinkReviewStatus;
  candidates: MemberOption[];
  /** For conflicts: the other nodes that claim the same member. */
  conflictsWith: string[];
}

export interface AceMemberLinkChange {
  nodeId: string;
  memberId: string;
}

/**
 * Classifies every unlinked node against the member directory. Linked nodes
 * are skipped. `existingLinks` should cover every family, so a member already
 * shown on one tree is never suggested for a second node.
 */
export function reviewUnlinkedNodes(
  nodes: readonly AceFamilyMember[],
  index: MemberNameIndex,
  existingLinks: readonly AceMemberLinkRef[],
): AceLinkReviewItem[] {
  const linkedByMember = new Map<string, AceMemberLinkRef[]>();
  for (const link of existingLinks) {
    const list = linkedByMember.get(link.memberId) ?? [];
    list.push(link);
    linkedByMember.set(link.memberId, list);
  }

  const unlinked = nodes.filter((node) => !node.member_id);
  const items = unlinked.map((node): AceLinkReviewItem => {
    const match = findExactMemberMatch(node.name, index);
    if (match.kind === 'none') return { node, status: 'none', candidates: [], conflictsWith: [] };
    if (match.kind === 'ambiguous') {
      return { node, status: 'ambiguous', candidates: match.members, conflictsWith: [] };
    }
    const others = (linkedByMember.get(match.member.id) ?? []).filter((link) => link.nodeId !== node.id);
    if (others.length > 0) {
      return {
        node,
        status: 'conflict',
        candidates: [match.member],
        conflictsWith: others.map(describeLink),
      };
    }
    return { node, status: 'recommended', candidates: [match.member], conflictsWith: [] };
  });

  // Two unlinked nodes uniquely matching one member (e.g. a same-name alumnus
  // in another fam): linking both would put one person on two nodes.
  const recommendedByMember = new Map<string, AceLinkReviewItem[]>();
  for (const item of items) {
    if (item.status !== 'recommended') continue;
    const id = item.candidates[0].id;
    recommendedByMember.set(id, [...(recommendedByMember.get(id) ?? []), item]);
  }
  recommendedByMember.forEach((group) => {
    if (group.length < 2) return;
    for (const item of group) {
      item.status = 'conflict';
      item.conflictsWith = group.filter((other) => other !== item).map((other) => other.node.name);
    }
  });

  return items;
}

function describeLink(link: AceMemberLinkRef): string {
  return link.familyName ? `${link.nodeName} (${link.familyName})` : link.nodeName;
}

/**
 * The bulk action links only items the admin left checked AND that are still
 * unique, unconflicted matches. Ambiguous and conflicting rows are never
 * included, whatever the selection says.
 */
export function selectBulkLinks(
  items: readonly AceLinkReviewItem[],
  selectedNodeIds: ReadonlySet<string>,
): AceMemberLinkChange[] {
  return items
    .filter((item) => item.status === 'recommended' && selectedNodeIds.has(item.node.id))
    .map((item) => ({ nodeId: item.node.id, memberId: item.candidates[0].id }));
}

export function summarizeLinks(nodes: readonly AceFamilyMember[]): { linked: number; total: number } {
  return { linked: nodes.filter((node) => node.member_id).length, total: nodes.length };
}

/**
 * A genuine rename means the node now describes a different person, so its
 * old canonical link must not survive the save.
 */
export function applyRenameLinkGuard<T extends { name?: string; member_id?: string | null }>(
  previousName: string | null | undefined,
  patch: T,
): T {
  return patch.name !== undefined && isRenamed(previousName, patch.name) ? { ...patch, member_id: null } : patch;
}
