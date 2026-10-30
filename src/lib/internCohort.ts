// Pure logic for the Intern cohort manager: pasted-name parsing, canonical
// member matching, ordering, preflight, and the mapping onto cabinet_members.
// Nothing here touches the database.
import type { Database } from '../types/database';
import { MemberNameIndex, findExactMemberMatch } from './memberLinkMatching';
import { cleanNameForImport, normalizeNameForMatch } from './memberMatching';

export type InternCohortCycle = Database['public']['Tables']['intern_cohort_cycles']['Row'];
export type InternCohortDraft = Database['public']['Tables']['intern_cohort_drafts']['Row'];
export type InternCohortDraftInsert = Database['public']['Tables']['intern_cohort_drafts']['Insert'];
export type CabinetMemberInsert = Database['public']['Tables']['cabinet_members']['Insert'];

/** Default public role label; the Internship page hides it when it is just "Intern". */
export const INTERN_DEFAULT_ROLE = 'Intern';
export const INTERN_CATEGORY = 'Interns';

/** The most cabinet positions one intern shadows; the database enforces it too. */
export const MAX_SHADOW_POSITIONS = 3;
/** Boards whose positions can be shadowed. */
export const SHADOW_POSITION_CATEGORIES = ['Executive Board', 'General Board'];

/** Trimmed, non-empty, first occurrence of each title, in the given order. */
export function distinctPositionTitles(titles: readonly string[]): string[] {
  return Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)));
}

/**
 * An intern's list after choosing `value` in picker `slot` ('' clears it).
 * Always compact, free of repeats, and within the limit.
 */
export function withShadowPosition(current: readonly string[], slot: number, value: string): string[] {
  const next = [...current];
  if (slot >= next.length) next.push(value);
  else next[slot] = value;
  return distinctPositionTitles(next).slice(0, MAX_SHADOW_POSITIONS);
}

/**
 * Titles picker `slot` may offer: every option no other picker holds, plus the
 * slot's own value, so a title since renamed on Cabinet stays visible.
 */
export function shadowPositionChoices(options: readonly string[], current: readonly string[], slot: number): string[] {
  const own = current[slot];
  const taken = new Set(current.filter((_, index) => index !== slot));
  const available = options.filter((option) => !taken.has(option));
  return own && !available.includes(own) ? [own, ...available] : available;
}

export function sameShadowPositions(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((title, index) => title === b[index]);
}

export interface ParsedInternName {
  name: string;
  roleOrTrack: string | null;
}

/**
 * One intern per line, "Name" or "Name, Track" (a tab, " | ", or " - " also
 * separates the track). A leading header line containing "name" is skipped.
 */
export function parseInternNames(raw: string): ParsedInternName[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const body = lines.length > 0 && /^name\b/i.test(lines[0]) ? lines.slice(1) : lines;
  return body
    .map((line) => {
      const [namePart, ...rest] = line.split(/\t|\s\|\s|\s-\s|,/);
      const name = cleanNameForImport(namePart ?? '');
      const track = rest.join(' ').trim();
      return { name, roleOrTrack: track || null };
    })
    .filter((entry) => entry.name.length > 0);
}

export interface InternMatchResult {
  /** Set only for one exact, unclaimed name match. Near-misses are never guessed. */
  memberId: string | null;
}

export function matchInternToMember(
  name: string,
  nameIndex: MemberNameIndex,
  claimedMemberIds: ReadonlySet<string> = new Set(),
): InternMatchResult {
  const match = findExactMemberMatch(cleanNameForImport(name), nameIndex);
  return { memberId: match.kind === 'unique' && !claimedMemberIds.has(match.member.id) ? match.member.id : null };
}

/** Rows to insert for a pasted list, linking each exact unambiguous name. */
export function buildInternDraftRows(
  parsed: ParsedInternName[],
  nameIndex: MemberNameIndex,
  startingOrder: number,
  alreadyLinkedMemberIds: Iterable<string> = [],
): Array<Omit<InternCohortDraftInsert, 'cycle_id'>> {
  const claimed = new Set(alreadyLinkedMemberIds);
  return parsed.map((entry, index) => {
    const match = matchInternToMember(entry.name, nameIndex, claimed);
    if (match.memberId) claimed.add(match.memberId);
    return {
      name: entry.name,
      member_id: match.memberId,
      role_or_track: entry.roleOrTrack,
      display_order: startingOrder + index,
    };
  });
}

