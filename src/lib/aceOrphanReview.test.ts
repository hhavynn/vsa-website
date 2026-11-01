import {
  buildOrphanCsv, littleState, ORPHAN_EXPORT_HEADERS, type AceOrphanReviewRow,
} from './aceOrphanReview';

// Fictional participants only; never ingest real applicant/contact data here.
const orphan = (overrides: Partial<AceOrphanReviewRow> = {}): AceOrphanReviewRow => ({
  participantId: 'participant-1',
  cycleId: 'synthetic-cycle-2026',
  cycleLabel: 'Fall 2026',
  displayName: 'Fictional Little',
  role: 'little',
  operationalStatus: 'eligible',
  littleOutcome: 'orphan',
  orphanFollowUp: 'to_contact',
  orphanContinues: true,
  pairingStatus: 'none',
  orphanReason: 'PRIVATE_REASON_NEVER_EXPORT',
  ...overrides,
});

describe('private ACE Little review states (#646)', () => {
  it('distinguishes unmatched, tentative, confirmed, orphan, declined and withdrawn', () => {
    expect(littleState(orphan({ littleOutcome: 'none' }))).toBe('not_yet_matched');
    expect(littleState(orphan({ littleOutcome: 'none', pairingStatus: 'tentative' })))
      .toBe('tentatively_matched');
    expect(littleState(orphan({ littleOutcome: 'none', pairingStatus: 'confirmed' })))
      .toBe('confirmed_pairing');
    expect(littleState(orphan())).toBe('orphan');
    expect(littleState(orphan({ littleOutcome: 'declined' }))).toBe('declined_withdrawn');
    expect(littleState(orphan({ operationalStatus: 'withdrawn' }))).toBe('declined_withdrawn');
  });

  it('keeps contradictory pairing/outcome or non-Little states explicitly reviewable', () => {
    expect(littleState(orphan({ pairingStatus: 'tentative' }))).toBe('needs_review');
    expect(littleState(orphan({ pairingStatus: 'confirmed' }))).toBe('needs_review');
    expect(littleState(orphan({ littleOutcome: 'declined', pairingStatus: 'confirmed' })))
      .toBe('needs_review');
    expect(littleState(orphan({ littleOutcome: 'none', operationalStatus: 'withdrawn', pairingStatus: 'confirmed' })))
      .toBe('needs_review');
    expect(littleState(orphan({ role: 'big' }))).toBe('needs_review');
    // A revoked pairing no longer makes an Orphan appear paired.
    expect(littleState(orphan({ pairingStatus: 'revoked' }))).toBe('orphan');
  });

  it('supports explicitly reassigning a former Orphan without inventing an ancestor', () => {
    const before = orphan();
    const after = orphan({ littleOutcome: 'none', pairingStatus: 'tentative' });
    expect(littleState(before)).toBe('orphan');
    expect(littleState(after)).toBe('tentatively_matched');
    expect(before.littleOutcome).toBe('orphan');
  });
});

describe('private, reviewed Orphan CSV (#646)', () => {
  it('exports only minimal fields in stable name order, leaving non-Orphans out', () => {
    const rows = [
      orphan({ participantId: 'b', displayName: 'Zia Fictional', orphanFollowUp: 'closed', orphanContinues: false }),
      orphan({ participantId: 'c', displayName: 'Not An Orphan', littleOutcome: 'none', pairingStatus: 'confirmed' }),
      orphan({ participantId: 'a', displayName: 'Ada Fictional', orphanFollowUp: 'contacted', orphanContinues: true }),
    ];
    const untouched = rows.map((r) => r.participantId);
    const csv = buildOrphanCsv(rows, 'synthetic-cycle-2026');
    expect(csv).toBe('\uFEFF' + ORPHAN_EXPORT_HEADERS.join(',') +
      '\nAda Fictional,Fall 2026,contacted,Yes\nZia Fictional,Fall 2026,closed,No\n');
    expect(rows.map((r) => r.participantId)).toEqual(untouched);
    expect(csv).not.toContain('PRIVATE_REASON_NEVER_EXPORT');
    expect(csv).not.toMatch(/participant-|member_id|email|answers|dob|gender/i);
  });

  it('neutralizes spreadsheet formula cells, quotes commas and preserves UTF-8 names', () => {
    const csv = buildOrphanCsv([
      orphan({ displayName: '=HYPERLINK("https://malicious.invalid","Click")', cycleLabel: '@external' }),
      orphan({ participantId: 'second', displayName: 'Nguyễn, Ánh', cycleLabel: 'Fall 2026' }),
    ], 'synthetic-cycle-2026');
    expect(csv).toContain('"\'=HYPERLINK(""https://malicious.invalid"",""Click"")"');
    expect(csv).toContain("'@external");
    expect(csv).toContain('"Nguyễn, Ánh"');
    expect(csv).not.toContain('PRIVATE_REASON_NEVER_EXPORT');
  });

  it('keeps a valid empty reviewed roster as a header only', () => {
    expect(buildOrphanCsv([orphan({ littleOutcome: 'none' })], 'synthetic-cycle-2026'))
      .toBe('\uFEFFName,Cycle,Follow-up,Continues\n');
  });

  it.each([
    ['a live confirmed pairing', { pairingStatus: 'confirmed' }],
    ['a live tentative pairing', { pairingStatus: 'tentative' }],
    ['a withdrawn Little', { operationalStatus: 'withdrawn' }],
    ['an ineligible Little', { operationalStatus: 'not_eligible' }],
    ['an unreviewed Little', { operationalStatus: 'pending_review' }],
    ['a Big marked Orphan', { role: 'big' }],
    ['a missing display name', { displayName: '  ' }],
    ['an unsupported follow-up code', { orphanFollowUp: 'sensitive notes' }],
    ['an unknown continuation field', { orphanContinues: null }],
  ] as const)('fails closed on %s rather than exporting partial sensitive data', (_label, fields) => {
    expect(() => buildOrphanCsv([
      orphan({ participantId: 'safe' }), orphan({ participantId: 'other', ...fields } as Partial<AceOrphanReviewRow>),
    ], 'synthetic-cycle-2026')).toThrow();
  });

  it('refuses duplicate identities and accidental mixed cycles', () => {
    expect(() => buildOrphanCsv([orphan(), orphan()], 'synthetic-cycle-2026'))
      .toThrow(/duplicate participant ID/);
    expect(() => buildOrphanCsv([orphan(), orphan({
      participantId: 'other', cycleId: 'synthetic-cycle-2025', cycleLabel: 'Fall 2025',
    })], 'synthetic-cycle-2026')).toThrow(/different ACE cycle/);
    expect(() => buildOrphanCsv([orphan()], '')).toThrow(/Select a reviewed ACE cycle/);
  });
});
