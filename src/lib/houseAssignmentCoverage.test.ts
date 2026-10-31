import type { CoverageDraft } from '../data/repos/houseAssignmentCoverage';
import type { MemberYearMembership } from './houseMembershipIntervals';
import { reviewPublishedHouseBatchCoverage, countHouseCoverage, reviewHouseBatchPopulation } from './houseAssignmentCoverage';

const row = (id: string, memberId: string | null, houseId: string | null = 'hp1', status = 'match'): CoverageDraft => ({
  id, member_id: memberId, house_profile_id: houseId, source_name: id, source_order: Number(id.replace(/\D/g,'') || '0'), match_status: status,
} as CoverageDraft);
const profiles = [
  { id: 'hp1', house_key: 'fictional', display_name: 'Fictional', is_active: true },
  { id: 'hp2', house_key: 'hidden', display_name: 'Other', is_active: false },
];
const memberIds = new Set(['one','two','three','four','five']);
const interval = (house: string, start='2026-10-01', end: string | null = null): MemberYearMembership =>
  ({id: house + start, house_profile_id: house, effective_start_date: start, effective_end_date: end});
const date='2026-10-29';
it('recognizes published current-year membership, future start and intentional unconfirmed draft rows', () => {
  const items=reviewPublishedHouseBatchCoverage([row('1','one'),row('2','two'),row('3',null)],
    profiles,memberIds,new Map([['one',[interval('hp1')]],['two',[interval('hp1','2026-11-01')]]]),date);
  expect(items.map(i=>i.state)).toEqual(['linked','scheduled','unconfirmed']);
  expect(countHouseCoverage(items)).toEqual({linked:1,scheduled:1,unassigned:0,needsReview:1,total:3});
});
it('flags duplicate canonical IDs and wrong, inactive or missing House records', () => {
  const rows=[row('1','one'),row('2','one'),row('3','two','hp2'),row('4','three',null),row('5','deleted')];
  expect(reviewPublishedHouseBatchCoverage(rows,profiles,memberIds,new Map(),date).map(i=>i.state))
    .toEqual(['duplicate-member','duplicate-member','invalid-house','unassigned','missing-member']);
});
it('detects overlapping intervals and different effective House, not just a cached members.house label', () => {
  const rows=[row('1','one'),row('2','two'),row('3','three'),row('4','four')];
  const membership = new Map([
    ['one',[interval('hp1'),interval('hp2')]],
    ['two',[interval('hp2')]],
    ['three',[interval('hp1','2026-09-01','2026-10-01')]],
    ['four',[]],
  ]);
  expect(reviewPublishedHouseBatchCoverage(rows,profiles,memberIds,membership,date).map(i=>i.state))
    .toEqual(['conflicting-membership','conflicting-membership','missing-membership','missing-membership']);
});
it('never counts an ambiguous review match as published even when the ID looks valid',()=>{
  expect(reviewPublishedHouseBatchCoverage([row('1','one','hp1','review')],profiles,memberIds,
    new Map([['one',[interval('hp1')]]]),date)[0].state).toBe('unconfirmed');
});


