import type { HouseAssignmentDraft } from './houseAssignmentDraft';
import {
  Placement,
  PlacementHouse,
  allocateHouseApplicants,
  firstChoiceDemand,
  suggestCapacities,
} from './housePlacement';
import {
  HouseApplicant,
  HousePaymentCycle,
  RerunMemberLink,
  applicantKey,
  applicantSetFingerprint,
  bulkStatusChanges,
  compareDrafts,
  comparisonCsv,
  cutoffReached,
  cutoffState,
  finalSortBlockers,
  isEligible,
  isoToPacificInput,
  pacificInputToIso,
  parseChecklistCsv,
  parseChecklistStatus,
  paymentChecklistCsv,
  paymentCounts,
  planChecklistImport,
  rerunApplicants,
  rerunDraftInsert,
  rerunMemberLink,
} from './housePayments';

const HOUSES: PlacementHouse[] = [
  { id: 'twilight', label: 'Twilight Sparkle', displayOrder: 0 },
  { id: 'applejack', label: 'Applejack', displayOrder: 1 },
  { id: 'pinkie', label: 'Pinkie Pie', displayOrder: 2 },
  { id: 'rarity', label: 'Rarity', displayOrder: 3 },
];
const ORDERS = [
  ['twilight', 'applejack', 'pinkie', 'rarity'],
  ['applejack', 'pinkie', 'rarity', 'twilight'],
  ['pinkie', 'rarity', 'twilight', 'applejack'],
  ['rarity', 'twilight', 'applejack', 'pinkie'],
];
const BASE_MS = Date.parse('2026-10-05T16:00:00Z');

function applicant(n: number, overrides: Partial<HouseApplicant> = {}): HouseApplicant {
  // Popularity skew: most people want Twilight first, so the sort is contested.
  const order = n % 5 === 0 ? ORDERS[1] : n % 7 === 0 ? ORDERS[2] : n % 11 === 0 ? ORDERS[3] : ORDERS[0];
  return {
    id: `app-${String(n).padStart(3, '0')}`,
    cycle_id: 'cycle-1',
    applicant_key: applicantKey(new Date(BASE_MS + n * 60_000).toISOString(), n + 1),
    source_name: `Fictional Applicant ${n}`,
    submission_timestamp: new Date(BASE_MS + n * 60_000).toISOString(),
    source_row_number: n + 1,
    preferences: order,
    member_id: `member-${n}`,
    match_status: 'match',
    match_method: 'email',
    payment_status: 'paid',
    payment_evidence: null,
    payment_reference: null,
    payment_note: null,
    payment_updated_by: null,
    payment_updated_at: null,
    withdrawn_reason: null,
    created_by: null,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    ...overrides,
  };
}

function draftRowsFrom(placements: readonly Placement[], applicants: readonly HouseApplicant[]): HouseAssignmentDraft[] {
  const byId = new Map(applicants.map((item) => [item.id, item]));
  return placements.map((placement) => {
    const source = byId.get(placement.applicantId) as HouseApplicant;
    const insert = rerunDraftInsert(placement, source, rerunMemberLink(source, undefined), null);
    return {
      ...insert,
      id: `draftA-${placement.applicantId}`,
      batch_id: 'batch-A',
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
    } as HouseAssignmentDraft;
  });
}

function sortCohort(applicants: readonly HouseApplicant[]) {
  const people = rerunApplicants(applicants);
  const capacities = suggestCapacities(HOUSES, people.length, firstChoiceDemand(HOUSES, people));
  const result = allocateHouseApplicants({ houses: HOUSES, capacities, applicants: people });
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('; '));
  return { people, capacities, result };
}

