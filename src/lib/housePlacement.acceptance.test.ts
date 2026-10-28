// Acceptance test for the 2026–27 House Applications import, end to end in pure
// code: parse → validate → correct → allocate → draft rows → Google Sheets
// exports. The fixture is SYNTHETIC. It mirrors only the shape of the owner's
// importer test file (159 submissions, 158 unique emails, one repeat at sheet
// rows 14 and 82, invalid rankings at rows 29, 45, 104 and 157, the form's
// "Pinky Pie" spelling); every name, email and answer below is made up.
import {
  EMPTY_PLACEMENT_EDITS,
  PlacementProfile,
  buildPlacementReview,
  parsePlacementCsv,
  placementApplicants,
} from './housePlacementImport';
import { allocateHouseApplicants, firstChoiceDemand, suggestCapacities } from './housePlacement';
import {
  exportRowsFromDrafts,
  houseRosterCsv,
  placementNeedsReviewCsv,
  placementRosterCsv,
} from './housePlacementExport';
import type { HouseAssignmentDraft } from './houseAssignmentDraft';

const profiles: PlacementProfile[] = [
  { id: 'p-twilight', house_key: 'twilight-sparkle', display_name: 'Twilight Sparkle', is_active: true, display_order: 0, parentNames: ['Timothy (Tim) Huynh', 'Kent Nguyen'] },
  { id: 'p-applejack', house_key: 'applejack', display_name: 'Applejack', is_active: true, display_order: 1, parentNames: ['Ryan Francisco', 'Nathan Centeno'] },
  { id: 'p-pinkie', house_key: 'pinkie-pie', display_name: 'Pinkie Pie', is_active: true, display_order: 2, parentNames: ['Ingyin Moh', 'Martin Dang'] },
  { id: 'p-rarity', house_key: 'rarity', display_name: 'Rarity', is_active: true, display_order: 3, parentNames: ['Kirsten Ngo', 'Jonas Truong'] },
  { id: 'p-bowser-2025', house_key: 'bowser', display_name: 'Bowser', is_active: false, display_order: 9 },
];
const FORM = {
  t: 'Twilight Sparkle (Kent & Tim)',
  a: 'Applejack (Ryan & Nathan)',
  p: 'Pinky Pie (Ingyin & Martin)',
  r: 'Rarity (Kirsten & Jonas)',
};
const ID = { t: 'p-twilight', a: 'p-applejack', p: 'p-pinkie', r: 'p-rarity' };
type Key = keyof typeof FORM;
const ORDERS: Key[][] = [['p', 'r', 'a', 't'], ['r', 'p', 't', 'a'], ['a', 't', 'p', 'r'], ['t', 'a', 'r', 'p'], ['p', 'a', 'r', 't']];

const HEADER = [
  'Timestamp', 'Phone Number', '"Name (First, Middle Initial, Last)"', 'Date of Birth', 'Email', 'Food allergies?',
  'House Rank [First Choice ]', 'House Rank [Second Choice ]', 'House Rank [Third Choice ]', 'House Rank [Forth Choice ]',
  'Tell us about yourself',
].join(',');

const SUBMISSIONS = 159;
const DUPLICATE = { first: 14, repeat: 82 };
const INVALID = [29, 45, 104, 157];

/** Sheet row n (row 1 is the header) → its synthetic choices. */
function choicesFor(sheetRow: number): string[] {
  const order = ORDERS[sheetRow % ORDERS.length].map((key) => FORM[key]);
  if (sheetRow === 29) return [FORM.r, FORM.r, FORM.a, FORM.t]; // a House ranked twice
  if (sheetRow === 45) return [FORM.p, '', FORM.a, FORM.t]; // a blank rank
  if (sheetRow === 104) return [FORM.a, FORM.t, FORM.a, FORM.r]; // a House ranked twice
  if (sheetRow === 157) return [`${FORM.t}, ${FORM.r}`, FORM.a, FORM.p, FORM.r]; // two Houses in one rank
  return order;
}

function timestampFor(sheetRow: number) {
  const minutes = sheetRow - 2;
  const hour = 20 + Math.floor(minutes / 60);
  return `10/21/2026 ${hour}:${String(minutes % 60).padStart(2, '0')}:07`;
}

