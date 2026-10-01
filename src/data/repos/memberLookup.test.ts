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
