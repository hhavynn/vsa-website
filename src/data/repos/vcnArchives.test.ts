import { vcnArchivesRepository } from './vcnArchives';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('vcnArchivesRepository publication and private-data boundary (#291)', () => {
  it('queries only the published VCN view and scrubs private notes in the result', async () => {
    supabaseMock.queueResult('published_vcn_archives', {
      data: [{ id: 'vcn-1', title: 'Culture Night', internal_notes: 'not for public' }],
      error: null,
    });
    await expect(vcnArchivesRepository.getPublishedArchives()).resolves.toEqual([
      { id: 'vcn-1', title: 'Culture Night', internal_notes: null, source_doc_url: null },
    ]);
    const calls = supabaseMock.queriesFor('published_vcn_archives')[0].calls;
    expect(calls).toContainEqual({ method: 'eq', args: ['is_published', true] });
    const projection = String(calls.find(c => c.method === 'select')?.args[0]);
    expect(projection).not.toContain('internal_notes');
    expect(projection).not.toContain('source_doc_url');
    expect(supabaseMock.queriesFor('vcn_archives')).toHaveLength(0);
  });

  it('returns [] on empty public results and rejects a denied public query', async () => {
    supabaseMock.queueResult('published_vcn_archives', { data: null, error: null });
    await expect(vcnArchivesRepository.getPublishedArchives()).resolves.toEqual([]);
    supabaseMock.queueResult('published_vcn_archives', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(vcnArchivesRepository.getPublishedArchives()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('selects only a published current archive and treats missing data as unavailable', async () => {
    supabaseMock.queueResult('published_vcn_archives', {
      data: { id: 'vcn-1', title: 'Example' }, error: null,
    });
    await expect(vcnArchivesRepository.getCurrentArchive()).resolves.toEqual({
      id: 'vcn-1', title: 'Example', internal_notes: null, source_doc_url: null,
    });
    const calls = supabaseMock.queriesFor('published_vcn_archives')[0].calls;
    expect(calls).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['is_published', true] },
      { method: 'limit', args: [1] },
    ]));
    supabaseMock.queueResult('published_vcn_archives', { data: null, error: null });
    await expect(vcnArchivesRepository.getCurrentArchive()).resolves.toBeNull();
  });

  it('returns the admin-only full table without applying a public filter', async () => {
    supabaseMock.queueResult('vcn_archives', {
      data: [{ id: 'unpublished', internal_notes: 'cabinet only' }], error: null,
    });
    await expect(vcnArchivesRepository.getAllArchives()).resolves.toEqual([
      { id: 'unpublished', internal_notes: 'cabinet only' },
    ]);
    expect(supabaseMock.filtersFor('vcn_archives')).not.toContainEqual(['is_published', true]);
    expect(supabaseMock.queriesFor('published_vcn_archives')).toHaveLength(0);
  });

  it('does not hide authorization failures when loading admin archives', async () => {
    supabaseMock.queueResult('vcn_archives', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(vcnArchivesRepository.getAllArchives()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('creates an archived row and clears other current flags first only when requested', async () => {
    supabaseMock.queueResult('vcn_archives', { data: null, error: null });
    supabaseMock.queueResult('vcn_archives', { data: { id: 'vcn-2' }, error: null });
    await expect(vcnArchivesRepository.createArchive({
      year: 2027, title: 'Example', is_current: true,
    } as Parameters<typeof vcnArchivesRepository.createArchive>[0])).resolves.toEqual({ id: 'vcn-2' });
    const queries = supabaseMock.queriesFor('vcn_archives');
    expect(queries).toHaveLength(2);
    expect(queries[0].calls).toContainEqual({ method: 'eq', args: ['is_current', true] });
    expect(queries[1].calls.find(c => c.method === 'insert')?.args[0]).toMatchObject({
      year: 2027, is_current: true, updated_at: expect.any(String),
    });
  });
});