function buildCsv() {
  const lines = [HEADER];
  for (let sheetRow = 2; sheetRow <= SUBMISSIONS + 1; sheetRow += 1) {
    const person = sheetRow === DUPLICATE.repeat ? DUPLICATE.first : sheetRow;
    lines.push([
      timestampFor(sheetRow),
      '555-0100',
      `Applicant${person} Synthetic`,
      '1/1/2006',
      `applicant${person}@example.test`,
      '"peanuts, shellfish"',
      ...choicesFor(sheetRow).map((choice) => `"${choice}"`),
      '"=HYPERLINK(""http://evil.test"",""free boba"")"',
    ].join(','));
  }
  return lines.join('\n');
}

function parsedRows() {
  const result = parsePlacementCsv(buildCsv());
  if (!result.ok) throw new Error(result.error);
  return result.rows;
}

const CORRECTIONS = {
  'row-29': [ID.r, ID.p, ID.a, ID.t],
  'row-45': [ID.p, ID.r, ID.a, ID.t],
  'row-104': [ID.a, ID.t, ID.p, ID.r],
  'row-157': [ID.t, ID.a, ID.p, ID.r],
};

function placedDrafts(): HouseAssignmentDraft[] {
  const review = buildPlacementReview(parsedRows(), profiles, { ...EMPTY_PLACEMENT_EDITS, corrections: CORRECTIONS });
  const applicants = placementApplicants(review);
  const capacities = suggestCapacities(review.houses, applicants.length, firstChoiceDemand(review.houses, applicants));
  const result = allocateHouseApplicants({ houses: review.houses, capacities, applicants });
  if (!result.ok) throw new Error('allocation failed');
  const byId = new Map(applicants.map((applicant) => [applicant.id, applicant]));
  return result.placements.map((placement): HouseAssignmentDraft => {
    const applicant = byId.get(placement.applicantId);
    if (!applicant) throw new Error('missing applicant');
    return {
      id: `draft-${placement.applicantId}`,
      batch_id: 'batch-2026', applicant_id: null,
      created_at: '2026-10-27T00:00:00Z',
      updated_at: '2026-10-27T00:00:00Z',
      source_name: applicant.name,
      source_house: null,
      source_order: placement.priority - 1,
      source_row_number: applicant.sourceRow,
      submission_timestamp: new Date(applicant.submittedAtMs).toISOString(),
      preferences: [...applicant.preferences],
      generated_house_profile_id: placement.houseId,
      house_profile_id: placement.houseId,
      override_reason: null,
      member_id: null,
      match_status: 'unmatched',
      match_method: null,
      match_score: null,
      notes: null,
    };
  });
}

const houseLabel = (id: string) => profiles.find((profile) => profile.id === id)?.display_name ?? null;

