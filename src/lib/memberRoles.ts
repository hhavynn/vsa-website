/**
 * Public role badges are earned identities, not point/rank classifications.
 * The initial approved source is the *published* Cabinet roster: its linked
 * member_id and explicit academic year. Other sources (House Parent, ACE Fam
 * Head and VCN production) must join only through the future approved #623
 * projection, never via unreviewed names or private draft tables.
 */
export type PublicMemberRoleKind = 'board' | 'cabinet_position' | 'intern';

export interface PublicMemberRole {
  memberId: string;
  kind: PublicMemberRoleKind;
  label: string;
  academicYearStart: number;
  sourceType: 'cabinet_members';
}

export interface PublishedCabinetRoleRow {
  id: string;
  member_id: string | null;
  role: string;
  category: string;
}

/** Source-derived order: leadership recognition before exact position, then Intern. */
const ORDER: Record<PublicMemberRoleKind, number> = {
  board: 0,
  cabinet_position: 1,
  intern: 2,
};

/**
 * Only an explicitly linked, public Cabinet position can confer a badge.
 * Published roster categories distinguish Board from Interns; "Intern" is
 * never silently elevated to Board and no role is inferred from a name.
 */
export function shapePublishedCabinetRoles(
  rows: readonly PublishedCabinetRoleRow[],
  memberIds: readonly string[],
  academicYearStart: number,
): Map<string, PublicMemberRole[]> {
  const allowed = new Set(memberIds);
  const mapped = new Map<string, PublicMemberRole[]>();
  for (const row of rows) {
    const memberId = row.member_id;
    if (!memberId || !allowed.has(memberId)) continue;
    const roles = mapped.get(memberId) ?? [];
    const append = (kind: PublicMemberRoleKind, label: string) => {
      const normalized = label.trim();
      if (!normalized || roles.some((role) => role.kind === kind && role.label.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return;
      roles.push({
        memberId,
        kind,
        label: normalized,
        academicYearStart,
        sourceType: 'cabinet_members',
      });
    };

    if (row.category === 'Executive Board' || row.category === 'General Board') {
      append('board', 'Board Member');
      const position = row.role?.trim() ?? '';
      if (position && position.toLocaleLowerCase() !== 'board member') {
        append('cabinet_position', position);
      }
    } else if (row.category === 'Interns') {
      append('intern', 'Intern');
    }
    if (roles.length > 0) mapped.set(memberId, roles);
  }

  for (const roles of Array.from(mapped.values())) {
    roles.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.label.localeCompare(b.label));
  }
  return mapped;
}

/** Intentionally no all-time current-role inference; dated roles need a year. */
export function rolesForSelectedYear(
  rolesById: ReadonlyMap<string, PublicMemberRole[]>,
  memberId: string,
  selectedYear: number | 'all' | null,
): PublicMemberRole[] {
  if (typeof selectedYear !== 'number') return [];
  return (rolesById.get(memberId) ?? []).filter((role) => role.academicYearStart === selectedYear);
}
