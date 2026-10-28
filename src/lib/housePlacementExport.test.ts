import {
  PlacementExportRow,
  draftMemberMatch,
  exportRowsFromDrafts,
  houseRosterCsv,
  placementExportFilename,
  placementNeedsReviewCsv,
  placementRosterCsv,
} from './housePlacementExport';
import { csvCell } from './adminImportReview';
import type { HouseAssignmentDraft } from './houseAssignmentDraft';

// Synthetic fixtures only — never real applicant data.
const HEADER = 'Priority,Sheet row,Applicant name,Linked member,Submitted (Pacific),Submitted (UTC),1st choice,2nd choice,3rd choice,4th choice,Generated House,Assigned House,Achieved rank,Placement,Override reason,Member match,Needs review,Review reason,Draft row ID';

const row = (overrides: Partial<PlacementExportRow>): PlacementExportRow => ({
  priority: 1,
  sheetRow: 2,
  applicantName: 'An Example',
  linkedMember: 'An Example',
  submittedPacific: '10/21/2026 20:00:00',
  submittedUtc: '2026-10-22T03:00:00.000Z',
  preferences: ['Rarity', 'Pinkie Pie', 'Applejack', 'Twilight Sparkle'],
  generatedHouseId: 'p-rarity',
  generatedHouse: 'Rarity',
  houseId: 'p-rarity',
  house: 'Rarity',
  achievedRank: 1,
  placement: 'Automatic',
  overrideReason: '',
  memberMatch: 'Matched',
  reviewReasons: [],
  draftRowId: 'd-1',
  ...overrides,
});

function lines(csv: string) {
  return csv.trim().split('\n');
}

describe('csvCell', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+SUM(A1)', "'+SUM(A1)"],
    ['-2+3', "'-2+3"],
    ['@cmd', "'@cmd"],
    ['  =HYPERLINK("x")', `"'  =HYPERLINK(""x"")"`],
    ['\t=1', "'\t=1"],
    ['\r=1', `"'\r=1"`],
    ['plain', 'plain'],
    ['a, b', '"a, b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    ['', ''],
  ])('escapes %j as %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });
});

