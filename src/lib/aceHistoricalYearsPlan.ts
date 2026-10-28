// Review sheet and dry-run backfill plan for ACE pickup years (#670).
//
// Flow: reconcilePickupYears() → reviewSheetCsv() → an authorized reviewer
// (ACE Chair / Webmaster) fills the reviewer columns → parseReviewSheet() →
// buildBackfillPlan() against a FRESH live snapshot → planSqlPreview().
//
// The plan is keyed by live node id and may only ever set the two pickup
// columns #669 adds. Every other column a reviewer could edit in the sheet
// (name, fam, Big) is compared with the live snapshot and, if it no longer
// matches, the row is rejected as stale: a review sheet can never move,
// rename or relink anyone.
import { parseCsvTable } from './csvParse';
import { csvCell } from './adminImportReview';
import {
  academicYearLabel,
  ConfidenceClass,
  CONFIDENCE_CLASSES,
  evidenceLabel,
  LiveSnapshot,
  nameKeys,
  NodeReconciliation,
  parseAcademicYear,
  parseTerm,
  ReconciliationResult,
} from './aceHistoricalYears';

/** The #669 contract. These are the only columns a plan may write. */
export const PICKUP_COLUMNS = ['pickup_term', 'pickup_academic_year_start'] as const;
export type PickupColumn = (typeof PICKUP_COLUMNS)[number];

export const REVIEW_COLUMNS = [
  'ace_node_id',
  'fam_id',
  'fam_name',
  'member_name',
  'current_big_node_id',
  'current_big_name',
  'canonical_member_id',
  'existing_pickup_term',
  'existing_pickup_academic_year',
  'recommended_pickup_academic_year',
  'recommended_pickup_term',
  'confidence_class',
  'candidate_years',
  'supporting_sources',
  'conflicting_sources',
  'source_version',
  'source_sheet_and_cell',
  'identity_resolution_status',
  'review_flags',
  'review_reason',
  'reviewer_decision',
  'reviewer_confirmed_year',
  'reviewer_confirmed_term',
  'approved_for_backfill',
] as const;

export type ReviewColumn = (typeof REVIEW_COLUMNS)[number];

const REVIEWER_COLUMNS: ReviewColumn[] = ['reviewer_decision', 'reviewer_confirmed_year', 'reviewer_confirmed_term', 'approved_for_backfill'];

function reviewRecord(row: NodeReconciliation, sourceVersion: string): Record<ReviewColumn, string> {
  const refs = Array.from(new Set([...row.supporting, ...row.conflicting].map((e) => `${e.source.source_id}!${e.record.ref}`)));
  return {
    ace_node_id: row.ace_node_id,
    fam_id: row.fam_id,
    fam_name: row.fam_name,
    member_name: row.member_name,
    current_big_node_id: row.current_big_node_id ?? '',
    current_big_name: row.current_big_name ?? '',
    canonical_member_id: row.canonical_member_id ?? '',
    existing_pickup_term: row.existing_pickup_term ?? '',
    existing_pickup_academic_year: academicYearLabel(row.existing_pickup_academic_year_start),
    recommended_pickup_academic_year: academicYearLabel(row.recommended_pickup_academic_year),
    recommended_pickup_term: row.recommended_pickup_term ?? '',
    confidence_class: row.confidence_class,
    candidate_years: row.candidate_years.map(academicYearLabel).join(' / '),
    supporting_sources: row.supporting.map(evidenceLabel).join(' | '),
    conflicting_sources: row.conflicting.map(evidenceLabel).join(' | '),
    source_version: sourceVersion,
    source_sheet_and_cell: refs.join(' | '),
    identity_resolution_status: row.identity_resolution_status,
    review_flags: row.flags.join(' '),
    review_reason: row.review_reason,
    reviewer_decision: '',
    reviewer_confirmed_year: '',
    reviewer_confirmed_term: '',
    approved_for_backfill: '',
  };
}

const CLASS_ORDER: Record<ConfidenceClass, number> = Object.fromEntries(CONFIDENCE_CLASSES.map((c, i) => [c, i])) as Record<ConfidenceClass, number>;

