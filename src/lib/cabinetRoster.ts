// Pure logic for the Cabinet rollover workflow: structure copy, pasted-roster
// parsing, canonical member matching, preflight, and the mapping onto
// cabinet_members. Nothing here touches the database.
import type { Database } from '../types/database';
import {
  MemberNameIndex,
  findExactMemberMatch,
  normalizeMemberName,
} from './memberLinkMatching';
import { MemberLinkSuggestionData, suggestMemberLink } from './memberLinkSuggestion';
import { PreflightLine, pluralize } from './operationalStatus';

export type CabinetRosterCycle = Database['public']['Tables']['cabinet_roster_cycles']['Row'];
export type CabinetRosterDraft = Database['public']['Tables']['cabinet_roster_drafts']['Row'];
export type CabinetRosterDraftInsert = Database['public']['Tables']['cabinet_roster_drafts']['Insert'];
export type CabinetMemberInsert = Database['public']['Tables']['cabinet_members']['Insert'];

export const CABINET_ROSTER_CATEGORIES = ['Executive Board', 'General Board'] as const;
export type CabinetRosterCategory = (typeof CABINET_ROSTER_CATEGORIES)[number];

/** Interns are managed by their own cohort cycle, never by the roster. */
export const ROSTER_EXCLUDED_CATEGORY = 'Interns';

export type RosterDraftPatch = Partial<Pick<
  CabinetRosterDraft,
  | 'role' | 'category' | 'display_order' | 'name' | 'member_id' | 'year' | 'college'
  | 'major' | 'pronouns' | 'favorite_snack' | 'fun_fact'
>>;

// ─── Structure copy ──────────────────────────────────────────────────────────

export interface StructureSource {
  role: string;
  category: string;
  display_order: number;
}

export function isRosterCategory(value: string): value is CabinetRosterCategory {
  return (CABINET_ROSTER_CATEGORIES as readonly string[]).includes(value);
}

function categoryRank(category: string) {
  const index = (CABINET_ROSTER_CATEGORIES as readonly string[]).indexOf(category);
  return index === -1 ? CABINET_ROSTER_CATEGORIES.length : index;
}

/**
 * The position structure of a previous year: role, category and display_order
 * and NOTHING else. People, member links, photos, and bios never carry over.
 */
export function buildStructureRows(
  source: readonly StructureSource[],
): Array<Pick<CabinetRosterDraftInsert, 'role' | 'category' | 'display_order'>> {
  return source
    .filter((row) => isRosterCategory(row.category) && row.role.trim().length > 0)
    .map((row) => ({ role: row.role.trim(), category: row.category, display_order: row.display_order }))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.display_order - b.display_order);
}

export function sortRosterDrafts(drafts: readonly CabinetRosterDraft[]): CabinetRosterDraft[] {
  return [...drafts].sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.display_order - b.display_order ||
      a.created_at.localeCompare(b.created_at),
  );
}

// ─── Roles ───────────────────────────────────────────────────────────────────

