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

it('matches primary and confirmed alternate emails via POST RPC without returning email fields', async () => {
  supabaseMock.queueResult('rpc:admin_match_members_by_email', { data: [
    { ...row('m1', 'Amy', 'Tran'), input_email: 'amy@ucsd.edu' },
    { ...row('m1', 'Amy', 'Tran'), input_email: 'amy.alias@example.edu' },
  ], error: null });
  const matches = await memberLookupRepository.matchMembersByEmail([
    ' amy@ucsd.edu ', 'AMY@ucsd.edu', 'amy.alias@example.edu',
  ]);
  expect(Array.from(matches.keys())).toEqual(['amy@ucsd.edu', 'amy.alias@example.edu']);
  expect(matches.get('amy.alias@example.edu')).toEqual([expect.objectContaining({ id: 'm1' })]);
  expect(JSON.stringify(Array.from(matches.values()))).not.toMatch(/@|input_email|email/);
  expect(supabaseMock.queries().map((q) => q.table)).toEqual(['rpc:admin_match_members_by_email']);
  expect(supabaseMock.queries()[0].calls).toEqual([
    { method: 'rpc', args: [{ p_emails: ['amy@ucsd.edu', 'amy.alias@example.edu'] }] },
  ]);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  expect(supabaseMock.queriesFor('member_identity_emails')).toHaveLength(0);
});

it('keeps distinct members with shared input primary email as ambiguous options', async () => {
  supabaseMock.queueResult('rpc:admin_match_members_by_email', { data: [
    { ...row('m1', 'Ari', 'Example'), input_email: 'shared@example.edu' },
    { ...row('m2', 'Bea', 'Example'), input_email: 'shared@example.edu' },
    { ...row('m1', 'Ari', 'Example'), input_email: 'shared@example.edu' },
  ], error: null });
  const matches = await memberLookupRepository.matchMembersByEmail(['shared@example.edu']);
  expect(matches.get('shared@example.edu')?.map((m) => m.id)).toEqual(['m1','m2']);
});

it('splits large input sets into bounded POST requests with no URL filters', async () => {
  const emails = Array.from({length: 201},(_,i) => 'fictional-' + i + '@example.edu');
  for (let i=0;i<3;i++) supabaseMock.queueResult('rpc:admin_match_members_by_email',{data:[],error:null});
  expect(await memberLookupRepository.matchMembersByEmail(emails)).toEqual(new Map());
  const calls = supabaseMock.queriesFor('rpc:admin_match_members_by_email');
  expect(calls).toHaveLength(3);
  expect(calls.map((q) => (q.calls[0].args[0] as {p_emails:string[]}).p_emails.length)).toEqual([100,100,1]);
  expect(supabaseMock.queriesFor('members')).toHaveLength(0);
});

it('fails the entire match when a later page is unreadable, rather than silently omitting people', async () => {
  supabaseMock.queueResult('rpc:admin_match_members_by_email', { data: [], error: null });
  supabaseMock.queueResult('rpc:admin_match_members_by_email', {
    data: null, error: { code: 'P0001', message: 'synthetic backend failure', details: 'fixture' },
  });
  const emails = Array.from({length: 101},(_,i) => 'test-' + i + '@example.edu');
  await expect(memberLookupRepository.matchMembersByEmail(emails)).rejects.toThrow();
});

it('rejects an RPC response containing an unrequested email, never presenting unrelated members', async () => {
  supabaseMock.queueResult('rpc:admin_match_members_by_email', { data: [
    { ...row('m', 'Unrelated', 'Member'), input_email: 'not-requested@example.edu' },
  ], error: null });
  await expect(memberLookupRepository.matchMembersByEmail(['real@example.edu']))
    .rejects.toThrow(/unrequested address/);
});

it('does not call the RPC when there are no emails to match', async () => {
  await expect(memberLookupRepository.matchMembersByEmail(['', '  '])).resolves.toEqual(new Map());
  expect(supabaseMock.queries()).toHaveLength(0);
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
