import type { AceFamily, AceFamilyMember } from '../types';
import type { AceMemberLinkRef } from './aceMemberLinks';
import type { MemberOption } from './memberLinkMatching';
import { normalizeMemberName } from './memberLinkMatching';

/** Fam Head is an explicit approved role, never inferred from Big/Little/root. */
export function isExplicitFamHeadRole(label: string | null | undefined): boolean {
  return /^(?:co[\s-]*)?fam(?:ily)?[\s-]*head$/i.test((label ?? '').trim().replace(/\s+/g, ' '));
}

export interface FamHeadReviewRow {
  node: AceFamilyMember;
  status: 'verified-source' | 'needs-review' | 'unknown';
  notes: string[];
  linkedMember: MemberOption | null;
}

/** Admin-only evidence review. Verified source never means public badge published (#623). */
export function reviewExplicitFamHeads(
  family: AceFamily,
  nodes: readonly AceFamilyMember[],
  byId: ReadonlyMap<string, MemberOption>,
  allLinks: readonly AceMemberLinkRef[],
  evidenceReady: boolean,
): FamHeadReviewRow[] {
  return nodes.filter((node) => isExplicitFamHeadRole(node.role_label)).map((node) => {
    const notes: string[] = [];
    const linkedMember = node.member_id ? byId.get(node.member_id) ?? null : null;
    if (!family.is_published || !node.is_published) notes.push('Unpublished family or head node');
    if (family.academic_year_start == null) notes.push('No approved leadership academic year on this family');
    if (!node.member_id) notes.push('No canonical member link');
    if (node.member_id && evidenceReady) {
      if (!linkedMember) notes.push('Linked canonical member is no longer in the member directory');
      else if (normalizeMemberName(linkedMember.fullName) !== normalizeMemberName(node.name)) {
        notes.push('Display name differs from linked member; verify identity before publishing');
      }
      const elsewhere = allLinks.filter((ref) => ref.nodeId !== node.id && ref.memberId === node.member_id);
      if (elsewhere.length > 0) notes.push('Canonical member is also linked to another ACE node');
    }
    const status = !evidenceReady ? 'unknown' : notes.length ? 'needs-review' : 'verified-source';
    return { node, linkedMember, notes, status };
  }).sort((a,b) => a.node.display_order - b.node.display_order || a.node.name.localeCompare(b.node.name));
}
