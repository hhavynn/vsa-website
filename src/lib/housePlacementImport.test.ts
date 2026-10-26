import {
  EMPTY_PLACEMENT_EDITS,
  PlacementProfile,
  buildPlacementMemberIndex,
  buildPlacementReview,
  detectPlacementColumns,
  formatFormTime,
  matchApplicantToMember,
  parseFormTimestamp,
  parsePlacementCsv,
  placementApplicants,
  rankOfHeader,
  resolveHouseLabel,
} from './housePlacementImport';
import { allocateHouseApplicants, firstChoiceDemand, suggestCapacities } from './housePlacement';
import { PlacementExportRow, placementExceptionsCsv, placementRosterCsv } from './housePlacementExport';
import type { HouseImportMember } from './houseAssignmentImport';

// Synthetic fixtures only — never real applicant data.
const profiles: PlacementProfile[] = [
  { id: 'p-rarity', house_key: 'rarity', display_name: 'Rarity', is_active: true, display_order: 1 },
  { id: 'p-pinkie', house_key: 'pinkie-pie', display_name: 'Pinkie Pie', is_active: true, display_order: 2 },
  { id: 'p-apple', house_key: 'applejack', display_name: 'Applejack', is_active: true, display_order: 3 },
  { id: 'p-twilight', house_key: 'twilight-sparkle', display_name: 'Twilight Sparkle', is_active: true, display_order: 4 },
  { id: 'p-old', house_key: 'fluttershy', display_name: 'Fluttershy', is_active: false, display_order: 5 },
];

const R = 'Rarity (Parent A & Parent B)';
const P = 'Pinkie Pie (Parent C & Parent D)';
const A = 'Applejack (Parent E & Parent F)';
const T = 'Twilight Sparkle (Parent G & Parent H)';

const HEADER = [
  'Timestamp', 'Phone Number', '"Name (First, Middle Initial, Last)"', 'Date of Birth', 'Email', 'Food allergies?',
  'House Rank [First Choice ]', 'House Rank [Second Choice ]', 'House Rank [Third Choice ]', 'House Rank [Forth Choice ]',
  'Tell us about yourself',
].join(',');

function line(timestamp: string, name: string, email: string, choices: string[], extra = 'likes boba') {
  return [timestamp, '555-0100', name, '1/1/2006', email, 'none', ...choices.map((choice) => `"${choice}"`), `"${extra}"`].join(',');
}

function csv(...lines: string[]) {
  return [HEADER, ...lines].join('\n');
}

function parsed(raw: string) {
  const result = parsePlacementCsv(raw);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('column detection', () => {
  it('recognizes the 2026 Google Form headers, including the "Forth Choice" typo', () => {
    const { detection } = parsed(csv(line('10/21/2026 20:59:50', 'An Example', 'an@example.test', [R, P, A, T])));
    expect(detection.columns).toEqual({
      timestamp: 'Timestamp',
      name: 'Name (First, Middle Initial, Last)',
      email: 'Email',
      ranks: ['House Rank [First Choice ]', 'House Rank [Second Choice ]', 'House Rank [Third Choice ]', 'House Rank [Forth Choice ]'],
    });
  });

  it('accepts conventional and correctly spelled rank headers with case and spacing variations', () => {
    expect(rankOfHeader('House Rank [Fourth Choice]')).toBe(4);
    expect(rankOfHeader('  FIRST   choice ')).toBe(1);
    expect(rankOfHeader('2nd House Choice')).toBe(2);
    expect(rankOfHeader('Preference 3')).toBe(3);
    expect(rankOfHeader('What is your first choice of snack?')).toBeNull();
  });

  it('reports an ambiguous column instead of guessing, and accepts an explicit choice', () => {
    const headers = ['Timestamp', 'Email Address', 'Name', 'Email', 'First choice', 'Second choice'];
    const detected = detectPlacementColumns(headers);
    expect(detected.issues.map((issue) => issue.code)).toEqual(['ambiguous_column']);
    expect(detected.columns.email).toBeNull();
    expect(detectPlacementColumns(headers, { email: 'Email' }).columns.email).toBe('Email');
  });

  it('reports two columns for the same rank', () => {
    const detected = detectPlacementColumns(['Timestamp', 'Name', 'Email', 'First choice', 'Choice 1']);
    expect(detected.issues.map((issue) => issue.code)).toContain('duplicate_rank');
    expect(detected.columns.ranks).toEqual([]);
  });

  it('reports missing required columns with actionable errors', () => {
    const result = parsePlacementCsv('Name,Email\nAn,an@example.test');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Timestamp column/);
    expect(!result.ok && result.error).toMatch(/House ranking columns/);
  });
});

