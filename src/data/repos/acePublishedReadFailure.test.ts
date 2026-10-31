import { aceFamiliesRepository } from './aceFamilies';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

describe('ACE published-view read failures vs empty results (#666)', () => {
  beforeEach(() => {
    supabaseMock.reset();
  });

  it('propagates a published family query error when strict (for outage UX)', async () => {
    supabaseMock.queueResult('published_ace_families', {
      data: null,
      error: { message: 'temporary published-view outage' },
    });
    await expect(aceFamiliesRepository.getPublishedFamilies({ strict: true }))
      .rejects.toMatchObject({ message: 'temporary published-view outage' });
  });

  it('propagates a published member query error instead of asserting no match', async () => {
    supabaseMock.queueResult('published_ace_family_members', {
      data: null,
      error: { message: 'temporary member-view outage' },
    });
    await expect(aceFamiliesRepository.getAllPublishedMembers({ strict: true }))
      .rejects.toMatchObject({ message: 'temporary member-view outage' });
  });

  it('treats a successful empty read as a real empty Fam, not an outage', async () => {
    supabaseMock.queueResult('published_ace_families', { data: [], error: null });
    supabaseMock.queueResult('published_ace_family_members', { data: [], error: null });
    expect(await aceFamiliesRepository.getPublishedFamilies({ strict: true })).toEqual([]);
    expect(await aceFamiliesRepository.getAllPublishedMembers({ strict: true })).toEqual([]);
  });
});


describe('ACE published member pagination (#803)', () => {
  beforeEach(() => supabaseMock.reset());

  const rows = (count: number, start = 0) =>
    Array.from({ length: count }, (_, i) => ({
      id: 'fictional-node-' + String(start + i).padStart(4, '0'),
      name: 'Fictional Member ' + String(start + i).padStart(4, '0'),
    }));

  it('requests a second page after exactly 1,000 rows and preserves all nodes', async () => {
    supabaseMock.queueResult('published_ace_family_members', { data: rows(1000), error: null });
    supabaseMock.queueResult('published_ace_family_members', { data: [], error: null });

    const members = await aceFamiliesRepository.getAllPublishedMembers({ strict: true });
    expect(members).toHaveLength(1000);
    expect(members.every((member) => member.is_published)).toBe(true);
    const queries = supabaseMock.queriesFor('published_ace_family_members');
    expect(queries).toHaveLength(2);
    expect(queries[0].calls).toContainEqual({ method: 'range', args: [0, 999] });
    expect(queries[1].calls).toContainEqual({ method: 'range', args: [1000, 1999] });
    expect(queries[0].calls).toContainEqual({ method: 'order', args: ['name', { ascending: true }] });
    expect(queries[0].calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
  });

  it('retains every node after the 1,000-row boundary without another unnecessary page', async () => {
    supabaseMock.queueResult('published_ace_family_members', { data: rows(1000), error: null });
    supabaseMock.queueResult('published_ace_family_members', { data: rows(1, 1000), error: null });

    const members = await aceFamiliesRepository.getAllPublishedMembers({ strict: true });
    expect(members).toHaveLength(1001);
    expect(members[1000].id).toBe('fictional-node-1000');
    expect(supabaseMock.queriesFor('published_ace_family_members')).toHaveLength(2);
  });

  it('rejects the whole tree when a later page fails in strict mode', async () => {
    supabaseMock.queueResult('published_ace_family_members', { data: rows(1000), error: null });
    supabaseMock.queueResult('published_ace_family_members', {
      data: null, error: { message: 'fictional second-page outage' },
    });
    await expect(aceFamiliesRepository.getAllPublishedMembers({ strict: true }))
      .rejects.toMatchObject({ message: 'fictional second-page outage' });
    expect(supabaseMock.queriesFor('published_ace_family_members')).toHaveLength(2);
  });

  it('returns empty fallback rather than partial nodes when a later page fails non-strictly', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      supabaseMock.queueResult('published_ace_family_members', { data: rows(1000), error: null });
      supabaseMock.queueResult('published_ace_family_members', {
        data: null, error: { message: 'fictional second-page outage' },
      });
      await expect(aceFamiliesRepository.getAllPublishedMembers()).resolves.toEqual([]);
      expect(supabaseMock.queriesFor('published_ace_family_members')).toHaveLength(2);
    } finally {
      warn.mockRestore();
    }
  });
});