/** display_order values that make `ids` sequential, only for rows that change. */
export function resequence(drafts: InternCohortDraft[], orderedIds: string[]) {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  return orderedIds
    .map((id, index) => ({ id, display_order: index }))
    .filter((entry) => byId.get(entry.id) && byId.get(entry.id)?.display_order !== entry.display_order);
}

export function moveId(orderedIds: string[], id: string, direction: -1 | 1) {
  const index = orderedIds.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= orderedIds.length) return orderedIds;
  const next = [...orderedIds];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function sortDrafts(drafts: InternCohortDraft[]) {
  return [...drafts].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
}

export interface InternPreflightIssue {
  code: 'empty' | 'duplicate_member' | 'unlinked' | 'duplicate_name';
  message: string;
  draftIds: string[];
}

export interface InternPreflight {
  accepted: number;
  linked: number;
  /** Hard stops: lock and publish are refused while any remain. */
  blockers: InternPreflightIssue[];
  /** Worth a look, never a stop. */
  warnings: InternPreflightIssue[];
  canLock: boolean;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function buildInternPreflight(drafts: InternCohortDraft[]): InternPreflight {
  const blockers: InternPreflightIssue[] = [];
  const warnings: InternPreflightIssue[] = [];

  if (drafts.length === 0) {
    blockers.push({ code: 'empty', message: 'The cohort has no interns.', draftIds: [] });
  }

  const byMember = new Map<string, InternCohortDraft[]>();
  drafts.forEach((draft) => {
    if (draft.member_id) byMember.set(draft.member_id, [...(byMember.get(draft.member_id) ?? []), draft]);
  });
  const duplicateMembers = Array.from(byMember.values()).filter((list) => list.length > 1);
  if (duplicateMembers.length > 0) {
    blockers.push({
      code: 'duplicate_member',
      message: `${plural(duplicateMembers.length, 'duplicate canonical member')} (the same member is linked to more than one intern).`,
      draftIds: duplicateMembers.flat().map((draft) => draft.id),
    });
  }

  const unlinked = drafts.filter((draft) => !draft.member_id);
  if (unlinked.length > 0) {
    warnings.push({
      code: 'unlinked',
      message: `${plural(unlinked.length, 'member link')} unresolved (no avatar until linked).`,
      draftIds: unlinked.map((draft) => draft.id),
    });
  }

  const byName = new Map<string, InternCohortDraft[]>();
  drafts.forEach((draft) => {
    const key = normalizeNameForMatch(draft.name);
    byName.set(key, [...(byName.get(key) ?? []), draft]);
  });
  const duplicateNames = Array.from(byName.values()).filter((list) => list.length > 1);
  if (duplicateNames.length > 0) {
    warnings.push({
      code: 'duplicate_name',
      message: `${plural(duplicateNames.length, 'duplicate name')}.`,
      draftIds: duplicateNames.flat().map((draft) => draft.id),
    });
  }

  return {
    accepted: drafts.length,
    linked: drafts.length - unlinked.length,
    blockers,
    warnings,
    canLock: blockers.length === 0,
  };
}

/**
 * The public cabinet_members row for an intern. Only fields that map cleanly
 * go public: shadow positions, caption, and internal notes stay in the private draft.
 */
export function cabinetMemberFromIntern(draft: InternCohortDraft, cabinetYearId: string): CabinetMemberInsert {
  return {
    name: draft.name.trim(),
    role: draft.role_or_track?.trim() || INTERN_DEFAULT_ROLE,
    category: INTERN_CATEGORY,
    display_order: draft.display_order,
    member_id: draft.member_id,
    cabinet_year_id: cabinetYearId,
  };
}

export function formatCohortYears(cycle: Pick<InternCohortCycle, 'academic_year_start' | 'academic_year_end'>) {
  return `${cycle.academic_year_start}–${String(cycle.academic_year_end).slice(-2)}`;
}
