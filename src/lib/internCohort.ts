// Pure logic for the Intern cohort manager: pasted-name parsing, canonical
// member matching, ordering, preflight, and the mapping onto cabinet_members.
// Nothing here touches the database.
import type { Database } from '../types/database';
import { cleanNameForImport, nameSimilarity, normalizeNameForMatch } from './memberMatching';

export type InternCohortCycle = Database['public']['Tables']['intern_cohort_cycles']['Row'];
export type InternCohortDraft = Database['public']['Tables']['intern_cohort_drafts']['Row'];
export type InternCohortDraftInsert = Database['public']['Tables']['intern_cohort_drafts']['Insert'];
export type CabinetMemberInsert = Database['public']['Tables']['cabinet_members']['Insert'];

/** Default public role label; the Internship page hides it when it is just "Intern". */
export const INTERN_DEFAULT_ROLE = 'Intern';
export const INTERN_CATEGORY = 'Interns';

export interface InternMemberOption {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
}

export interface MentorOption {
  id: string;
  name: string;
  role: string;
}

export interface ParsedInternName {
  name: string;
  roleOrTrack: string | null;
}

export function memberFullName(member: Pick<InternMemberOption, 'first_name' | 'last_name'>) {
  return `${member.first_name} ${member.last_name}`.trim();
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

export interface MemberMatchSuggestion {
  member: InternMemberOption;
  score: number;
}

export interface InternMatchResult {
  /** Set only for one exact, unclaimed name match. */
  memberId: string | null;
  /** Near-misses for an admin to review; never linked automatically. */
  suggestions: MemberMatchSuggestion[];
}

const SUGGESTION_THRESHOLD = 70;

export function matchInternToMember(
  name: string,
  directory: InternMemberOption[],
  claimedMemberIds: ReadonlySet<string> = new Set(),
): InternMatchResult {
  const wanted = normalizeNameForMatch(cleanNameForImport(name));
  if (!wanted) return { memberId: null, suggestions: [] };

  const exact = directory.filter((member) => normalizeNameForMatch(memberFullName(member)) === wanted);
  if (exact.length === 1 && !claimedMemberIds.has(exact[0].id)) {
    return { memberId: exact[0].id, suggestions: [] };
  }

  const suggestions = (exact.length > 0
    ? exact.map((member) => ({ member, score: 100 }))
    : directory
        .map((member) => ({ member, score: nameSimilarity(name, memberFullName(member)) }))
        .filter((entry) => entry.score >= SUGGESTION_THRESHOLD))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return { memberId: null, suggestions };
}

/** Rows to insert for a pasted list, linking each exact unambiguous name. */
export function buildInternDraftRows(
  parsed: ParsedInternName[],
  directory: InternMemberOption[],
  startingOrder: number,
  alreadyLinkedMemberIds: Iterable<string> = [],
): Array<Omit<InternCohortDraftInsert, 'cycle_id'>> {
  const claimed = new Set(alreadyLinkedMemberIds);
  return parsed.map((entry, index) => {
    const match = matchInternToMember(entry.name, directory, claimed);
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
  code: 'empty' | 'duplicate_member' | 'unlinked' | 'duplicate_name' | 'missing_mentor';
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
  /** Optional fields left empty. */
  notes: InternPreflightIssue[];
  canLock: boolean;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function buildInternPreflight(drafts: InternCohortDraft[]): InternPreflight {
  const blockers: InternPreflightIssue[] = [];
  const warnings: InternPreflightIssue[] = [];
  const notes: InternPreflightIssue[] = [];

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

  const noMentor = drafts.filter((draft) => !draft.mentor_cabinet_member_id);
  if (noMentor.length > 0) {
    notes.push({
      code: 'missing_mentor',
      message: `${plural(noMentor.length, 'missing mentor')} (optional).`,
      draftIds: noMentor.map((draft) => draft.id),
    });
  }

  return {
    accepted: drafts.length,
    linked: drafts.length - unlinked.length,
    blockers,
    warnings,
    notes,
    canLock: blockers.length === 0,
  };
}

/**
 * The public cabinet_members row for an intern. Only fields that map cleanly
 * go public: mentor, caption, and internal notes stay in the private draft.
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
