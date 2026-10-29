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