describe('CSV parsing', () => {
  it('handles quoted commas, escaped quotes, multiline answers, CRLF, BOM, and blank lines', () => {
    const raw = `﻿${HEADER}\r\n${line('10/21/2026 20:59:50', '"Nguyen, An"', 'AN@Example.test', [R, P, A, T], 'line one\r\nsaid ""hi""')}\r\n\r\n${line('10/21/2026 21:00:01', 'Bao Tran', 'bao@example.test', [P, R, A, T])}\r\n`;
    const result = parsed(raw);
    expect(result.rows.map((row) => [row.sourceRow, row.name, row.email])).toEqual([
      [2, 'Nguyen, An', 'an@example.test'],
      [4, 'Bao Tran', 'bao@example.test'],
    ]);
    expect(result.rows[0].rawChoices).toEqual([R, P, A, T]);
  });

  it('keeps only placement fields — no extra form answers survive parsing', () => {
    const [row] = parsed(csv(line('10/21/2026 20:59:50', 'An Example', 'an@example.test', [R, P, A, T], 'secret answer'))).rows;
    expect(Object.keys(row).sort()).toEqual(['email', 'id', 'name', 'rawChoices', 'rawTimestamp', 'sourceRow', 'timestamp']);
    expect(JSON.stringify(row)).not.toMatch(/555-0100|secret answer|1\/1\/2006|none/);
  });

  it('fails clearly on an empty upload, a header-only file, and an unterminated quote', () => {
    expect(parsePlacementCsv('   ')).toMatchObject({ ok: false, error: expect.stringMatching(/empty/) });
    expect(parsePlacementCsv(HEADER)).toMatchObject({ ok: false, error: expect.stringMatching(/no submissions/) });
    expect(parsePlacementCsv(`${HEADER}\n10/21/2026 20:59:50,"broken`)).toMatchObject({ ok: false, error: expect.stringMatching(/malformed/) });
  });

  it('treats a repeated header as an ambiguous mapping, then warns once a column is chosen', () => {
    const raw = `${HEADER},Email\n${line('10/21/2026 20:59:50', 'An', 'an@example.test', [R, P, A, T])},other@example.test`;
    const ambiguous = parsePlacementCsv(raw);
    expect(ambiguous.ok).toBe(false);
    expect(!ambiguous.ok && ambiguous.error).toMatch(/More than one column could be the email \("Email", "Email \(2\)"\)/);
    const chosen = parsePlacementCsv(raw, { email: 'Email' });
    expect(chosen.ok && chosen.warnings.join(' ')).toMatch(/Repeated column headers: "Email"/);
    expect(chosen.ok && chosen.rows[0].email).toBe('an@example.test');
  });
});

