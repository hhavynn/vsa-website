// One import experience for ACE, House, Cabinet, Intern, and attendance
// imports: Input → Parsed → Matched → Needs Review → Ready, a summary before
// anything is written, and a concrete reason on every row that did not go
// cleanly. Pure: domain adapters below turn each importer's parse/match output
// into the same ImportReviewRow shape.
import { findExactMemberMatch, MemberNameIndex, normalizeMemberName } from './memberLinkMatching';
import { pluralize } from './operationalStatus';
import type { ParsedImportRow, AceNodeRef } from './aceAssignments';
import type { ParsedHouseRow } from './houseAssignmentImport';
import type { RosterEntry } from './cabinetRoster';
import type { ParsedInternName } from './internCohort';

export type ImportRowCategory = 'ready' | 'needs_review' | 'unmatched' | 'invalid';

export interface ImportReviewRow {
  /** Position in the pasted data (1-based), for "row 14". */
  index: number;
  /** Who/what the row is about; shown first. */
  label: string;
  category: ImportRowCategory;
  /** Concrete explanation. Present for every non-ready row. */
  reason: string | null;
  /** Original cells, for the problem-row export. */
  raw?: Record<string, string>;
}

export interface ImportSummary {
  total: number;
  ready: number;
  needsReview: number;
  unmatched: number;
  invalid: number;
  /** Rows that need a human before or after writing. */
  problems: number;
}

export function summarizeImport(rows: readonly ImportReviewRow[]): ImportSummary {
  const count = (category: ImportRowCategory) => rows.filter((row) => row.category === category).length;
  const ready = count('ready');
  return {
    total: rows.length,
    ready,
    needsReview: count('needs_review'),
    unmatched: count('unmatched'),
    invalid: count('invalid'),
    problems: rows.length - ready,
  };
}

