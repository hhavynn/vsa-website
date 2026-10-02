import { buildMemberNameIndex } from './memberLinkMatching';
import type { ParsedImportRow } from './aceAssignments';
import {
  formatImportSummary,
  importStage,
  problemRows,
  problemRowsToCsv,
  problemRowsToText,
  reviewAceImportRows,
  reviewAttendanceRows,
  reviewInternNames,
  reviewRosterEntries,
  stageStates,
  summarizeImport,
  ImportReviewRow,
} from './adminImportReview';

const member = (id: string, fullName: string) => ({ id, fullName, college: null, year: null, displayName: fullName });
const index = buildMemberNameIndex([
  member('1', 'Ada Lovelace'),
  member('2', 'Andy Tran'),
  member('3', 'Andy Tran'),
  member('4', 'Andy Tran'),
  member('5', 'Grace Hopper'),
]);

const row = (line: number, name: string, extra: Partial<ParsedImportRow> = {}): ParsedImportRow => ({ line, name, email: null, bigName: null, notes: null, ...extra });

describe('summarizeImport / formatImportSummary', () => {
  const rows: ImportReviewRow[] = [
    { index: 1, label: 'a', category: 'ready', reason: null },
    { index: 2, label: 'b', category: 'ready', reason: null },
    { index: 3, label: 'c', category: 'needs_review', reason: 'x' },
    { index: 4, label: 'd', category: 'unmatched', reason: 'y' },
    { index: 5, label: 'e', category: 'invalid', reason: 'z' },
  ];

  it('counts every category and the problem total', () => {
    expect(summarizeImport(rows)).toEqual({ total: 5, ready: 2, needsReview: 1, unmatched: 1, invalid: 1, problems: 3 });
  });

  it('formats the summary shown before writing, hiding empty categories', () => {
    expect(formatImportSummary(summarizeImport(rows))).toEqual(['5 rows', '2 ready', '1 need review', '1 unmatched', '1 invalid']);
    expect(formatImportSummary(summarizeImport(rows.slice(0, 2)))).toEqual(['2 rows', '2 ready']);
  });
});

describe('importStage / stageStates', () => {
  it('walks Input → Needs Review → Ready', () => {
    expect(importStage({ hasInput: false, summary: null })).toBe('input');
    expect(importStage({ hasInput: true, summary: summarizeImport([]) })).toBe('parsed');
    const problem = summarizeImport([{ index: 1, label: 'a', category: 'unmatched', reason: 'x' }]);
    expect(importStage({ hasInput: true, summary: problem })).toBe('needs_review');
    const clean = summarizeImport([{ index: 1, label: 'a', category: 'ready', reason: null }]);
    expect(importStage({ hasInput: true, summary: clean })).toBe('ready');
  });

  it('marks earlier stages done and later ones todo', () => {
    const clean = summarizeImport([{ index: 1, label: 'a', category: 'ready', reason: null }]);
    const states = stageStates('ready', clean).map((stage) => stage.state);
    expect(states).toEqual(['done', 'done', 'done', 'done', 'current']);
    const early = stageStates('input', null).map((stage) => stage.state);
    expect(early).toEqual(['current', 'todo', 'todo', 'todo', 'todo']);
  });
});

describe('reviewAceImportRows', () => {
  const nodes = [
    { id: 'n1', name: 'April Pham', parentId: null, memberId: null },
    { id: 'n2', name: 'Twin Name', parentId: null, memberId: null },
    { id: 'n3', name: 'Twin Name', parentId: null, memberId: null },
  ] as never;

  it('categorizes ready, ambiguous, unmatched, and invalid rows with concrete reasons', () => {
    const rows = reviewAceImportRows(
      [row(2, 'Ada Lovelace'), row(3, 'Andy Tran'), row(4, 'Nobody Known'), row(5, 'Grace Hopper', { bigName: 'April Pham' })],
      { nameIndex: index, nodes, skippedBlank: 1 },
    );
    expect(rows.map((item) => item.category)).toEqual(['ready', 'needs_review', 'unmatched', 'ready', 'invalid']);
    expect(rows[1].reason).toBe('3 canonical members share this name. Choose one manually.');
    expect(rows[2].reason).toMatch(/No member has this exact name/);
    expect(rows[4].reason).toBe('This row has no name.');
  });

  it('flags a requested Big that is missing or ambiguous instead of guessing', () => {
    const rows = reviewAceImportRows([row(2, 'Ada Lovelace', { bigName: 'Ghost' }), row(3, 'Grace Hopper', { bigName: 'Twin Name' })], { nameIndex: index, nodes });
    expect(rows[0].reason).toBe('Requested Big "Ghost" was not found on the ACE tree.');
    expect(rows[1].reason).toMatch(/matches 2 people/);
    expect(rows.every((item) => item.category === 'needs_review')).toBe(true);
  });

  it('flags repeated names in the paste and names already in the draft', () => {
    const rows = reviewAceImportRows([row(2, 'Ada Lovelace'), row(3, 'ada  lovelace'), row(4, 'Grace Hopper')], {
      nameIndex: index,
      nodes,
      existingLittleNames: new Set(['grace hopper']),
    });
    expect(rows[0].reason).toMatch(/more than once/);
    expect(rows[1].category).toBe('needs_review');
    expect(rows[2].reason).toMatch(/already in the draft/);
  });

  it('treats an email-matched row as ready', () => {
    const rows = reviewAceImportRows([row(2, 'Someone New', { email: 'x@y.z' })], { nameIndex: index, nodes, emailMatched: new Set(['x@y.z']) });
    expect(rows[0].category).toBe('ready');
  });
});