/** Case, punctuation, "&" vs "and", and hyphen spelling are ignored. */
export function normalizeRole(role: string | null | undefined): string {
  return (role ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9/\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const EXEC_ROLE_PATTERN = /president|secretary|treasurer|intercollegiate|external vice|internal vice/;

export function guessCategory(role: string): CabinetRosterCategory {
  return EXEC_ROLE_PATTERN.test(normalizeRole(role)) ? 'Executive Board' : 'General Board';
}

// ─── Pasted roster ───────────────────────────────────────────────────────────

export interface RosterEntry {
  name: string;
  role: string;
}

/**
 * One person per line as "Name, Role" (a tab or " | " also separates them).
 * A leading "Name, Role" header is skipped; list numbering and bullets are
 * stripped. Lines without both a name and a role are ignored.
 */
export function parseRosterPaste(raw: string): RosterEntry[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const body = lines.length > 0 && /^name\b/i.test(lines[0]) && /role|position|title/i.test(lines[0])
    ? lines.slice(1)
    : lines;
  const entries: RosterEntry[] = [];
  for (const line of body) {
    const stripped = line.replace(/^(?:[-*•]|\d+[.)])\s+/, '');
    const separator = stripped.includes('\t') ? '\t' : stripped.includes(' | ') ? ' | ' : ',';
    const at = stripped.indexOf(separator);
    if (at === -1) continue;
    const name = stripped.slice(0, at).replace(/\s+/g, ' ').trim();
    const role = stripped.slice(at + separator.length).replace(/\s+/g, ' ').trim();
    if (name && role) entries.push({ name, role });
  }
  return entries;
}

export interface RosterFillPlan {
  /** Existing empty positions that now have a person. */
  updates: Array<{ draftId: string; patch: RosterDraftPatch }>;
  /** Positions the structure did not have (a role added this year). */
  inserts: Array<Omit<CabinetRosterDraftInsert, 'cycle_id'>>;
  linked: number;
}

/**
 * Places each pasted person into the first empty position with the same role,
 * or adds a new position when the structure has none. Links a member only for
 * one exact, unclaimed name; near-misses are left for an admin to review.
 */
export function planRosterFill(
  drafts: readonly CabinetRosterDraft[],
  entries: readonly RosterEntry[],
  nameIndex: MemberNameIndex,
): RosterFillPlan {
  const claimed = new Set(drafts.map((draft) => draft.member_id).filter((id): id is string => !!id));
  const emptyByRole = new Map<string, CabinetRosterDraft[]>();
  const categoryByRole = new Map<string, string>();
  const orderByRole = new Map<string, number>();
  let maxOrder = -1;

  for (const draft of sortRosterDrafts(drafts)) {
    const key = normalizeRole(draft.role);
    categoryByRole.set(key, categoryByRole.get(key) ?? draft.category);
    orderByRole.set(key, orderByRole.get(key) ?? draft.display_order);
    maxOrder = Math.max(maxOrder, draft.display_order);
    if (!draft.name?.trim()) emptyByRole.set(key, [...(emptyByRole.get(key) ?? []), draft]);
  }

  const plan: RosterFillPlan = { updates: [], inserts: [], linked: 0 };

  for (const entry of entries) {
    const match = findExactMemberMatch(entry.name, nameIndex);
    const memberId = match.kind === 'unique' && !claimed.has(match.member.id) ? match.member.id : null;
    if (memberId) {
      claimed.add(memberId);
      plan.linked += 1;
    }

    const key = normalizeRole(entry.role);
    const slot = emptyByRole.get(key)?.shift();
    if (slot) {
      plan.updates.push({ draftId: slot.id, patch: { name: entry.name, member_id: memberId } });
      continue;
    }

    if (!orderByRole.has(key)) {
      maxOrder += 1;
      orderByRole.set(key, maxOrder);
    }
    plan.inserts.push({
      role: entry.role,
      category: categoryByRole.get(key) ?? guessCategory(entry.role),
      display_order: orderByRole.get(key) as number,
      name: entry.name,
      member_id: memberId,
    });
  }

  return plan;
}

// ─── Member link suggestions ─────────────────────────────────────────────────

export type RosterLinkSuggestion = MemberLinkSuggestionData;

/** What an admin should be offered for an unlinked position. */
export function rosterLinkSuggestion(
  draft: Pick<CabinetRosterDraft, 'name' | 'member_id'>,
  nameIndex: MemberNameIndex,
  claimedByOthers: ReadonlySet<string>,
): RosterLinkSuggestion | null {
  return suggestMemberLink(draft.name, draft.member_id, nameIndex, claimedByOthers);
}

// ─── Preflight ───────────────────────────────────────────────────────────────

export interface RosterIssue {
  code:
    | 'empty'
    | 'empty_slot'
    | 'duplicate_member'
    | 'unresolved_links'
    | 'missing_photos'
    | 'duplicate_name'
    | 'duplicate_role';
  message: string;
  draftIds: string[];
}

export interface RosterPreflight {
  positions: number;
  /** Positions with a person's name. */
  filled: number;
  /** Named positions linked to a canonical member. */
  linked: number;
  /** Named positions still without a member link. */
  needReview: number;
  /** Linked members with an approved public avatar. */
  photosAvailable: number;
  /** Hard stops: lock and publish are refused while any remain. */
  blockers: RosterIssue[];
  /** Worth a look, never a stop. A missing photo never blocks. */
  warnings: RosterIssue[];
  /** Short "✓" lines for what is already in good shape. */
  passed: string[];
  canLock: boolean;
}

const MAX_HOLDERS_PER_ROLE = 2;

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Array.from(groups.values());
}

