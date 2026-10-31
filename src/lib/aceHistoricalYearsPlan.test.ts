import { LiveNode, LiveSnapshot, reconcilePickupYears } from './aceHistoricalYears';
import {
  buildBackfillPlan,
  EVIDENCE_SOURCE_KIND,
  validatePickupBatchLabel,
  parseReviewSheet,
  PICKUP_COLUMNS,
  planSqlPreview,
  REVIEW_COLUMNS,
  reviewQueues,
  ReviewRow,
  reviewSheetCsv,
} from './aceHistoricalYearsPlan';
import { parseCsvTable } from './csvParse';

// Fictional people; UUIDs are made up.
const FAM_ID = '00000000-0000-4000-8000-0000000000f1';
const OTHER_FAM_ID = '00000000-0000-4000-8000-0000000000f2';
const ROOT = '00000000-0000-4000-8000-000000000001';
const BIG = '00000000-0000-4000-8000-000000000002';
const LITTLE = '00000000-0000-4000-8000-000000000003';
const OTHER = '00000000-0000-4000-8000-000000000004';

function liveNodes(extra: Partial<Record<string, Partial<LiveNode>>> = {}): LiveSnapshot {
  const nodes: LiveNode[] = [
    { id: ROOT, family_id: FAM_ID, name: 'Rowan Testroot', parent_member_id: null, member_id: null },
    { id: BIG, family_id: FAM_ID, name: 'Bree Sample', parent_member_id: ROOT, member_id: null },
    { id: LITTLE, family_id: FAM_ID, name: 'Lio Fakename', parent_member_id: BIG, member_id: null },
    { id: OTHER, family_id: FAM_ID, name: '=Odd Name', parent_member_id: ROOT, member_id: null },
  ].map((n) => ({ ...n, ...(extra[n.id] ?? {}) }));
  return { families: [{ id: FAM_ID, slug: 'reef', name: 'Reef' }, { id: OTHER_FAM_ID, slug: 'comet', name: 'Comet' }], nodes };
}

function review(overrides: Partial<ReviewRow>, sheetRow = 2): ReviewRow {
  return {
    sheetRow,
    ace_node_id: LITTLE,
    fam_id: FAM_ID,
    member_name: 'Lio Fakename',
    current_big_node_id: BIG,
    current_big_name: 'Bree Sample',
    existing_pickup_term: '',
    existing_pickup_academic_year: '',
    confidence_class: 'CONFIRMED_YEAR',
    reviewer_decision: 'approve',
    reviewer_confirmed_year: '2021–22',
    reviewer_confirmed_term: 'FA21',
    approved_for_backfill: 'yes',
    ...overrides,
  };
}

const OPTS = { maxAcademicYearStart: 2025 };

describe('review sheet', () => {
  const snap = liveNodes();
  const result = reconcilePickupYears(
    snap,
    {
      sources: [{ source_id: 'FA21', kind: 'official_pairing', label: 'FA21', term: 'FA21', extraction_complete: true, authoritative: true }],
      records: [{ source_id: 'FA21', kind: 'official_pairing', little: 'Lio Fakename', big: 'Bree Sample', ref: 'Pairings!row 4' }],
    },
    OPTS
  );

  it('has one row per live node, every review column, and blank reviewer columns', () => {
    const csv = reviewSheetCsv(result.rows, 'test');
    const table = parseCsvTable(csv);
    expect(table.headers).toEqual([...REVIEW_COLUMNS]);
    expect(table.rows).toHaveLength(snap.nodes.length);
    const little = table.rows.find((r) => r.ace_node_id === LITTLE)!;
    expect(little).toMatchObject({ confidence_class: 'CONFIRMED_YEAR', recommended_pickup_academic_year: '2021–22', recommended_pickup_term: 'FA21', approved_for_backfill: '' });
    expect(little.source_sheet_and_cell).toBe('FA21!Pairings!row 4');
  });

  it('guards formula-looking names and reads them back unchanged', () => {
    const csv = reviewSheetCsv(result.rows, 'test');
    expect(csv).toContain("'=Odd Name");
    const rows = parseReviewSheet(csv);
    expect(rows.find((r) => r.ace_node_id === OTHER)!.member_name).toBe('=Odd Name');
  });

  it('routes rows to follow-up queues', () => {
    const little = result.rows.find((r) => r.ace_node_id === LITTLE)!;
    const root = result.rows.find((r) => r.ace_node_id === ROOT)!;
    expect(reviewQueues(little)).toEqual(['ready_for_review']);
    expect(reviewQueues(root)).toEqual(['missing_evidence', 'roots']);
  });

  it('rejects a sheet without the reviewer columns', () => {
    expect(() => parseReviewSheet('ace_node_id,fam_id\nx,y\n')).toThrow(/missing column/);
  });
});