describe('payment eligibility', () => {
  it('never treats unknown payment as paid or unpaid, and separates provisional from final', () => {
    const unverified = applicant(1, { payment_status: 'unverified' });
    const pending = applicant(2, { payment_status: 'pending' });
    const unpaid = applicant(3, { payment_status: 'unpaid' });
    const waived = applicant(4, { payment_status: 'waived' });
    const withdrawn = applicant(5, { withdrawn_reason: 'Withdrew by email' });
    expect([unverified, pending, unpaid, waived, withdrawn].map((item) => isEligible(item, 'provisional'))).toEqual([true, true, false, true, false]);
    expect([unverified, pending, unpaid, waived, withdrawn].map((item) => isEligible(item, 'final'))).toEqual([false, false, false, true, false]);
    const counts = paymentCounts([unverified, pending, unpaid, waived, withdrawn, applicant(6)]);
    expect(counts).toMatchObject({ total: 6, unresolved: 2, unpaid: 1, waived: 1, paid: 1, withdrawn: 1, finalEligible: 2, provisionalEligible: 4 });
  });

  it('evaluates the cutoff in Pacific time across daylight saving', () => {
    // Fri Nov 6 2026 11:59 PM PST = Nov 7 07:59 UTC (DST ended Nov 1).
    const nov = pacificInputToIso('2026-11-06T23:59');
    expect(nov).toEqual({ ok: true, iso: '2026-11-07T07:59:00.000Z', ambiguous: false });
    // Fri Oct 30 2026 11:59 PM PDT = Oct 31 06:59 UTC.
    expect(pacificInputToIso('2026-10-30T23:59')).toMatchObject({ ok: true, iso: '2026-10-31T06:59:00.000Z' });
    // 1:30 AM on Nov 1 happens twice; the later (PST) instant gives the full hour.
    expect(pacificInputToIso('2026-11-01T01:30')).toMatchObject({ ok: true, iso: '2026-11-01T09:30:00.000Z', ambiguous: true });
    expect(pacificInputToIso('2027-03-14T02:30')).toMatchObject({ ok: false });
    expect(isoToPacificInput('2026-11-07T07:59:00.000Z')).toBe('2026-11-06T23:59');

    const cycle: Pick<HousePaymentCycle, 'payment_deadline' | 'grace_until' | 'cutoff_authorized_at' | 'cutoff_authorized_reason'> = {
      payment_deadline: '2026-11-07T07:59:00.000Z', grace_until: null, cutoff_authorized_at: null, cutoff_authorized_reason: null,
    };
    expect(cutoffState(cycle, Date.parse('2026-11-07T07:58:59Z')).kind).toBe('open');
    expect(cutoffReached(cutoffState(cycle, Date.parse('2026-11-07T07:59:00Z')))).toBe(true);
    const grace = { ...cycle, grace_until: '2026-11-08T07:59:00.000Z' };
    expect(cutoffState(grace, Date.parse('2026-11-07T12:00:00Z')).kind).toBe('grace');
    expect(cutoffReached(cutoffState({ ...cycle, payment_deadline: null }, Date.now()))).toBe(false);
    expect(cutoffState({ ...cycle, cutoff_authorized_at: '2026-11-01T00:00:00Z', cutoff_authorized_reason: 'All 80 confirmed early' }, 0).kind).toBe('authorized');
  });

  it('blocks a final sort until the cutoff passes and nobody is unresolved', () => {
    const open = cutoffState({ payment_deadline: '2099-01-01T00:00:00Z', grace_until: null, cutoff_authorized_at: null, cutoff_authorized_reason: null }, Date.now());
    const counts = paymentCounts([applicant(1), applicant(2, { payment_status: 'pending' })]);
    expect(finalSortBlockers(open, counts)).toHaveLength(2);
    expect(finalSortBlockers({ kind: 'passed', cutoffIso: '2026-01-01T00:00:00Z' }, paymentCounts([applicant(1)]))).toEqual([]);
  });

  it('builds bulk changes only for people whose status changes', () => {
    const people = [applicant(1), applicant(2, { payment_status: 'pending' }), applicant(3, { payment_status: 'unpaid' })];
    const { changes, unchanged } = bulkStatusChanges(people, new Set(['app-001', 'app-002', 'app-003']), 'unpaid', 'crc_confirmation');
    expect(unchanged).toBe(1);
    expect(changes.map((change) => change.applicant_id)).toEqual(['app-001', 'app-002']);
  });
});