export function buildRosterPreflight(
  drafts: readonly CabinetRosterDraft[],
  photoMemberIds: ReadonlySet<string> = new Set(),
): RosterPreflight {
  const blockers: RosterIssue[] = [];
  const warnings: RosterIssue[] = [];
  const passed: string[] = [];

  const named = drafts.filter((draft) => !!draft.name?.trim());
  const empty = drafts.filter((draft) => !draft.name?.trim());
  const linked = named.filter((draft) => !!draft.member_id);
  const unlinked = named.filter((draft) => !draft.member_id);
  const photos = linked.filter((draft) => photoMemberIds.has(draft.member_id as string));

  if (drafts.length === 0) {
    blockers.push({ code: 'empty', message: 'The roster has no positions.', draftIds: [] });
  }
  if (empty.length > 0) {
    blockers.push({
      code: 'empty_slot',
      message: `${pluralize(empty.length, 'position')} still empty (${empty.map((draft) => draft.role).join(', ')}).`,
      draftIds: empty.map((draft) => draft.id),
    });
  }

  const duplicateMembers = groupBy(linked, (draft) => draft.member_id).filter((group) => group.length > 1);
  if (duplicateMembers.length > 0) {
    blockers.push({
      code: 'duplicate_member',
      message: `${pluralize(duplicateMembers.length, 'duplicate canonical member')} (the same member is linked to more than one position).`,
      draftIds: duplicateMembers.flat().map((draft) => draft.id),
    });
  }

  if (unlinked.length > 0) {
    warnings.push({
      code: 'unresolved_links',
      message: `${pluralize(unlinked.length, 'unresolved link')} (no approved photo until linked).`,
      draftIds: unlinked.map((draft) => draft.id),
    });
  }

  const noPhoto = linked.filter((draft) => !photoMemberIds.has(draft.member_id as string));
  if (noPhoto.length > 0) {
    warnings.push({
      code: 'missing_photos',
      message: `${pluralize(noPhoto.length, 'missing approved photo')} (a photo is not required to publish).`,
      draftIds: noPhoto.map((draft) => draft.id),
    });
  }

  // The same member under two roles is a duplicate canonical member (a
  // blocker above); this flags repeated names that are not linked together.
  const dupNameGroups = groupBy(named, (draft) => normalizeMemberName(draft.name) || null).filter(
    (group) => group.length > 1 && !group.every((draft) => draft.member_id && draft.member_id === group[0].member_id),
  );
  if (dupNameGroups.length > 0) {
    warnings.push({
      code: 'duplicate_name',
      message: `${pluralize(dupNameGroups.length, 'name')} appears on more than one position without a shared member link.`,
      draftIds: dupNameGroups.flat().map((draft) => draft.id),
    });
  }

  const roleGroups = groupBy(drafts, (draft) => `${draft.category}|${normalizeRole(draft.role)}`);
  const crowdedRoles = roleGroups.filter((group) => group.length > MAX_HOLDERS_PER_ROLE);
  const sameRolePerson = roleGroups.filter((group) => {
    const people = group.map((draft) => normalizeMemberName(draft.name)).filter(Boolean);
    return new Set(people).size < people.length;
  });
  const duplicateRoles = Array.from(new Set([...crowdedRoles, ...sameRolePerson]));
  if (duplicateRoles.length > 0) {
    warnings.push({
      code: 'duplicate_role',
      message: `${pluralize(duplicateRoles.length, 'role')} look like a duplicate slot mistake (${duplicateRoles.map((group) => group[0].role).join(', ')}).`,
      draftIds: duplicateRoles.flat().map((draft) => draft.id),
    });
  }

  if (drafts.length > 0 && empty.length === 0) passed.push(`${pluralize(drafts.length, 'position')} filled`);
  if (drafts.length > 0 && duplicateRoles.length === 0) passed.push('No duplicate role slot mistakes');
  if (linked.length > 0) passed.push(`${linked.length} canonical member ${linked.length === 1 ? 'link' : 'links'}`);

  return {
    positions: drafts.length,
    filled: named.length,
    linked: linked.length,
    needReview: unlinked.length,
    photosAvailable: photos.length,
    blockers,
    warnings,
    passed,
    canLock: blockers.length === 0,
  };
}

