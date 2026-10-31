import { findExactMemberMatch, normalizeMemberName, type MemberNameIndex } from './memberLinkMatching';

/** An import row remains reviewable even when it repeats another input. */
export interface RoleReviewInput {
  index: number;
  name: string;
  duplicateOf: number | null;
}

export type NamePasteFormat = 'first-last' | 'last-first';
export type ReviewRoleKind = 'board' | 'intern';

export interface CabinetRoleSource {
  id: string;
  name: string;
  role: string;
  category: string;
  member_id: string | null;
  cabinet_year_id: string;
}

export type RoleReviewStatus =
  | 'identity-review'
  | 'source-review'
  | 'name-mismatch'
  | 'conflict'
  | 'already-linked'
  | 'ready';

export const MAX_ROLE_REVIEW_ROWS = 150;
export const MAX_ROLE_REVIEW_CHARACTERS = 16000;

/**
 * The regular format intentionally treats commas as separators.
 * Last, First needs an explicit toggle; never infer identity from a comma.
 */
export function parseRoleNames(raw: string, format: NamePasteFormat): RoleReviewInput[] {
  if (raw.length > MAX_ROLE_REVIEW_CHARACTERS) {
    throw new Error('The pasted batch is too large. Split it into smaller batches.');
  }

  // A copied spreadsheet column is fine; multiple non-empty TSV cells per
  // row are not. Otherwise a second column (email, role, phone, etc.) can
  // silently become a new person's name in the admin matching queue.
  if (raw.split(/\r?\n/).some((line) => line.split('\t').filter((cell) => cell.trim()).length > 1)) {
    throw new Error('Paste only the name column from your spreadsheet. Remove other columns before parsing.');
  }

  const tokens = format === 'last-first'
    ? raw.split(/[\n;]+/)
    : raw.split(/[\n;,]+/);

  const names = tokens.map((token) => {
    const cleaned = token.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, '').replace(/^["']|["']$/g, '').trim().replace(/\s+/g, ' ');
    if (format !== 'last-first' || !cleaned) return cleaned;
    const halves = cleaned.split(',');
    if (halves.length !== 2 || !halves[0].trim() || !halves[1].trim()) {
      throw new Error('For Last, First format, use one "Last, First" name per line.');
    }
    return (halves[1].trim() + ' ' + halves[0].trim()).replace(/\s+/g, ' ');
  }).filter(Boolean);

  if (names.length > MAX_ROLE_REVIEW_ROWS) {
    throw new Error('A review batch supports up to 150 names. Split the paste to continue.');
  }

  const firstIndex = new Map<string, number>();
  return names.map((name, index) => {
    const key = normalizeMemberName(name);
    const previous = firstIndex.get(key);
    if (previous === undefined) firstIndex.set(key, index + 1);
    return { index: index + 1, name, duplicateOf: previous ?? null };
  });
}

export function exactCandidateCount(name: string, index: MemberNameIndex): number {
  const match = findExactMemberMatch(name, index);
  return match.kind === 'none' ? 0 : match.kind === 'unique' ? 1 : match.members.length;
}

export function belongsToRole(source: CabinetRoleSource, role: ReviewRoleKind): boolean {
  return role === 'board'
    ? source.category === 'Executive Board' || source.category === 'General Board'
    : source.category === 'Interns';
}

/** Preview only. This function does not authorize a write or make a public claim. */
export function getRoleReviewStatus(
  row: RoleReviewInput,
  selectedMemberId: string | null,
  source: CabinetRoleSource | null,
  role: ReviewRoleKind,
  yearId: string,
  selectedSourceIds: readonly string[],
  canonicalMemberName?: string,
): RoleReviewStatus {
  if (!selectedMemberId || row.duplicateOf !== null) return 'identity-review';
  if (!source) return 'source-review';
  if (source.cabinet_year_id !== yearId || !belongsToRole(source, role)) return 'conflict';
  if (selectedSourceIds.filter((id) => id === source.id).length > 1) return 'conflict';
  if (source.member_id && source.member_id !== selectedMemberId) return 'conflict';
  if (normalizeMemberName(row.name) !== normalizeMemberName(source.name) ||
    (canonicalMemberName && normalizeMemberName(row.name) !== normalizeMemberName(canonicalMemberName))) return 'name-mismatch';
  if (source.member_id === selectedMemberId) return 'already-linked';

  return 'ready';
}
