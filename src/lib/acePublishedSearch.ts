// Public ACE discovery (#666). Search only nodes already approved for public
// publication, and only families returned by the published family view.
// Never join private application, pairing, contact, or member identity tables.
import type { AceFamily, AceFamilyMember } from '../types';
import { formatPickupLabel, pickupYearOf } from './acePickupYear';

export interface PublishedAceResult {
  family: AceFamily;
  member: AceFamilyMember;
  bigName: string | null;
  pickupLabel: string | null;
}

export interface PublishedAceSearch {
  matches: PublishedAceResult[];
  total: number;
}

export function foldAceName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bounded, case/accent-insensitive in-memory search of already-public names. */
export function searchPublishedAceNodes(
  families: readonly AceFamily[],
  members: readonly AceFamilyMember[],
  rawQuery: string,
  maxResults = 20,
): PublishedAceSearch {
  const q = foldAceName(rawQuery);
  if (q.length < 2) return { matches: [], total: 0 };
  const publishedFamilies = new Map(families.filter((family) => family.is_published).map((family) => [family.id, family]));
  const publishedMembers = members.filter((member) => member.is_published && publishedFamilies.has(member.family_id));
  const memberMap = new Map(publishedMembers.map((member) => [member.id, member]));
  const found = publishedMembers.filter((member) => foldAceName(member.name).includes(q));
  found.sort((a, b) => (
    foldAceName(a.name).localeCompare(foldAceName(b.name)) ||
    (publishedFamilies.get(a.family_id)?.name ?? '').localeCompare(publishedFamilies.get(b.family_id)?.name ?? '') ||
    a.id.localeCompare(b.id)
  ));
  return {
    total: found.length,
    matches: found.slice(0, Math.max(0, Math.min(30, maxResults))).map((member) => {
      const family = publishedFamilies.get(member.family_id)!;
      const parent = member.parent_member_id ? memberMap.get(member.parent_member_id) : null;
      return {
        family,
        member,
        bigName: parent?.family_id === member.family_id ? parent.name : null,
        pickupLabel: formatPickupLabel(pickupYearOf(member)),
      };
    }),
  };
}

export type AceLinkResolution =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'published'; family: AceFamily; member: AceFamilyMember | null };

/** Fail closed if family/node is unpublished, removed, or mismatched. */
export function resolvePublishedAceLink(
  families: readonly AceFamily[],
  members: readonly AceFamilyMember[],
  familySlug: string | null,
  nodeId: string | null,
): AceLinkResolution {
  if (!familySlug && !nodeId) return { status: 'none' };
  if (!familySlug) return { status: 'invalid' };
  const family = families.find((candidate) => candidate.is_published && candidate.slug === familySlug);
  if (!family) return { status: 'invalid' };
  if (!nodeId) return { status: 'published', family, member: null };
  const member = members.find((candidate) =>
    candidate.is_published && candidate.family_id === family.id && candidate.id === nodeId,
  );
  return member ? { status: 'published', family, member } : { status: 'invalid' };
}

/** Node IDs are published ACE tree IDs, never email, applications or member PII. */
export function publishedAceNodePath(family: AceFamily, member: AceFamilyMember): string {
  const params = new URLSearchParams({ fam: family.slug, node: member.id });
  return `/ace?${params.toString()}`;
}
