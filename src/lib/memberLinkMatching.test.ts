import {
  buildMemberNameIndex,
  findExactMemberMatch,
  normalizeMemberName,
  toMemberOption,
} from './memberLinkMatching';

const member = (id: string, first: string, last: string, college: string | null = null, year: string | null = null) =>
  toMemberOption({ id, first_name: first, last_name: last, college, year });

describe('normalizeMemberName', () => {
  it('ignores case, surrounding/extra whitespace, and Vietnamese diacritics', () => {
    expect(normalizeMemberName('  Nguyễn   Văn  ')).toBe('nguyen van');
    expect(normalizeMemberName('Đặng Thu')).toBe('dang thu');
    expect(normalizeMemberName('HAVYN nguyen')).toBe(normalizeMemberName('Havyn Nguyen'));
  });

  it('keeps middle initials and punctuation significant (no fuzzy matching)', () => {
    expect(normalizeMemberName('Tony Q Tran')).not.toBe(normalizeMemberName('Tony Tran'));
    expect(normalizeMemberName('Tommy Tran')).not.toBe(normalizeMemberName('Tommy Tram'));
  });

  it('treats empty input as empty', () => {
    expect(normalizeMemberName(null)).toBe('');
    expect(normalizeMemberName('   ')).toBe('');
  });
});

describe('toMemberOption', () => {
  it('formats a disambiguating label from public fields only', () => {
    expect(member('m1', 'Havyn', 'Nguyen', 'Sixth', 'Fourth Year').displayName).toBe(
      'Havyn Nguyen · Sixth · Fourth Year',
    );
    expect(member('m2', 'Andy', 'Tran').displayName).toBe('Andy Tran');
  });
});

describe('findExactMemberMatch', () => {
  const index = buildMemberNameIndex([
    member('tommy', 'Tommy', 'Tran', 'Sixth', 'Third Year'),
    member('andy-1', 'Andy', 'Tran', 'Seventh'),
    member('andy-2', 'Andy', 'Tran', 'Muir'),
    member('andy-3', 'andy', 'TRAN', 'Revelle'),
    member('blank', '', ''),
  ]);

  it('returns a unique match for exactly one exact normalized name', () => {
    expect(findExactMemberMatch('  tommy  TRAN ', index)).toEqual({
      kind: 'unique',
      member: expect.objectContaining({ id: 'tommy' }),
    });
  });

  it('never picks between several members with the same name', () => {
    const match = findExactMemberMatch('Andy Tran', index);
    expect(match.kind).toBe('ambiguous');
    expect(match.kind === 'ambiguous' && match.members.map((m) => m.id)).toEqual(['andy-1', 'andy-2', 'andy-3']);
  });

  it('returns none for unknown, near-miss, or empty names', () => {
    expect(findExactMemberMatch('Old Alumni Name', index)).toEqual({ kind: 'none' });
    expect(findExactMemberMatch('Tommy Trann', index)).toEqual({ kind: 'none' });
    expect(findExactMemberMatch('', index)).toEqual({ kind: 'none' });
  });
});