// ─── Publish mapping ─────────────────────────────────────────────────────────

/**
 * The public cabinet_members row for a draft position. Photos are deliberately
 * absent: an approved avatar flows through member_id, and an existing manual
 * image_url on an updated row is left untouched.
 */
export function cabinetMemberFromDraft(draft: CabinetRosterDraft, cabinetYearId: string): CabinetMemberInsert {
  return {
    name: (draft.name ?? '').trim(),
    role: draft.role.trim(),
    category: draft.category,
    display_order: draft.display_order,
    member_id: draft.member_id,
    year: draft.year,
    college: draft.college,
    major: draft.major,
    pronouns: draft.pronouns,
    favorite_snack: draft.favorite_snack,
    fun_fact: draft.fun_fact,
    cabinet_year_id: cabinetYearId,
  };
}

const OPTIONAL_PUBLIC_FIELDS = ['member_id', 'year', 'college', 'major', 'pronouns', 'favorite_snack', 'fun_fact'] as const;

/**
 * The same mapping for a row that already exists publicly. A blank draft field
 * never erases what the public row already has (an adopted row may carry a bio
 * or link an admin entered by hand), so null optional fields are left out.
 */
export function cabinetMemberUpdateFromDraft(draft: CabinetRosterDraft, cabinetYearId: string): CabinetMemberInsert {
  const payload = cabinetMemberFromDraft(draft, cabinetYearId);
  for (const field of OPTIONAL_PUBLIC_FIELDS) {
    if (payload[field] === null || payload[field] === undefined) delete payload[field];
  }
  return payload;
}

export interface ExistingCabinetRow {
  id: string;
  name: string;
  member_id: string | null;
}

/**
 * Which existing public row a draft should update, so a repeat publish never
 * duplicates: the id already recorded on the draft, else an unclaimed row for
 * the same member (or, when unlinked, the same name).
 */
export function findExistingCabinetRow(
  draft: Pick<CabinetRosterDraft, 'published_cabinet_member_id' | 'member_id' | 'name'>,
  existing: readonly ExistingCabinetRow[],
  claimed: ReadonlySet<string>,
): ExistingCabinetRow | null {
  if (draft.published_cabinet_member_id) {
    const recorded = existing.find((row) => row.id === draft.published_cabinet_member_id);
    if (recorded) return recorded;
  }
  const wanted = normalizeMemberName(draft.name);
  return (
    existing.find(
      (row) =>
        !claimed.has(row.id) &&
        (draft.member_id ? row.member_id === draft.member_id : !row.member_id && normalizeMemberName(row.name) === wanted),
    ) ?? null
  );
}

export function formatRosterYears(cabinetYear: { start_year: number; end_year: number } | null | undefined) {
  return cabinetYear ? `${cabinetYear.start_year}–${String(cabinetYear.end_year % 100).padStart(2, '0')}` : 'Cabinet';
}

/** The preflight as the shared passed / blocking / needs-attention lines. */
export function rosterPreflightLines(preflight: RosterPreflight): PreflightLine[] {
  return [
    ...preflight.passed.map((message, index): PreflightLine => ({ id: `ok-${index}`, severity: 'ok', message })),
    ...preflight.blockers.map((issue): PreflightLine => ({ id: issue.code, severity: 'blocker', message: issue.message })),
    ...preflight.warnings.map((issue): PreflightLine => ({ id: issue.code, severity: 'warning', message: issue.message })),
  ];
}
