/**
 * Identity matching between free-text names (ACE nodes, Cabinet rows, photo
 * requests) and canonical `members` rows from the `public_members` projection.
 *
 * Matching is exact on a normalized full name only. There is deliberately no
 * fuzzy matching: a wrong link shows one person's photo on another person.
 */

/** The `public_members` columns needed to identify someone. Never email. */
export interface MemberLookupRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  college: string | null;
  year: string | null;
}

export interface MemberOption {
  id: string;
  fullName: string;
  college: string | null;
  year: string | null;
  /** "Havyn Nguyen · Sixth · Fourth Year" */
  displayName: string;
}

export type ExactMemberMatch =
  | { kind: 'unique'; member: MemberOption }
  | { kind: 'ambiguous'; members: MemberOption[] }
  | { kind: 'none' };

export type MemberNameIndex = ReadonlyMap<string, MemberOption[]>;

/**
 * Case, whitespace, and Vietnamese diacritics are ignored ("Nguyễn  Văn" ==
 * "nguyen van"); every other character, including middle initials, must match.
 */
export function normalizeMemberName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function toMemberOption(row: MemberLookupRow): MemberOption {
  const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim().replace(/\s+/g, ' ');
  return {
    id: row.id,
    fullName,
    college: row.college,
    year: row.year,
    displayName: [fullName, row.college, row.year].filter(Boolean).join(' · '),
  };
}

export function buildMemberNameIndex(members: readonly MemberOption[]): MemberNameIndex {
  const index = new Map<string, MemberOption[]>();
  for (const member of members) {
    const key = normalizeMemberName(member.fullName);
    if (!key) continue;
    const list = index.get(key);
    if (list) list.push(member);
    else index.set(key, [member]);
  }
  return index;
}

export function findExactMemberMatch(name: string | null | undefined, index: MemberNameIndex): ExactMemberMatch {
  const key = normalizeMemberName(name);
  const matches = key ? index.get(key) ?? [] : [];
  if (matches.length === 1) return { kind: 'unique', member: matches[0] };
  if (matches.length > 1) return { kind: 'ambiguous', members: matches };
  return { kind: 'none' };
}
