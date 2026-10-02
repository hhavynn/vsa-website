// Admin activity log: the shape of an entry, how summaries read, what metadata
// may be stored, and which changes can be undone. Pure; the repository writes
// and reads the rows (data/repos/adminActivity.ts).
//
// Privacy rule: the log stores concise operational facts (a name, a before/after
// label, record ids). Never whole rows, emails, or other sensitive columns.
import { formatYearSpan } from './operationalStatus';

// ─── Actions and filters ─────────────────────────────────────────────────────

export type ActivityFilterKey = 'all' | 'ace' | 'houses' | 'cabinet' | 'interns' | 'members' | 'year_setup';

export const ACTIVITY_FILTERS: ReadonlyArray<{ key: ActivityFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ace', label: 'ACE' },
  { key: 'houses', label: 'Houses' },
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'interns', label: 'Interns' },
  { key: 'members', label: 'Members' },
  { key: 'year_setup', label: 'Year Setup' },
];

/** `domain.verb`; the domain prefix decides which filter an entry belongs to. */
const DOMAIN_FILTER: Record<string, ActivityFilterKey> = {
  ace: 'ace',
  house: 'houses',
  cabinet: 'cabinet',
  intern: 'interns',
  member: 'members',
  year: 'year_setup',
};

export function activityFilterFor(action: string): ActivityFilterKey | null {
  return DOMAIN_FILTER[action.split('.')[0]] ?? null;
}

export function matchesActivityFilter(action: string, filter: ActivityFilterKey): boolean {
  return filter === 'all' || activityFilterFor(action) === filter;
}

/** The action prefixes the repository queries for a filter (server-side filter). */
export function actionPrefixesFor(filter: ActivityFilterKey): string[] | null {
  if (filter === 'all') return null;
  return Object.entries(DOMAIN_FILTER)
    .filter(([, key]) => key === filter)
    .map(([prefix]) => `${prefix}.`);
}

export const ACTIVITY_ACTIONS = {
  aceAssignmentChanged: 'ace.assignment_changed',
  aceLinkChanged: 'ace.link_changed',
  aceBulkLinked: 'ace.bulk_linked',
  aceCycleLocked: 'ace.cycle_locked',
  aceCycleUnlocked: 'ace.cycle_unlocked',
  aceCyclePublished: 'ace.cycle_published',
  houseAssignmentChanged: 'house.assignment_changed',
  houseBulkChanged: 'house.bulk_changed',
  houseBatchLocked: 'house.batch_locked',
  houseBatchReopened: 'house.batch_reopened',
  houseBatchPublished: 'house.batch_published',
  internAdded: 'intern.added',
  internRemoved: 'intern.removed',
  internMentorChanged: 'intern.mentor_changed',
  internBulkChanged: 'intern.bulk_changed',
  internCohortLocked: 'intern.cohort_locked',
  internCohortPublished: 'intern.cohort_published',
  cabinetPositionAssigned: 'cabinet.position_assigned',
  cabinetBulkChanged: 'cabinet.bulk_changed',
  cabinetRosterLocked: 'cabinet.roster_locked',
  cabinetRosterPublished: 'cabinet.roster_published',
  memberLinkChanged: 'member.link_changed',
  memberBulkChanged: 'member.bulk_changed',
  yearSetupCreated: 'year.setup_created',
} as const;

export type ActivityAction = typeof ACTIVITY_ACTIONS[keyof typeof ACTIVITY_ACTIONS];

// ─── Entries ─────────────────────────────────────────────────────────────────

export type ActivityMetadata = Record<string, unknown>;

export interface ActivityDraft {
  action: string;
  entityType: string;
  entityId?: string | null;
  academicYearStart?: number | null;
  summary: string;
  metadata?: ActivityMetadata;
}

export interface ActivityEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  academicYearStart: number | null;
  summary: string;
  metadata: ActivityMetadata;
  createdAt: string;
}

export const MAX_SUMMARY_LENGTH = 300;

export function clampSummary(summary: string): string {
  const clean = summary.replace(/\s+/g, ' ').trim();
  return clean.length <= MAX_SUMMARY_LENGTH ? clean : `${clean.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`;
}

// ─── Metadata hygiene ────────────────────────────────────────────────────────

const SENSITIVE_KEY = /e-?mail|phone|password|token|secret|address|birth|ssn|api_?key/i;
const MAX_STRING = 200;
const MAX_ARRAY = 50;
const MAX_DEPTH = 3;
const MAX_METADATA_CHARS = 3500;