describe('timestamps', () => {
  it('parses the Google Forms export format explicitly in Pacific time', () => {
    const parsedTime = parseFormTimestamp('10/21/2026 20:59:50');
    expect(parsedTime).toEqual({ kind: 'ok', ms: Date.UTC(2026, 9, 22, 3, 59, 50), iso: '2026-10-22T03:59:50.000Z', local: '2026-10-21 20:59:50', ambiguous: false, laterMs: null });
    expect(formatFormTime('2026-10-22T03:59:50.000Z')).toBe('10/21/2026 20:59:50');
    expect(parseFormTimestamp('1/5/2026 9:03:00 PM')).toMatchObject({ kind: 'ok', local: '2026-01-05 21:03:00', iso: '2026-01-06T05:03:00.000Z' });
    expect(parseFormTimestamp('2026-10-21 20:59:50')).toMatchObject({ kind: 'ok', local: '2026-10-21 20:59:50' });
  });

  it('flags missing, invalid, impossible and non-existent times instead of guessing', () => {
    expect(parseFormTimestamp('')).toEqual({ kind: 'missing' });
    expect(parseFormTimestamp('yesterday')).toMatchObject({ kind: 'invalid' });
    expect(parseFormTimestamp('21/10/2026 20:59:50')).toMatchObject({ kind: 'invalid', reason: expect.stringMatching(/month 21/) });
    expect(parseFormTimestamp('2/30/2026 10:00:00')).toMatchObject({ kind: 'invalid', reason: expect.stringMatching(/not a real date/) });
    expect(parseFormTimestamp('3/8/2026 2:30:00')).toMatchObject({ kind: 'invalid', reason: expect.stringMatching(/daylight-saving gap/) });
    expect(parseFormTimestamp('10/21/26 20:59')).toMatchObject({ kind: 'invalid' });
  });

  it('marks a wall-clock time repeated by the daylight-saving rollback, with both instants', () => {
    expect(parseFormTimestamp('11/1/2026 1:30:00')).toMatchObject({ kind: 'ok', ambiguous: true, iso: '2026-11-01T08:30:00.000Z', laterMs: Date.UTC(2026, 10, 1, 9, 30) });
  });

  it('blocks a rollback-hour submission until an admin says which hour it was, then orders it by that instant', () => {
    // Real order: A at 1:50 PDT (08:50Z), then B at 1:10 PST (09:10Z).
    const { rows } = parsed(csv(
      line('11/1/2026 1:50:00', 'Applicant A', 'a@example.test', [R, P, A, T]),
      line('11/1/2026 1:10:00', 'Applicant B', 'b@example.test', [R, P, A, T]),
    ));
    const blocked = buildPlacementReview(rows, profiles);
    expect(blocked.applicants.map((row) => row.status)).toEqual(['invalid', 'invalid']);
    expect(blocked.applicants[0].issues.map((issue) => issue.code)).toEqual(['ambiguous_timestamp']);
    const resolved = buildPlacementReview(rows, profiles, { ...EMPTY_PLACEMENT_EDITS, rollbackChoices: { 'row-2': 'first', 'row-3': 'second' } });
    expect(resolved.ready).toBe(true);
    expect(placementApplicants(resolved).map((applicant) => [applicant.id, new Date(applicant.submittedAtMs).toISOString()])).toEqual([
      ['row-2', '2026-11-01T08:50:00.000Z'],
      ['row-3', '2026-11-01T09:10:00.000Z'],
    ]);
  });
});

describe('House label resolution', () => {
  it('maps exact keys, names, and labels with a House Parent parenthetical', () => {
    expect(resolveHouseLabel('Rarity', profiles)).toEqual({ kind: 'resolved', profileId: 'p-rarity' });
    expect(resolveHouseLabel('pinkie-pie', profiles)).toEqual({ kind: 'resolved', profileId: 'p-pinkie' });
    expect(resolveHouseLabel('  twilight SPARKLE ', profiles)).toEqual({ kind: 'resolved', profileId: 'p-twilight' });
    expect(resolveHouseLabel(A, profiles)).toEqual({ kind: 'resolved', profileId: 'p-apple' });
  });

  it('reports unknown, inactive and ambiguous options, and honours an admin mapping', () => {
    expect(resolveHouseLabel('Spike (Parent Z)', profiles)).toEqual({ kind: 'unknown' });
    expect(resolveHouseLabel('Fluttershy', profiles)).toEqual({ kind: 'inactive', profileId: 'p-old' });
    const twins: PlacementProfile[] = [
      { id: 'x1', house_key: 'star', display_name: 'Star', is_active: true },
      { id: 'x2', house_key: 'star-2', display_name: 'Star', is_active: true },
    ];
    expect(resolveHouseLabel('Star (Parents)', twins)).toEqual({ kind: 'ambiguous', profileIds: ['x1', 'x2'] });
    expect(resolveHouseLabel('Spike (Parent Z)', profiles, { 'spike parent z': 'p-apple' })).toEqual({ kind: 'resolved', profileId: 'p-apple', viaMapping: true });
  });
});