describe('eligible House population read-only review (#621)', () => {
  const approved = (id: string, member: string | null, status = 'paid') => ({
    id, source_name: 'Fictional Applicant ' + id, member_id: member,
    match_status: member ? 'match' : 'review', payment_status: status,
    withdrawn_reason: null as string | null,
  });
  const linked = (id: string, member: string, house: string | null = 'hp1', applicantId = id): CoverageDraft =>
    ({ ...row(id, member, house), applicant_id: applicantId, source_house: house ? 'fictional' : null } as CoverageDraft);
  const review = (
    applicants: ReturnType<typeof approved>[], rows: CoverageDraft[],
    memberships: ReadonlyMap<string, MemberYearMembership[]> = new Map(),
    revealed = false,
  ) => reviewHouseBatchPopulation({
    applicants, rows, profiles, memberIds,
    memberships, effectiveStartDate: '2026-10-29', onDate: date, revealed,
  });

  it('marks a confirmed no-House row as intentional unassigned, not an invalid House', () => {
    const r = { ...linked('1', 'one', null), source_house: null };
    expect(reviewPublishedHouseBatchCoverage([r], profiles, memberIds, new Map(), date)[0].state).toBe('unassigned');
    const tally = countHouseCoverage(reviewPublishedHouseBatchCoverage([r], profiles, memberIds, new Map(), date));
    expect(tally).toMatchObject({ unassigned: 1, needsReview: 0 });
  });

  it('excludes withdrawn and unpaid applicants without reporting them as unassigned', () => {
    const a = approved('A', 'one');
    const b = { ...approved('B', 'two'), withdrawn_reason: 'synthetic withdrawal' };
    const c = approved('C', 'three', 'unpaid');
    const d = approved('D', 'four', 'pending');
    const r = review([a,b,c,d], [linked('1','one','hp1','A')]);
    expect(r.results).toHaveLength(1);
    expect(r.excluded).toEqual({ withdrawn: 1, unpaid: 1, unresolved: 1 });
  });

  it('detects an eligible applicant missing from the batch and an unconfirmed canonical link', () => {
    const r = review([approved('A','one'),approved('B','two')],
      [linked('1','one','hp1','A'),{ ...linked('2','two','hp1','B'), match_status: 'review' }]);
    expect(r.results.map(x => x.state)).toEqual(['assigned','ambiguous-identity']);
    expect(review([approved('A','one')],[]).results[0].state).toBe('not-in-batch');
  });

  it('rejects two distinct eligible applicants linked to the same member even when names differ', () => {
    const r = review([approved('A','one'),approved('B','one')],
      [linked('1','one','hp1','A'),linked('2','one','hp1','B')]);
    expect(r.results.map(x => x.state)).toEqual(['duplicate-applicant','duplicate-applicant']);
  });

  it('flags duplicate rows for one eligible applicant before a false green placement, including on Reveal', () => {
    const original = linked('1','one','hp1','A');
    const duplicate = { ...linked('2','one','hp2','A'), source_order: 1 };
    const before = review([approved('A','one')], [original, duplicate]);
    expect(before.results).toHaveLength(1);
    expect(before.results[0]).toMatchObject({ applicantId: 'A', rowId: original.id, state: 'duplicate-batch-row' });
    expect(before.results[0].reason).toMatch(/multiple rows/);
    const after = review([approved('A','one')], [original, duplicate],
      new Map([['one', [interval('hp1')]]]), true);
    expect(after.results[0].state).toBe('duplicate-batch-row');
    expect(review([approved('A','one')], [original]).results[0].state).toBe('assigned');
  });

  it('flags conflicting future interval before Reveal and outside-batch membership', () => {
    const r = review([approved('A','one')], [linked('1','one','hp1','A')],
      new Map([['one',[interval('hp2','2026-10-29')]],['two',[interval('hp1')]]]));
    expect(r.results[0].state).toBe('conflicting-membership');
    expect(r.membershipsOutsideBatch).toEqual(['two']);
  });

  it('reads published status from dated membership rather than cached House', () => {
    const r = review([approved('A','one')],[linked('1','one','hp1','A')],
      new Map([['one',[interval('hp1','2026-11-01')]]]),true);
    expect(r.results[0].state).toBe('scheduled');
    expect(r.rowsNotEligible).toHaveLength(0);
    expect(review([approved('A','one')],[linked('1','two','hp1','B')]).rowsNotEligible).toHaveLength(1);
  });
  it('does not report an unassigned applicant as clean when a House interval is active', () => {
    const blank = { ...linked('1', 'one', null, 'A'), source_house: null };
    const history = new Map([['one', [interval('hp1', '2026-10-01')]]]);
    const published = reviewPublishedHouseBatchCoverage([blank], profiles, memberIds, history, date);
    expect(published[0].state).toBe('conflicting-membership');
    expect(countHouseCoverage(published)).toMatchObject({ unassigned: 0, needsReview: 1 });
    const population = review([approved('A', 'one')], [blank], history);
    expect(population.results[0]).toMatchObject({ state: 'conflicting-membership', rowId: '1' });
    expect(review([approved('A', 'one')], [blank], history, true).results[0].state)
      .toBe('conflicting-membership');
  });

  it('flags a future House interval instead of claiming the confirmed person has none', () => {
    const blank = { ...linked('1', 'one', null, 'A'), source_house: null };
    const upcoming = new Map([['one', [interval('hp1', '2026-11-10')]]]);
    expect(reviewPublishedHouseBatchCoverage([blank], profiles, memberIds, upcoming, date)[0].state)
      .toBe('conflicting-membership');
    expect(review([approved('A', 'one')], [blank], upcoming).results[0].state)
      .toBe('conflicting-membership');
  });

  it('allows real unassigned after a previous membership has ended on this date', () => {
    const blank = { ...linked('1', 'one', null, 'A'), source_house: null };
    const expired = new Map([['one', [interval('hp1', '2026-10-01', '2026-10-29')]]]);
    expect(reviewPublishedHouseBatchCoverage([blank], profiles, memberIds, expired, date)[0].state)
      .toBe('unassigned');
    expect(review([approved('A', 'one')], [blank], expired).results[0].state).toBe('unassigned');
  });

  it('never counts an unassigned row as valid if its canonical member is absent', () => {
    const blank = { ...linked('1', 'fictional-missing', null, 'A'), source_house: null };
    expect(reviewPublishedHouseBatchCoverage([blank], profiles, memberIds, new Map(), date)[0].state)
      .toBe('missing-member');
    expect(review([approved('A', 'fictional-missing')], [blank]).results[0].state)
      .toBe('missing-member');
  });

});
