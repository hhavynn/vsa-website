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
