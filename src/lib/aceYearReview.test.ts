import type { AceFamilyMember } from '../types';
import type { AcePickupEvidenceRow } from '../data/repos/aceFamilies';
import { pickupChangeWarnings, reviewFamilyYears } from './aceYearReview';

function node(id: string, fields: Partial<AceFamilyMember> = {}): AceFamilyMember {
  return {
    id,
    family_id: 'fictional-family',
    name: `Fictional ${id}`,
    role_label: 'Little',
    photo_url: null,
    parent_member_id: null,
    member_id: null,
    display_order: 0,
    is_published: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    pickup_academic_year_start: null,
    pickup_term: null,
    ...fields,
  };
}

function evidence(
  id: string,
  ace_member_id: string,
  fields: Partial<AcePickupEvidenceRow> = {},
): AcePickupEvidenceRow {
  return {
    id,
    ace_member_id,
    source_kind: 'workbook_year_row',
    source_label: 'Synthetic workbook',
    raw_value: 'FA23',
    candidate_academic_year_start: 2023,
    candidate_term: 'FA23',
    review_status: 'pending',
    reviewed_at: null,
    ...fields,
  };
}

describe('reviewFamilyYears — approved values and evidence (#673)', () => {
  it('leaves a missing year unknown, even when no parent can supply a date', () => {
    const p = node('p', { pickup_academic_year_start: 2021, pickup_term: 'FA21' });
    const a = node('a', { parent_member_id: p.id });
    const result = reviewFamilyYears([p, a], []);
    expect(result.get('p')).toEqual({ status: 'verified', flags: [] });
    expect(result.get('a')).toEqual({ status: 'unknown', flags: ['missing_year'] });
  });

  it('places unrelated-depth cousins in the same year without inferring a generation year', () => {
    const p = node('p', { pickup_academic_year_start: 2021, pickup_term: 'FA21' });
    const a = node('a', { parent_member_id: p.id, pickup_academic_year_start: 2022, pickup_term: 'FA22' });
    const b = node('b', { parent_member_id: p.id, pickup_academic_year_start: 2023, pickup_term: 'FA23' });
    const c = node('c', { parent_member_id: a.id, pickup_academic_year_start: 2023, pickup_term: 'FA23' });
    for (const review of reviewFamilyYears([p, a, b, c], []).values()) {
      expect(review).toEqual({ status: 'verified', flags: [] });
    }
  });

  it('warns on a Little with a year or term before the Big', () => {
    const big = node('big', { pickup_academic_year_start: 2023, pickup_term: 'SP24' });
    const little = node('little', {
      parent_member_id: big.id, pickup_academic_year_start: 2023, pickup_term: 'FA23',
    });
    expect(reviewFamilyYears([big, little], []).get(little.id)).toEqual({
      status: 'needs_review', flags: ['child_before_big'],
    });
  });

  it('warns on a same-term parent/child as an anomaly without changing either', () => {
    const big = node('big', { pickup_academic_year_start: 2023, pickup_term: 'FA23' });
    const little = node('little', {
      parent_member_id: big.id, pickup_academic_year_start: 2023, pickup_term: 'FA23',
    });
    const before = JSON.stringify([big, little]);
    expect(reviewFamilyYears([big, little], []).get(little.id)?.flags)
      .toEqual(['same_term_as_big']);
    expect(JSON.stringify([big, little])).toBe(before);
  });

  it('flags six-year gaps but not exactly five years, without faking a missing Big year', () => {
    const big = node('big', { pickup_academic_year_start: 2016, pickup_term: null });
    const five = node('five', { parent_member_id: big.id, pickup_academic_year_start: 2021 });
    const six = node('six', { parent_member_id: big.id, pickup_academic_year_start: 2022 });
    const unknownBig = node('unknown');
    const unplaced = node('child', {
      parent_member_id: unknownBig.id, pickup_academic_year_start: 2026,
    });
    const reviews = reviewFamilyYears([big, five, six, unknownBig, unplaced], []);
    expect(reviews.get('five')).toEqual({ status: 'verified', flags: [] });
    expect(reviews.get('six')).toEqual({ status: 'needs_review', flags: ['suspicious_gap'] });
    expect(reviews.get('child')).toEqual({ status: 'verified', flags: [] });
  });

  it('keeps same-name IDs separate and flags duplicate canonical links', () => {
    const a = node('a', { name: 'Lan Nguyen', member_id: 'canonical-a', pickup_academic_year_start: 2021 });
    const b = node('b', { name: 'Lân Nguyễn', member_id: 'canonical-b', pickup_academic_year_start: 2022 });
    const c = node('c', { name: 'Fictional Other', member_id: 'canonical-a', pickup_academic_year_start: 2023 });
    const results = reviewFamilyYears([a, b, c], []);
    expect(results.size).toBe(3);
    for (const id of ['a', 'b', 'c']) {
      expect(results.get(id)?.flags).toContain('duplicate_identity');
      expect(results.get(id)?.status).toBe('needs_review');
    }
  });

  it('shows pending evidence, source conflicts and compatible year-only evidence', () => {
    const a = node('a', { pickup_academic_year_start: 2023, pickup_term: 'FA23' });
    const b = node('b', { pickup_academic_year_start: 2023, pickup_term: null });
    const c = node('c', { pickup_academic_year_start: null, pickup_term: null });
    const records = [
      evidence('a-1', 'a', { candidate_academic_year_start: 2023, candidate_term: null }),
      evidence('b-1', 'b'),
      evidence('c-1', 'c'),
    ];
    const results = reviewFamilyYears([a, b, c], records);
    expect(results.get('a')).toEqual({ status: 'needs_review', flags: ['pending_evidence'] });
    expect(results.get('b')).toEqual({ status: 'needs_review', flags: ['pending_evidence'] });
    expect(results.get('c')).toEqual({ status: 'needs_review', flags: ['missing_year', 'pending_evidence'] });

    const conflicts = reviewFamilyYears([a], [
      evidence('a-2', 'a', { candidate_academic_year_start: 2022, candidate_term: 'FA22' }),
      evidence('a-3', 'a', { candidate_academic_year_start: 2023, candidate_term: 'SP24', review_status: 'approved' }),
    ]);
    expect(conflicts.get('a')?.flags).toEqual(['pending_evidence', 'evidence_conflict']);
  });

  it('ignores rejected, superseded, and other-family evidence rows', () => {
    const a = node('a', { pickup_academic_year_start: 2023, pickup_term: 'FA23' });
    const results = reviewFamilyYears([a], [
      evidence('old', 'a', { review_status: 'superseded', candidate_academic_year_start: 2021 }),
      evidence('rejected', 'a', { review_status: 'rejected', candidate_academic_year_start: 2022 }),
      evidence('other', 'other-family-node'),
    ]);
    expect(results.get('a')).toEqual({ status: 'verified', flags: [] });
  });

  it('retains unpublished and archived family nodes in private review without writing', () => {
    const past = node('past', {
      family_id: 'fictional-archived-family', is_published: false,
      pickup_academic_year_start: 1998, pickup_term: 'FA98',
    });
    expect(reviewFamilyYears([past], []).get('past')).toEqual({ status: 'verified', flags: [] });
  });
});