describe('buildPlacementReview', () => {
  it('counts submissions, unique applicants and duplicates, keeping the earliest submission', () => {
    const { rows } = parsed(csv(
      line('10/21/2026 21:30:00', 'An Example', 'an@example.test', [P, R, A, T]),
      line('10/21/2026 20:00:00', 'An Example', 'AN@example.test', [R, P, A, T]),
      line('10/21/2026 20:05:00', 'Bao Tran', 'bao@example.test', [R, P, A, T]),
    ));
    const review = buildPlacementReview(rows, profiles);
    expect(review.counts).toEqual({ submissions: 3, unique: 2, duplicates: 1, invalid: 0, missingTimestamps: 0, excluded: 0, valid: 2 });
    const later = review.applicants.find((row) => row.sourceRow === 2);
    expect(later).toMatchObject({ status: 'duplicate', duplicateOf: 'row-3', duplicateDiffers: true });
    expect(placementApplicants(review).map((applicant) => [applicant.id, applicant.preferences[0]])).toEqual([['row-3', 'p-rarity'], ['row-4', 'p-rarity']]);
  });

  it('flags repeated, blank, multi-select, unknown and inactive choices without repairing them', () => {
    const { rows } = parsed(csv(
      line('10/21/2026 20:00:00', 'Four Times', 'four@example.test', [P, P, P, P]),
      line('10/21/2026 20:01:00', 'Blank Third', 'blank@example.test', [R, P, '', T]),
      line('10/21/2026 20:02:00', 'Two At Once', 'two@example.test', [`${R};${P}`, A, T, P]),
      line('10/21/2026 20:03:00', 'Old House', 'old@example.test', ['Fluttershy', R, P, A]),
      line('10/21/2026 20:04:00', 'Unknown', 'unknown@example.test', ['Spike (Parent Z)', R, P, A]),
    ));
    const review = buildPlacementReview(rows, profiles);
    const codes = (sourceRow: number) => review.applicants.find((row) => row.sourceRow === sourceRow)?.issues.map((issue) => issue.code);
    expect(codes(2)).toEqual(['repeated_choice', 'repeated_choice', 'repeated_choice', 'too_few_choices']);
    expect(codes(3)).toEqual(['missing_choice']);
    expect(codes(4)).toEqual(['ambiguous_first_choice']);
    expect(codes(5)).toEqual(['inactive_house']);
    expect(codes(6)).toEqual(['unknown_house']);
    expect(review.counts.invalid).toBe(5);
    expect(review.ready).toBe(false);
    expect(placementApplicants(review)).toEqual([]);
    expect(review.unresolvedLabels.map((label) => [label.label, label.kind])).toEqual([['Fluttershy', 'inactive'], ['Spike (Parent Z)', 'unknown']]);
  });

  it('lets an admin repair a ranking, keeping the applicant’s place in line', () => {
    const { rows } = parsed(csv(
      line('10/21/2026 20:00:00', 'Four Times', 'four@example.test', [P, P, P, P]),
      line('10/21/2026 20:10:00', 'Later', 'later@example.test', [P, R, A, T]),
    ));
    const review = buildPlacementReview(rows, profiles, {
      ...EMPTY_PLACEMENT_EDITS,
      corrections: { 'row-2': ['p-pinkie', 'p-rarity', 'p-apple', 'p-twilight'] },
    });
    expect(review.applicants[0]).toMatchObject({ status: 'valid', corrected: true });
    expect(review.ready).toBe(true);
    const applicants = placementApplicants(review);
    const result = allocateHouseApplicants({ houses: review.houses, capacities: { 'p-rarity': 1, 'p-pinkie': 1, 'p-apple': 0, 'p-twilight': 0 }, applicants });
    expect(result.ok && result.placements.map((placement) => [placement.applicantId, placement.houseId])).toEqual([['row-2', 'p-pinkie'], ['row-3', 'p-rarity']]);
  });

  it('re-validates a correction that still repeats a House', () => {
    const { rows } = parsed(csv(line('10/21/2026 20:00:00', 'Four Times', 'four@example.test', [P, P, P, P])));
    const review = buildPlacementReview(rows, profiles, { ...EMPTY_PLACEMENT_EDITS, corrections: { 'row-2': ['p-pinkie', 'p-pinkie', 'p-apple', null] } });
    expect(review.applicants[0].issues.map((issue) => issue.code)).toEqual(['missing_choice', 'repeated_choice']);
  });

  it('applies a House mapping, an exclusion with a reason, and an identity confirmation', () => {
    const { rows } = parsed(csv(
      line('10/21/2026 20:00:00', 'Unknown', 'unknown@example.test', ['Spike (Parent Z)', R, P, A]),
      line('', 'No Time', 'notime@example.test', [R, P, A, T]),
      line('10/21/2026 20:02:00', 'No Email', '', [R, P, A, T]),
    ));
    let review = buildPlacementReview(rows, profiles);
    expect(review.applicants.map((row) => row.issues[0]?.code)).toEqual(['unknown_house', 'missing_timestamp', 'missing_email']);
    expect(review.counts.missingTimestamps).toBe(1);
    review = buildPlacementReview(rows, profiles, {
      houseMappings: { 'spike parent z': 'p-twilight' },
      corrections: {},
      exclusions: { 'row-3': 'Submitted outside the form window' },
      confirmedIdentities: { 'row-4': true },
      rollbackChoices: {},
    });
    expect(review.applicants.map((row) => row.status)).toEqual(['valid', 'excluded', 'valid']);
    expect(review.applicants[1].exclusionReason).toBe('Submitted outside the form window');
    expect(review.ready).toBe(true);
  });

  it('promotes the next submission when the earliest one for an email is excluded', () => {
    const { rows } = parsed(csv(
      line('10/21/2026 20:00:00', 'An', 'an@example.test', [P, P, P, P]),
      line('10/21/2026 21:00:00', 'An', 'an@example.test', [R, P, A, T]),
    ));
    const review = buildPlacementReview(rows, profiles, { ...EMPTY_PLACEMENT_EDITS, exclusions: { 'row-2': 'Resubmitted to fix ranking' } });
    expect(review.applicants.map((row) => row.status)).toEqual(['excluded', 'valid']);
  });

  it('keeps chronological priority for unsorted timestamps and breaks ties by sheet row', () => {
    const { rows } = parsed(csv(
      line('10/21/2026 22:00:00', 'Third', 'c@example.test', [R, P, A, T]),
      line('10/21/2026 20:00:00', 'First', 'a@example.test', [R, P, A, T]),
      line('10/21/2026 20:00:00', 'Second', 'b@example.test', [R, P, A, T]),
    ));
    const review = buildPlacementReview(rows, profiles);
    const applicants = placementApplicants(review);
    const capacities = suggestCapacities(review.houses, applicants.length, firstChoiceDemand(review.houses, applicants));
    const result = allocateHouseApplicants({ houses: review.houses, capacities, applicants });
    expect(result.ok && result.placements.map((placement) => [placement.name, placement.houseId])).toEqual([
      ['First', 'p-rarity'],
      ['Second', 'p-pinkie'],
      ['Third', 'p-apple'],
    ]);
  });
});