describe('placement exports', () => {
  it('writes the documented header and sorts by priority, not by name or input order', () => {
    const out = placementRosterCsv([
      row({ priority: 3, applicantName: 'Aaron First Alphabetically', draftRowId: 'd-3' }),
      row({ priority: 1, applicantName: 'Zed Last Alphabetically' }),
      row({ priority: 2, applicantName: 'Mai Middle', draftRowId: 'd-2' }),
    ]);
    const [header, ...body] = lines(out);
    expect(header).toBe(HEADER);
    expect(body.map((line) => line.split(',')[2])).toEqual(['Zed Last Alphabetically', 'Mai Middle', 'Aaron First Alphabetically']);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('defuses formulas and keeps RFC 4180 quoting in every user-controlled cell', () => {
    const out = placementRosterCsv([
      row({ applicantName: '=HYPERLINK("http://evil.test","x")', overrideReason: '@SUM(1)', linkedMember: '+1', placement: 'Manual override' }),
      row({ priority: 2, applicantName: '-cmd|calc', overrideReason: 'Swap, "approved"\nby the board' }),
    ]);
    expect(out).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
    expect(out).toContain(",'+1,");
    expect(out).toContain(",'@SUM(1),");
    expect(out).toContain(",'-cmd|calc,");
    expect(out).toContain('"Swap, ""approved""\nby the board"');
    // No unescaped formula starts a cell anywhere in the file.
    expect(out).not.toMatch(/(^|,)[=+@]/m);
  });

  it('adds choice columns past four only when a row has more', () => {
    const out = placementRosterCsv([row({ preferences: ['A', 'B', 'C', 'D', 'E'] })]);
    expect(lines(out)[0]).toContain('4th choice,5th choice,Generated House');
  });

  it('exports one House’s rows, still in priority order and with the same columns', () => {
    const rows = [
      row({ priority: 2, applicantName: 'Second Rarity', draftRowId: 'd-2' }),
      row({ priority: 1, applicantName: 'Pinkie Person', houseId: 'p-pinkie', house: 'Pinkie Pie' }),
      row({ priority: 3, applicantName: 'Third Rarity', draftRowId: 'd-3' }),
    ];
    const [header, ...body] = lines(houseRosterCsv(rows, 'p-rarity'));
    expect(header).toBe(HEADER);
    expect(body.map((line) => line.split(',')[2])).toEqual(['Second Rarity', 'Third Rarity']);
  });

  it('exports only rows that need review, with their reasons', () => {
    const out = placementNeedsReviewCsv([
      row({}),
      row({ priority: 2, applicantName: 'Needs Review', linkedMember: '', memberMatch: 'Unmatched', reviewReasons: ['No linked member', 'Manual override'] }),
    ]);
    expect(out).toContain('Needs Review');
    expect(out).toContain(',Yes,No linked member; Manual override,');
    expect(out).not.toContain('An Example');
  });

  it('names files by academic year and kind', () => {
    expect(placementExportFilename(2026, { kind: 'full' })).toBe('vsa-house-placement-2026-2027-full-roster.csv');
    expect(placementExportFilename(2026, { kind: 'house', houseLabel: 'Pinkie Pie' })).toBe('vsa-house-placement-2026-2027-pinkie-pie-roster.csv');
    expect(placementExportFilename(2026, { kind: 'review' })).toBe('vsa-house-placement-2026-2027-needs-review.csv');
    expect(placementExportFilename(2026, { kind: 'full' }, true)).toBe('vsa-house-placement-2026-2027-preview-full-roster.csv');
    expect(placementExportFilename(2026, { kind: 'house', houseLabel: '../Twilight Sparkle!' })).toBe('vsa-house-placement-2026-2027-twilight-sparkle-roster.csv');
  });
});

describe('exportRowsFromDrafts', () => {
  const draft = (overrides: Partial<HouseAssignmentDraft>): HouseAssignmentDraft => ({
    id: 'd-1',
    batch_id: 'b-1', applicant_id: null,
    created_at: '2026-10-27T00:00:00Z',
    updated_at: '2026-10-27T00:00:00Z',
    source_name: 'An Example',
    source_house: null,
    source_order: 0,
    source_row_number: 2,
    submission_timestamp: '2026-10-22T03:00:00.000Z',
    preferences: ['p-rarity', 'p-pinkie', 'p-apple', 'p-twilight'],
    generated_house_profile_id: 'p-rarity',
    house_profile_id: 'p-rarity',
    override_reason: null,
    member_id: 'm-1',
    match_status: 'match',
    match_method: 'email',
    match_score: null,
    notes: 'an@example.test 555-0100',
    ...overrides,
  });
  const labels: Record<string, string> = { 'p-rarity': 'Rarity', 'p-pinkie': 'Pinkie Pie', 'p-apple': 'Applejack', 'p-twilight': 'Twilight Sparkle' };
  const lookups = { houseLabel: (id: string) => labels[id] ?? null, memberName: (id: string) => (id === 'm-1' ? 'An Member' : null) };

  it('keeps the generated House next to an overridden one and explains the override', () => {
    const [automatic, overridden] = exportRowsFromDrafts([
      draft({ id: 'd-2', source_order: 1, source_name: 'Bao', house_profile_id: 'p-pinkie', override_reason: 'Approved swap' }),
      draft({}),
    ], lookups);
    expect(automatic).toMatchObject({ priority: 1, generatedHouse: 'Rarity', house: 'Rarity', achievedRank: 1, placement: 'Automatic', overrideReason: '', reviewReasons: [] });
    expect(overridden).toMatchObject({ priority: 2, generatedHouse: 'Rarity', house: 'Pinkie Pie', achievedRank: 2, placement: 'Manual override', overrideReason: 'Approved swap', draftRowId: 'd-2' });
    expect(overridden.reviewReasons).toEqual(['Manual override']);
  });

  it('drops a stale override reason once the row is back in its generated House', () => {
    const [row1] = exportRowsFromDrafts([draft({ override_reason: 'old reason' })], lookups);
    expect(row1).toMatchObject({ placement: 'Automatic', overrideReason: '' });
  });

  it('flags unmatched, review and unassigned rows and an assignment outside the ranking', () => {
    const rows = exportRowsFromDrafts([
      draft({ id: 'a', source_order: 0, member_id: null, match_status: 'unmatched' }),
      draft({ id: 'b', source_order: 1, member_id: null, match_status: 'review' }),
      draft({ id: 'c', source_order: 2, house_profile_id: null }),
      draft({ id: 'd', source_order: 3, house_profile_id: 'p-other', generated_house_profile_id: 'p-other', preferences: ['p-rarity'] }),
    ], lookups);
    expect(rows.map((item) => item.reviewReasons)).toEqual([
      ['No linked member'],
      ['Member match needs review'],
      ['Manual override', 'No House assigned'],
      ['Assigned House not in their ranking'],
    ]);
    expect(rows[2].house).toBe('Unassigned');
    expect(rows[3].house).toBe('Unknown House');
  });

  it('formats both timestamps and never carries emails, phones or notes into the CSV', () => {
    const rows = exportRowsFromDrafts([draft({})], lookups);
    expect(rows[0]).toMatchObject({ submittedUtc: '2026-10-22T03:00:00.000Z', linkedMember: 'An Member', applicantName: 'An Example' });
    expect(rows[0].submittedPacific).toMatch(/10\/21\/2026/);
    const csv = placementRosterCsv(rows);
    expect(csv).not.toMatch(/@example\.test|555-0100/);
  });

  it('maps member match status', () => {
    expect(draftMemberMatch({ member_id: 'm', match_status: 'manual' })).toBe('Matched');
    expect(draftMemberMatch({ member_id: null, match_status: 'match' })).toBe('Unmatched');
    expect(draftMemberMatch({ member_id: 'm', match_status: 'review' })).toBe('Needs review');
  });
});
