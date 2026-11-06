import { aceFamiliesRepository } from './aceFamilies';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

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

  it('reads approved pickup fields and unpublished nodes only into admin references (#665)', async () => {
    supabaseMock.queueResult('ace_family_members', { data: [
      { ...row(0), is_published: true, pickup_academic_year_start: 2021, pickup_term: 'FA21' },
      { ...row(1), is_published: false, pickup_academic_year_start: null, pickup_term: null },
    ], error: null });
    const refs = await aceFamiliesRepository.getAllNodeRefs();
    expect(refs).toEqual([
      expect.objectContaining({
        id: 'fictional-node-0000', isPublished: true,
        pickupAcademicYearStart: 2021, pickupTerm: 'FA21',
        parentId: null, roleLabel: 'OG Founder',
      }),
      expect.objectContaining({
        id: 'fictional-node-0001', isPublished: false,
        pickupAcademicYearStart: null, pickupTerm: null,
        parentId: 'fictional-node-0000',
      }),
    ]);
    const [query] = supabaseMock.queriesFor('ace_family_members');
    const selected = query.calls.find((call) => call.method === 'select')?.args[0];
    expect(selected).toBe('id, name, family_id, member_id, parent_member_id, role_label, is_published, pickup_academic_year_start, pickup_term, ace_families(name)');
    expect(supabaseMock.queriesFor('ace_member_pickup_evidence')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('does not infer publication or a year from legacy admin rows missing the new columns', async () => {
    supabaseMock.queueResult('ace_family_members', { data: [row(0)], error: null });
    const refs = await aceFamiliesRepository.getAllNodeRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0].isPublished).toBe(false);
    expect(refs[0].pickupAcademicYearStart).toBeUndefined();
    expect(refs[0].pickupTerm).toBeUndefined();
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

  it('rejects an overlapping second page instead of duplicating a selectable Big', async () => {
    supabaseMock.queueResult('ace_family_members', {
      data: Array.from({ length: 1000 }, (_, i) => row(i)), error: null,
    });
    supabaseMock.queueResult('ace_family_members', { data: [row(999), row(1000)], error: null });
    await expect(aceFamiliesRepository.getAllNodeRefs()).rejects.toThrow(/pages are inconsistent/);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(2);
  });

  it('rejects an out-of-order or malformed Big node rather than returning an incomplete index', async () => {
    for (const badPage of [
      [row(2), row(1)],
      [{ ...row(1), family_id: '' }],
      [{ ...row(1), name: '' }],
      [{ ...row(1), id: '' }],
    ]) {
      supabaseMock.queueResult('ace_family_members', { data: badPage, error: null });
      await expect(aceFamiliesRepository.getAllNodeRefs()).rejects.toThrow(/pages are inconsistent/);
    }
  });

  it('does not interpret a null-successful response as an empty ACE tree', async () => {
    supabaseMock.queueResult('ace_family_members', { data: null, error: null });
    await expect(aceFamiliesRepository.getAllNodeRefs()).rejects.toThrow(/incomplete page/);
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

describe('complete admin family directory for private ACE preview (#665)', () => {
  it('loads beyond the PostgREST 1000-row default with deterministic pagination', async () => {
    const page = Array.from({ length: 1000 }, (_, index) => ({
      id: 'synthetic-family-' + String(index).padStart(4, '0'),
      name: 'Fictional Family', display_order: 1, is_published: true,
    }));
    supabaseMock.queueResult('ace_families', { data: page, error: null });
    supabaseMock.queueResult('ace_families', {
      data: [{ id: 'synthetic-family-1000', name: 'Fictional Family', display_order: 1, is_published: false }],
      error: null,
    });
    const families = await aceFamiliesRepository.getAdminFamilies();
    expect(families).toHaveLength(1001);
    expect(families[1000].id).toBe('synthetic-family-1000');
    const queries = supabaseMock.queriesFor('ace_families');
    expect(queries).toHaveLength(2);
    expect(queries.map((query) => query.calls.find((call) => call.method === 'range')?.args))
      .toEqual([[0, 999], [1000, 1999]]);
    for (const query of queries) {
      expect(query.calls.filter((call) => call.method === 'order')).toEqual([
        { method: 'order', args: ['display_order', { ascending: true }] },
        { method: 'order', args: ['name', { ascending: true }] },
        { method: 'order', args: ['id', { ascending: true }] },
      ]);
    }
  });

  it('never returns a partial family list when a later page fails', async () => {
    supabaseMock.queueResult('ace_families', {
      data: Array.from({ length: 1000 }, (_, index) => ({ id: 'fake-' + index })), error: null,
    });
    supabaseMock.queueResult('ace_families', {
      data: null, error: postgrestError('permission denied for the next page', '42501'),
    });
    await expect(aceFamiliesRepository.getAdminFamilies())
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });
  });

  it('keeps a truly empty family directory distinct from a failed read', async () => {
    supabaseMock.queueResult('ace_families', { data: null, error: null });
    await expect(aceFamiliesRepository.getAdminFamilies()).resolves.toEqual([]);
    supabaseMock.queueResult('ace_families', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(aceFamiliesRepository.getAdminFamilies())
      .rejects.toMatchObject({ name: 'DatabaseError', message: 'Insufficient permissions' });
  });
});

describe('complete cross-family ACE member links (#850)', () => {
  const row = (index: number) => ({
    id: 'fictional-node-' + String(index).padStart(4, '0'),
    name: 'Same Fictional Name',
    member_id: 'fictional-member-' + String(index).padStart(4, '0'),
    ace_families: { name: index % 2 === 0 ? 'Fictional Sun Fam' : 'Fictional Moon Fam' },
  });

  it('reads every linked node past 1,000 and keeps same-name identities separate', async () => {
    supabaseMock.queueResult('ace_family_members', {
      data: Array.from({ length: 1000 }, (_, i) => row(i)), error: null,
    });
    supabaseMock.queueResult('ace_family_members', {
      data: [row(1000), row(1001)], error: null,
    });

    const links = await aceFamiliesRepository.getAllMemberLinks();
    expect(links).toHaveLength(1002);
    expect(links[0]).toEqual({
      nodeId: 'fictional-node-0000', memberId: 'fictional-member-0000',
      nodeName: 'Same Fictional Name', familyName: 'Fictional Sun Fam',
    });
    expect(links[1001]).toEqual({
      nodeId: 'fictional-node-1001', memberId: 'fictional-member-1001',
      nodeName: 'Same Fictional Name', familyName: 'Fictional Moon Fam',
    });
    expect(new Set(links.map(link => link.nodeId)).size).toBe(1002);
    const queries = supabaseMock.queriesFor('ace_family_members');
    expect(queries).toHaveLength(2);
    expect(queries[0].calls).toContainEqual({ method: 'range', args: [0, 999] });
    expect(queries[1].calls).toContainEqual({ method: 'range', args: [1000, 1999] });
    for (const query of queries) {
      expect(query.calls).toContainEqual({ method: 'not', args: ['member_id', 'is', null] });
      expect(query.calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
      expect(query.calls.find(call => call.method === 'select')?.args[0])
        .toBe('id, name, member_id, ace_families(name)');
    }
    expect(supabaseMock.queriesFor('public_members')).toHaveLength(0);
    expect(supabaseMock.queriesFor('published_ace_family_members')).toHaveLength(0);
  });

  it('continues after an exactly full 1,000-row page, then accepts an empty next page', async () => {
    supabaseMock.queueResult('ace_family_members', {
      data: Array.from({ length: 1000 }, (_, i) => row(i)), error: null,
    });
    supabaseMock.queueResult('ace_family_members', { data: [], error: null });
    const links = await aceFamiliesRepository.getAllMemberLinks();
    expect(links).toHaveLength(1000);
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(2);
  });

  it('rejects a later-page denial instead of returning incomplete identity hints', async () => {
    supabaseMock.queueResult('ace_family_members', {
      data: Array.from({ length: 1000 }, (_, i) => row(i)), error: null,
    });
    supabaseMock.queueResult('ace_family_members', {
      data: null, error: postgrestError('fictional later-page denied', '42501'),
    });
    await expect(aceFamiliesRepository.getAllMemberLinks()).rejects.toMatchObject({
      name: 'DatabaseError', message: 'Insufficient permissions', code: '42501',
    });
    expect(supabaseMock.queriesFor('ace_family_members')).toHaveLength(2);
  });

  it('preserves both Supabase family join shapes and never invents a missing family name', async () => {
    supabaseMock.queueResult('ace_family_members', {
      data: [
        { ...row(0), ace_families: [{ name: 'Array Fam' }] },
        { ...row(1), ace_families: null },
        { ...row(2), member_id: null },
      ], error: null,
    });
    await expect(aceFamiliesRepository.getAllMemberLinks()).resolves.toEqual([
      expect.objectContaining({ nodeId: 'fictional-node-0000', familyName: 'Array Fam' }),
      expect.objectContaining({ nodeId: 'fictional-node-0001', familyName: null }),
    ]);
  });

  it('distinguishes a genuinely empty linked roster from a denied first page', async () => {
    supabaseMock.queueResult('ace_family_members', { data: [], error: null });
    await expect(aceFamiliesRepository.getAllMemberLinks()).resolves.toEqual([]);
    supabaseMock.queueResult('ace_family_members', {
      data: null, error: postgrestError('fictional admin denied', '42501'),
    });
    await expect(aceFamiliesRepository.getAllMemberLinks()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });
});
