import { memberLookupRepository } from './memberLookup';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const row = (id: string, first: string, last: string) => ({ id, first_name: first, last_name: last, college: 'Sixth', year: 'Fourth Year' });

it('searches only the public_members projection, never raw members or email', async () => {
  supabaseMock.setDefault('public_members', { data: [row('m1', 'Havyn', 'Nguyen')], error: null });
  await expect(memberLookupRepository.searchMembers('Havyn Nguyen')).resolves.toEqual([
    expect.objectContaining({ id: 'm1', displayName: 'Havyn Nguyen · Sixth · Fourth Year' }),
  ]);
  const [query] = supabaseMock.queriesFor('public_members');
  expect(query.calls).toContainEqual({ method: 'select', args: ['id, first_name, last_name, college, year'] });
  expect(query.calls).toContainEqual({ method: 'ilike', args: ['first_name', '%Havyn%'] });
  expect(query.calls).toContainEqual({ method: 'ilike', args: ['last_name', '%Nguyen%'] });
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('strips PostgREST filter metacharacters from single-word searches', async () => {
  supabaseMock.setDefault('public_members', { data: [], error: null });
  await memberLookupRepository.searchMembers('ngu(),%*');
  const [query] = supabaseMock.queriesFor('public_members');
  expect(query.calls).toContainEqual({ method: 'or', args: ['first_name.ilike.%ngu%,last_name.ilike.%ngu%'] });
});

it('skips the query for searches under two characters', async () => {
  await expect(memberLookupRepository.searchMembers(' a ')).resolves.toEqual([]);
  expect(supabaseMock.queriesFor('public_members')).toHaveLength(0);
});

it('suggests a unique exact match and refuses to choose between duplicates', async () => {
  supabaseMock.setDefault('public_members', {
    data: [row('t', 'Tommy', 'Tran'), row('a1', 'Andy', 'Tran'), row('a2', 'Andy', 'Tran')],
    error: null,
  });
  await expect(memberLookupRepository.suggestExactMemberMatch('tommy tran')).resolves.toEqual({
    kind: 'unique',
    member: expect.objectContaining({ id: 't' }),
  });
  await expect(memberLookupRepository.suggestExactMemberMatch('Andy Tran')).resolves.toMatchObject({
    kind: 'ambiguous',
  });
});

it('matches import emails against members without returning the address', async () => {
  supabaseMock.setDefault('members', {
    data: [{ ...row('m1', 'Amy', 'Tran'), email: 'Amy@UCSD.edu' }, { ...row('m2', 'Kevin', 'Le'), email: null }],
    error: null,
  });
  const matches = await memberLookupRepository.matchMembersByEmail([' amy@ucsd.edu ', 'AMY@ucsd.edu', 'kevin@ucsd.edu']);
  expect(Array.from(matches.keys())).toEqual(['amy@ucsd.edu']);
  expect(matches.get('amy@ucsd.edu')).toEqual([expect.objectContaining({ id: 'm1' })]);
  expect(JSON.stringify(Array.from(matches.values()))).not.toMatch(/@/);
  const [query] = supabaseMock.queriesFor('members');
  expect(query.calls).toContainEqual({ method: 'in', args: ['email', ['amy@ucsd.edu', 'kevin@ucsd.edu']] });
});

it('does not query members when there are no emails to match', async () => {
  await expect(memberLookupRepository.matchMembersByEmail(['', '  '])).resolves.toEqual(new Map());
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('reads every canonical member past the 1,000-row public directory limit for bulk role review', async () => {
  const person = (index: number) => row(`id-${String(index).padStart(5, '0')}`, `First${index}`, 'Example');
  supabaseMock.queueResult('public_members', { data: Array.from({ length: 1000 }, (_, i) => person(i)), error: null });
  supabaseMock.queueResult('public_members', { data: [person(1000), person(1001)], error: null });
  const result = await memberLookupRepository.listMemberDirectory();
  expect(result).toHaveLength(1002);
  expect(result[1001]).toEqual(expect.objectContaining({ fullName: 'First1001 Example' }));
  const ranges = supabaseMock.queriesFor('public_members').flatMap((q) => q.calls).filter((call) => call.method === 'range');
  expect(ranges).toEqual([{ method: 'range', args: [0, 999] }, { method: 'range', args: [1000, 1999] }]);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('pages the House import member list past the 1,000-row cap', async () => {
  const member = (index: number) => ({ id: `m${String(index).padStart(5, '0')}`, first_name: `F${index}`, last_name: 'L', college: null, year: null, house: null, email: null, points: 0, events_attended: 0 });
  supabaseMock.queueResult('members', { data: Array.from({ length: 1000 }, (_, index) => member(index)), error: null });
  supabaseMock.queueResult('members', { data: Array.from({ length: 234 }, (_, index) => member(1000 + index)), error: null });
  const members = await memberLookupRepository.listHouseImportMembers();
  expect(members).toHaveLength(1234);
  const ranges = supabaseMock.queriesFor('members').flatMap((query) => query.calls).filter((call) => call.method === 'range');
  expect(ranges).toEqual([{ method: 'range', args: [0, 999] }, { method: 'range', args: [1000, 1999] }]);
});