describe('matchApplicantToMember', () => {
  const members: HouseImportMember[] = [
    { id: 'm-an', first_name: 'An', last_name: 'Example', college: null, year: null, house: null, email: 'an@example.test', points: 0, events_attended: 0 },
    { id: 'm-bao1', first_name: 'Bao', last_name: 'Tran', college: null, year: null, house: null, email: null, points: 0, events_attended: 0 },
    { id: 'm-bao2', first_name: 'Bao', last_name: 'Tran', college: null, year: null, house: null, email: null, points: 0, events_attended: 0 },
    { id: 'm-chi', first_name: 'Chi', last_name: 'Le', college: null, year: null, house: null, email: 'chi.personal@example.test', points: 0, events_attended: 0 },
    { id: 'm-dung', first_name: 'Dung', last_name: 'Pham', college: null, year: null, house: null, email: null, points: 0, events_attended: 0 },
    { id: 'm-shared1', first_name: 'Em', last_name: 'Vo', college: null, year: null, house: null, email: 'shared@example.test', points: 0, events_attended: 0 },
    { id: 'm-shared2', first_name: 'Em', last_name: 'Vo', college: null, year: null, house: null, email: 'shared@example.test', points: 0, events_attended: 0 },
  ];
  // Larger than PostgREST's 1,000-row page: matching must still see everyone.
  const directory = [
    ...Array.from({ length: 1500 }, (_, index): HouseImportMember => ({
      id: `m-filler-${index}`, first_name: `Filler${index}`, last_name: 'Person', college: null, year: null, house: null, email: `filler${index}@example.test`, points: 0, events_attended: 0,
    })),
    ...members,
  ];
  const index = buildPlacementMemberIndex(directory);

  it('matches by exact email first, then by a unique exact name', () => {
    expect(matchApplicantToMember({ name: 'Whoever', email: 'AN@example.test' }, index)).toMatchObject({ status: 'match', memberId: 'm-an', method: 'email' });
    expect(matchApplicantToMember({ name: 'dung  PHAM', email: 'dung@example.test' }, index)).toMatchObject({ status: 'match', memberId: 'm-dung', method: 'name' });
    expect(matchApplicantToMember({ name: 'Filler1499 Person', email: null }, index)).toMatchObject({ status: 'match', memberId: 'm-filler-1499' });
  });

  it('never picks between candidates and never guesses', () => {
    expect(matchApplicantToMember({ name: 'Bao Tran', email: 'bao@example.test' }, index)).toMatchObject({ status: 'review', memberId: null });
    expect(matchApplicantToMember({ name: 'Em Vo', email: 'shared@example.test' }, index)).toMatchObject({ status: 'review', memberId: null });
    expect(matchApplicantToMember({ name: 'Chi Le', email: 'chi@school.test' }, index)).toMatchObject({ status: 'review', memberId: 'm-chi' });
    expect(matchApplicantToMember({ name: 'An E. Example', email: null }, index)).toMatchObject({ status: 'review', memberId: 'm-an' });
    expect(matchApplicantToMember({ name: 'Nobody Known', email: 'nobody@example.test' }, index)).toMatchObject({ status: 'unmatched', memberId: null });
  });
});

