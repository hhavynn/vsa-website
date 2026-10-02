// Duplicate and conflict detection that runs before an admin saves or imports.
// It only ever FLAGS: it never merges two people, links records, or "fixes" a
// name. Actual member-record merges stay in Admin → Merge Review.
import { normalizeMemberName } from './memberLinkMatching';

export type ConflictKind =
  | 'same_member_twice'
  | 'same_ace_little_twice'
  | 'same_person_two_houses'
  | 'cabinet_duplicate_slot'
  | 'cabinet_person_two_slots'
  | 'same_intern_twice'
  | 'near_identical_rows';

export interface ConflictItem {
  id: string;
  label: string;
  detail?: string;
}

export interface PossibleDuplicate {
  kind: ConflictKind;
  /** Stable key for React lists. */
  key: string;
  title: string;
  /** Plain-language reason, shown under the pair. */
  reason: string;
  items: ConflictItem[];
  /** True for identical identities (same id or same normalized name). False for lookalikes. */
  exact: boolean;
  /** Blocking conflicts must be resolved before saving; the rest are warnings. */
  severity: 'blocker' | 'warning';
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

const asItem = (row: { id: string; label: string; detail?: string }): ConflictItem => ({ id: row.id, label: row.label, detail: row.detail });

// ─── Exact duplicates ────────────────────────────────────────────────────────

export interface IdentityRow {
  id: string;
  label: string;
  memberId?: string | null;
  detail?: string;
}

/** One canonical member on two rows (two Littles, two interns, two cabinet slots…). */
export function findSameMemberTwice(
  rows: readonly IdentityRow[],
  kind: ConflictKind = 'same_member_twice',
  noun = 'row',
): PossibleDuplicate[] {
  return Array.from(groupBy(rows, (row) => row.memberId ?? null).entries())
    .filter(([, group]) => group.length > 1)
    .map(([memberId, group]) => ({
      kind,
      key: `${kind}:${memberId}`,
      title: group[0].label,
      reason: `The same member is on ${group.length} ${noun}s.`,
      items: group.map(asItem),
      exact: true,
      severity: 'blocker' as const,
    }));
}

/** Identical names after case/accent/spacing normalization. Names are never merged. */
export function findSameNameTwice(
  rows: readonly IdentityRow[],
  kind: ConflictKind = 'near_identical_rows',
  noun = 'row',
): PossibleDuplicate[] {
  return Array.from(groupBy(rows, (row) => normalizeMemberName(row.label) || null).entries())
    .filter(([, group]) => group.length > 1)
    .map(([name, group]) => ({
      kind,
      key: `${kind}:name:${name}`,
      title: group[0].label,
      reason: `"${group[0].label}" appears on ${group.length} ${noun}s. They may be the same person or two people with one name.`,
      items: group.map(asItem),
      exact: true,
      severity: 'warning' as const,
    }));
}

/** Same ACE Little listed twice (by member link, else by normalized name). */
export function findAceLittleDuplicates(rows: readonly IdentityRow[]): PossibleDuplicate[] {
  const byMember = findSameMemberTwice(rows, 'same_ace_little_twice', 'Little');
  const flagged = new Set(byMember.flatMap((group) => group.items.map((item) => item.id)));
  const byName = findSameNameTwice(
    rows.filter((row) => !row.memberId || !flagged.has(row.id)),
    'same_ace_little_twice',
    'Little',
  ).map((group) => ({ ...group, severity: 'blocker' as const }));
  return [...byMember, ...byName];
}

export interface HouseConflictRow extends IdentityRow {
  houseId: string | null;
  houseLabel?: string | null;
}

/** One member assigned to different Houses. (The same House twice is a plain duplicate.) */
export function findPersonInTwoHouses(rows: readonly HouseConflictRow[]): PossibleDuplicate[] {
  return Array.from(groupBy(rows, (row) => row.memberId ?? null).entries())
    .filter(([, group]) => new Set(group.map((row) => row.houseId).filter(Boolean)).size > 1)
    .map(([memberId, group]) => ({
      kind: 'same_person_two_houses' as const,
      key: `same_person_two_houses:${memberId}`,
      title: group[0].label,
      reason: `Assigned to ${group.map((row) => row.houseLabel || 'a House').join(' and ')}. A member can only be in one House.`,
      items: group.map((row) => ({ id: row.id, label: row.label, detail: row.houseLabel ?? undefined })),
      exact: true,
      severity: 'blocker' as const,
    }));
}

export interface CabinetSlotRow {
  id: string;
  /** Position title. */
  role: string;
  name: string | null;
  memberId?: string | null;
}

/**
 * Cabinet: the same role listed with the same person twice is an accidental
 * duplicate slot (blocker); one person across different roles is flagged as a
 * warning, since co-hatted officers are legitimate.
 */
export function findCabinetDuplicates(rows: readonly CabinetSlotRow[]): PossibleDuplicate[] {
  const filled = rows.filter((row) => row.name && row.name.trim());
  const identity = (row: CabinetSlotRow) => row.memberId ?? (normalizeMemberName(row.name) || null);
  const results: PossibleDuplicate[] = [];

  const sameRoleSamePerson = groupBy(filled, (row) => {
    const who = identity(row);
    return who ? `${normalizeMemberName(row.role)}|${who}` : null;
  });
  const flagged = new Set<string>();
  for (const [key, group] of Array.from(sameRoleSamePerson)) {
    if (group.length < 2) continue;
    group.forEach((row) => flagged.add(row.id));
    results.push({
      kind: 'cabinet_duplicate_slot',
      key: `cabinet_duplicate_slot:${key}`,
      title: `${group[0].name} · ${group[0].role}`,
      reason: `${group[0].role} is listed ${group.length} times for the same person.`,
      items: group.map((row) => ({ id: row.id, label: row.name ?? '', detail: row.role })),
      exact: true,
      severity: 'blocker',
    });
  }

  const byPerson = groupBy(filled, identity);
  for (const [who, group] of Array.from(byPerson)) {
    const roles = new Set(group.map((row) => normalizeMemberName(row.role)));
    if (group.length < 2 || roles.size < 2 || group.every((row) => flagged.has(row.id))) continue;
    results.push({
      kind: 'cabinet_person_two_slots',
      key: `cabinet_person_two_slots:${who}`,
      title: group[0].name ?? '',
      reason: `Holds ${roles.size} positions (${group.map((row) => row.role).join(', ')}). Fine for co-officers; check it is intended.`,
      items: group.map((row) => ({ id: row.id, label: row.name ?? '', detail: row.role })),
      exact: true,
      severity: 'warning',
    });
  }
  return results;
}

// ─── Lookalikes ──────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

const sortedTokens = (name: string) => name.split(' ').filter(Boolean).sort().join(' ');

/**
 * Names that are almost, but not exactly, the same ("Andy Nguyen" / "Andy
 * Nguyen " with a typo, or "Nguyen Andy"). Always a warning: this is a prompt
 * for a human, never a basis for merging. Identical names are reported by
 * findSameNameTwice instead.
 */
export function findLookalikeNames(rows: readonly IdentityRow[], noun = 'row'): PossibleDuplicate[] {
  const prepared = rows
    .map((row) => ({ row, key: normalizeMemberName(row.label) }))
    .filter((entry) => entry.key.length >= 5);
  const results: PossibleDuplicate[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < prepared.length; i += 1) {
    for (let j = i + 1; j < prepared.length; j += 1) {
      const a = prepared[i];
      const b = prepared[j];
      if (a.key === b.key) continue;
      const reordered = sortedTokens(a.key) === sortedTokens(b.key);
      const typo = !reordered && levenshtein(a.key, b.key, 1) <= 1;
      if (!reordered && !typo) continue;
      // Two different canonical members are two people, however alike their names.
      if (a.row.memberId && b.row.memberId && a.row.memberId !== b.row.memberId) continue;
      const pair = [a.row.id, b.row.id].sort().join('|');
      if (seen.has(pair)) continue;
      seen.add(pair);
      results.push({
        kind: 'near_identical_rows',
        key: `near_identical_rows:${pair}`,
        title: `${a.row.label} / ${b.row.label}`,
        reason: `These ${noun}s look alike (${reordered ? 'same words, different order' : 'one letter apart'}). Check whether they are the same person.`,
        items: [asItem(a.row), asItem(b.row)],
        exact: false,
        severity: 'warning',
      });
    }
  }
  return results;
}

export function internDuplicates(rows: readonly IdentityRow[]): PossibleDuplicate[] {
  const byMember = findSameMemberTwice(rows, 'same_intern_twice', 'intern');
  const flagged = new Set(byMember.flatMap((group) => group.items.map((item) => item.id)));
  const byName = findSameNameTwice(rows.filter((row) => !flagged.has(row.id)), 'same_intern_twice', 'intern');
  return [...byMember, ...byName, ...findLookalikeNames(rows, 'intern')];
}

export function countBlockers(duplicates: readonly PossibleDuplicate[]): number {
  return duplicates.filter((duplicate) => duplicate.severity === 'blocker').length;
}

/** ids of every row named in any duplicate group, so a table can badge them. */
export function duplicateRowIds(duplicates: readonly PossibleDuplicate[]): Set<string> {
  return new Set(duplicates.flatMap((duplicate) => duplicate.items.map((item) => item.id)));
}
