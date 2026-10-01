import type { AceAssignmentDraft, AceAssignmentStatus } from '../types';
import {
  MemberNameIndex,
  MemberOption,
  findExactMemberMatch,
  normalizeMemberName,
} from './memberLinkMatching';

/** A live ACE tree node, as the assignment workspace needs it. */
export interface AceNodeRef {
  id: string;
  name: string;
  familyId: string;
  familyName: string | null;
  memberId: string | null;
  parentId: string | null;
  roleLabel: string | null;
}

export const LITTLE_ROLE_LABEL = 'Little';

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/** Mirrors guard_ace_assignment_cycle_update in the database. */
const TRANSITIONS: Record<AceAssignmentStatus, readonly AceAssignmentStatus[]> = {
  draft: ['locked', 'archived'],
  locked: ['draft', 'archived', 'published'],
  published: ['archived'],
  archived: [],
};

export function canTransitionCycle(from: AceAssignmentStatus, to: AceAssignmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Only a draft cycle can be edited; locking freezes every assignment. */
export function isCycleEditable(status: AceAssignmentStatus): boolean {
  return status === 'draft';
}

export function formatAcademicYear(start: number): string {
  return `${start}–${String((start + 1) % 100).padStart(2, '0')}`;
}

// ─── Preflight ───────────────────────────────────────────────────────────────

export type AssignmentIssueCode =
  | 'unassigned'
  | 'missing_big'
  | 'duplicate_little'
  | 'duplicate_member'
  | 'already_published'
  | 'already_on_tree'
  | 'ambiguous_match'
  | 'unlinked_suggestion'
  | 'no_member_record'
  | 'member_on_other_node';

export interface AssignmentIssue {
  code: AssignmentIssueCode;
  severity: 'blocker' | 'warning';
  message: string;
  draftIds: string[];
}

export interface AssignmentPreflight {
  littleCount: number;
  linkedCount: number;
  assignedCount: number;
  unassignedCount: number;
  bigCount: number;
  issues: AssignmentIssue[];
  blockers: AssignmentIssue[];
  warnings: AssignmentIssue[];
  canPublish: boolean;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function normalizeLittleName(name: string): string {
  return normalizeMemberName(name);
}

function groupDuplicates(drafts: readonly AceAssignmentDraft[], keyOf: (d: AceAssignmentDraft) => string | null) {
  const groups = new Map<string, AceAssignmentDraft[]>();
  for (const draft of drafts) {
    const key = keyOf(draft);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), draft]);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

/**
 * Hard blockers (unassigned, missing Big, duplicate Little, duplicate member,
 * already on the tree) stop Publish; the publish function enforces the same
 * rules. Member-link problems stay warnings, because someone can legitimately
 * have no member record.
 */
export function computePreflight(
  drafts: readonly AceAssignmentDraft[],
  nodes: readonly AceNodeRef[],
  nameIndex: MemberNameIndex,
  status: AceAssignmentStatus,
): AssignmentPreflight {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const issues: AssignmentIssue[] = [];
  const push = (code: AssignmentIssueCode, severity: AssignmentIssue['severity'], message: string, ids: string[]) => {
    if (ids.length > 0) issues.push({ code, severity, message, draftIds: ids });
  };

  const unassigned = drafts.filter((d) => !d.big_ace_member_id);
  push('unassigned', 'blocker', `${plural(unassigned.length, 'unassigned Little', 'unassigned Littles')}`, unassigned.map((d) => d.id));

  const missingBig = drafts.filter((d) => d.big_ace_member_id && !nodesById.has(d.big_ace_member_id));
  push('missing_big', 'blocker', `${plural(missingBig.length, 'Little has a Big that no longer exists', 'Littles have a Big that no longer exists')}`, missingBig.map((d) => d.id));

  const dupNames = groupDuplicates(drafts, (d) => normalizeLittleName(d.little_name) || null);
  push('duplicate_little', 'blocker', `${plural(dupNames.length, 'Little appears twice', 'Littles appear more than once')}`, dupNames.flat().map((d) => d.id));

  const dupMembers = groupDuplicates(drafts, (d) => d.little_member_id);
  push('duplicate_member', 'blocker', `${plural(dupMembers.length, 'canonical member assigned twice', 'canonical members assigned more than once')}`, dupMembers.flat().map((d) => d.id));

  if (status !== 'published') {
    const alreadyPublished = drafts.filter((d) => d.published_ace_member_id);
    push('already_published', 'blocker', `${plural(alreadyPublished.length, 'assignment already created a tree node', 'assignments already created a tree node')}`, alreadyPublished.map((d) => d.id));

    const onTree: string[] = [];
    const elsewhere: string[] = [];
    for (const draft of drafts) {
      if (!draft.big_ace_member_id) continue;
      const name = normalizeLittleName(draft.little_name);
      const sameBig = nodes.filter(
        (node) =>
          node.id !== draft.published_ace_member_id &&
          node.parentId === draft.big_ace_member_id &&
          ((draft.little_member_id && node.memberId === draft.little_member_id) ||
            normalizeLittleName(node.name) === name),
      );
      if (sameBig.length > 0) {
        onTree.push(draft.id);
        continue;
      }
      if (
        draft.little_member_id &&
        nodes.some((node) => node.id !== draft.published_ace_member_id && node.memberId === draft.little_member_id)
      ) {
        elsewhere.push(draft.id);
      }
    }
    push('already_on_tree', 'blocker', `${plural(onTree.length, 'Little is already on the tree under that Big', 'Littles are already on the tree under their Big')}`, onTree);
    push('member_on_other_node', 'warning', `${plural(elsewhere.length, 'member already appears elsewhere on the ACE tree', 'members already appear elsewhere on the ACE tree')}`, elsewhere);
  }

  const ambiguous: string[] = [];
  const suggested: string[] = [];
  const noRecord: string[] = [];
  for (const draft of drafts) {
    if (draft.little_member_id) continue;
    const match = findExactMemberMatch(draft.little_name, nameIndex);
    if (match.kind === 'ambiguous') ambiguous.push(draft.id);
    else if (match.kind === 'unique') suggested.push(draft.id);
    else noRecord.push(draft.id);
  }
  push('ambiguous_match', 'warning', `${plural(ambiguous.length, 'ambiguous member match', 'ambiguous member matches')}`, ambiguous);
  push('unlinked_suggestion', 'warning', `${plural(suggested.length, 'obvious member match not linked yet', 'obvious member matches not linked yet')}`, suggested);
  push('no_member_record', 'warning', `${plural(noRecord.length, 'Little has no member record', 'Littles have no member record')}`, noRecord);

  const blockers = issues.filter((issue) => issue.severity === 'blocker');
  const assigned = drafts.filter((d) => d.big_ace_member_id);
  return {
    littleCount: drafts.length,
    linkedCount: drafts.filter((d) => d.little_member_id).length,
    assignedCount: assigned.length,
    unassignedCount: unassigned.length,
    bigCount: new Set(assigned.map((d) => d.big_ace_member_id)).size,
    issues,
    blockers,
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    canPublish: drafts.length > 0 && blockers.length === 0,
  };
}

// ─── Per-Big load ────────────────────────────────────────────────────────────

export interface BigLoad {
  /** Littles already under this Big on the live tree. */
  current: number;
  /** Littles assigned to this Big in the cycle being edited. */
  incoming: number;
}

export function computeBigLoad(
  bigId: string,
  drafts: readonly AceAssignmentDraft[],
  nodes: readonly AceNodeRef[],
): BigLoad {
  return {
    current: nodes.filter((node) => node.parentId === bigId).length,
    incoming: drafts.filter((draft) => draft.big_ace_member_id === bigId && !draft.published_ace_member_id).length,
  };
}

// ─── Publish preview ─────────────────────────────────────────────────────────

export interface PlannedNode {
  draftId: string;
  name: string;
  familyId: string;
  /** The selected Big's node id; the public lineage edge. */
  parentMemberId: string;
  memberId: string | null;
  roleLabel: typeof LITTLE_ROLE_LABEL;
  isPublished: true;
}

export interface PublishPreview {
  nodes: PlannedNode[];
  familyCount: number;
  /** Drafts publish would refuse or skip: no Big, deleted Big, or already published. */
  skipped: Array<{ draftId: string; reason: 'unassigned' | 'missing_big' | 'already_published' }>;
}

/** What Publish will create. The family always comes from the Big's own node. */
export function buildPublishPreview(
  drafts: readonly AceAssignmentDraft[],
  nodes: readonly AceNodeRef[],
): PublishPreview {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const planned: PlannedNode[] = [];
  const skipped: PublishPreview['skipped'] = [];
  for (const draft of drafts) {
    if (draft.published_ace_member_id) {
      skipped.push({ draftId: draft.id, reason: 'already_published' });
      continue;
    }
    if (!draft.big_ace_member_id) {
      skipped.push({ draftId: draft.id, reason: 'unassigned' });
      continue;
    }
    const big = nodesById.get(draft.big_ace_member_id);
    if (!big) {
      skipped.push({ draftId: draft.id, reason: 'missing_big' });
      continue;
    }
    planned.push({
      draftId: draft.id,
      name: draft.little_name.trim(),
      familyId: big.familyId,
      parentMemberId: big.id,
      memberId: draft.little_member_id,
      roleLabel: LITTLE_ROLE_LABEL,
      isPublished: true,
    });
  }
  return { nodes: planned, familyCount: new Set(planned.map((node) => node.familyId)).size, skipped };
}

// ─── Link suggestions for Littles ────────────────────────────────────────────

export type LittleLinkStatus = 'recommended' | 'ambiguous' | 'conflict' | 'none';

export interface LittleLinkReviewItem {
  draft: AceAssignmentDraft;
  status: LittleLinkStatus;
  candidates: MemberOption[];
}

/**
 * Classifies every unlinked Little. A unique exact match is only
 * "recommended" when no other draft already holds, or also wants, that member.
 */
export function reviewUnlinkedLittles(
  drafts: readonly AceAssignmentDraft[],
  nameIndex: MemberNameIndex,
): LittleLinkReviewItem[] {
  const claimed = new Map<string, number>();
  for (const draft of drafts) {
    if (draft.little_member_id) claimed.set(draft.little_member_id, (claimed.get(draft.little_member_id) ?? 0) + 1);
  }
  const items = drafts
    .filter((draft) => !draft.little_member_id)
    .map((draft): LittleLinkReviewItem => {
      const match = findExactMemberMatch(draft.little_name, nameIndex);
      if (match.kind === 'ambiguous') return { draft, status: 'ambiguous', candidates: match.members };
      if (match.kind === 'none') return { draft, status: 'none', candidates: [] };
      return { draft, status: 'recommended', candidates: [match.member] };
    });
  const wanted = new Map<string, number>();
  for (const item of items) {
    if (item.status === 'recommended') wanted.set(item.candidates[0].id, (wanted.get(item.candidates[0].id) ?? 0) + 1);
  }
  for (const item of items) {
    if (item.status !== 'recommended') continue;
    const id = item.candidates[0].id;
    if ((claimed.get(id) ?? 0) > 0 || (wanted.get(id) ?? 0) > 1) item.status = 'conflict';
  }
  return items;
}

export function selectBulkLittleLinks(
  items: readonly LittleLinkReviewItem[],
): Array<{ draftId: string; memberId: string }> {
  return items
    .filter((item) => item.status === 'recommended')
    .map((item) => ({ draftId: item.draft.id, memberId: item.candidates[0].id }));
}

// ─── Pasted CSV / TSV import ─────────────────────────────────────────────────

export interface ParsedImportRow {
  line: number;
  name: string;
  /** Used only to match a member while importing; never stored. */
  email: string | null;
  bigName: string | null;
  notes: string | null;
}

export interface ParsedImport {
  rows: ParsedImportRow[];
  /** Header columns that were recognized, e.g. ['name', 'big']. */
  columns: string[];
  skipped: number;
  warnings: string[];
}

type ImportColumn = 'name' | 'first' | 'last' | 'email' | 'big' | 'notes';

const HEADER_ALIASES: Record<string, ImportColumn> = {
  name: 'name',
  fullname: 'name',
  littlename: 'name',
  little: 'name',
  firstname: 'first',
  first: 'first',
  fname: 'first',
  lastname: 'last',
  last: 'last',
  lname: 'last',
  email: 'email',
  emailaddress: 'email',
  big: 'big',
  bigname: 'big',
  requestedbig: 'big',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
};

function splitDelimited(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function squash(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Parses pasted CSV or TSV. A header row is optional; without one, column 1 is the name. */
export function parseAssignmentImport(text: string): ParsedImport {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const result: ParsedImport = { rows: [], columns: [], skipped: 0, warnings: [] };
  if (lines.length === 0) return result;

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headerCells = splitDelimited(lines[0], delimiter);
  const mapped = headerCells.map((cell) => HEADER_ALIASES[cell.toLowerCase().replace(/[^a-z]/g, '')] ?? null);
  const hasHeader = mapped.some(Boolean);

  const columnIndex = new Map<ImportColumn, number>();
  if (hasHeader) {
    mapped.forEach((column, index) => {
      if (column && !columnIndex.has(column)) columnIndex.set(column, index);
    });
    result.columns = Array.from(columnIndex.keys());
    if (!columnIndex.has('name') && !(columnIndex.has('first') && columnIndex.has('last'))) {
      result.warnings.push('No name column found. Use "name", or "first name" and "last name".');
      return result;
    }
  } else {
    columnIndex.set('name', 0);
    result.columns = ['name'];
    result.warnings.push('No header row recognized, so the first column is used as the name.');
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  dataLines.forEach((line, offset) => {
    const cells = splitDelimited(line, delimiter);
    const cell = (column: ImportColumn) => {
      const index = columnIndex.get(column);
      return index === undefined ? '' : squash(cells[index]);
    };
    const name = cell('name') || squash(`${cell('first')} ${cell('last')}`);
    if (!name) {
      result.skipped += 1;
      return;
    }
    result.rows.push({
      line: offset + (hasHeader ? 2 : 1),
      name,
      email: cell('email').toLowerCase() || null,
      bigName: cell('big') || null,
      notes: cell('notes') || null,
    });
  });
  return result;
}

export interface DraftSeed {
  little_name: string;
  little_member_id: string | null;
  big_ace_member_id: string | null;
  notes: string | null;
}

export interface ImportResolution {
  seeds: DraftSeed[];
  emailLinked: number;
  bigMatched: number;
  bigUnresolved: number;
}

/**
 * Turns parsed rows into draft rows. An email that matches exactly one member
 * links that member. A "big" column matching exactly one existing node
 * assigns that Big; otherwise the request is kept in notes for an admin. Name
 * matches are left to the Review step, and no email is carried forward.
 */
export function resolveImportRows(
  rows: readonly ParsedImportRow[],
  options: {
    nodes: readonly AceNodeRef[];
    membersByEmail: ReadonlyMap<string, readonly MemberOption[]>;
  },
): ImportResolution {
  const nodesByName = new Map<string, AceNodeRef[]>();
  for (const node of options.nodes) {
    const key = normalizeMemberName(node.name);
    nodesByName.set(key, [...(nodesByName.get(key) ?? []), node]);
  }

  let emailLinked = 0;
  let bigMatched = 0;
  let bigUnresolved = 0;
  const seeds = rows.map((row): DraftSeed => {
    const emailMatches = row.email ? options.membersByEmail.get(row.email) ?? [] : [];
    const memberId = emailMatches.length === 1 ? emailMatches[0].id : null;
    if (memberId) emailLinked += 1;

    const notes: string[] = row.notes ? [row.notes] : [];
    let bigId: string | null = null;
    if (row.bigName) {
      const matches = nodesByName.get(normalizeMemberName(row.bigName)) ?? [];
      if (matches.length === 1) {
        bigId = matches[0].id;
        bigMatched += 1;
      } else {
        bigUnresolved += 1;
        notes.push(`Requested Big: ${row.bigName} (${matches.length === 0 ? 'not found' : 'several matches'})`);
      }
    }
    return {
      little_name: row.name,
      little_member_id: memberId,
      big_ace_member_id: bigId,
      notes: notes.length > 0 ? notes.join('; ') : null,
    };
  });
  return { seeds, emailLinked, bigMatched, bigUnresolved };
}