describe('placement CSV export', () => {
  const row = (overrides: Partial<PlacementExportRow>): PlacementExportRow => ({
    priority: 1, name: 'An Example', houseId: 'p-rarity', house: 'Rarity', submitted: '10/21/2026 20:00:00',
    preferences: ['Rarity', 'Pinkie Pie', 'Applejack', 'Twilight Sparkle'], achievedRank: 1, placement: 'Automatic',
    overrideReason: '', memberMatch: 'Matched', exception: false, ...overrides,
  });

  it('neutralizes spreadsheet formulas in user-controlled text and quotes per RFC 4180', () => {
    const out = placementRosterCsv([row({ name: '=HYPERLINK("http://evil.test","x")' }), row({ priority: 2, name: '+SUM(A1)', overrideReason: 'Swap, "approved"' })]);
    const lines = out.trim().split('\n');
    expect(lines[0]).toBe('Priority,Name,Assigned House,Submitted (Pacific),1st choice,2nd choice,3rd choice,4th choice,Result,Placement,Override reason,Member match');
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
    expect(lines[2]).toContain(`'+SUM(A1)`);
    expect(lines[2]).toContain('"Swap, ""approved"""');
    expect(out).not.toMatch(/@example\.test/);
  });

  it('exports only the exception rows in the exception list', () => {
    const out = placementExceptionsCsv([row({}), row({ priority: 2, name: 'Needs Review', exception: true, memberMatch: 'Unmatched' })]);
    expect(out).toContain('Needs Review');
    expect(out).not.toContain('An Example');
  });
});

