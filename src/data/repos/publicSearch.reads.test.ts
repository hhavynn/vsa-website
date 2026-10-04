/**
 * The two reads behind site search must filter at the query, exactly like the
 * public pages they mirror -- never fetch everything and hide private rows
 * afterwards. Mirrors the draft-leak guards in events.test.ts (#292).
 */

import { eventsRepository } from './events';
import { galleryRepository } from './gallery';
import { DatabaseError } from '../errors';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

function selectOf(table: string): string {
  return String(
    supabaseMock
      .queriesFor(table)
      .flatMap((q) => q.calls)
      .find((c) => c.method === 'select')?.args[0],
  );
}

describe('EventsRepository.getPublicSearchEntries', () => {
  it('filters to published events in the query itself', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });

    await eventsRepository.getPublicSearchEntries();

    expect(supabaseMock.filtersFor('events')).toContainEqual(['is_published', true]);
  });

  it('selects only the fields a search result shows (no description, no check-in form URL, no select *)', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });

    await eventsRepository.getPublicSearchEntries();

    const select = selectOf('events');
    expect(select).not.toContain('*');
    expect(select).not.toContain('check_in_form_url');
    expect(select).not.toContain('description');
    expect(select).not.toContain('is_published');
    expect(select.split(',').map((column) => column.trim())).toEqual([
      'id',
      'name',
      'date',
      'end_date',
      'location',
      'event_type',
      'academic_term_id',
    ]);
  });

  it('is one bounded query (a single request, with a limit)', async () => {
    supabaseMock.queueResult('events', { data: [], error: null });

    await eventsRepository.getPublicSearchEntries();

    expect(supabaseMock.queriesFor('events')).toHaveLength(1);
    expect(supabaseMock.usedMethod('events', 'limit')).toBe(true);
  });

  it('surfaces a failure instead of returning a silently empty index', async () => {
    supabaseMock.queueResult('events', { data: null, error: postgrestError('permission denied for table events', '42501') });

    await expect(eventsRepository.getPublicSearchEntries()).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('GalleryRepository.getPublicSearchAlbums', () => {
  it('applies the same visibility rule as the Gallery page: only albums with a Google Photos URL', async () => {
    supabaseMock.queueResult('gallery_events', { data: [], error: null });

    await galleryRepository.getPublicSearchAlbums();

    const notFilters = supabaseMock
      .queriesFor('gallery_events')
      .flatMap((q) => q.calls)
      .filter((c) => c.method === 'not')
      .map((c) => c.args);
    expect(notFilters).toContainEqual(['google_photos_url', 'is', null]);
  });

  it('selects only id, title, date and the album URL, in one bounded query', async () => {
    supabaseMock.queueResult('gallery_events', { data: [], error: null });

    await galleryRepository.getPublicSearchAlbums();

    expect(selectOf('gallery_events')).toBe('id, title, date, google_photos_url');
    expect(supabaseMock.queriesFor('gallery_events')).toHaveLength(1);
    expect(supabaseMock.usedMethod('gallery_events', 'limit')).toBe(true);
  });
});