describe('payment checklist import', () => {
  const roster = [
    applicant(1),
    applicant(2, { payment_status: 'unverified', source_name: 'Bao Tran', member_id: 'member-bao-a' }),
    applicant(3, { payment_status: 'unverified', source_name: 'Bao Tran', member_id: 'member-bao-b' }),
    applicant(4, { payment_status: 'waived' }),
    applicant(5, { payment_status: 'unverified', source_name: 'Linh Vo' }),
    applicant(6, { payment_status: 'pending' }),
  ];
  const membersByEmail = new Map([['bao.a@ucsd.edu', ['member-bao-a']]]);

  it('parses a Sheets export, recognizes statuses and refuses a file with no identifying column', () => {
    const parsed = parseChecklistCsv('﻿Name,Email,Paid?,Notes\n"Tran, Bao",BAO.A@ucsd.edu,yes,"Venmo, 10/29"\n');
    expect(parsed.ok && parsed.rows[0]).toMatchObject({ name: 'Tran, Bao', email: 'bao.a@ucsd.edu', rawStatus: 'yes', note: 'Venmo, 10/29' });
    expect(parseChecklistCsv('Amount,Method\n15,cash\n')).toMatchObject({ ok: false });
    expect(['Paid', 'no', '', 'comped', 'maybe'].map(parseChecklistStatus)).toEqual(['paid', 'unpaid', 'blank', 'waived', 'unknown']);
  });

  it('matches by application row or known email, only suggests by name, and keeps same-name people apart', () => {
    const parsed = parseChecklistCsv([
      'Application row,Name,Email,Status',
      '2,Fictional Applicant 1,,Paid',
      ',Bao Tran,bao.a@ucsd.edu,Paid',
      ',Bao Tran,,Paid',
      ',Linh Vo,,Paid',
      ',Nobody Here,,Paid',
      '5,Fictional Applicant 4,,Unpaid',
    ].join('\n'));
    if (!parsed.ok) throw new Error(parsed.error);
    const plan = planChecklistImport(parsed.rows, {
      applicants: roster, membersByEmail, mode: 'paid_roster', absentPolicy: 'unknown', confirmedSuggestions: {},
    });
    expect(plan.items.map((item) => item.outcome)).toEqual(['unchanged', 'change', 'ambiguous', 'suggested', 'unmatched', 'kept_waiver']);
    expect(plan.changes).toEqual([{ applicant_id: 'app-002', payment_status: 'paid', payment_evidence: 'payment_checklist' }]);
    expect(plan.absentToUnpaid).toEqual([]);
    expect(plan.blocked).toBe(false);

    const confirmed = planChecklistImport(parsed.rows, {
      applicants: roster, membersByEmail, mode: 'paid_roster', absentPolicy: 'unknown', confirmedSuggestions: { 5: 'app-005' },
    });
    expect(confirmed.changes.map((change) => change.applicant_id)).toEqual(['app-002', 'app-005']);
  });

  it('treats absence as Unknown unless Unpaid was explicitly chosen, and never downgrades a Paid person', () => {
    const parsed = parseChecklistCsv('Application row,Status\n3,paid\n');
    if (!parsed.ok) throw new Error(parsed.error);
    const unknown = planChecklistImport(parsed.rows, { applicants: roster, membersByEmail, mode: 'paid_roster', absentPolicy: 'unknown', confirmedSuggestions: {} });
    expect(unknown.absentToUnpaid).toEqual([]);
    const unpaid = planChecklistImport(parsed.rows, { applicants: roster, membersByEmail, mode: 'paid_roster', absentPolicy: 'unpaid', confirmedSuggestions: {} });
    expect(unpaid.absentToUnpaid.sort()).toEqual(['app-003', 'app-005', 'app-006']);
    expect(unpaid.paidButAbsent).toEqual(['app-001']);
    expect(unpaid.changes.filter((change) => change.payment_status === 'unpaid')).toHaveLength(3);
  });

  it('refuses "absent means Unpaid" while any listed row is unmatched, so a nickname never turns a payer Unpaid', () => {
    const parsed = parseChecklistCsv('Name,Status\nKathy Tran,paid\nFictional Applicant 1,paid\n');
    if (!parsed.ok) throw new Error(parsed.error);
    const roster = [applicant(1, { payment_status: 'unverified' }), applicant(2, { payment_status: 'unverified', source_name: 'Katherine Tran' })];
    const plan = planChecklistImport(parsed.rows, { applicants: roster, membersByEmail: new Map(), mode: 'paid_roster', absentPolicy: 'unpaid', confirmedSuggestions: {} });
    expect(plan.absentToUnpaid).toEqual(['app-002']);
    expect(plan.blocked).toBe(true);
    expect(plan.blockReasons.join(' ')).toMatch(/not matched to an applicant yet/);
    // With absence meaning Unknown, the same file can be applied for the rows that did match.
    const safe = planChecklistImport(parsed.rows, { applicants: roster, membersByEmail: new Map(), mode: 'paid_roster', absentPolicy: 'unknown', confirmedSuggestions: {} });
    expect(safe.blocked).toBe(false);
  });

  it('never reads a checklist\'s own "Row" numbering as the application row', () => {
    const parsed = parseChecklistCsv('Row,Name,Status\n1,Fictional Applicant 9,paid\n');
    expect(parsed.ok && parsed.columns.sheetRow).toBeNull();
  });

  it('counts a repeated row once and blocks on conflicting statuses', () => {
    const parsed = parseChecklistCsv('Application row,Status\n7,Unpaid\n7,unpaid\n3,paid\n3,unpaid\n');
    if (!parsed.ok) throw new Error(parsed.error);
    const plan = planChecklistImport(parsed.rows, { applicants: roster, membersByEmail, mode: 'unpaid_list', absentPolicy: 'unknown', confirmedSuggestions: {} });
    expect(plan.items.map((item) => item.outcome)).toEqual(['change', 'duplicate', 'conflict', 'conflict']);
    expect(plan.blocked).toBe(true);
  });

  it('exports a formula-safe admin checklist without payment details', () => {
    const csv = paymentChecklistCsv([applicant(1, { source_name: '=HYPERLINK("x")', payment_note: '+1 note' })], () => 'Linked Member');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'+1 note");
    expect(csv.split('\n')[0]).toBe('Application row,Applicant name,Linked member,Submitted (Pacific),Payment status,Evidence,Note,Status changed (Pacific),Withdrawn reason');
  });
});