describe('buildBackfillPlan', () => {
  it('plans a year-only update for an approved row and nothing else', () => {
    const plan = buildBackfillPlan([review({})], liveNodes(), OPTS);
    expect(plan.mode).toBe('dry-run');
    expect(plan.columns).toEqual(PICKUP_COLUMNS);
    expect(plan.updates).toEqual([
      {
        ace_node_id: LITTLE,
        family_id: FAM_ID,
        expected_parent_member_id: BIG,
        previous: { pickup_term: null, pickup_academic_year_start: null },
        next: { pickup_term: 'FA21', pickup_academic_year_start: 2021 },
        review_sheet_confidence_class: 'CONFIRMED_YEAR',
        evidence_category: 'official_pairing',
        overwrites_existing_value: false,
        sheet_row: 2,
      },
    ]);
    for (const update of plan.updates) expect(Object.keys(update.next).sort()).toEqual([...PICKUP_COLUMNS].sort());
  });

  it('keeps a year-only approval year-only', () => {
    const plan = buildBackfillPlan([review({ reviewer_confirmed_term: '', reviewer_confirmed_year: '2019–20' })], liveNodes(), OPTS);
    expect(plan.updates[0].next).toEqual({ pickup_term: null, pickup_academic_year_start: 2019 });
  });

  it('ignores rows that are not approved', () => {
    const plan = buildBackfillPlan([review({ approved_for_backfill: '' }), review({ approved_for_backfill: 'no', ace_node_id: BIG })], liveNodes(), OPTS);
    expect(plan.updates).toHaveLength(0);
    expect(plan.not_approved).toBe(2);
  });

  it.each([
    ['fam changed', { fam_id: OTHER_FAM_ID }, /fam changed/],
    ['Big changed', { current_big_node_id: ROOT }, /Big changed/],
    ['name edited in the sheet', { member_name: 'Someone Else' }, /name differs/],
    ['node gone', { ace_node_id: '00000000-0000-4000-8000-000000000099' }, /not in the current published snapshot/],
    ['no year', { reviewer_confirmed_year: '' }, /without reviewer_confirmed_year/],
    ['bad year', { reviewer_confirmed_year: 'sometime' }, /not an academic year/],
    ['bare year', { reviewer_confirmed_year: '2021' }, /not an academic year like 2021–22/],
    ['Big renamed', { current_big_name: 'Bree Oldname' }, /renamed since review/],
    ['bad term', { reviewer_confirmed_term: 'Fall' }, /not a FA\/WI\/SP term/],
    ['FA23 is not 2022–23', { reviewer_confirmed_term: 'FA23', reviewer_confirmed_year: '2022–23' }, /FA23 is in 2023–24/],
    ['unrevealed year', { reviewer_confirmed_year: '2026–27', reviewer_confirmed_term: '' }, /after the latest revealed cycle/],
    ['unclear approval', { approved_for_backfill: 'maybe' }, /not yes or no/],
  ])('rejects a row when %s, without planning any change', (_label, overrides, reason) => {
    const plan = buildBackfillPlan([review(overrides as Partial<ReviewRow>)], liveNodes(), OPTS);
    expect(plan.updates).toHaveLength(0);
    expect(plan.rejected).toHaveLength(1);
    expect(plan.rejected[0].reason).toMatch(reason);
  });

  it('accepts SP23 as 2022–23', () => {
    const plan = buildBackfillPlan([review({ reviewer_confirmed_term: 'SP23', reviewer_confirmed_year: '2022-23' })], liveNodes(), OPTS);
    expect(plan.updates[0].next).toEqual({ pickup_term: 'SP23', pickup_academic_year_start: 2022 });
  });

  it('rejects every copy when one node is approved twice', () => {
    const plan = buildBackfillPlan([review({}, 2), review({ reviewer_confirmed_year: '2022–23', reviewer_confirmed_term: '' }, 3)], liveNodes(), OPTS);
    expect(plan.updates).toHaveLength(0);
    expect(plan.rejected.map((r) => r.sheet_row)).toEqual([2, 3]);
  });

  it('changes zero records when the same approved plan is repeated', () => {
    const applied = liveNodes({ [LITTLE]: { pickup_term: 'FA21', pickup_academic_year_start: 2021 } });
    const plan = buildBackfillPlan([review({ existing_pickup_term: 'FA21', existing_pickup_academic_year: '2021–22' })], applied, OPTS);
    expect(plan.updates).toHaveLength(0);
    expect(plan.unchanged).toEqual([{ ace_node_id: LITTLE, sheet_row: 2 }]);
  });

  it('marks a correction of an existing year that the reviewer saw', () => {
    const existing = liveNodes({ [LITTLE]: { pickup_term: null, pickup_academic_year_start: 2020 } });
    const plan = buildBackfillPlan([review({ existing_pickup_academic_year: '2020–21' })], existing, OPTS);
    expect(plan.updates[0]).toMatchObject({ overwrites_existing_value: true, previous: { pickup_term: null, pickup_academic_year_start: 2020 } });
  });

  it('never overwrites a year set after the review', () => {
    const corrected = liveNodes({ [LITTLE]: { pickup_term: 'FA22', pickup_academic_year_start: 2022 } });
    const plan = buildBackfillPlan([review({})], corrected, OPTS);
    expect(plan.updates).toHaveLength(0);
    expect(plan.rejected[0].reason).toMatch(/changed since review/);
  });

  it('keeps an existing term when a year-only approval repeats its year, and clears it only on request', () => {
    const existing = liveNodes({ [LITTLE]: { pickup_term: 'FA21', pickup_academic_year_start: 2021 } });
    const seen = { existing_pickup_term: 'FA21', existing_pickup_academic_year: '2021–22', reviewer_confirmed_term: '' };
    expect(buildBackfillPlan([review(seen)], existing, OPTS).unchanged).toHaveLength(1);
    const cleared = buildBackfillPlan([review({ ...seen, reviewer_confirmed_term: 'clear' })], existing, OPTS);
    expect(cleared.updates[0].next).toEqual({ pickup_term: null, pickup_academic_year_start: 2021 });
  });

  it('refuses a snapshot without pickup columns unless asked for a preview', () => {
    const bare = { ...liveNodes(), hasPickupColumns: false };
    expect(() => buildBackfillPlan([review({})], bare, OPTS)).toThrow(/no pickup_term/);
    const preview = buildBackfillPlan([review({})], bare, { ...OPTS, allowMissingPickupColumns: true });
    expect(preview.snapshot_has_pickup_columns).toBe(false);
    expect(planSqlPreview(preview)).toMatch(/WITHOUT pickup columns/);
  });
});