describe('reviewRosterEntries / reviewInternNames', () => {
  it('explains an unknown role, an unmatched name, and an ambiguous name', () => {
    const rows = reviewRosterEntries(
      [
        { name: 'Ada Lovelace', role: 'President' },
        { name: 'Nobody', role: 'President' },
        { name: 'Andy Tran', role: 'President' },
        { name: 'Grace Hopper', role: 'Chief of Vibes' },
      ],
      { nameIndex: index, knownRoles: new Set(['president']), normalizeRole: (role) => role.trim().toLowerCase() },
    );
    expect(rows.map((item) => item.category)).toEqual(['ready', 'unmatched', 'needs_review', 'needs_review']);
    expect(rows[2].reason).toMatch(/3 canonical members/);
    expect(rows[3].reason).toMatch(/not a position on this roster/);
  });

  it('flags interns already in the cohort and repeated lines', () => {
    const rows = reviewInternNames([{ name: 'Ada Lovelace', roleOrTrack: null }, { name: 'Grace Hopper', roleOrTrack: null }, { name: 'Grace Hopper', roleOrTrack: null }], {
      nameIndex: index,
      existingNames: new Set(['ada lovelace']),
    });
    expect(rows[0].reason).toMatch(/already in the cohort/);
    expect(rows[1].category).toBe('needs_review');
    expect(rows[2].category).toBe('needs_review');
  });
});

describe('problem row export', () => {
  const rows: ImportReviewRow[] = [
    { index: 2, label: 'Ada', category: 'ready', reason: null, raw: { Name: 'Ada' } },
    { index: 3, label: 'Andy Tran', category: 'needs_review', reason: '3 canonical members share this name. Choose one manually.', raw: { Name: 'Andy Tran', Notes: 'said "hi", thanks' } },
    { index: 4, label: '=HYPERLINK("x")', category: 'invalid', reason: 'bad', raw: { Name: '=HYPERLINK("x")' } },
  ];

  it('keeps only the rows that need attention', () => {
    expect(problemRows(rows).map((item) => item.index)).toEqual([3, 4]);
  });

  it('exports CSV with a header, escapes quotes and commas, and neutralizes formulas', () => {
    const csv = problemRowsToCsv(rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Row,Who,Problem,Reason,Name,Notes');
    expect(lines[1]).toContain('3 canonical members share this name. Choose one manually.');
    expect(lines[1]).toContain('"said ""hi"", thanks"');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toContain('Ada');
  });

  it('copies a readable text summary', () => {
    expect(problemRowsToText(rows).split('\n')[0]).toBe('Row 3: Andy Tran — Needs review. 3 canonical members share this name. Choose one manually.');
  });
});

describe('reviewAttendanceRows', () => {
  const row = (patch: Partial<Parameters<typeof reviewAttendanceRows>[0][number]>) => ({
    originalIndex: 0,
    displayName: 'Andy Tran',
    effectiveStatus: 'match' as const,
    reason: 'exact_name_match',
    note: '',
    invalidYear: false,
    candidateCount: 0,
    ...patch,
  });

  it('treats matches, new members, and already-imported rows as ready', () => {
    const rows = reviewAttendanceRows([row({}), row({ effectiveStatus: 'new' }), row({ effectiveStatus: 'already' })]);
    expect(rows.every((item) => item.category === 'ready')).toBe(true);
  });

  it('explains an ambiguous name concretely, with the sheet row number', () => {
    const [item] = reviewAttendanceRows([row({ originalIndex: 12, effectiveStatus: 'review', reason: 'ambiguous_match', candidateCount: 3 })]);
    expect(item).toMatchObject({ index: 14, category: 'needs_review', reason: '3 canonical members share this name. Choose one manually.' });
  });

  it('explains near matches, email conflicts, and duplicate rows', () => {
    const rows = reviewAttendanceRows([
      row({ effectiveStatus: 'review', reason: 'fuzzy_name_match' }),
      row({ effectiveStatus: 'review', reason: 'email_name_conflict' }),
      row({ effectiveStatus: 'duplicate', reason: 'duplicate_row' }),
    ]);
    expect(rows[0].reason).toMatch(/near name match/);
    expect(rows[1].reason).toMatch(/different name/);
    expect(rows[2].reason).toMatch(/Duplicate of an earlier row/);
  });

  it('flags an unrecognized year even on a matched row', () => {
    const [item] = reviewAttendanceRows([row({ invalidYear: true, csvYear: 'Yr 9' })]);
    expect(item.category).toBe('needs_review');
    expect(item.reason).toContain('"Yr 9"');
  });

  it('falls back to the importer note, then to a generic prompt', () => {
    expect(reviewAttendanceRows([row({ effectiveStatus: 'review', reason: 'something_new', note: 'Custom note.' })])[0].reason).toBe('Custom note.');
    expect(reviewAttendanceRows([row({ effectiveStatus: 'review', reason: 'something_new', note: '' })])[0].reason).toBe('Needs a manual decision.');
  });
});
