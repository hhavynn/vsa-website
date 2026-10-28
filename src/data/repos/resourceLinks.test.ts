import { resourceLinksRepository } from './resourceLinks';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const item = {
  id: 'resource-1',
  title: 'Room booking',
  category: 'Room Booking',
  url: 'https://example.invalid/booking',
  visibility: 'admin_only',
};

beforeEach(() => supabaseMock.reset());

describe('resourceLinksRepository (admin-only data boundary)', () => {
  it('returns only the rows supplied by the repository query and pins sort order', async () => {
    supabaseMock.queueResult('resource_links', { data: [item], error: null });
    await expect(resourceLinksRepository.getAll()).resolves.toEqual([item]);
    expect(supabaseMock.queriesFor('resource_links')[0].calls.filter((call) => call.method === 'order')).toEqual([
      { method: 'order', args: ['is_archived', { ascending: true }] },
      { method: 'order', args: ['is_current', { ascending: false }] },
      { method: 'order', args: ['category', { ascending: true }] },
      { method: 'order', args: ['title', { ascending: true }] },
    ]);
  });

  it('returns an empty list on a successful null result', async () => {
    supabaseMock.queueResult('resource_links', { data: null, error: null });
    await expect(resourceLinksRepository.getAll()).resolves.toEqual([]);
  });

  it('preserves PostgREST authorization failures as typed database errors', async () => {
    supabaseMock.queueResult('resource_links', {
      data: null,
      error: postgrestError('permission denied', '42501'),
    });
    await expect(resourceLinksRepository.getAll()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501', message: 'Insufficient permissions',
    });
  });

  it('normalizes inserts and forces visibility to admin_only even if a caller requests otherwise', async () => {
    supabaseMock.queueResult('resource_links', { data: item, error: null });
    await expect(resourceLinksRepository.create({
      title: '  Room booking  ',
      url: '  https://example.invalid/booking  ',
      category: '  Room Booking ',
      description: '   ',
      role: '  Events Chair  ',
      visibility: 'public',
    })).resolves.toEqual(item);

    const insert = supabaseMock.queriesFor('resource_links')[0].calls.find((call) => call.method === 'insert');
    expect(insert?.args[0]).toMatchObject({
      title: 'Room booking',
      url: 'https://example.invalid/booking',
      category: 'Room Booking',
      description: null,
      role: 'Events Chair',
      visibility: 'admin_only',
    });
  });

  it('forces admin_only visibility on partial updates and keeps row selection scoped to id', async () => {
    supabaseMock.queueResult('resource_links', { data: item, error: null });
    await resourceLinksRepository.update(item.id, { title: '  Booking  ', visibility: 'public' });
    expect(supabaseMock.filtersFor('resource_links')).toContainEqual(['id', item.id]);
    const update = supabaseMock.queriesFor('resource_links')[0].calls.find((call) => call.method === 'update');
    expect(update?.args[0]).toMatchObject({ title: 'Booking', visibility: 'admin_only' });
  });

  it('marks archived links non-current and preserves current state when unarchiving', async () => {
    supabaseMock.queueResult('resource_links', { data: item, error: null });
    supabaseMock.queueResult('resource_links', { data: item, error: null });
    await resourceLinksRepository.setArchived(item.id, true);
    await resourceLinksRepository.setArchived(item.id, false);
    const patches = supabaseMock.queriesFor('resource_links').map((q) =>
      q.calls.find((call) => call.method === 'update')?.args[0]
    );
    expect(patches).toEqual([{ is_archived: true, is_current: false }, { is_archived: false }]);
  });

  it('propagates failed writes rather than reporting success', async () => {
    supabaseMock.queueResult('resource_links', {
      data: null,
      error: postgrestError('permission denied', '42501'),
    });
    await expect(resourceLinksRepository.delete(item.id)).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
    expect(supabaseMock.filtersFor('resource_links')).toContainEqual(['id', item.id]);
  });
});