describe('planSqlPreview', () => {
  const plan = buildBackfillPlan(
    [
      review({}),
      review(
        {
          ace_node_id: ROOT,
          member_name: 'Rowan Testroot',
          current_big_node_id: '',
          current_big_name: '',
          existing_pickup_academic_year: '2016–17',
          reviewer_confirmed_term: '',
          reviewer_confirmed_year: '2017–18',
        },
        3
      ),
    ],
    liveNodes({ [ROOT]: { pickup_academic_year_start: 2016 } }),
    OPTS
  );
  const preview = planSqlPreview(plan, { batchLabel: 'FA26-reviewed-batch' });

  it('sets only the pickup columns, guarded on fam, Big and previous values, and rolls back', () => {
    expect(preview.trim().endsWith('rollback;')).toBe(true);
    expect(preview).not.toMatch(/\bcommit\b/i);
    const executable = preview
      .split('\n')
      .filter((line) => !line.startsWith('--'))
      .join('\n');
    const withoutScratch = executable.replace(/insert into ace_pickup_plan_failures values[^\n]*/g, '');
    expect(withoutScratch).not.toMatch(/\b(delete|upsert|truncate|drop|alter|grant|revoke)\b/i);
    expect(executable.match(/insert into public.ace_member_pickup_evidence/g)).toHaveLength(2);
    expect(executable.match(/insert into public.admin_activity_log/g)).toHaveLength(1);
    expect(executable).toContain("'ace.pickup_backfill'");
    expect(executable).toContain("'batch_label', 'FA26-reviewed-batch'");
    expect(executable).toContain("'overwrites', 1");
    expect(executable).toContain("if changed = 1 then");
    expect(executable).toContain("on conflict (ace_member_id, source_kind, source_label, raw_value) do nothing;");
    expect(executable).toContain("and review_status = 'approved' and reviewed_at is not null");
    expect(executable).toContain('ACE pickup evidence conflict');
    expect(executable.match(/do \$\$/g)).toHaveLength(3);
    expect(executable.match(/update [\w.]+/g)).toEqual(['update public.ace_family_members', 'update public.ace_family_members']);
    const sets = preview.match(/set [^\n]+/g) ?? [];
    expect(sets).toHaveLength(2);
    for (const set of sets) expect(set).toMatch(/^set pickup_term = (null|'(FA|WI|SP)\d\d'), pickup_academic_year_start = \d{4}$/);
    expect(preview).toContain(`and family_id = '${FAM_ID}'::uuid`);
    expect(preview).toContain(`and parent_member_id = '${BIG}'::uuid`);
    expect(preview).toContain('and parent_member_id is null');
    expect(preview).toContain('and pickup_academic_year_start = 2016;');
    expect(preview).toMatch(/insert into ace_pickup_plan_failures/);
    expect(preview).toMatch(/these nodes did not match their reviewed state/);
    expect(preview).toMatch(/never public/);
    expect(preview).not.toMatch(/Lio|Rowan|Bree/);
  });

  it('maps each source classification only to an allowed evidence source kind', () => {
    expect(EVIDENCE_SOURCE_KIND).toEqual({
      official_pairing: 'official_pairing',
      explicit_term_or_official_loose: 'import_json',
      master_year_row: 'workbook_year_row',
      reviewer_resolved_conflict: 'admin_entry',
      reviewer_supplied: 'admin_entry',
    });
  });

  it('requires a short URL-free audit batch label for a current-schema plan', () => {
    expect(() => planSqlPreview(plan)).toThrow(/Batch label/);
    expect(() => planSqlPreview(plan, { batchLabel: 'https://docs.google.com/private' })).toThrow(/Batch label/);
    expect(() => planSqlPreview(plan, { batchLabel: 'FA26-$-review' })).toThrow(/Batch label/);
    expect(() => planSqlPreview(plan, { batchLabel: 'a'.repeat(201) })).toThrow(/Batch label/);
    expect(validatePickupBatchLabel("  FA26's review  ")).toBe("FA26's review");
    expect(planSqlPreview(plan, { batchLabel: "FA26's review" })).toContain("'FA26''s review'");
  });

  it('omits evidence and audit for unchanged replay and unsupported pre-schema previews', () => {
    const unchanged = buildBackfillPlan([review({ approved_for_backfill: 'no' })], liveNodes(), OPTS);
    const sql = planSqlPreview(unchanged, { batchLabel: 'checked-batch' });
    expect(sql).not.toContain('insert into public.ace_member_pickup_evidence');
    expect(sql).not.toContain('insert into public.admin_activity_log');
    const legacy = { ...plan, snapshot_has_pickup_columns: false };
    const legacySql = planSqlPreview(legacy);
    expect(legacySql).not.toContain('insert into public.ace_member_pickup_evidence');
    expect(legacySql).not.toContain('insert into public.admin_activity_log');
    expect(legacySql.trim().endsWith('rollback;')).toBe(true);
  });

  it('refuses to render a non-UUID id', () => {
    const bad = { ...plan, updates: [{ ...plan.updates[0], ace_node_id: "x'; drop table members; --" }] };
    expect(() => planSqlPreview(bad, { batchLabel: 'FA26-reviewed-batch' })).toThrow(/non-UUID/);
  });
});
