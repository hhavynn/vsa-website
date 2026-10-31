/** Verified, year-scoped public role projection; never inferred from a display name. */
import { formatAcademicYear } from './academicTerms';
import { houseSlugFromKey } from '../utils/houseSlug';

export const PUBLIC_ROLE_KINDS = [
  'board', 'cabinet_position', 'house_parent', 'ace_fam_head', 'intern',
  'vcn_choreographer', 'vcn_dancer', 'vcn_stage_ninja', 'vcn_props_member',
] as const;
export type PublicMemberRoleKind = (typeof PUBLIC_ROLE_KINDS)[number];

export interface PublicMemberRole {
  memberId: string;
  kind: PublicMemberRoleKind;
  label: string;
  academicYearStart: number;
  sourceType: string;
  relatedKey: string | null;
}

export interface PublicMemberRoleRow {
  member_id: string;
  kind: string;
  label: string;
  academic_year_start: number;
  source_type: string;
  related_key: string | null;
}

const kindSet: ReadonlySet<string> = new Set(PUBLIC_ROLE_KINDS);
const order = new Map<string, number>(PUBLIC_ROLE_KINDS.map((kind, i) => [kind, i]));

/**
 * Fail closed on an RPC response for an unrelated year/identity. A newer
 * backend arm is ignored on older bundles until its badge kind is supported.
 */
export function shapePublicMemberRoles(
  rows: readonly PublicMemberRoleRow[],
  memberIds: readonly string[],
  academicYearStart: number,
): Map<string, PublicMemberRole[]> {
  const permitted = new Set(memberIds);
  const result = new Map<string, PublicMemberRole[]>();
  for (const row of rows) {
    if (row.academic_year_start !== academicYearStart || !permitted.has(row.member_id)) {
      throw new Error('Public role projection returned a foreign year or member.');
    }
    if (!kindSet.has(row.kind)) continue;
    const kind = row.kind as PublicMemberRoleKind;
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!label) continue;
    const roles = result.get(row.member_id) ?? [];
    if (roles.some((role) => role.kind === kind && role.label.toLowerCase() === label.toLowerCase())) continue;
    roles.push({
      memberId: row.member_id, kind, label,
      academicYearStart, sourceType: row.source_type,
      relatedKey: row.related_key,
    });
    result.set(row.member_id, roles);
  }
  result.forEach((roles) => roles.sort(
    (a, b) => (order.get(a.kind) ?? 999) - (order.get(b.kind) ?? 999) ||
      a.label.localeCompare(b.label),
  ));
  return result;
}

export function relatedPublicPath(role: PublicMemberRole): string | null {
  if (role.kind !== 'house_parent' || !role.relatedKey) return null;
  const slug = houseSlugFromKey(role.relatedKey);
  return slug ? '/house/year/' + formatAcademicYear(role.academicYearStart) + '/' + slug : null;
}

/** All-Time is never proof that an archived role is a current position. */
export function rolesForSelectedYear(
  rolesById: ReadonlyMap<string, PublicMemberRole[]>,
  memberId: string,
  selectedYear: number | 'all' | null,
): PublicMemberRole[] {
  if (typeof selectedYear !== 'number') return [];
  return (rolesById.get(memberId) ?? []).filter((role) => role.academicYearStart === selectedYear);
}