/** One row per live node, sorted fam → class → name, reviewer columns blank. */
export function reviewSheetCsv(rows: readonly NodeReconciliation[], sourceVersion: string): string {
  const sorted = rows
    .slice()
    .sort(
      (a, b) =>
        a.fam_name.localeCompare(b.fam_name) ||
        CLASS_ORDER[a.confidence_class] - CLASS_ORDER[b.confidence_class] ||
        a.member_name.localeCompare(b.member_name) ||
        a.ace_node_id.localeCompare(b.ace_node_id)
    );
  const lines = [REVIEW_COLUMNS.join(',')];
  for (const row of sorted) {
    const record = reviewRecord(row, sourceVersion);
    lines.push(REVIEW_COLUMNS.map((c) => csvCell(record[c])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export type ReviewQueue = 'ambiguous_identity' | 'conflicting_years' | 'missing_evidence' | 'chronology' | 'ready_for_review';

/** Which follow-up list a row belongs on. A row can be on several. */
export function reviewQueues(row: NodeReconciliation): ReviewQueue[] {
  const queues: ReviewQueue[] = [];
  if (
    row.flags.includes('AMBIGUOUS_IDENTITY') ||
    row.flags.includes('SAME_NAME_IN_FAM') ||
    row.flags.includes('SOURCE_BIG_DIFFERS') ||
    row.flags.includes('CANONICAL_MEMBER_ON_SEVERAL_NODES')
  )
    queues.push('ambiguous_identity');
  if (row.confidence_class === 'CONFLICTING_EVIDENCE') queues.push('conflicting_years');
  if (row.flags.includes('CHILD_EARLIER_THAN_BIG') || row.flags.includes('SAME_TERM_AS_BIG')) queues.push('chronology');
  if (row.confidence_class === 'UNKNOWN') queues.push('missing_evidence');
  if (row.confidence_class === 'CONFIRMED_YEAR' || row.confidence_class === 'STRONG_CANDIDATE' || row.confidence_class === 'SUSPECTED_YEAR')
    queues.push('ready_for_review');
  return queues;
}

export function reviewSheetForQueue(result: ReconciliationResult, queue: ReviewQueue, sourceVersion: string): string {
  return reviewSheetCsv(result.rows.filter((r) => reviewQueues(r).includes(queue)), sourceVersion);
}

// ── Reading a reviewed sheet back ───────────────────────────────────────────

export interface ReviewRow {
  sheetRow: number;
  ace_node_id: string;
  fam_id: string;
  member_name: string;
  current_big_node_id: string;
  confidence_class: string;
  reviewer_decision: string;
  reviewer_confirmed_year: string;
  reviewer_confirmed_term: string;
  approved_for_backfill: string;
}

/** csvCell() guards formula-looking text with a leading apostrophe; undo that on read. */
function unguard(value: string): string {
  return /^'(?:[\t\r]|\s*[=+\-@])/.test(value) ? value.slice(1) : value;
}

export function parseReviewSheet(csvText: string): ReviewRow[] {
  const table = parseCsvTable(csvText);
  if (table.unterminatedQuote) throw new Error(`Review sheet has an unclosed quote starting on line ${table.unterminatedQuoteLine}.`);
  const required: ReviewColumn[] = ['ace_node_id', 'fam_id', 'member_name', 'current_big_node_id', ...REVIEWER_COLUMNS];
  const missing = required.filter((c) => !table.headers.includes(c));
  if (missing.length > 0) throw new Error(`Review sheet is missing column(s): ${missing.join(', ')}.`);
  return table.rows.map((raw, i) => ({
    sheetRow: table.rowNumbers[i],
    ace_node_id: unguard(raw.ace_node_id ?? ''),
    fam_id: unguard(raw.fam_id ?? ''),
    member_name: unguard(raw.member_name ?? ''),
    current_big_node_id: unguard(raw.current_big_node_id ?? ''),
    confidence_class: unguard(raw.confidence_class ?? ''),
    reviewer_decision: unguard(raw.reviewer_decision ?? ''),
    reviewer_confirmed_year: unguard(raw.reviewer_confirmed_year ?? ''),
    reviewer_confirmed_term: unguard(raw.reviewer_confirmed_term ?? ''),
    approved_for_backfill: unguard(raw.approved_for_backfill ?? ''),
  }));
}

// ── Plan ────────────────────────────────────────────────────────────────────

export interface PickupValues {
  pickup_term: string | null;
  pickup_academic_year_start: number | null;
}

export interface PlanUpdate {
  ace_node_id: string;
  family_id: string;
  /** The update is guarded on these: if the live row moved, the update matches nothing. */
  expected_parent_member_id: string | null;
  previous: PickupValues;
  next: PickupValues;
  confidence_class: string;
  evidence_category: string;
  overwrites_existing_value: boolean;
  sheet_row: number;
}

export interface PlanRejection {
  ace_node_id: string;
  sheet_row: number;
  reason: string;
}

export interface BackfillPlan {
  mode: 'dry-run';
  columns: readonly PickupColumn[];
  max_academic_year_start: number;
  updates: PlanUpdate[];
  /** Approved rows whose live values already equal the approved values. */
  unchanged: { ace_node_id: string; sheet_row: number }[];
  rejected: PlanRejection[];
  not_approved: number;
}

const APPROVED = /^(yes|y|true|approved|approve|1)$/i;
const NOT_APPROVED = /^(|no|n|false|0|hold|reject|rejected)$/i;

const EVIDENCE_CATEGORY: Record<string, string> = {
  CONFIRMED_YEAR: 'official_pairing',
  STRONG_CANDIDATE: 'explicit_term_or_official_loose',
  SUSPECTED_YEAR: 'master_year_row',
  CONFLICTING_EVIDENCE: 'reviewer_resolved_conflict',
  UNKNOWN: 'reviewer_supplied',
};

export interface PlanOptions {
  maxAcademicYearStart: number;
}

/**
 * Builds the year-only update plan from reviewer-approved rows. Never writes.
 * Repeating it after the plan was applied yields zero updates.
 */
export function buildBackfillPlan(review: readonly ReviewRow[], snapshot: LiveSnapshot, options: PlanOptions): BackfillPlan {
  const live = new Map(snapshot.nodes.map((n) => [n.id, n] as const));
  const rejected: PlanRejection[] = [];
  const updates: PlanUpdate[] = [];
  const unchanged: BackfillPlan['unchanged'] = [];
  let notApproved = 0;

  const approvedRows: ReviewRow[] = [];
  for (const row of review) {
    const flag = row.approved_for_backfill.trim();
    if (APPROVED.test(flag)) approvedRows.push(row);
    else if (NOT_APPROVED.test(flag)) notApproved += 1;
    else rejected.push({ ace_node_id: row.ace_node_id, sheet_row: row.sheetRow, reason: `approved_for_backfill "${flag}" is not yes or no` });
  }

  const approvalsPerNode = new Map<string, number>();
  for (const row of approvedRows) approvalsPerNode.set(row.ace_node_id, (approvalsPerNode.get(row.ace_node_id) ?? 0) + 1);

  for (const row of approvedRows) {
    const reject = (reason: string) => rejected.push({ ace_node_id: row.ace_node_id, sheet_row: row.sheetRow, reason });
    if ((approvalsPerNode.get(row.ace_node_id) ?? 0) > 1) {
      reject('node approved on more than one sheet row');
      continue;
    }
    const node = live.get(row.ace_node_id);
    if (!node) {
      reject('node is not in the current published snapshot');
      continue;
    }
    if (node.family_id !== row.fam_id) {
      reject('fam changed since review (live fam kept; re-review)');
      continue;
    }
    if ((node.parent_member_id ?? '') !== row.current_big_node_id) {
      reject('Big changed since review (live Big kept; re-review)');
      continue;
    }
    if (nameKeys(node.name).exact !== nameKeys(row.member_name).exact) {
      reject('name differs from the live node (names are never changed by this plan)');
      continue;
    }
    const year = parseAcademicYear(row.reviewer_confirmed_year);
    if (year === null) {
      reject(row.reviewer_confirmed_year.trim() ? `reviewer_confirmed_year "${row.reviewer_confirmed_year}" is not an academic year` : 'approved without reviewer_confirmed_year');
      continue;
    }
    if (year > options.maxAcademicYearStart) {
      reject(`year ${academicYearLabel(year)} is after the latest revealed cycle`);
      continue;
    }
    let term: string | null = null;
    if (row.reviewer_confirmed_term.trim()) {
      const parsed = parseTerm(row.reviewer_confirmed_term);
      if (!parsed) {
        reject(`reviewer_confirmed_term "${row.reviewer_confirmed_term}" is not a FA/WI/SP term`);
        continue;
      }
      if (parsed.academicYearStart !== year) {
        reject(`term ${parsed.term} is in ${academicYearLabel(parsed.academicYearStart)}, not ${academicYearLabel(year)}`);
        continue;
      }
      term = parsed.term;
    }
    const previous: PickupValues = { pickup_term: node.pickup_term ?? null, pickup_academic_year_start: node.pickup_academic_year_start ?? null };
    const next: PickupValues = { pickup_term: term, pickup_academic_year_start: year };
    if (previous.pickup_term === next.pickup_term && previous.pickup_academic_year_start === next.pickup_academic_year_start) {
      unchanged.push({ ace_node_id: node.id, sheet_row: row.sheetRow });
      continue;
    }
    updates.push({
      ace_node_id: node.id,
      family_id: node.family_id,
      expected_parent_member_id: node.parent_member_id,
      previous,
      next,
      confidence_class: row.confidence_class,
      evidence_category: EVIDENCE_CATEGORY[row.confidence_class] ?? 'reviewer_supplied',
      overwrites_existing_value: previous.pickup_term !== null || previous.pickup_academic_year_start !== null,
      sheet_row: row.sheetRow,
    });
  }

  updates.sort((a, b) => a.ace_node_id.localeCompare(b.ace_node_id));
  return { mode: 'dry-run', columns: PICKUP_COLUMNS, max_academic_year_start: options.maxAcademicYearStart, updates, unchanged, rejected, not_approved: notApproved };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sqlUuid(value: string): string {
  if (!UUID.test(value)) throw new Error(`Refusing to render a non-UUID id into SQL: ${JSON.stringify(value)}`);
  return `'${value.toLowerCase()}'::uuid`;
}

function sqlTerm(value: string | null): string {
  if (value === null) return 'null';
  if (!/^(FA|WI|SP)\d{2}$/.test(value)) throw new Error(`Refusing to render an unexpected term into SQL: ${JSON.stringify(value)}`);
  return `'${value}'`;
}

function sqlYear(value: number | null): string {
  if (value === null) return 'null';
  if (!Number.isInteger(value)) throw new Error(`Refusing to render a non-integer year into SQL: ${value}`);
  return String(value);
}

/**
 * A review-only SQL preview. It runs in one transaction and ENDS IN ROLLBACK:
 * applying it for real is a separate, owner-approved step through the manual
 * production change path, after #669's columns exist. Each statement sets only
 * the two pickup columns, is guarded on the node's live fam and Big and on the
 * reviewed previous values, and raises with the node id unless exactly one row
 * changes, so a partial or stale apply stops at the exact row.
 */
export function planSqlPreview(plan: BackfillPlan): string {
  const lines: string[] = [
    '-- ACE pickup-year backfill PREVIEW (#670). Generated; review-only.',
    `-- ${plan.updates.length} update(s), ${plan.unchanged.length} already applied, ${plan.rejected.length} rejected.`,
    `-- Writes only: ${PICKUP_COLUMNS.join(', ')}. Requires the #669 columns.`,
    '-- Back up first:',
    '--   create table <private_backup> as select id, pickup_term, pickup_academic_year_start',
    '--   from public.ace_family_members where id in (<plan ids>);',
    'begin;',
  ];
  for (const u of plan.updates) {
    const prevTerm = u.previous.pickup_term === null ? 'pickup_term is null' : `pickup_term = ${sqlTerm(u.previous.pickup_term)}`;
    const prevYear =
      u.previous.pickup_academic_year_start === null
        ? 'pickup_academic_year_start is null'
        : `pickup_academic_year_start = ${sqlYear(u.previous.pickup_academic_year_start)}`;
    const parent = u.expected_parent_member_id === null ? 'parent_member_id is null' : `parent_member_id = ${sqlUuid(u.expected_parent_member_id)}`;
    lines.push(
      'do $$',
      'declare changed integer;',
      'begin',
      '  update public.ace_family_members',
      `     set pickup_term = ${sqlTerm(u.next.pickup_term)}, pickup_academic_year_start = ${sqlYear(u.next.pickup_academic_year_start)}`,
      `   where id = ${sqlUuid(u.ace_node_id)}`,
      `     and family_id = ${sqlUuid(u.family_id)}`,
      `     and ${parent}`,
      `     and ${prevTerm}`,
      `     and ${prevYear};`,
      '  get diagnostics changed = row_count;',
      `  if changed <> 1 then raise exception 'ace node ${u.ace_node_id.toLowerCase()}: expected 1 row, changed %', changed; end if;`,
      'end $$;'
    );
  }
  lines.push('rollback;', '');
  return lines.join('\n');
}