describe('2026-2027 My Little Pony Houses', () => {
  const mlp: PlacementProfile[] = [
    { id: 'p-twilight', house_key: 'twilight-sparkle', display_name: 'Twilight Sparkle', is_active: true, display_order: 0, parentNames: ['Timothy (Tim) Huynh', 'Kent Nguyen'] },
    { id: 'p-applejack', house_key: 'applejack', display_name: 'Applejack', is_active: true, display_order: 1, parentNames: ['Ryan Francisco', 'Nathan Centeno'] },
    { id: 'p-pinkie', house_key: 'pinkie-pie', display_name: 'Pinkie Pie', is_active: true, display_order: 2, parentNames: ['Ingyin Moh', 'Martin Dang'] },
    { id: 'p-rarity', house_key: 'rarity', display_name: 'Rarity', is_active: true, display_order: 3, parentNames: ['Kirsten Ngo', 'Jonas Truong'] },
    { id: 'p-bowser-2025', house_key: 'bowser', display_name: 'Bowser', is_active: false, display_order: 9 },
  ];

  it('recognizes every 2026 form option, including the form\u2019s "Pinky Pie" spelling via its House Parents', () => {
    expect(resolveHouseLabel('Twilight Sparkle (Kent & Tim)', mlp)).toEqual({ kind: 'resolved', profileId: 'p-twilight' });
    expect(resolveHouseLabel('Applejack (Ryan & Nathan)', mlp)).toEqual({ kind: 'resolved', profileId: 'p-applejack' });
    expect(resolveHouseLabel('Rarity (Kirsten & Jonas)', mlp)).toEqual({ kind: 'resolved', profileId: 'p-rarity' });
    expect(resolveHouseLabel('Pinkie Pie (Ingyin & Martin)', mlp)).toEqual({ kind: 'resolved', profileId: 'p-pinkie' });
    expect(resolveHouseLabel('Pinky Pie (Ingyin & Martin)', mlp)).toEqual({ kind: 'resolved', profileId: 'p-pinkie', viaParents: true });
    expect(resolveHouseLabel('Pinky Pie (Ingyin Moh and Martin Dang)', mlp)).toEqual({ kind: 'resolved', profileId: 'p-pinkie', viaParents: true });
  });

  it('never guesses: a misspelling without matching House Parents, or a name that contradicts its parents, needs review', () => {
    expect(resolveHouseLabel('Pinky Pie', mlp)).toEqual({ kind: 'unknown' });
    expect(resolveHouseLabel('Pinky Pie (Ingyin & Someone)', mlp)).toEqual({ kind: 'unknown' });
    expect(resolveHouseLabel('Pinky Pie (Ingyin & Martin)', mlp.map(({ parentNames, ...profile }) => profile))).toEqual({ kind: 'unknown' });
    expect(resolveHouseLabel('Rarity (Ingyin & Martin)', mlp)).toEqual({ kind: 'ambiguous', profileIds: ['p-rarity', 'p-pinkie'] });
    expect(resolveHouseLabel('Bowser', mlp)).toEqual({ kind: 'inactive', profileId: 'p-bowser-2025' });
  });

  it('lists options recognized by House Parents, and keeps a mapped option visible so it can be changed', () => {
    const { rows } = parsed(csv(
      line('10/21/2026 20:00:00', 'An', 'an@example.test', ['Pinky Pie (Ingyin & Martin)', 'Rarity (Kirsten & Jonas)', 'Applejack (Ryan & Nathan)', 'Twilight Sparkle (Kent & Tim)']),
      line('10/21/2026 20:01:00', 'Bao', 'bao@example.test', ['Rarity (Kirsten & Jonas)', 'Pinky Pie (Ingyin & Martin)', 'Applejack (Ryan & Nathan)', 'Sparkle']),
    ));
    const review = buildPlacementReview(rows, mlp);
    expect(review.houses.map((house) => house.label)).toEqual(['Twilight Sparkle', 'Applejack', 'Pinkie Pie', 'Rarity']);
    expect(review.parentResolvedLabels).toEqual([{ label: 'Pinky Pie (Ingyin & Martin)', profileId: 'p-pinkie', count: 2 }]);
    expect(review.applicants[0].status).toBe('valid');
    expect(review.applicants[1].issues.map((issue) => issue.code)).toEqual(['unknown_house']);
    const mapped = buildPlacementReview(rows, mlp, { ...EMPTY_PLACEMENT_EDITS, houseMappings: { sparkle: 'p-twilight' } });
    expect(mapped.ready).toBe(true);
    expect(mapped.unresolvedLabels.map((label) => label.label)).toEqual(['Sparkle']);
  });
});

