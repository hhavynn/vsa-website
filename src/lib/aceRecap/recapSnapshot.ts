import type { AceAssignmentDraft, AceFamily } from '../../types';
import type { AceNodeRef } from '../aceAssignments';
import { buildBranchPreview } from '../aceBranchPreview';
import type { BranchCheck } from '../aceBranchPreview';
import { nodeRefToTreeNode } from '../aceFamilyAdapter';
import { layoutTree } from '../aceTreeLayout';
import type { TreeNode } from '../aceTreeLayout';
import { normalizeMemberName } from '../memberLinkMatching';
import type { OfficialPairing, PairingSheetIssue } from './officialPairings';
import { PREVIEWABLE_BIG_STATUSES, compareNames, indexNodes, isArchivedFamilyName, resolveBig } from './bigResolution';
import type { BigResolution } from './bigResolution';

/**
 * Builds the single reviewed snapshot that BOTH the private tree preview and
 * the recap video render from. Pure: give it a complete read-only copy of the
 * published tree plus the official pairings; it never writes anywhere.
 *
 * New Littles exist only in memory, as `draft:` nodes produced by the same
 * buildBranchPreview() the admin Assignments workspace uses, so the preview
 * shows exactly what Publish would add under each Big.
 */

export const ACE_RECAP_SNAPSHOT_VERSION = 1;

export interface RecapCycle {
  /** e.g. "Fall 2026". */
  label: string;
  academicYearStart: number;
}

export interface RecapApproval {
  littleName: string;
  bigNodeId: string;
}

export interface RecapBuildInput {
  cycle: RecapCycle;
  source: { label: string; revision: string | null; retrievedAt: string };
  families: readonly AceFamily[];
  nodes: readonly AceNodeRef[];
  pairings: readonly OfficialPairing[];
  sheetIssues?: readonly PairingSheetIssue[];
  /** Pairings the ACE Chair has approved. Absent → nothing is approved. */
  approvals?: readonly RecapApproval[];
  /** Names that appear in the sheet's rejection lists; never pairing candidates. */
  rejectedNames?: readonly string[];
  importTermByNodeId?: ReadonlyMap<string, string>;
  /**
   * A Big more than this many generations above the newest generation of
   * their family is held for review: current Bigs sit near the newest
   * branches, so a much older node is likely a same-name earlier member.
   * Compares tree positions only; it never infers a year.
   */
  generationOutlierGap?: number;
}

export const DEFAULT_GENERATION_OUTLIER_GAP = 4;

export interface RecapNode {
  id: string;
  label: string;
  parent: string | null;
  role: string;
  isNew: boolean;
  /** Layout units in the AFTER tree (FamilyTree multiplies by treeMetrics). */
  x: number;
  y: number;
}

export interface RecapGrowth {
  bigNodeId: string;
  bigLabel: string;
  littleIds: string[];
  /** Root first, Big last. */
  lineage: string[];
}

export interface RecapFamilyStats {
  people: number;
  generations: number;
  roots: number;
}

export interface RecapFamily {
  id: string;
  name: string;
  slug: string;
  themeColor: string | null;
  archived: boolean;
  nodes: RecapNode[];
  /** Layout units. */
  width: number;
  rows: number;
  before: RecapFamilyStats;
  after: RecapFamilyStats;
  added: number;
  growth: RecapGrowth[];
  checks: BranchCheck[];
}

export type ReviewReason =
  | BigResolution['status']
  | 'rejected_name_match'
  | 'rejected_namesake'
  | 'generation_outlier'
  | 'little_already_on_tree'
  | 'duplicate_little';

export interface RecapReviewRecord {
  /** Stable within one snapshot; contains no names. */
  id: string;
  cycleLabel: string;
  sheetRow: number;
  bigName: string;
  littleName: string;
  bigStatus: BigResolution['status'];
  bigNodeId: string | null;
  bigMemberId: string | null;
  familyId: string | null;
  familyName: string | null;
  proposedParentNodeId: string | null;
  candidateCount: number;
  candidates: Array<{ nodeId: string; nodeName: string; familyName: string; matchKind: string; depth: number; childCount: number; importTerm: string | null }>;
  evidence: string[];
  warnings: string[];
  safeToPreview: boolean;
  reviewerApproval: 'approved' | 'pending';
  approvedForPublication: boolean;
}

