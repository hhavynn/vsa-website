import type { AceAssignmentCycle, AceAssignmentDraft, AceFamily } from '../types';
import type { TreeNode } from './aceTreeLayout';
import type { AceNodeRef, PublishPreview } from './aceAssignments';
import { buildPublishPreview } from './aceAssignments';
import { comparePickup, formatPickupLabel, pickupYearOf } from './acePickupYear';
import { nodeRefToTreeNode } from './aceFamilyAdapter';
import { layoutTree } from './aceTreeLayout';
import { normalizeMemberName } from './memberLinkMatching';

/**
 * Pure, admin-only plan. The caller must first load a complete authoritative
 * cycle, draft list, node list and family list; NEVER call this with partial
 * query pages or share its output with public ACE query caches.
 *
 * #674 will persist pickup_term on AceAssignmentCycle. Until that migration
 * lands, an absent term is intentionally treated as unknown.
 */
export interface BranchPreviewInput {
  cycle: Pick<AceAssignmentCycle, 'id' | 'status' | 'academic_year_start'> & {
    pickup_term?: string | null;
  };
  drafts: readonly AceAssignmentDraft[];
  nodes: readonly AceNodeRef[];
  families: readonly AceFamily[];
}

export type BranchCheckCode =
  | 'big_no_member_link' | 'big_name_ambiguous' | 'big_unpublished'
  | 'family_unpublished' | 'family_missing' | 'parent_missing' | 'parent_wrong_family'
  | 'lineage_cycle' | 'member_linked_twice'
  | 'draft_year_unknown' | 'little_before_big';

export interface BranchCheck {
  code: BranchCheckCode;
  familyId: string | null;
  nodeIds: string[];
  draftIds: string[];
  message: string;
}
export interface BranchFamPreview {
  familyId: string;
  familyName: string;
  isPublished: boolean;
  byBig: Array<{ bigId: string; bigName: string; existing: number; incoming: number }>;
  fullNodes: TreeNode[];
  newOnlyNodes: TreeNode[];
}
export interface BranchPreview {
  fams: BranchFamPreview[];
  skipped: PublishPreview['skipped'];
  checks: BranchCheck[];
  /** Only locked drafts are the server-guarded write snapshot. */
  isFinal: boolean;
}