describe('repeat submissions with an uncertain time', () => {
  it('does not set aside a timestamped resubmission while the same email has a row with no time', () => {
    const { rows } = parsed(csv(
      line('', 'An', 'an@example.test', [R, P, A, T]),
      line('10/21/2026 21:00:00', 'An', 'an@example.test', [P, R, A, T]),
    ));
    const review = buildPlacementReview(rows, profiles);
    expect(review.applicants.map((row) => row.status)).toEqual(['invalid', 'valid']);
    expect(review.applicants[0].issues.map((issue) => issue.code)).toEqual(['missing_timestamp', 'repeat_pending']);
    expect(review.ready).toBe(false);
    const excluded = buildPlacementReview(rows, profiles, { ...EMPTY_PLACEMENT_EDITS, exclusions: { 'row-2': 'No submission time' } });
    expect(excluded.applicants.map((row) => row.status)).toEqual(['excluded', 'valid']);
    expect(excluded.ready).toBe(true);
  });

  it('picks the earliest rollback-hour resubmission only after the admin says which hour each was', () => {
    // Real order: row 2 at 1:10 PST (09:10Z) is later than row 3 at 1:50 PDT (08:50Z).
    const { rows } = parsed(csv(
      line('11/1/2026 1:10:00', 'An', 'an@example.test', [R, P, A, T]),
      line('11/1/2026 1:50:00', 'An', 'an@example.test', [P, R, A, T]),
    ));
    const pending = buildPlacementReview(rows, profiles);
    expect(pending.applicants.every((row) => row.duplicateOf === null)).toBe(true);
    expect(pending.ready).toBe(false);
    const resolved = buildPlacementReview(rows, profiles, { ...EMPTY_PLACEMENT_EDITS, rollbackChoices: { 'row-2': 'second', 'row-3': 'first' } });
    expect(resolved.applicants.map((row) => [row.status, row.duplicateOf])).toEqual([['duplicate', 'row-3'], ['valid', null]]);
  });
});
