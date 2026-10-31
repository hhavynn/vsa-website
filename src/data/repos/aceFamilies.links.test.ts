import { aceFamiliesRepository } from './aceFamilies';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const updatePayloads = () =>
  supabaseMock
    .queriesFor('ace_family_members')
    .map((query) => query.calls.find((call) => call.method === 'update')?.args[0] as Record<string, unknown>);

describe('ACE node member links', () => {
  it('links one node to a canonical member and touches nothing else', async () => {
    supabaseMock.setDefault('ace_family_members', { data: { id: 'node-1', member_id: 'member-1' }, error: null });
    await aceFamiliesRepository.setMemberLink('node-1', 'member-1');
    const [payload] = updatePayloads();
    expect(Object.keys(payload).sort()).toEqual(['member_id', 'updated_at']);
    expect(payload.member_id).toBe('member-1');
    expect(supabaseMock.filtersFor('ace_family_members')).toContainEqual(['id', 'node-1']);
  });

  it('unlinks by writing a null member_id', async () => {
    supabaseMock.setDefault('ace_family_members', { data: { id: 'node-1', member_id: null }, error: null });
    await aceFamiliesRepository.setMemberLink('node-1', null);
    expect(updatePayloads()[0].member_id).toBeNull();
  });

  it('bulk-links only nodes that are still unlinked and reports skipped ones', async () => {
    supabaseMock
      .queueResult('ace_family_members', { data: [{ id: 'node-1' }], error: null })
      .queueResult('ace_family_members', { data: [], error: null });

    await expect(
      aceFamiliesRepository.linkUnlinkedMembers([
        { nodeId: 'node-1', memberId: 'member-1' },
        { nodeId: 'node-2', memberId: 'member-2' },
      ]),
    ).resolves.toEqual({ linked: ['node-1'], skipped: ['node-2'] });

    const queries = supabaseMock.queriesFor('ace_family_members');
    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.calls).toContainEqual({ method: 'is', args: ['member_id', null] });
    }
    expect(updatePayloads().map((payload) => payload.member_id)).toEqual(['member-1', 'member-2']);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });
});


describe('complete admin ACE node references (#291)', () => {
  const row = (n: number) => ({
    id: 'fictional-node-' + String(n).padStart(4, '0'),
    name: 'Fictional Member ' + n,
    family_id: 'fictional-fam',
    member_id: n === 0 ? null : 'fictional-member-' + n,
    parent_member_id: n > 0 ? 'fictional-node-' + String(n - 1).padStart(4, '0') : null,
    role_label: n === 0 ? 'OG Founder' : 'Little',
    ace_families: { name: 'Fictional Family' },
  });

  it('reads every page of existing Big/Little nodes in stable ID order, including unlinked roots', async () => {
    const first = Array.from({ length: 1000 }, (_, i) => row(i));
    supabaseMock.queueResult('ace_family_members', { data: first, error: null });
    supabaseMock.queueResult('ace_family_members', { data: [row(1000), row(1001)], error: null });

    const nodes = await aceFamiliesRepository.getAllNodeRefs();
    expect(nodes).toHaveLength(1002);
    expect(nodes[0]).toMatchObject({
      id: 'fictional-node-0000', familyId: 'fictional-fam',
      familyName: 'Fictional Family', memberId: null, parentId: null,
    });
    expect(nodes[1001]).toMatchObject({
      id: 'fictional-node-1001',
      memberId: 'fictional-member-1001', parentId: 'fictional-node-1000',
    });
    const queries = supabaseMock.queriesFor('ace_family_members');
    expect(queries).toHaveLength(2);
    expect(queries[0].calls).toContainEqual({ method: 'range', args: [0, 999] });
    expect(queries[1].calls).toContainEqual({ method: 'range', args: [1000, 1999] });
    queries.forEach((query) => {
      expect(query.calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
      const columns = String(query.calls.find((c) => c.method === 'select')?.args[0] ?? '');
      expect(columns).not.toMatch(/notes|email|phone|source|gender|application/i);
    });
    expect(supabaseMock.queriesFor('published_ace_family_members')).toHaveLength(0);
  });

  it('preserves the two existing PostgREST family-join shapes', async () => {
    supabaseMock.queueResult('ace_family_members', {
      data: [{ ...row(1), ace_families: [{ name: 'Array Family' }] }, {
        ...row(2), ace_families: null,
      }], error: null,
    });
    await expect(aceFamiliesRepository.getAllNodeRefs()).resolves.toEqual([
      expect.objectContaining({ familyName: 'Array Family' }),
      expect.objectContaining({ familyName: null }),
    ]);
  });

  it('returns a genuine empty list without inventing any node', async () => {
    supabaseMock.queueResult('ace_family_members', { data: [], error: null });
    await expect(aceFamiliesRepository.getAllNodeRefs()).resolves.toEqual([]);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(1);
  });

  it('rejects the full read if the second admin node page fails', async () => {
    supabaseMock.queueResult('ace_family_members', {
      data: Array.from({ length: 1000 }, (_, i) => row(i)), error: null,
    });
    supabaseMock.queueResult('ace_family_members', {
      data: null, error: { message: 'fictional later-page denial', code: '42501' },
    });
    await expect(aceFamiliesRepository.getAllNodeRefs()).rejects.toMatchObject({
      message: 'Insufficient permissions', code: '42501',
    });
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(2);
  });
});