describe('2026–27 House Applications acceptance (synthetic fixture)', () => {
  it('counts 159 submissions and 158 unique applicants, keeping the earlier of the repeat pair', () => {
    const review = buildPlacementReview(parsedRows(), profiles);
    expect(review.counts.submissions).toBe(159);
    expect(review.counts.unique).toBe(158);
    expect(review.counts.duplicates).toBe(1);
    const repeat = review.applicants.find((row) => row.sourceRow === DUPLICATE.repeat);
    expect(repeat).toMatchObject({ status: 'duplicate', duplicateOf: `row-${DUPLICATE.first}` });
    expect(review.applicants.find((row) => row.sourceRow === DUPLICATE.first)?.status).not.toBe('duplicate');
  });

  it('finds exactly the four Houses, resolving the form’s "Pinky Pie" option to Pinkie Pie', () => {
    const review = buildPlacementReview(parsedRows(), profiles);
    expect(review.houses.map((house) => house.label)).toEqual(['Twilight Sparkle', 'Applejack', 'Pinkie Pie', 'Rarity']);
    expect(review.parentResolvedLabels).toEqual([expect.objectContaining({ label: FORM.p, profileId: 'p-pinkie' })]);
    expect(review.unresolvedLabels).toEqual([]);
  });

  it('blocks placement on the malformed rankings at rows 29, 45, 104 and 157', () => {
    const review = buildPlacementReview(parsedRows(), profiles);
    expect(review.applicants.filter((row) => row.status === 'invalid').map((row) => row.sourceRow)).toEqual(INVALID);
    expect(review.counts.invalid).toBe(4);
    const codes = (sheetRow: number) => review.applicants.find((row) => row.sourceRow === sheetRow)?.issues.map((issue) => issue.code);
    expect(codes(29)).toContain('repeated_choice');
    expect(codes(45)).toContain('missing_choice');
    expect(codes(104)).toContain('repeated_choice');
    expect(codes(157)).toContain('ambiguous_first_choice');
    expect(review.ready).toBe(false);
  });

  it('accepts admin corrections and keeps each corrected applicant’s place in line', () => {
    const review = buildPlacementReview(parsedRows(), profiles, { ...EMPTY_PLACEMENT_EDITS, corrections: CORRECTIONS });
    expect(review.ready).toBe(true);
    const applicants = placementApplicants(review);
    expect(applicants).toHaveLength(158);
    const capacities = suggestCapacities(review.houses, applicants.length, firstChoiceDemand(review.houses, applicants));
    expect(Object.values(capacities).reduce((sum, value) => sum + value, 0)).toBe(158);
    const result = allocateHouseApplicants({ houses: review.houses, capacities, applicants });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const priorityOf = (sheetRow: number) => result.placements.find((placement) => placement.applicantId === `row-${sheetRow}`)?.priority;
    // Sheet row n is the (n − 1)th submission; the repeat at row 82 is later than all four.
    expect(INVALID.filter((row) => row < DUPLICATE.repeat).map(priorityOf)).toEqual([28, 44]);
    expect(INVALID.filter((row) => row > DUPLICATE.repeat).map(priorityOf)).toEqual([102, 155]);
    expect(priorityOf(DUPLICATE.first)).toBe(13);
    expect(priorityOf(DUPLICATE.repeat)).toBeUndefined();
    for (const house of review.houses) expect(result.houseCounts[house.id]).toBe(capacities[house.id]);
  });

  it('exports every placed applicant in priority order with no contact details or other answers', () => {
    const rows = exportRowsFromDrafts(placedDrafts(), { houseLabel, memberName: () => null });
    const roster = placementRosterCsv(rows);
    const lines = roster.trim().split('\n');
    expect(lines).toHaveLength(159); // header + 158
    expect(lines[1].startsWith('1,2,Applicant2 Synthetic,')).toBe(true);
    expect(lines[158].startsWith('158,160,Applicant160 Synthetic,')).toBe(true);
    expect(roster).not.toMatch(/@example\.test|555-0100|1\/1\/2006|peanuts|HYPERLINK|boba/);
    expect(roster).toContain('Pinkie Pie');
    expect(roster).not.toContain('Pinky Pie');

    const perHouse = profiles.filter((profile) => profile.is_active).map((profile) => houseRosterCsv(rows, profile.id).trim().split('\n').length - 1);
    expect(perHouse.reduce((sum, count) => sum + count, 0)).toBe(158);
  });

  it('reflects a draft edit in the exports: assigned vs generated House, override reason and review list', () => {
    const drafts = placedDrafts();
    const target = drafts[0];
    const other = profiles.find((profile) => profile.is_active && profile.id !== target.house_profile_id)?.id as string;
    const edited = drafts.map((row) => (row.id === target.id ? { ...row, house_profile_id: other, override_reason: 'Approved swap, "sibling" request' } : row));
    const rows = exportRowsFromDrafts(edited, { houseLabel, memberName: () => null });
    const first = rows[0];
    expect(first).toMatchObject({
      generatedHouse: houseLabel(target.house_profile_id as string),
      house: houseLabel(other),
      placement: 'Manual override',
      overrideReason: 'Approved swap, "sibling" request',
      draftRowId: target.id,
    });
    expect(first.reviewReasons).toContain('Manual override');
    expect(placementNeedsReviewCsv(rows)).toContain('"Approved swap, ""sibling"" request"');
  });
});
