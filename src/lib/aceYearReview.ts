import type { AceFamilyMember } from '../types';
import type { AcePickupEvidenceRow } from '../data/repos/aceFamilies';
import { normalizeMemberName } from './memberLinkMatching';
import { comparePickup, pickupYearOf, type PickupYearColumns } from './acePickupYear';

export type YearFlag =
  | 'missing_year'
  | 'pending_evidence'
  | 'evidence_conflict'
  | 'child_before_big'
  | 'same_term_as_big'
  | 'suspicious_gap'
  | 'duplicate_identity';

export type YearEvidenceStatus = 'verified' | 'needs_review' | 'unknown';

export interface YearReview {
  status: YearEvidenceStatus;
  flags: YearFlag[];
}

function addFlag(flags: Set<YearFlag>, flag: YearFlag): void {
  flags.add(flag);
}

function chronologyFlags(
  parent: PickupYearColumns,
  child: PickupYearColumns,
): YearFlag[] {
  const parentPickup = pickupYearOf(parent);
  const childPickup = pickupYearOf(child);
  if (parentPickup.status !== 'verified' || childPickup.status !== 'verified') return [];

  const flags: YearFlag[] = [];
  if (comparePickup(childPickup, parentPickup) === -1) flags.push('child_before_big');
  if (childPickup.term && parentPickup.term && childPickup.term === parentPickup.term) {
    flags.push('same_term_as_big');
  }
  if (childPickup.academicYearStart - parentPickup.academicYearStart >= 6) {
    flags.push('suspicious_gap');
  }
  return flags;
}

function evidenceConflictsWithApproved(
  node: AceFamilyMember,
  evidence: AcePickupEvidenceRow,
): boolean {
  if (evidence.review_status !== 'pending' && evidence.review_status !== 'approved') return false;
  const approved = pickupYearOf(node);
  if (approved.status !== 'verified' || evidence.candidate_academic_year_start == null) {
    return false;
  }
  if (evidence.candidate_academic_year_start !== approved.academicYearStart) return true;
  // An evidence row with a year but no term doesn't contradict an exact approved term.
  // Similarly, a year-only approval can be refined by exact term evidence.
  return Boolean(evidence.candidate_term && approved.term && evidence.candidate_term !== approved.term);
}

/**
 * Admin-only advisory data. Never infer a year from lineage or pending evidence.
 * The approved node fields are the sole source of verified pickup placement.
 * Distinct node IDs are retained even when names or canonical links collide.
 */
export function reviewFamilyYears(
  members: readonly AceFamilyMember[],
  evidence: readonly AcePickupEvidenceRow[],
): Map<string, YearReview> {
  const byId = new Map(members.map(node => [node.id, node]));
  const evidenceByNode = new Map<string, AcePickupEvidenceRow[]>();
  const byName = new Map<string, string[]>();
  const byMemberId = new Map<string, string[]>();

  for (const row of evidence) {
    if (!byId.has(row.ace_member_id)) continue;
    const group = evidenceByNode.get(row.ace_member_id) ?? [];
    group.push(row);
    evidenceByNode.set(row.ace_member_id, group);
  }
  for (const node of members) {
    const key = normalizeMemberName(node.name);
    if (key) byName.set(key, [...(byName.get(key) ?? []), node.id]);
    if (node.member_id) {
      byMemberId.set(node.member_id, [...(byMemberId.get(node.member_id) ?? []), node.id]);
    }
  }

  const results = new Map<string, YearReview>();
  for (const node of members) {
    const flags = new Set<YearFlag>();
    const approved = pickupYearOf(node);
    const ownEvidence = evidenceByNode.get(node.id) ?? [];
    const parent = node.parent_member_id ? byId.get(node.parent_member_id) : null;

    if (approved.status === 'unknown') addFlag(flags, 'missing_year');
    if (ownEvidence.some(row => row.review_status === 'pending')) {
      addFlag(flags, 'pending_evidence');
    }
    if (ownEvidence.some(row => evidenceConflictsWithApproved(node, row))) {
      addFlag(flags, 'evidence_conflict');
    }
    if (parent) chronologyFlags(parent, node).forEach(flag => addFlag(flags, flag));

    const nameKey = normalizeMemberName(node.name);
    if (
      (nameKey && (byName.get(nameKey)?.length ?? 0) > 1) ||
      (node.member_id && (byMemberId.get(node.member_id)?.length ?? 0) > 1)
    ) {
      addFlag(flags, 'duplicate_identity');
    }

    const hasReviewFlag = Array.from(flags).some(flag => flag !== 'missing_year');
    const status: YearEvidenceStatus = hasReviewFlag
      ? 'needs_review'
      : approved.status === 'verified'
        ? 'verified'
        : 'unknown';
    results.set(node.id, { status, flags: Array.from(flags) });
  }
  return results;
}

/** Preview-only warnings; no RPC, update, propagation to Big or children. */
export function pickupChangeWarnings(
  node: AceFamilyMember,
  proposed: PickupYearColumns,
  big: AceFamilyMember | null,
  littles: readonly AceFamilyMember[],
): YearFlag[] {
  const flags = new Set<YearFlag>();
  if (pickupYearOf(proposed).status === 'unknown') addFlag(flags, 'missing_year');
  if (big) chronologyFlags(big, proposed).forEach(flag => addFlag(flags, flag));
  for (const little of littles) {
    if (little.parent_member_id !== node.id) continue;
    chronologyFlags(proposed, little).forEach(flag => addFlag(flags, flag));
  }
  return Array.from(flags);
}