export interface AceRecapSnapshot {
  version: typeof ACE_RECAP_SNAPSHOT_VERSION;
  /** Hard marker for every consumer: this file is unpublished, private data. */
  visibility: 'private-preview';
  cycle: RecapCycle;
  source: RecapBuildInput['source'];
  families: RecapFamily[];
  records: RecapReviewRecord[];
  sheetIssues: PairingSheetIssue[];
  totals: {
    bigRows: number;
    littles: number;
    previewed: number;
    queued: number;
    approved: number;
    familiesGrowing: number;
    peopleBefore: number;
    peopleAfter: number;
  };
}

const RECORD_PREFIX = 'pairing';

function familyStats(nodes: readonly TreeNode[]): RecapFamilyStats {
  if (nodes.length === 0) return { people: 0, generations: 0, roots: 0 };
  const layout = layoutTree([...nodes]);
  return {
    people: nodes.length,
    generations: layout.rowCount,
    roots: Object.values(layout.parentById).filter((p) => p === null).length,
  };
}

function lineageOf(id: string, parentById: Record<string, string | null>): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let current: string | null = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    path.unshift(current);
    current = parentById[current] ?? null;
  }
  return path;
}

export function buildRecapSnapshot(input: RecapBuildInput): AceRecapSnapshot {
  const familyById = new Map(input.families.map((f) => [f.id, f]));
  const nodes = input.nodes.map((n) => ({ ...n, familyName: n.familyName ?? familyById.get(n.familyId)?.name ?? null }));
  const index = indexNodes(nodes);
  const approvals = new Set((input.approvals ?? []).map((a) => `${normalizeMemberName(a.littleName)}|${a.bigNodeId}`));
  const rejected = new Set((input.rejectedNames ?? []).map(normalizeMemberName));
  const outlierGap = input.generationOutlierGap ?? DEFAULT_GENERATION_OUTLIER_GAP;
  const deepestByFamily = new Map<string, number>();
  for (const n of nodes) {
    deepestByFamily.set(n.familyId, Math.max(deepestByFamily.get(n.familyId) ?? 0, index.depthOf(n.id)));
  }
  const littleSeen = new Map<string, number>();
  for (const p of input.pairings) for (const l of p.littleNames) {
    const key = normalizeMemberName(l);
    littleSeen.set(key, (littleSeen.get(key) ?? 0) + 1);
  }

  const records: RecapReviewRecord[] = [];
  for (const pairing of input.pairings) {
    const resolution = resolveBig(pairing.bigName, pairing.bigNames, {
      nodes, importTermByNodeId: input.importTermByNodeId,
    }, index);
    const chosen = resolution.chosen;
    pairing.littleNames.forEach((littleName, i) => {
      const warnings: string[] = [];
      const evidence = [...resolution.notes];
      let blocked = !PREVIEWABLE_BIG_STATUSES.includes(resolution.status);
      if (chosen && (deepestByFamily.get(chosen.familyId) ?? 0) - chosen.depth > outlierGap) {
        warnings.push('generation_outlier');
        evidence.push(`Big node is ${(deepestByFamily.get(chosen.familyId) ?? 0) - chosen.depth} generations above the newest generation in ${chosen.familyName}; likely an earlier namesake — confirm the node.`);
        blocked = true;
      }
      if (rejected.has(normalizeMemberName(littleName)) || pairing.bigNames.some((b) => rejected.has(normalizeMemberName(b)))) {
        warnings.push('rejected_name_match');
        blocked = true;
      }
      const namesake = (input.rejectedNames ?? []).filter((r) => compareNames(littleName, r) === 'variant');
      if (namesake.length) {
        // Non-blocking: the official sheet accepted this person, but a
        // middle-initial namesake is on a rejection list. Chair confirms.
        warnings.push('rejected_namesake');
        evidence.push(`Rejection list has a similar name (${namesake.join(', ')}); confirm this is a different person.`);
      }
      if ((littleSeen.get(normalizeMemberName(littleName)) ?? 0) > 1) {
        warnings.push('duplicate_little');
        blocked = true;
      }
      if (chosen && nodes.some((n) => n.parentId === chosen.nodeId && normalizeMemberName(n.name) === normalizeMemberName(littleName))) {
        warnings.push('little_already_on_tree');
        blocked = true;
      }
      const sameNameNodes = nodes.filter((n) => normalizeMemberName(n.name) === normalizeMemberName(littleName));
      if (sameNameNodes.length) {
        evidence.push(`A different published node already uses this Little's name (${Array.from(new Set(sameNameNodes.map((n) => n.familyName))).join(', ')}); not linked.`);
      }
      const approved = !!chosen && approvals.has(`${normalizeMemberName(littleName)}|${chosen.nodeId}`);
      records.push({
        id: `${RECORD_PREFIX}-${pairing.rowNumber}-${i + 1}`,
        cycleLabel: input.cycle.label,
        sheetRow: pairing.rowNumber,
        bigName: pairing.bigName,
        littleName,
        bigStatus: resolution.status,
        bigNodeId: chosen?.nodeId ?? null,
        bigMemberId: chosen?.memberId ?? null,
        familyId: chosen?.familyId ?? null,
        familyName: chosen?.familyName ?? null,
        proposedParentNodeId: blocked ? null : chosen?.nodeId ?? null,
        candidateCount: resolution.candidates.length,
        candidates: resolution.candidates.map((c) => ({
          nodeId: c.nodeId, nodeName: c.nodeName, familyName: c.familyName, matchKind: c.matchKind,
          depth: c.depth, childCount: c.childCount, importTerm: c.importTerm,
        })),
        evidence,
        warnings,
        safeToPreview: !blocked,
        reviewerApproval: approved ? 'approved' : 'pending',
        approvedForPublication: approved && !blocked,
      });
    });
  }

  // Previewable records become in-memory drafts for the existing branch preview.
  const previewable = records.filter((r) => r.safeToPreview && r.proposedParentNodeId);
  const drafts: AceAssignmentDraft[] = previewable.map((r, i) => ({
    id: r.id, cycle_id: 'recap-preview', little_name: r.littleName, little_member_id: null,
    big_ace_member_id: r.proposedParentNodeId, published_ace_member_id: null, notes: null,
    display_order: i, created_at: '', updated_at: '',
  }));
  const branch = buildBranchPreview({
    // Publish currently writes an unknown pickup year (#674), so the preview does too.
    cycle: { id: 'recap-preview', status: 'draft', academic_year_start: input.cycle.academicYearStart, pickup_term: null },
    drafts, nodes, families: [...input.families],
  });
  const branchByFamily = new Map(branch.fams.map((f) => [f.familyId, f]));

  const families: RecapFamily[] = [];
  for (const family of input.families) {
    const published = nodes.filter((n) => n.familyId === family.id && n.isPublished !== false).map(nodeRefToTreeNode);
    const preview = branchByFamily.get(family.id);
    const after = preview ? preview.fullNodes : published;
    const layout = layoutTree([...after]);
    const newIds = new Set(after.filter((n) => n.isDraft).map((n) => n.id));
    const growthByBig = new Map<string, string[]>();
    for (const n of after) if (n.isDraft && layout.parentById[n.id]) {
      const big = layout.parentById[n.id]!;
      growthByBig.set(big, [...(growthByBig.get(big) ?? []), n.id]);
    }
    families.push({
      id: family.id,
      name: family.name,
      slug: family.slug,
      themeColor: family.theme_color,
      archived: isArchivedFamilyName(family.name),
      nodes: after.map((n) => ({
        id: n.id, label: n.label, parent: layout.parentById[n.id] ?? null, role: n.role,
        isNew: newIds.has(n.id), x: layout.positions[n.id].x, y: layout.positions[n.id].y,
      })),
      width: layout.totalWidth,
      rows: layout.rowCount,
      before: familyStats(published),
      after: familyStats(after),
      added: newIds.size,
      growth: Array.from(growthByBig, ([bigNodeId, littleIds]) => ({
        bigNodeId, bigLabel: index.byId.get(bigNodeId)?.name ?? 'Big',
        littleIds, lineage: lineageOf(bigNodeId, layout.parentById),
      })).sort((a, b) => b.littleIds.length - a.littleIds.length || a.bigLabel.localeCompare(b.bigLabel)),
      checks: branch.checks.filter((c) => c.familyId === family.id),
    });
  }
  families.sort((a, b) => Number(a.archived) - Number(b.archived) || b.added - a.added || a.name.localeCompare(b.name));

  const peopleBefore = families.reduce((s, f) => s + f.before.people, 0);
  return {
    version: ACE_RECAP_SNAPSHOT_VERSION,
    visibility: 'private-preview',
    cycle: input.cycle,
    source: input.source,
    families,
    records,
    sheetIssues: [...(input.sheetIssues ?? [])],
    totals: {
      bigRows: input.pairings.length,
      littles: records.length,
      previewed: previewable.length,
      queued: records.length - previewable.length,
      approved: records.filter((r) => r.approvedForPublication).length,
      familiesGrowing: families.filter((f) => f.added > 0).length,
      peopleBefore,
      peopleAfter: peopleBefore + previewable.length,
    },
  };
}
