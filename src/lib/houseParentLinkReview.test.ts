import { reviewHouseParents } from './houseParentLinkReview';
import type { HouseParentLink } from '../data/repos/houseParents';
import type { MemberOption } from './memberLinkMatching';

const member = (id: string, fullName: string): MemberOption => ({ id, fullName, displayName: fullName, college: null, year: null });
const parent = (id: string, profileId: string, displayName: string, memberId: string | null): HouseParentLink => ({
  id, house_profile_id: profileId, display_name: displayName, member_id: memberId,
  review_note: null, display_order: 0, created_at: '', updated_at: '',
  houseLabel: 'Fictional House', houseDisplayOrder: 0,
});

describe('admin House Parent identity review — synthetic records only', () => {
  it('recognizes a real year-linked parent, including a reviewed nickname display', () => {
    const records = [parent('p1', 'h1', 'Timothy (Tim) Huynh', 'm1')];
    expect(reviewHouseParents(records, [member('m1', 'Tim Huynh')])[0].state).toBe('linked');
  });
  it('separates ambiguous same-name unlinked rows from unmatched rows', () => {
    const records = [parent('p1', 'h1', 'Ada Example', null), parent('p2', 'h1', 'Cai Example', null)];
    const review = reviewHouseParents(records, [member('m1', 'Ada Example'), member('m2', 'Ada Example')]);
    expect(review.map((r) => r.state)).toEqual(['ambiguous', 'unlinked']);
    expect(review[0].candidateCount).toBe(2);
  });
  it('flags stale/deleted/merged member links and never substitutes a name match', () => {
    const records = [parent('p1', 'h1', 'Ada Example', 'deleted-id')];
    const review = reviewHouseParents(records, [member('m1', 'Ada Example')]);
    expect(review[0].state).toBe('duplicate-stale');
    expect(review[0].reason).toMatch(/not found/i);
  });
  it('flags a linked member whose published parent name differs', () => {
    const review = reviewHouseParents([parent('p1', 'h1', 'Ada Example', 'm1')], [member('m1', 'Other Person')]);
    expect(review[0].state).toBe('duplicate-stale');
    expect(review[0].reason).toMatch(/name differs/);
  });
  it('flags a single member linked to different Houses within the selected year', () => {
    const rows = [parent('p1', 'h1', 'Ada Example', 'm1'), parent('p2', 'h2', 'Ada Example', 'm1')];
    expect(reviewHouseParents(rows, [member('m1', 'Ada Example')]).map((r) => r.state)).toEqual(['duplicate-stale', 'duplicate-stale']);
  });
  it('does not forbid independent co-parents or repeated assignments within the same House', () => {
    const rows = [parent('p1', 'h1', 'Ada Example', 'm1'), parent('p2', 'h1', 'Ada Example', 'm1'), parent('p3', 'h1', 'Bea Sample', 'm2')];
    expect(reviewHouseParents(rows, [member('m1', 'Ada Example'), member('m2', 'Bea Sample')]).map((r) => r.state))
      .toEqual(['linked', 'linked', 'linked']);
  });
});
