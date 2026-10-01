import { buildMemberNameIndex, toMemberOption } from './memberLinkMatching';
import { suggestMemberLink } from './memberLinkSuggestion';

const index = buildMemberNameIndex([
  toMemberOption({ id: 'm-a', first_name: 'Amy', last_name: 'Tran', college: 'Muir', year: 'Second Year' }),
  toMemberOption({ id: 'm-k1', first_name: 'Kevin', last_name: 'Le', college: 'Warren', year: 'First Year' }),
  toMemberOption({ id: 'm-k2', first_name: 'Kevin', last_name: 'Le', college: 'Revelle', year: 'Third Year' }),
]);

describe('suggestMemberLink', () => {
  it('recommends one exact, unclaimed match', () => {
    expect(suggestMemberLink('amy tran', null, index, new Set())).toMatchObject({ kind: 'recommended', members: [{ id: 'm-a' }] });
  });

  it('asks for review when the name is ambiguous, listing every candidate', () => {
    const suggestion = suggestMemberLink('Kevin Le', null, index, new Set());
    expect(suggestion?.kind).toBe('review');
    expect(suggestion?.members.map((m) => m.id).sort()).toEqual(['m-k1', 'm-k2']);
  });

  it('asks for review when the member is already linked elsewhere', () => {
    expect(suggestMemberLink('Amy Tran', null, index, new Set(['m-a']))).toMatchObject({ kind: 'review', note: expect.stringMatching(/already linked/) });
  });

  it('offers nothing for an unknown name, a near-miss, an empty name, or an already linked row', () => {
    expect(suggestMemberLink('Zed Unknown', null, index, new Set())).toBeNull();
    expect(suggestMemberLink('Amy Tren', null, index, new Set())).toBeNull();
    expect(suggestMemberLink('  ', null, index, new Set())).toBeNull();
    expect(suggestMemberLink('Amy Tran', 'm-a', index, new Set())).toBeNull();
  });
});
