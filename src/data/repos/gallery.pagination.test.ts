import { galleryRepository } from './gallery';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const createAlbumRow = (id: string, date: string, title = `Album ${id}`) => ({
  id,
  title,
  description: `Description for ${id}`,
  date,
  google_photos_url: `https://photos.app.goo.gl/${id}`,
  cover_image_url: `https://photos.example.com/${id}.jpg`,
  cover_thumbnail_url: `https://photos.example.com/${id}_thumb.jpg`,
  event_id: null,
  event: null,
});

describe('Gallery cursor pagination (Issue #561)', () => {
  it('applies deterministic ordering: date DESC, id DESC, and public google_photos_url filter', async () => {
    supabaseMock.setDefault('gallery_events', {
      data: [createAlbumRow('a1', '2026-10-01')],
      error: null,
    });

    const page = await galleryRepository.getAlbumPage({ limit: 12 });
    expect(page.albums).toHaveLength(1);
    expect(page.nextCursor).toBeNull();

    const [query] = supabaseMock.queriesFor('gallery_events');
    expect(query.calls).toContainEqual({
      method: 'not',
      args: ['google_photos_url', 'is', null],
    });
    expect(query.calls).toContainEqual({
      method: 'order',
      args: ['date', { ascending: false }],
    });
    expect(query.calls).toContainEqual({
      method: 'order',
      args: ['id', { ascending: false }],
    });
    // Lookahead: limit(13) for limit=12
    expect(query.calls).toContainEqual({
      method: 'limit',
      args: [13],
    });
  });

  it('handles 0 total: returns empty albums and null nextCursor', async () => {
    supabaseMock.setDefault('gallery_events', {
      data: [],
      error: null,
    });

    const page = await galleryRepository.getAlbumPage({ limit: 12 });
    expect(page.albums).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('handles 11 total: returns 11 albums and null nextCursor (exhausted)', async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      createAlbumRow(`alb-${String(i).padStart(2, '0')}`, `2026-10-${String(20 - i).padStart(2, '0')}`)
    );
    supabaseMock.setDefault('gallery_events', { data: rows, error: null });

    const page = await galleryRepository.getAlbumPage({ limit: 12 });
    expect(page.albums).toHaveLength(11);
    expect(page.nextCursor).toBeNull();
  });

  it('handles exactly 12 total: returns 12 albums and null nextCursor (no phantom extra page)', async () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      createAlbumRow(`alb-${String(i).padStart(2, '0')}`, `2026-10-${String(20 - i).padStart(2, '0')}`)
    );
    supabaseMock.setDefault('gallery_events', { data: rows, error: null });

    const page = await galleryRepository.getAlbumPage({ limit: 12 });
    expect(page.albums).toHaveLength(12);
    // Crucial: 12 returned out of 12 fetched (limit+1 was 13, but only 12 existed)
    // Therefore nextCursor MUST be null.
    expect(page.nextCursor).toBeNull();
  });

  it('handles 13 total: page 1 returns 12 albums with nextCursor, page 2 returns 1 album with null cursor', async () => {
    // 13 albums total
    const allRows = Array.from({ length: 13 }, (_, i) =>
      createAlbumRow(`alb-${String(13 - i).padStart(2, '0')}`, `2026-09-${String(20 - i).padStart(2, '0')}`)
    );

    // Page 1: Supabase returns 13 rows because limit=13
    supabaseMock.queueResult('gallery_events', { data: allRows, error: null });

    const page1 = await galleryRepository.getAlbumPage({ limit: 12 });
    expect(page1.albums).toHaveLength(12);
    expect(page1.albums[0].id).toBe('alb-13');
    expect(page1.albums[11].id).toBe('alb-02');
    expect(page1.nextCursor).toEqual({
      date: page1.albums[11].date,
      id: page1.albums[11].id,
    });

    // Page 2: with cursor applied, returns remaining 1 row
    supabaseMock.queueResult('gallery_events', { data: [allRows[12]], error: null });

    const page2 = await galleryRepository.getAlbumPage({
      limit: 12,
      cursor: page1.nextCursor,
    });
    expect(page2.albums).toHaveLength(1);
    expect(page2.albums[0].id).toBe('alb-01');
    expect(page2.nextCursor).toBeNull();

    // Verify page 2 query included cursor .or()
    const queries = supabaseMock.queriesFor('gallery_events');
    const page2Query = queries[1];
    expect(page2Query.calls).toContainEqual({
      method: 'or',
      args: [`date.lt.${page1.nextCursor!.date},and(date.eq.${page1.nextCursor!.date},id.lt.${page1.nextCursor!.id})`],
    });
  });

  it('resolves same-date ties deterministically across page boundaries without duplicate or omitted IDs', async () => {
    // All 14 items have the EXACT same date '2026-10-15' but different IDs ('item-14' down to 'item-01')
    const allSameDateRows = Array.from({ length: 14 }, (_, i) =>
      createAlbumRow(`item-${String(14 - i).padStart(2, '0')}`, '2026-10-15')
    );

    // Page 1 returns 13 rows (12 items + 1 lookahead)
    supabaseMock.queueResult('gallery_events', {
      data: allSameDateRows.slice(0, 13),
      error: null,
    });

    const page1 = await galleryRepository.getAlbumPage({ limit: 12 });
    expect(page1.albums).toHaveLength(12);
    expect(page1.albums.map((a) => a.id)).toEqual([
      'item-14', 'item-13', 'item-12', 'item-11', 'item-10', 'item-09',
      'item-08', 'item-07', 'item-06', 'item-05', 'item-04', 'item-03'
    ]);
    expect(page1.nextCursor).toEqual({ date: '2026-10-15', id: 'item-03' });

    // Page 2: remaining 2 items ('item-02', 'item-01')
    supabaseMock.queueResult('gallery_events', {
      data: allSameDateRows.slice(12),
      error: null,
    });

    const page2 = await galleryRepository.getAlbumPage({
      limit: 12,
      cursor: page1.nextCursor,
    });
    expect(page2.albums).toHaveLength(2);
    expect(page2.albums.map((a) => a.id)).toEqual(['item-02', 'item-01']);
    expect(page2.nextCursor).toBeNull();

    // Check union has all 14 unique IDs
    const combinedIds = [...page1.albums.map((a) => a.id), ...page2.albums.map((a) => a.id)];
    expect(combinedIds).toHaveLength(14);
    expect(new Set(combinedIds).size).toBe(14);
  });

  it('propagates Supabase errors instead of returning empty successful pages', async () => {
    supabaseMock.setDefault('gallery_events', {
      data: null,
      error: { message: 'Network connection refused', code: 'PGRST000' },
    });

    await expect(galleryRepository.getAlbumPage({ limit: 12 })).rejects.toThrow();
  });

  it('preserves existing getAlbums() method and return type for homepage and wrapped callers', async () => {
    supabaseMock.setDefault('gallery_events', {
      data: [createAlbumRow('latest', '2026-10-20')],
      error: null,
    });

    const albums = await galleryRepository.getAlbums({ limit: 1 });
    expect(Array.isArray(albums)).toBe(true);
    expect(albums).toHaveLength(1);
    expect(albums[0].id).toBe('latest');
  });

  it('normalizes event relation if returned as an array or object', async () => {
    const rawRow = {
      ...createAlbumRow('e1', '2026-10-01'),
      event: [
        {
          id: 'evt-1',
          name: 'General Body Meeting',
          date: '2026-10-01',
          academic_term_id: 'term-fa26',
          is_published: true,
        },
      ],
    };

    supabaseMock.setDefault('gallery_events', {
      data: [rawRow],
      error: null,
    });

    const page = await galleryRepository.getAlbumPage({ limit: 12 });
    expect(page.albums[0].event).toEqual({
      id: 'evt-1',
      name: 'General Body Meeting',
      date: '2026-10-01',
      academic_term_id: 'term-fa26',
      is_published: true,
    });
  });
});