describe('pickupChangeWarnings — preview only (#673)', () => {
  it('checks both Big and Littles before a proposed move, without mutating lineage', () => {
    const big = node('big', { pickup_academic_year_start: 2023, pickup_term: 'SP24' });
    const selected = node('selected', {
      parent_member_id: big.id, pickup_academic_year_start: 2024, pickup_term: 'FA24',
    });
    const child = node('child', {
      parent_member_id: selected.id, pickup_academic_year_start: 2022, pickup_term: 'FA22',
    });
    const unrelated = node('other', { parent_member_id: 'other-id', pickup_academic_year_start: 2024 });
    const snapshot = JSON.stringify([big, selected, child, unrelated]);
    expect(pickupChangeWarnings(
      selected, { pickup_academic_year_start: 2023, pickup_term: 'FA23' },
      big, [child, unrelated],
    )).toEqual(['child_before_big']);
    expect(JSON.stringify([big, selected, child, unrelated])).toBe(snapshot);
  });

  it('keeps Unknown explicit and never borrows the Big year', () => {
    const big = node('big', { pickup_academic_year_start: 2022, pickup_term: 'FA22' });
    const selected = node('selected', { parent_member_id: big.id, pickup_academic_year_start: 2023 });
    expect(pickupChangeWarnings(
      selected, { pickup_academic_year_start: null, pickup_term: null }, big, [],
    )).toEqual(['missing_year']);
  });

  it('flags a future Little gap when moving the Big backward', () => {
    const big = node('big', { pickup_academic_year_start: 2020 });
    const child = node('child', { parent_member_id: big.id, pickup_academic_year_start: 2026 });
    expect(pickupChangeWarnings(
      big, { pickup_academic_year_start: 2020 }, null, [child],
    )).toEqual(['suspicious_gap']);
  });
});