function cleanValue(value: unknown, depth: number): unknown {
  if (depth >= MAX_DEPTH) return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING - 1)}…` : value;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => cleanValue(item, depth + 1)).filter((item) => item !== undefined);
  if (value && typeof value === 'object') return cleanObject(value as Record<string, unknown>, depth + 1);
  return undefined;
}

function cleanObject(input: Record<string, unknown>, depth: number): ActivityMetadata {
  const out: ActivityMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const cleaned = cleanValue(value, depth);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

/**
 * Drops sensitive-looking keys, truncates long strings, caps nesting and array
 * length, and refuses to grow past the database's size limit. The privacy
 * control is "callers pass concise facts"; this is the backstop.
 */
export function sanitizeMetadata(metadata: ActivityMetadata | undefined): ActivityMetadata {
  const cleaned = cleanObject(metadata ?? {}, 0);
  if (JSON.stringify(cleaned).length <= MAX_METADATA_CHARS) return cleaned;
  // Keep the undo spec (small, essential) and a flag; drop the rest.
  const trimmed: ActivityMetadata = {};
  if (cleaned.undo) trimmed.undo = cleaned.undo;
  if (cleaned.undoes) trimmed.undoes = cleaned.undoes;
  trimmed.truncated = true;
  return trimmed;
}

// ─── Summaries ───────────────────────────────────────────────────────────────

const label = (value: string | null | undefined, fallback = 'none') => (value && value.trim() ? value.trim() : fallback);

export const activitySummary = {
  houseChanged: (person: string, from: string | null, to: string | null) =>
    clampSummary(`Changed ${label(person, 'a member')}'s House: ${label(from, 'Unassigned')} → ${label(to, 'Unassigned')}`),
  houseBulk: (count: number, to: string | null) =>
    clampSummary(to ? `Assigned ${count} ${count === 1 ? 'row' : 'rows'} to ${to}` : `Cleared the House on ${count} ${count === 1 ? 'row' : 'rows'}`),
  aceAssignmentChanged: (little: string, from: string | null, to: string | null) =>
    clampSummary(`Changed ${label(little, 'a Little')}'s Big: ${label(from, 'Unassigned')} → ${label(to, 'Unassigned')}`),
  aceLinked: (node: string, member: string) => clampSummary(`Linked ACE node "${label(node)}" → member ${label(member)}`),
  aceUnlinked: (node: string, member: string | null) =>
    clampSummary(`Unlinked ACE node "${label(node)}"${member ? ` from member ${member}` : ''}`),
  aceBulkLinked: (count: number) => clampSummary(`Linked ${count} ${count === 1 ? 'Little' : 'Littles'} to their exact member matches`),
  cycleLocked: (domain: string, yearStart: number) => clampSummary(`Locked the ${formatYearSpan(yearStart)} ${domain} assignments`),
  cycleUnlocked: (domain: string, yearStart: number) => clampSummary(`Unlocked the ${formatYearSpan(yearStart)} ${domain} assignments`),
  published: (domain: string, yearStart: number, records?: number) =>
    clampSummary(`Published the ${formatYearSpan(yearStart)} ${domain}${records !== undefined ? ` (${records} ${records === 1 ? 'record' : 'records'})` : ''}`),
  internAdded: (count: number, yearStart: number) =>
    clampSummary(`Added ${count} ${count === 1 ? 'intern' : 'interns'} to the ${formatYearSpan(yearStart)} cohort`),
  internRemoved: (name: string) => clampSummary(`Removed intern ${label(name)} from the cohort`),
  internMentor: (intern: string, from: string | null, to: string | null) =>
    clampSummary(`Changed ${label(intern, 'an intern')}'s mentor: ${label(from)} → ${label(to)}`),
  cabinetAssigned: (role: string, from: string | null, to: string | null) =>
    clampSummary(`${label(role, 'Position')}: ${label(from, 'Unfilled')} → ${label(to, 'Unfilled')}`),
  bulk: (verb: string, count: number, noun: string) => clampSummary(`${verb} ${count} ${count === 1 ? noun : `${noun}s`}`),
  memberLink: (member: string, to: string | null) =>
    clampSummary(to ? `Linked ${label(member, 'a record')} to member ${to}` : `Unlinked ${label(member, 'a record')} from its member`),
  yearSetup: (yearStart: number) => clampSummary(`Prepared the ${formatYearSpan(yearStart)} academic year`),
};

// ─── Undo ────────────────────────────────────────────────────────────────────

export type UndoKind = 'house_draft_house' | 'ace_draft_big' | 'ace_node_link' | 'intern_mentor';

export interface UndoSpec {
  kind: UndoKind;
  /** Record ids needed to find the row again (batch + draft, cycle + draft, node). */
  target: Record<string, string>;
  /** The column value before the change (restore this). */
  before: string | null;
  /** The column value the change wrote (must still be there to undo). */
  after: string | null;
}

