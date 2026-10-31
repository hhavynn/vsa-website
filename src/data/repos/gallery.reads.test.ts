/**
 * #291: Gallery public read contracts not covered by the pagination/discovery
 * suites. Pure Supabase boundary mocks with fictional albums only.
 */
import { galleryRepository, PUBLIC_SEARCH_ALBUM_LIMIT } from './gallery';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const forbidden = () => postgrestError('gallery read permission denied', '42501');
const publicAlbum = {
  id: 'fictional-album',
  title: 'Fictional Gallery',
  description: null,
  date: '2026-10-01',
  google_photos_url: 'https://photos.example.invalid/fictional',
  cover_image_url: null,
  cover_thumbnail_url: null,
  event_id: 'fictional-event',
  event: [{ id: 'fictional-event', name: 'Fictional Event', date: '2026-10-01', is_published: true }],
};

describe('Gallery public read boundaries (#291)', () => {
  it('indexes only bounded, link-backed, narrow gallery columns', async () => {
    const projected = {
      id: publicAlbum.id, title: publicAlbum.title,
      date: publicAlbum.date, google_photos_url: publicAlbum.google_photos_url,
    };
    supabaseMock.queueResult('gallery_events', { data: [projected], error: null });
    await expect(galleryRepository.getPublicSearchAlbums()).resolves.toEqual([projected]);
    const [query] = supabaseMock.queriesFor('gallery_events');
    expect(query.calls).toEqual(expect.arrayContaining([
      { method: 'select', args: ['id, title, date, google_photos_url'] },
      { method: 'not', args: ['google_photos_url', 'is', null] },
      { method: 'order', args: ['date', { ascending: false }] },
      { method: 'limit', args: [PUBLIC_SEARCH_ALBUM_LIMIT] },
    ]));
    const select = String(query.calls.find(call => call.method === 'select')?.args[0]);
    for (const privateField of ['check_in_form_url', 'admin_notes', 'submitted_email', 'source_doc_url']) {
      expect(select).not.toContain(privateField);
    }
  });

  it('honors a smaller explicit public-search limit', async () => {
    supabaseMock.queueResult('gallery_events', { data: [], error: null });
    await expect(galleryRepository.getPublicSearchAlbums(7)).resolves.toEqual([]);
    expect(supabaseMock.queriesFor('gallery_events')[0].calls).toContainEqual({
      method: 'limit', args: [7],
    });
  });

  it('treats a successful empty search as empty but rejects permission denial', async () => {
    supabaseMock.queueResult('gallery_events', { data: null, error: null });
    await expect(galleryRepository.getPublicSearchAlbums()).resolves.toEqual([]);
    supabaseMock.queueResult('gallery_events', { data: null, error: forbidden() });
    await expect(galleryRepository.getPublicSearchAlbums()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501', message: 'Insufficient permissions',
    });
  });

  it('pins public album counts to the visible URL filter and exact head count', async () => {
    supabaseMock.queueResult('gallery_events', { data: null, count: 5, error: null });
    await expect(galleryRepository.getAlbumCount()).resolves.toBe(5);
    expect(supabaseMock.queriesFor('gallery_events')[0].calls).toEqual(expect.arrayContaining([
      { method: 'select', args: ['*', { count: 'exact', head: true }] },
      { method: 'not', args: ['google_photos_url', 'is', null] },
    ]));

    supabaseMock.queueResult('gallery_events', { data: null, count: null, error: null });
    await expect(galleryRepository.getAlbumCount()).resolves.toBe(0);

    supabaseMock.queueResult('gallery_events', { data: null, count: null, error: forbidden() });
    await expect(galleryRepository.getAlbumCount()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('preserves empty versus denied academic-year and filtered-count reads', async () => {
    supabaseMock.queueResult('gallery_events', { data: null, error: null });
    await expect(galleryRepository.getAlbumYears()).resolves.toEqual([]);

    supabaseMock.queueResult('gallery_events', { data: null, error: forbidden() });
    await expect(galleryRepository.getAlbumYears()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });

    supabaseMock.queueResult('gallery_events', { data: null, count: null, error: null });
    await expect(galleryRepository.getFilteredAlbumCount({ search: 'fictional' })).resolves.toBe(0);

    supabaseMock.queueResult('gallery_events', { data: null, count: null, error: forbidden() });
    await expect(galleryRepository.getFilteredAlbumCount()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('normalizes a linked event in list reads without leaking its full event table', async () => {
    supabaseMock.queueResult('gallery_events', { data: [publicAlbum], error: null });
    const albums = await galleryRepository.getAlbums({ limit: 1, offset: 0 });
    expect(albums[0].event).toEqual(publicAlbum.event[0]);
    const calls = supabaseMock.queriesFor('gallery_events')[0].calls;
    const select = String(calls.find(call => call.method === 'select')?.args[0]);
    expect(select).toContain('event:events(id, name, date, academic_term_id, is_published)');
    expect(select).not.toContain('events(*)');
    expect(select).not.toContain('check_in_form_url');
    expect(calls).toEqual(expect.arrayContaining([
      { method: 'not', args: ['google_photos_url', 'is', null] },
      { method: 'range', args: [0, 0] },
    ]));
  });

  it('does not reinterpret list and program-photo read failures as successful empty lists', async () => {
    supabaseMock.queueResult('gallery_events', { data: null, error: null });
    await expect(galleryRepository.getAlbums()).resolves.toEqual([]);
    supabaseMock.queueResult('gallery_events', { data: null, error: forbidden() });
    await expect(galleryRepository.getAlbums()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });

    supabaseMock.queueResult('gallery_events', { data: null, error: null });
    await expect(galleryRepository.getProgramAlbums(['vcn'])).resolves.toEqual([]);
    supabaseMock.queueResult('gallery_events', { data: null, error: forbidden() });
    await expect(galleryRepository.getProgramAlbums(['vcn'])).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });
});
