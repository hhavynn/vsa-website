import type { CoverageDraft } from '../data/repos/houseAssignmentCoverage';
import type { MemberYearMembership } from './houseMembershipIntervals';
import { reviewPublishedHouseBatchCoverage, countHouseCoverage } from './houseAssignmentCoverage';

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
  expect(countHouseCoverage(items)).toEqual({linked:1,scheduled:1,needsReview:1,total:3});
});
it('flags duplicate canonical IDs and wrong, inactive or missing House records', () => {
  const rows=[row('1','one'),row('2','one'),row('3','two','hp2'),row('4','three',null),row('5','deleted')];
  expect(reviewPublishedHouseBatchCoverage(rows,profiles,memberIds,new Map(),date).map(i=>i.state))
    .toEqual(['duplicate-member','duplicate-member','invalid-house','invalid-house','missing-member']);
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