/** "82 rows", "71 ready", … — only the lines that apply, in the order admins scan them. */
export function formatImportSummary(summary: ImportSummary): string[] {
  const lines = [pluralize(summary.total, 'row'), `${summary.ready} ready`];
  if (summary.needsReview > 0) lines.push(`${summary.needsReview} need review`);
  if (summary.unmatched > 0) lines.push(`${summary.unmatched} unmatched`);
  if (summary.invalid > 0) lines.push(`${summary.invalid} invalid`);
  return lines;
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export type ImportStageKey = 'input' | 'parsed' | 'matched' | 'needs_review' | 'ready';

export const IMPORT_STAGES: ReadonlyArray<{ key: ImportStageKey; label: string }> = [
  { key: 'input', label: 'Input' },
  { key: 'parsed', label: 'Parsed' },
  { key: 'matched', label: 'Matched' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'ready', label: 'Ready' },
];

/**
 * Where the admin is. Nothing pasted → Input. Rows parsed but none usable
 * → Parsed. Rows matched with problems → Needs Review. Nothing left → Ready.
 */
export function importStage(options: { hasInput: boolean; summary: ImportSummary | null; matching?: boolean }): ImportStageKey {
  const { hasInput, summary } = options;
  if (!hasInput || !summary) return 'input';
  if (summary.total === 0 || summary.total === summary.invalid) return 'parsed';
  if (options.matching) return 'matched';
  return summary.problems > 0 ? 'needs_review' : 'ready';
}

export type StageState = 'done' | 'current' | 'todo';

/** Needs Review is skipped (shown done) when it has nothing to review. */
export function stageStates(stage: ImportStageKey, summary: ImportSummary | null): Array<{ key: ImportStageKey; label: string; state: StageState }> {
  const currentIndex = IMPORT_STAGES.findIndex((item) => item.key === stage);
  return IMPORT_STAGES.map((item, index) => {
    let state: StageState = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
    if (item.key === 'needs_review' && summary && summary.problems === 0 && currentIndex > index) state = 'done';
    return { ...item, state };
  });
}

// ─── Problem rows ────────────────────────────────────────────────────────────

export function problemRows(rows: readonly ImportReviewRow[]): ImportReviewRow[] {
  return rows.filter((row) => row.category !== 'ready');
}

const CATEGORY_LABEL: Record<ImportRowCategory, string> = {
  ready: 'Ready',
  needs_review: 'Needs review',
  unmatched: 'Unmatched',
  invalid: 'Invalid',
};

/** A leading =, +, -, @, tab or CR makes a spreadsheet treat a cell as a formula. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV of the rows that need attention, ready to fix in a spreadsheet and re-import. */
export function problemRowsToCsv(rows: readonly ImportReviewRow[]): string {
  const problems = problemRows(rows);
  const rawColumns = Array.from(new Set(problems.flatMap((row) => Object.keys(row.raw ?? {}))));
  const header = ['Row', 'Who', 'Problem', 'Reason', ...rawColumns];
  const lines = [header.map(csvCell).join(',')];
  for (const row of problems) {
    lines.push(
      [String(row.index), row.label, CATEGORY_LABEL[row.category], row.reason ?? '', ...rawColumns.map((column) => row.raw?.[column] ?? '')]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

/** Plain text for pasting into chat or a doc. */
export function problemRowsToText(rows: readonly ImportReviewRow[]): string {
  return problemRows(rows)
    .map((row) => `Row ${row.index}: ${row.label} — ${CATEGORY_LABEL[row.category]}${row.reason ? `. ${row.reason}` : ''}`)
    .join('\n');
}

export function ambiguousNameReason(count: number): string {
  return `${count} canonical members share this name. Choose one manually.`;
}

// ─── Adapters ────────────────────────────────────────────────────────────────

function duplicateIndexes<T>(items: readonly T[], keyOf: (item: T) => string): Set<number> {
  const seen = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = keyOf(item);
    if (key) seen.set(key, [...(seen.get(key) ?? []), index]);
  });
  return new Set(Array.from(seen.values()).filter((group) => group.length > 1).flat());
}

/** ACE: pasted Littles (optionally with a requested Big) against members and the live tree. */
export function reviewAceImportRows(
  rows: readonly ParsedImportRow[],
  options: {
    nameIndex: MemberNameIndex;
    nodes: readonly AceNodeRef[];
    /** Emails that matched exactly one member (resolved by the importer). */
    emailMatched?: ReadonlySet<string>;
    /** Little names already in the draft. */
    existingLittleNames?: ReadonlySet<string>;
    skippedBlank?: number;
  },
): ImportReviewRow[] {
  const nodeNames = new Map<string, number>();
  for (const node of options.nodes) {
    const key = normalizeMemberName(node.name);
    nodeNames.set(key, (nodeNames.get(key) ?? 0) + 1);
  }
  const repeated = duplicateIndexes(rows, (row) => normalizeMemberName(row.name));

  const reviewed = rows.map((row, index): ImportReviewRow => {
    const base = { index: row.line, label: row.name, raw: { Name: row.name, Big: row.bigName ?? '', Notes: row.notes ?? '' } };
    const key = normalizeMemberName(row.name);
    if (options.existingLittleNames?.has(key)) {
      return { ...base, category: 'needs_review', reason: 'A Little with this name is already in the draft.' };
    }
    if (repeated.has(index)) {
      return { ...base, category: 'needs_review', reason: 'This name appears more than once in the pasted list.' };
    }
    if (row.bigName) {
      const bigCount = nodeNames.get(normalizeMemberName(row.bigName)) ?? 0;
      if (bigCount > 1) return { ...base, category: 'needs_review', reason: `Requested Big "${row.bigName}" matches ${bigCount} people on the ACE tree. Choose one manually.` };
      if (bigCount === 0) return { ...base, category: 'needs_review', reason: `Requested Big "${row.bigName}" was not found on the ACE tree.` };
    }
    const emailLinked = !!row.email && options.emailMatched?.has(row.email);
    const match = findExactMemberMatch(row.name, options.nameIndex);
    if (emailLinked || match.kind === 'unique') return { ...base, category: 'ready', reason: null };
    if (match.kind === 'ambiguous') return { ...base, category: 'needs_review', reason: ambiguousNameReason(match.members.length) };
    return { ...base, category: 'unmatched', reason: 'No member has this exact name. It will be added without a member link.' };
  });

  for (let i = 0; i < (options.skippedBlank ?? 0); i += 1) {
    reviewed.push({ index: 0, label: '(no name)', category: 'invalid', reason: 'This row has no name.' });
  }
  return reviewed;
}

/** House: the importer's own match statuses, with the sheet's reason carried over. */
export function reviewHouseRows(rows: readonly ParsedHouseRow[]): ImportReviewRow[] {
  const repeated = duplicateIndexes(rows, (row) => row.matchedMember?.id ?? '');
  return rows.map((row, index): ImportReviewRow => {
    const base = { index: row.sourceIndex + 1, label: row.name || row.email || '(blank)', raw: { Name: row.name, House: row.house ?? '', Year: row.year, College: row.college } };
    if (row.status === 'invalid') return { ...base, category: 'invalid', reason: row.note || 'Name or email is required.' };
    if (row.status === 'unmatched') return { ...base, category: 'unmatched', reason: row.note || 'No possible match found.' };
    if (row.status === 'review') return { ...base, category: 'needs_review', reason: row.note || 'Possible name match. Review before publishing.' };
    if (repeated.has(index)) return { ...base, category: 'needs_review', reason: 'The same member is matched by more than one row.' };
    if (!row.houseProfile && row.house) return { ...base, category: 'needs_review', reason: `House "${row.house}" has no profile for this academic year.` };
    return { ...base, category: 'ready', reason: null };
  });
}

/** Cabinet: "Name, Role" lines against the roster's positions and members. */
export function reviewRosterEntries(
  entries: readonly RosterEntry[],
  options: { nameIndex: MemberNameIndex; knownRoles: ReadonlySet<string>; normalizeRole: (role: string) => string },
): ImportReviewRow[] {
  const repeated = duplicateIndexes(entries, (entry) => normalizeMemberName(entry.name));
  return entries.map((entry, index): ImportReviewRow => {
    const base = { index: index + 1, label: entry.name, raw: { Name: entry.name, Role: entry.role } };
    if (repeated.has(index)) return { ...base, category: 'needs_review', reason: 'This person appears on more than one line.' };
    const match = findExactMemberMatch(entry.name, options.nameIndex);
    if (match.kind === 'ambiguous') return { ...base, category: 'needs_review', reason: ambiguousNameReason(match.members.length) };
    if (!options.knownRoles.has(options.normalizeRole(entry.role))) {
      return { ...base, category: 'needs_review', reason: `"${entry.role}" is not a position on this roster yet. A new position will be added.` };
    }
    if (match.kind === 'none') return { ...base, category: 'unmatched', reason: 'No member has this exact name. They will be placed without a member link.' };
    return { ...base, category: 'ready', reason: null };
  });
}

/** Interns: "Name, Track" lines against members and the cohort already drafted. */
export function reviewInternNames(
  entries: readonly ParsedInternName[],
  options: { nameIndex: MemberNameIndex; existingNames?: ReadonlySet<string> },
): ImportReviewRow[] {
  const repeated = duplicateIndexes(entries, (entry) => normalizeMemberName(entry.name));
  return entries.map((entry, index): ImportReviewRow => {
    const base = { index: index + 1, label: entry.name, raw: { Name: entry.name, Track: entry.roleOrTrack ?? '' } };
    if (options.existingNames?.has(normalizeMemberName(entry.name))) {
      return { ...base, category: 'needs_review', reason: 'An intern with this name is already in the cohort.' };
    }
    if (repeated.has(index)) return { ...base, category: 'needs_review', reason: 'This name appears more than once in the pasted list.' };
    const match = findExactMemberMatch(entry.name, options.nameIndex);
    if (match.kind === 'ambiguous') return { ...base, category: 'needs_review', reason: ambiguousNameReason(match.members.length) };
    if (match.kind === 'none') return { ...base, category: 'unmatched', reason: 'No member has this exact name. They will be added without a member link.' };
    return { ...base, category: 'ready', reason: null };
  });
}

// ─── Attendance import ───────────────────────────────────────────────────────

export interface AttendanceReviewInput {
  /** 0-based position in the CSV (the sheet row is this + 2, after the header). */
  originalIndex: number;
  displayName: string;
  /** Status after any manual Force Match / Mark New override. */
  effectiveStatus: 'match' | 'new' | 'already' | 'review' | 'duplicate';
  reason: string;
  note: string;
  invalidYear: boolean;
  candidateCount: number;
  csvYear?: string;
  csvRow?: Record<string, string>;
}

const ATTENDANCE_REASON: Record<string, (row: AttendanceReviewInput) => string> = {
  ambiguous_match: (row) =>
    row.candidateCount > 1 ? ambiguousNameReason(row.candidateCount) : 'More than one member could be this person. Choose one manually.',
  fuzzy_name_match: () => 'Only a near name match. Force Match to confirm it, or mark the row as new.',
  duplicate_email_conflict: () => 'This email belongs to more than one member. Choose one manually.',
  email_name_conflict: () => 'The email matches a member with a different name. Check before linking.',
  duplicate_row: () => 'Duplicate of an earlier row in this file. It will be skipped.',
  skipped_unresolved_review: () => 'Still unresolved, so it will be skipped.',
};

/**
 * Attendance import: matches and new members are ready; a row that needs a human
 * (ambiguous, near-match, conflicting email), a duplicate row, or an unrecognized
 * year is listed with the concrete reason so the sheet never has to be re-read.
 */
export function reviewAttendanceRows(rows: readonly AttendanceReviewInput[]): ImportReviewRow[] {
  return rows.map((row): ImportReviewRow => {
    const base = { index: row.originalIndex + 2, label: row.displayName || '(blank)', raw: row.csvRow };
    if (row.effectiveStatus === 'review') {
      return { ...base, category: 'needs_review', reason: (ATTENDANCE_REASON[row.reason]?.(row) ?? row.note) || 'Needs a manual decision.' };
    }
    if (row.effectiveStatus === 'duplicate') {
      return { ...base, category: 'needs_review', reason: ATTENDANCE_REASON.duplicate_row(row) };
    }
    if (row.invalidYear) {
      // The importer still stores the year as typed, so say so rather than imply it is dropped.
      return { ...base, category: 'needs_review', reason: `The year${row.csvYear ? ` "${row.csvYear}"` : ''} is not a recognized year. It is imported as typed, so fix it in the sheet or edit the member afterwards.` };
    }
    return { ...base, category: 'ready', reason: null };
  });
}
