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

export type ReviewQueue = 'ambiguous_identity' | 'conflicting_years' | 'missing_evidence' | 'chronology' | 'roots' | 'ready_for_review';

/** Which follow-up list a row belongs on. A row can be on several. */
export function reviewQueues(row: NodeReconciliation): ReviewQueue[] {
  const queues: ReviewQueue[] = [];
  if (
    row.flags.includes('AMBIGUOUS_IDENTITY') ||
    row.flags.includes('SAME_NAME_IN_FAM') ||
    row.flags.includes('SOURCE_BIG_DIFFERS') ||
    row.flags.includes('SOURCE_FAM_LABEL_DIFFERS') ||
    row.flags.includes('CANONICAL_MEMBER_ON_SEVERAL_NODES')
  )
    queues.push('ambiguous_identity');
  if (row.confidence_class === 'CONFLICTING_EVIDENCE') queues.push('conflicting_years');
  if (row.flags.includes('CHILD_EARLIER_THAN_BIG') || row.flags.includes('SAME_TERM_AS_BIG')) queues.push('chronology');
  if (row.confidence_class === 'UNKNOWN') queues.push('missing_evidence');
  if (!row.current_big_node_id) queues.push('roots');
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
  current_big_name: string;
  existing_pickup_term: string;
  existing_pickup_academic_year: string;
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
  const required: ReviewColumn[] = [
    'ace_node_id',
    'fam_id',
    'member_name',
    'current_big_node_id',
    'current_big_name',
    'existing_pickup_term',
    'existing_pickup_academic_year',
    ...REVIEWER_COLUMNS,
  ];
  const missing = required.filter((c) => !table.headers.includes(c));
  if (missing.length > 0) throw new Error(`Review sheet is missing column(s): ${missing.join(', ')}.`);
  return table.rows.map((raw, i) => ({
    sheetRow: table.rowNumbers[i],
    ace_node_id: unguard(raw.ace_node_id ?? ''),
    fam_id: unguard(raw.fam_id ?? ''),
    member_name: unguard(raw.member_name ?? ''),
    current_big_node_id: unguard(raw.current_big_node_id ?? ''),
    current_big_name: unguard(raw.current_big_name ?? ''),
    existing_pickup_term: unguard(raw.existing_pickup_term ?? ''),
    existing_pickup_academic_year: unguard(raw.existing_pickup_academic_year ?? ''),
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
  /** As recorded in the review sheet (reviewer-editable); re-check against a fresh reconcile before applying. */
  review_sheet_confidence_class: string;
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
  /** False when planned against a snapshot without #669's columns: previous values are assumed blank and the plan is a preview only. */
  snapshot_has_pickup_columns: boolean;
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

/** Explicit mapping from review classifications to the approved evidence-table enum. */
export const EVIDENCE_SOURCE_KIND: Readonly<Record<string, string>> = {
  official_pairing: 'official_pairing',
  explicit_term_or_official_loose: 'import_json',
  master_year_row: 'workbook_year_row',
  reviewer_resolved_conflict: 'admin_entry',
  reviewer_supplied: 'admin_entry',
};

export function validatePickupBatchLabel(label: string): string {
  const clean = label.trim();
  if (!clean || clean.length > 200 || /(https?:\/\/|drive\.google|docs\.google)/i.test(clean) || clean.includes('$$') || /[\u0000-\u001f]/.test(clean)) {
    throw new Error('Batch label must be 1–200 characters and cannot contain URLs or Drive links.');
  }
  // Only deliberately generic labels are appropriate for audit records, never a person's name.
  return clean;
}

export interface PlanOptions {
  maxAcademicYearStart: number;
  /**
   * Allow a snapshot without the pickup columns (before #669). The plan then
   * assumes every current value is blank, so it is a preview, not idempotent.
   */
  allowMissingPickupColumns?: boolean;
}

/** In reviewer_confirmed_term, removes an existing term while keeping the year. */
export const CLEAR_TERM = 'CLEAR';

/**
 * Builds the year-only update plan from reviewer-approved rows. Never writes.
 * Repeating it after the plan was applied yields zero updates.
 */
export function buildBackfillPlan(review: readonly ReviewRow[], snapshot: LiveSnapshot, options: PlanOptions): BackfillPlan {
  const hasColumns = snapshot.hasPickupColumns !== false;
  if (!hasColumns && !options.allowMissingPickupColumns) {
    throw new Error(
      'The live snapshot has no pickup_term / pickup_academic_year_start: the plan cannot see current values. Re-snapshot with those columns (#669), or pass the pre-#669 preview option.'
    );
  }
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
    const liveBigName = node.parent_member_id ? live.get(node.parent_member_id)?.name ?? '' : '';
    if (nameKeys(liveBigName).exact !== nameKeys(row.current_big_name).exact) {
      reject('the live Big was renamed since review (re-review)');
      continue;
    }
    if (nameKeys(node.name).exact !== nameKeys(row.member_name).exact) {
      reject('name differs from the live node (names are never changed by this plan)');
      continue;
    }
    const previous: PickupValues = { pickup_term: node.pickup_term ?? null, pickup_academic_year_start: node.pickup_academic_year_start ?? null };
    const reviewedYear = row.existing_pickup_academic_year.trim() ? parseAcademicYear(row.existing_pickup_academic_year) : null;
    const reviewedTerm = row.existing_pickup_term.trim() ? parseTerm(row.existing_pickup_term)?.term ?? row.existing_pickup_term.trim() : null;
    if (reviewedYear !== previous.pickup_academic_year_start || reviewedTerm !== previous.pickup_term) {
      reject('the live year/term changed since review (a later correction is never overwritten; re-review)');
      continue;
    }
    const year = parseAcademicYear(row.reviewer_confirmed_year, true);
    if (year === null) {
      reject(
        row.reviewer_confirmed_year.trim()
          ? `reviewer_confirmed_year "${row.reviewer_confirmed_year}" is not an academic year like 2021–22`
          : 'approved without reviewer_confirmed_year'
      );
      continue;
    }
    if (year > options.maxAcademicYearStart) {
      reject(`year ${academicYearLabel(year)} is after the latest revealed cycle`);
      continue;
    }
    let term: string | null = null;
    const termInput = row.reviewer_confirmed_term.trim();
    if (termInput.toUpperCase() === CLEAR_TERM) term = null;
    else if (!termInput) {
      // A year-only approval keeps a term already recorded for that same year.
      term = previous.pickup_academic_year_start === year ? previous.pickup_term : null;
    } else {
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
      review_sheet_confidence_class: row.confidence_class,
      evidence_category: EVIDENCE_CATEGORY[row.confidence_class] ?? 'reviewer_supplied',
      overwrites_existing_value: previous.pickup_term !== null || previous.pickup_academic_year_start !== null,
      sheet_row: row.sheetRow,
    });
  }

  updates.sort((a, b) => a.ace_node_id.localeCompare(b.ace_node_id));
  return {
    mode: 'dry-run',
    columns: PICKUP_COLUMNS,
    snapshot_has_pickup_columns: hasColumns,
    max_academic_year_start: options.maxAcademicYearStart,
    updates,
    unchanged,
    rejected,
    not_approved: notApproved,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sqlLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

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
 * the two pickup columns and is guarded on the node's live fam and Big and on
 * the reviewed previous values. A row that does not change exactly once is
 * recorded, and at the end every such node id is reported together and the
 * whole transaction is aborted: nothing is half-applied.
 */
export function planSqlPreview(plan: BackfillPlan, options?: { batchLabel?: string }): string {
  const batchLabel = plan.snapshot_has_pickup_columns
    ? validatePickupBatchLabel(options?.batchLabel ?? '')
    : options?.batchLabel ? validatePickupBatchLabel(options.batchLabel) : null;
  const labelSql = batchLabel === null ? null : sqlLiteral(batchLabel);

  const lines: string[] = [
    '-- ACE pickup-year backfill PREVIEW (#670). Generated; review-only.',
    `-- ${plan.updates.length} update(s), ${plan.unchanged.length} already applied, ${plan.rejected.length} rejected.`,
    `-- Only pickup_* columns are UPDATED on ACE nodes; approved evidence and aggregate admin audit are INSERTED. Requires #669.`,
  ];
  if (!plan.snapshot_has_pickup_columns) {
    lines.push('-- WARNING: planned against a snapshot WITHOUT pickup columns; previous values were assumed blank.', '-- Regenerate from a post-#669 snapshot before any real apply.');
  }
  lines.push(
    '-- Back up first, into a schema the API does not expose (never public, which gets anon grants):',
    '--   create table <private_schema>.ace_pickup_backup_<date> as select id, pickup_term, pickup_academic_year_start',
    '--   from public.ace_family_members where id in (<plan ids>);',
    'begin;',
    'create temporary table ace_pickup_plan_failures (ace_node_id uuid primary key, changed integer not null);'
  );
  for (const u of plan.updates) {
    const prevTerm = u.previous.pickup_term === null ? 'pickup_term is null' : `pickup_term = ${sqlTerm(u.previous.pickup_term)}`;
    const prevYear =
      u.previous.pickup_academic_year_start === null
        ? 'pickup_academic_year_start is null'
        : `pickup_academic_year_start = ${sqlYear(u.previous.pickup_academic_year_start)}`;
    const parent = u.expected_parent_member_id === null ? 'parent_member_id is null' : `parent_member_id = ${sqlUuid(u.expected_parent_member_id)}`;
    const sourceKind = EVIDENCE_SOURCE_KIND[u.evidence_category];
    if (!sourceKind) throw new Error('Unknown ACE evidence category: ' + u.evidence_category);
    if (!/^[A-Z_]{2,64}$/.test(u.review_sheet_confidence_class)) {
      throw new Error('Unexpected ACE confidence class in reviewed sheet.');
    }
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
      `  if changed <> 1 then insert into ace_pickup_plan_failures values (${sqlUuid(u.ace_node_id)}, changed); end if;`,
      // Audited provenance is generated only after the guarded year update changed exactly one row.
      ...(labelSql !== null && u.next.pickup_academic_year_start !== null ? [
        '  if changed = 1 then',
        '    insert into public.ace_member_pickup_evidence',
        '      (ace_member_id, source_kind, source_label, raw_value, candidate_academic_year_start, candidate_term, source_confidence, review_status, reviewed_at)',
        `    values (${sqlUuid(u.ace_node_id)}, ${sqlLiteral(sourceKind)}, ${labelSql}, ${sqlLiteral(u.next.pickup_term ?? academicYearLabel(u.next.pickup_academic_year_start))}, ${sqlYear(u.next.pickup_academic_year_start)}, ${sqlTerm(u.next.pickup_term)}, ${sqlLiteral(u.review_sheet_confidence_class)}, 'approved', now())`,
        '    on conflict (ace_member_id, source_kind, source_label, raw_value) do nothing;',
        // ON CONFLICT alone is unsafe: an existing pending/rejected/superseded
        // row cannot be used as proof of this reviewed change.
        '    if not exists (select 1 from public.ace_member_pickup_evidence',
        `      where ace_member_id = ${sqlUuid(u.ace_node_id)} and source_kind = ${sqlLiteral(sourceKind)}`,
        `        and source_label = ${labelSql} and raw_value = ${sqlLiteral(u.next.pickup_term ?? academicYearLabel(u.next.pickup_academic_year_start))}`,
        `        and candidate_academic_year_start = ${sqlYear(u.next.pickup_academic_year_start)}`,
        `        and candidate_term is not distinct from ${sqlTerm(u.next.pickup_term)}`,
        `        and source_confidence is not distinct from ${sqlLiteral(u.review_sheet_confidence_class)}`,
        "        and review_status = 'approved' and reviewed_at is not null) then",
        "      raise exception 'ACE pickup evidence conflict: reviewed evidence is missing or not approved. Use a fresh batch label.';",
        '    end if;',
        '  end if;',
      ] : []),
      // Same as set_ace_member_pickup_year: an approval the node no longer matches is superseded.
      ...(labelSql !== null ? [
        '  if changed = 1 then',
        "    update public.ace_member_pickup_evidence set review_status = 'superseded'",
        `      where ace_member_id = ${sqlUuid(u.ace_node_id)} and review_status = 'approved'`,
        `        and (candidate_academic_year_start is distinct from ${sqlYear(u.next.pickup_academic_year_start)}`,
        `          or candidate_term is distinct from ${sqlTerm(u.next.pickup_term)});`,
        '  end if;',
      ] : []),
      'end $$;'
    );
  }
  const byFam = new Map<string, { updates: number; overwrites: number }>();
  for (const update of plan.updates) {
    const count = byFam.get(update.family_id) ?? { updates: 0, overwrites: 0 };
    count.updates++;
    if (update.overwrites_existing_value) count.overwrites++;
    byFam.set(update.family_id, count);
  }
  lines.push(
    'do $$',
    'declare failed text;',
    'begin',
    "  select string_agg(ace_node_id::text || ' (' || changed || ' rows)', ', ' order by ace_node_id) into failed from ace_pickup_plan_failures;",
    "  if failed is not null then raise exception 'ACE pickup plan aborted; these nodes did not match their reviewed state: %', failed; end if;",
    'end $$;',
    // An audit failure is transactional: no years or evidence survive unless the audit insert succeeds.
    ...(labelSql !== null ? Array.from(byFam.entries()).map(([famId, count]) =>
      `insert into public.admin_activity_log (actor_user_id, action, entity_type, entity_id, academic_year_start, summary, metadata)
  values (null, 'ace.pickup_backfill', 'ace_family', ${sqlUuid(famId)}, null, ${sqlLiteral('ACE pickup-year backfill: ' + count.updates + ' reviewed node(s)')}, jsonb_build_object('updates', ${count.updates}, 'overwrites', ${count.overwrites}, 'batch_label', ${labelSql}));`
    ) : []),
    'rollback;',
    ''
  );
  return lines.join('\n');
}