/**
 * The only actions that may carry an undo. Anything else (publish, reveal,
 * Cabinet publication, year setup, deletes, bulk edits) uses an explicit
 * corrective workflow instead, even if a stray `undo` block is present.
 */
export const UNDOABLE_ACTIONS: Readonly<Record<string, UndoKind>> = {
  [ACTIVITY_ACTIONS.houseAssignmentChanged]: 'house_draft_house',
  [ACTIVITY_ACTIONS.aceAssignmentChanged]: 'ace_draft_big',
  [ACTIVITY_ACTIONS.aceLinkChanged]: 'ace_node_link',
  [ACTIVITY_ACTIONS.internMentorChanged]: 'intern_mentor',
};

export const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const UNDO_TARGET_KEYS: Record<UndoKind, readonly string[]> = {
  house_draft_house: ['batchId', 'draftId'],
  ace_draft_big: ['draftId'],
  ace_node_link: ['nodeId'],
  intern_mentor: ['cycleId', 'draftId'],
};

export function buildUndoMetadata(spec: UndoSpec): ActivityMetadata {
  return { undo: { kind: spec.kind, target: spec.target, before: spec.before, after: spec.after } };
}

export function readUndoSpec(metadata: ActivityMetadata | null | undefined): UndoSpec | null {
  const raw = metadata?.undo as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind as UndoKind;
  const keys = UNDO_TARGET_KEYS[kind];
  if (!keys) return null;
  const target = raw.target as Record<string, unknown> | undefined;
  if (!target || typeof target !== 'object') return null;
  const cleanTarget: Record<string, string> = {};
  for (const key of keys) {
    if (typeof target[key] !== 'string' || !target[key]) return null;
    cleanTarget[key] = target[key] as string;
  }
  const before = raw.before === null || typeof raw.before === 'string' ? (raw.before as string | null) : undefined;
  const after = raw.after === null || typeof raw.after === 'string' ? (raw.after as string | null) : undefined;
  if (before === undefined || after === undefined) return null;
  return { kind, target: cleanTarget, before, after };
}

/** Entry ids that a later "undone" entry points at. */
export function undoneEntryIds(entries: ReadonlyArray<Pick<ActivityEntry, 'metadata'>>): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    const undoes = entry.metadata?.undoes;
    if (typeof undoes === 'string') ids.add(undoes);
  }
  return ids;
}

export function isUndoable(
  entry: Pick<ActivityEntry, 'id' | 'action' | 'metadata' | 'createdAt'>,
  options: { now?: number; undoneIds?: ReadonlySet<string> } = {},
): boolean {
  const kind = UNDOABLE_ACTIONS[entry.action];
  if (!kind) return false;
  if (options.undoneIds?.has(entry.id)) return false;
  const spec = readUndoSpec(entry.metadata);
  if (!spec || spec.kind !== kind || spec.before === spec.after) return false;
  const created = Date.parse(entry.createdAt);
  if (Number.isNaN(created)) return false;
  return (options.now ?? Date.now()) - created <= UNDO_WINDOW_MS;
}

export type UndoPlan =
  | { ok: true; restore: string | null }
  | { ok: false; reason: string };

/**
 * Compare-and-set: the change can only be undone while the recorded "after"
 * value is still current and the row is still editable. Otherwise undoing
 * would silently overwrite newer work.
 */
export function planUndo(spec: UndoSpec, current: { found: boolean; value: string | null; editable: boolean }): UndoPlan {
  if (!current.found) return { ok: false, reason: 'That record no longer exists.' };
  if (!current.editable) return { ok: false, reason: 'It is locked now. Reopen it before undoing.' };
  if ((current.value ?? null) !== (spec.after ?? null)) {
    return { ok: false, reason: 'It was changed again since, so undoing would overwrite newer work.' };
  }
  return { ok: true, restore: spec.before };
}

export function undoEntryDraft(original: Pick<ActivityEntry, 'id' | 'action' | 'entityType' | 'entityId' | 'academicYearStart' | 'summary'>): ActivityDraft {
  return {
    action: original.action.replace(/_changed$/, '_undone'),
    entityType: original.entityType,
    entityId: original.entityId,
    academicYearStart: original.academicYearStart,
    summary: clampSummary(`Undid: ${original.summary}`),
    metadata: { undoes: original.id },
  };
}

// ─── Display ─────────────────────────────────────────────────────────────────

/** First name or email local-part, so the log can say who without storing an email. */
export function actorLabel(user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  const named = [meta.full_name, meta.name].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (named) return named.trim().split(/\s+/)[0];
  const local = user?.email?.split('@')[0];
  return local ? local.replace(/[._-]+/g, ' ').split(' ')[0] : 'An admin';
}