describe('post-payment rerun and comparison', () => {
  it('reruns the #657 fixture: 8 applicants, 2 unpaid, capacities total 6, original order kept', () => {
    const eight = Array.from({ length: 8 }, (_, index) => applicant(index + 1, {
      preferences: ORDERS[index % 4],
      payment_status: index === 0 || index === 5 ? 'unpaid' : 'paid',
    }));
    const draftA = sortCohort(eight);
    expect(Object.values(draftA.capacities)).toEqual([2, 2, 2, 2]);
    const eligible = eight.filter((item) => isEligible(item, 'final'));
    const draftB = sortCohort(eligible);
    expect(Object.values(draftB.capacities).reduce((sum, value) => sum + value, 0)).toBe(6);
    expect(draftB.result.ok && draftB.result.placements.map((placement) => placement.applicantId)).toEqual(
      eligible.map((item) => item.id),
    );
    expect(draftB.result.ok && draftB.result.placements.some((placement) => placement.applicantId === 'app-001')).toBe(false);
  });

  it('acceptance: 100 applicants, 10 unpaid; Draft B frees spots by ORIGINAL priority and explains every move', () => {
    const unpaidIds = new Set([3, 8, 12, 19, 27, 33, 41, 58, 66, 90].map((n) => `app-${String(n).padStart(3, '0')}`));
    const everyone = Array.from({ length: 100 }, (_, index) => applicant(index + 1));
    // Draft A: provisional sort of all 100.
    const draftA = sortCohort(everyone);
    if (!draftA.result.ok) throw new Error('Draft A failed');
    const draftARows = draftRowsFrom(draftA.result.placements, everyone);
    const draftASnapshot = JSON.stringify(draftARows);

    // CRC marks 10 Unpaid; Draft B reruns the 90 eligible.
    const afterPayments = everyone.map((item) => (unpaidIds.has(item.id) ? { ...item, payment_status: 'unpaid' } : item));
    const eligible = afterPayments.filter((item) => isEligible(item, 'final'));
    expect(eligible).toHaveLength(90);
    const draftB = sortCohort(eligible);
    if (!draftB.result.ok) throw new Error('Draft B failed');
    expect(Object.values(draftB.capacities).reduce((sum, value) => sum + value, 0)).toBe(90);

    // Deterministic: same eligible set + capacities → identical result and fingerprint.
    const again = allocateHouseApplicants({ houses: HOUSES, capacities: draftB.capacities, applicants: [...draftB.people].reverse() });
    expect(again.ok && again.placements).toEqual(draftB.result.placements);
    expect(applicantSetFingerprint([...draftB.people].reverse(), draftB.capacities)).toBe(applicantSetFingerprint(draftB.people, draftB.capacities));
    expect(applicantSetFingerprint(draftA.people, draftA.capacities)).not.toBe(applicantSetFingerprint(draftB.people, draftB.capacities));

    // Priority is still submission order, never payment order.
    draftB.result.placements.forEach((placement, index) => {
      expect(placement.applicantId).toBe(eligible[index].id);
    });

    const links = new Map<string, RerunMemberLink>(eligible.map((item) => [item.id, rerunMemberLink(item, draftARows.find((row) => row.applicant_id === item.id))]));
    const comparison = compareDrafts({
      houses: HOUSES,
      before: { rows: draftARows, capacities: draftA.capacities },
      after: { placements: draftB.result.placements, capacities: draftB.capacities },
      applicants: afterPayments,
      linkByApplicant: links,
      mode: 'final',
    });
    expect(comparison.counts.removed_payment).toBe(10);
    expect(comparison.beforeTotal).toBe(100);
    expect(comparison.afterTotal).toBe(90);
    expect(comparison.entries.filter((entry) => entry.category === 'removed_payment').map((entry) => entry.applicantId).sort())
      .toEqual(Array.from(unpaidIds).sort());
    const moved = comparison.entries.filter((entry) => entry.category === 'moved_better' || entry.category === 'moved_worse');
    expect(comparison.counts.unchanged + moved.length + comparison.counts.removed_payment + comparison.counts.moved_other).toBe(100);
    expect(comparison.counts.moved_other).toBe(0);
    moved.forEach((entry) => {
      expect(entry.reason).toMatch(/turn came/);
      expect(entry.beforeHouseId).not.toBe(entry.afterHouseId);
    });
    // Twilight is the contested House: someone must move up into it once unpaid holders leave.
    const intoTwilight = moved.filter((entry) => entry.category === 'moved_better' && entry.afterHouseId === 'twilight');
    expect(intoTwilight.length).toBeGreaterThan(0);
    expect(intoTwilight[0].reason).toMatch(/no longer included/);
    comparison.houses.forEach((house) => {
      expect(house.afterCount).toBe(house.afterCapacity);
      expect(house.beforeCount).toBe(house.beforeCapacity);
    });
    expect(comparison.entries.every((entry) => !entry.needsIdentity)).toBe(true);
    // Draft A is untouched by everything above.
    expect(JSON.stringify(draftARows)).toBe(draftASnapshot);

    const csv = comparisonCsv(comparison, (id) => HOUSES.find((house) => house.id === id)?.label ?? '');
    expect(csv.trim().split('\n')).toHaveLength(101);
    expect(csv).not.toMatch(/@/);
  });

  it('a late payer reinstated before Reveal is placed by original time, not payment time', () => {
    const ten = Array.from({ length: 10 }, (_, index) => applicant(index + 1, { preferences: ORDERS[0] }));
    const withoutFirst = ten.filter((item) => item.id !== 'app-001');
    const draftB = sortCohort(withoutFirst);
    const reinstated = sortCohort(ten);
    if (!draftB.result.ok || !reinstated.result.ok) throw new Error('sort failed');
    const comparison = compareDrafts({
      houses: HOUSES,
      before: { rows: draftRowsFrom(draftB.result.placements, withoutFirst), capacities: draftB.capacities },
      after: { placements: reinstated.result.placements, capacities: reinstated.capacities },
      applicants: ten,
      linkByApplicant: new Map(ten.map((item) => [item.id, rerunMemberLink(item, undefined)])),
      mode: 'final',
    });
    const late = comparison.entries.find((entry) => entry.applicantId === 'app-001');
    expect(late).toMatchObject({ category: 'reinstated', afterPriority: 1, afterHouseId: 'twilight' });
  });

  it('keeps equal names as different people and flags unresolved identity', () => {
    const twins = [
      applicant(1, { source_name: 'Minh Nguyen', member_id: 'member-a' }),
      applicant(2, { source_name: 'Minh Nguyen', member_id: null, match_status: 'unmatched', match_method: null }),
    ];
    const { result, capacities } = sortCohort(twins);
    if (!result.ok) throw new Error('sort failed');
    const comparison = compareDrafts({
      houses: HOUSES,
      before: { rows: [], capacities: null },
      after: { placements: result.placements, capacities },
      applicants: twins,
      linkByApplicant: new Map(twins.map((item) => [item.id, rerunMemberLink(item, undefined)])),
      mode: 'final',
    });
    expect(comparison.entries.map((entry) => [entry.applicantId, entry.needsIdentity])).toEqual([['app-001', false], ['app-002', true]]);
  });

  it('keeps the application\'s confirmed member, and otherwise uses a link an admin confirmed in the source draft', () => {
    const guessed = applicant(1, { member_id: 'member-guess', match_status: 'review', match_method: 'name' });
    expect(rerunMemberLink(guessed, undefined)).toEqual({ memberId: 'member-guess', status: 'review', method: 'name' });
    expect(rerunMemberLink(guessed, { member_id: 'member-confirmed', match_status: 'manual', match_method: 'manual' }))
      .toEqual({ memberId: 'member-confirmed', status: 'manual', method: 'manual' });
    // A wrong pick in the source draft never overrides the application's confirmed member.
    const confirmed = applicant(2, { member_id: 'member-2', match_status: 'match', match_method: 'email' });
    expect(rerunMemberLink(confirmed, { member_id: 'member-7', match_status: 'manual', match_method: 'manual' }))
      .toEqual({ memberId: 'member-2', status: 'match', method: 'email' });
  });
});