export function buildBranchPreview({ cycle, drafts, nodes, families }: BranchPreviewInput): BranchPreview {
  const plan = buildPublishPreview(drafts, nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const byFamily = new Map(families.map((f) => [f.id, f]));
  const checks: BranchCheck[] = [];
  const seen = new Set<string>();
  const add = (check: BranchCheck) => {
    const key = [check.code, check.familyId, ...check.nodeIds, ...check.draftIds].join(':');
    if (!seen.has(key)) { seen.add(key); checks.push(check); }
  };
  const refsByFamily = new Map<string, AceNodeRef[]>();
  for (const node of nodes) {
    refsByFamily.set(node.familyId, [...(refsByFamily.get(node.familyId) ?? []), node]);
  }
  const plannedByFamily = new Map<string, typeof plan.nodes>();
  for (const node of plan.nodes) {
    plannedByFamily.set(node.familyId, [...(plannedByFamily.get(node.familyId) ?? []), node]);
  }
  const memberNodes = new Map<string, AceNodeRef[]>();
  for (const node of nodes) {
    if (node.memberId) memberNodes.set(node.memberId, [...(memberNodes.get(node.memberId) ?? []), node]);
  }

  const fams: BranchFamPreview[] = [];
  for (const [familyId, additions] of plannedByFamily) {
    const family = byFamily.get(familyId);
    const refs = refsByFamily.get(familyId) ?? [];
    // A published node inside an unpublished family is not publicly visible.
    const publicRefs = family?.is_published === true ? refs.filter((n) => n.isPublished === true) : [];
    const publicIds = new Set(publicRefs.map((n) => n.id));
    const published: TreeNode[] = publicRefs.map(nodeRefToTreeNode);
    const pickup = cycle.pickup_term
      ? pickupYearOf({ pickup_academic_year_start: cycle.academic_year_start, pickup_term: cycle.pickup_term })
      : { status: 'unknown' as const };

    if (!family) add({
      code: 'family_missing', familyId, nodeIds: [], draftIds: additions.map((n) => n.draftId),
      message: 'Assigned family is not in the complete admin family list.',
    });
    else if (!family.is_published) add({
      code: 'family_unpublished', familyId, nodeIds: [], draftIds: additions.map((n) => n.draftId),
      message: 'Family is unpublished, so these Littles would not appear in the public tree.',
    });
    if (pickup.status === 'unknown') add({
      code: 'draft_year_unknown', familyId, nodeIds: [],
      draftIds: additions.map((n) => n.draftId),
      message: 'Pickup term is not approved; draft nodes must remain in the Unknown band.',
    });

    const draftNodes: TreeNode[] = additions.map((n) => ({
      id: 'draft:' + n.draftId, initial: n.name.charAt(0).toUpperCase() || '?',
      label: n.name, role: n.roleLabel, cohort: formatPickupLabel(pickup),
      pickup, parent: publicIds.has(n.parentMemberId) ? n.parentMemberId : null,
      photoUrl: null, isDraft: true,
    }));

    const groups = new Map<string, typeof additions>();
    for (const node of additions) groups.set(
      node.parentMemberId, [...(groups.get(node.parentMemberId) ?? []), node],
    );
    const byBig = Array.from(groups, ([bigId, children]) => ({
      bigId, bigName: byId.get(bigId)?.name ?? 'Unlinked Big',
      existing: refs.filter((n) => n.parentId === bigId && n.isPublished === true).length,
      incoming: children.length,
    })).sort((a, b) => a.bigName.localeCompare(b.bigName) || a.bigId.localeCompare(b.bigId));

    for (const [bigId, children] of groups) {
      const big = byId.get(bigId);
      if (!big) continue; // Already classified as skipped by buildPublishPreview.
      const draftIds = children.map((n) => n.draftId);
      if (!big.memberId) add({
        code: 'big_no_member_link', familyId, nodeIds: [bigId], draftIds,
        message: 'The selected Big has no verified canonical member link.',
      });
      const sameName = refs.filter((ref) =>
        ref.id !== bigId && normalizeMemberName(ref.name) === normalizeMemberName(big.name));
      if (sameName.length) add({
        code: 'big_name_ambiguous', familyId,
        nodeIds: [bigId, ...sameName.map((n) => n.id)], draftIds,
        message: 'More than one ACE node has the selected Big’s name in this family.',
      });

      const visited = new Set<string>();
      const ancestors: AceNodeRef[] = [];
      let current: AceNodeRef | undefined = big;
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        ancestors.push(current);
        const parent = current.parentId ? byId.get(current.parentId) : undefined;
        if (current.parentId && !parent) add({
          code: 'parent_missing', familyId, nodeIds: [current.id], draftIds,
          message: 'A lineage ancestor points to a missing parent node.',
        });
        if (parent && parent.familyId !== familyId) add({
          code: 'parent_wrong_family', familyId, nodeIds: [current.id], draftIds,
          message: 'A lineage ancestor points to a parent in another ACE family.',
        });
        // Never follow a cross-family link into a different family's private tree.
        current = parent?.familyId === familyId ? parent : undefined;
      }
      if (ancestors.some((n) => n.isPublished !== true)) add({
        code: 'big_unpublished', familyId, nodeIds: ancestors.filter((n) => n.isPublished !== true).map((n) => n.id),
        draftIds, message: 'A Big or ancestor is unpublished; its new Little would be a public root.',
      });
      for (const child of children) {
        const before = comparePickup(pickup, pickupYearOf({
          pickup_academic_year_start: big.pickupAcademicYearStart,
          pickup_term: big.pickupTerm,
        }));
        if (before === -1) add({
          code: 'little_before_big', familyId, nodeIds: [bigId],
          draftIds: [child.draftId], message: 'The draft Little is dated before the selected Big.',
        });
      }
    }
    const fullNodes = [...published, ...draftNodes];
    const graph = layoutTree(fullNodes);
    for (const issue of graph.issues.filter((i) => i.kind === 'cycle')) add({
      code: 'lineage_cycle', familyId, nodeIds: issue.nodeIds, draftIds: [],
      message: 'Published ancestry contains a cycle; the preview repairs it only in memory.',
    });
    for (const ref of refs) {
      if (ref.memberId && (memberNodes.get(ref.memberId)?.length ?? 0) > 1) add({
        code: 'member_linked_twice', familyId,
        nodeIds: (memberNodes.get(ref.memberId) ?? []).map((n) => n.id),
        draftIds: [], message: 'A canonical member is linked to multiple ACE nodes.',
      });
      if (ref.parentId && !byId.has(ref.parentId)) add({
        code: 'parent_missing', familyId, nodeIds: [ref.id], draftIds: [],
        message: 'An existing ACE node has a missing parent.',
      });
      if (ref.parentId && byId.has(ref.parentId) && byId.get(ref.parentId)?.familyId !== familyId) add({
        code: 'parent_wrong_family', familyId, nodeIds: [ref.id], draftIds: [],
        message: 'An existing ACE node points to a parent in another ACE family.',
      });
    }

    const included = new Set(draftNodes.map((n) => n.id));
    for (const bigId of groups.keys()) {
      let current: AceNodeRef | undefined = byId.get(bigId);
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        if (publicIds.has(current.id)) included.add(current.id);
        const next = current.parentId ? byId.get(current.parentId) : undefined;
        current = next?.familyId === familyId ? next : undefined;
      }
      for (const sibling of publicRefs.filter((n) => n.parentId === bigId)) included.add(sibling.id);
    }
    fams.push({
      familyId, familyName: family?.name ?? additions[0]?.familyId ?? 'Unknown family',
      isPublished: family?.is_published ?? false,
      byBig, fullNodes, newOnlyNodes: fullNodes.filter((n) => included.has(n.id)),
    });
  }
  fams.sort((a, b) => a.familyName.localeCompare(b.familyName) || a.familyId.localeCompare(b.familyId));
  return { fams, skipped: plan.skipped, checks, isFinal: cycle.status === 'locked' };
}
