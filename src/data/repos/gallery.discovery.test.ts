import {
  galleryRepository,
  sanitizeSearchQuery,
  escapeIlikePattern,
} from './gallery';
import { formatAcademicYearLabel } from '../../components/features/gallery/GalleryFilters';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('Gallery discovery & filtering (Issue #562)', () => {
  describe('search query sanitization & literal wildcard matching', () => {
    it('strips PostgREST delimiters like commas and parentheses to avoid filter malformation', () => {
      expect(sanitizeSearchQuery('Fall (GBM, Mixer)')).toBe('Fall  GBM  Mixer');
      expect(sanitizeSearchQuery('   trimming spaces   ')).toBe('trimming spaces');
      expect(sanitizeSearchQuery('')).toBe('');
    });

    it('escapes SQL LIKE / PostgREST ILIKE wildcards so % and _ match literally', () => {
      expect(escapeIlikePattern('100% win_rate')).toBe('100\\% win\\_rate');
      expect(escapeIlikePattern('C:\\Users')).toBe('C:\\\\Users');
      // Apostrophes are preserved literally without escaping
      expect(escapeIlikePattern("S'mores")).toBe("S'mores");
    });
  });

  describe('academic year boundary semantics (September 1 rollover)', () => {
    it('formats academic year labels with en-dash (e.g. 2026–27)', () => {
      expect(formatAcademicYearLabel(2026)).toBe('2026–27');
      expect(formatAcademicYearLabel(2025)).toBe('2025–26');
      expect(formatAcademicYearLabel(2024)).toBe('2024–25');
    });

    it('extracts distinct academic years from public albums using Sept 1 rollover', async () => {
      supabaseMock.setDefault('gallery_events', {
        data: [
          { date: '2026-10-06' }, // 2026-27 (Fall 2026)
          { date: '2026-09-01' }, // 2026-27 (First day of 2026-27)
          { date: '2026-08-31' }, // 2025-26 (Last day of 2025-26)
          { date: '2026-01-15' }, // 2025-26 (Winter 2026 -> 2025-26)
          { date: '2025-09-10' }, // 2025-26 (Fall 2025 -> 2025-26)
          { date: '2025-08-20' }, // 2024-25 (Summer 2025 -> 2024-25)
          { date: '2024-11-01' }, // 2024-25 (Fall 2024 -> 2024-25)
        ],
        error: null,
      });

      const years = await galleryRepository.getAlbumYears();
      expect(years).toEqual([2026, 2025, 2024]);

      const [query] = supabaseMock.queriesFor('gallery_events');
      expect(query.calls).toContainEqual({
        method: 'select',
        args: ['date'],
      });
      expect(query.calls).toContainEqual({
        method: 'not',
        args: ['google_photos_url', 'is', null],
      });
    });
  });

  describe('server-side filtering execution', () => {
    it('applies date_from and date_to before cursor pagination', async () => {
      supabaseMock.setDefault('gallery_events', {
        data: [],
        error: null,
      });

      await galleryRepository.getAlbumPage({
        limit: 12,
        date_from: '2025-09-01',
        date_to: '2026-08-31',
      });

      const [query] = supabaseMock.queriesFor('gallery_events');
      expect(query.calls).toContainEqual({ method: 'gte', args: ['date', '2025-09-01'] });
      expect(query.calls).toContainEqual({ method: 'lte', args: ['date', '2026-08-31'] });
    });

    it('applies search filter on title and description with wildcards escaped', async () => {
      supabaseMock.setDefault('gallery_events', {
        data: [],
        error: null,
      });

      await galleryRepository.getAlbumPage({
        limit: 12,
        search: "100% S'mores!",
      });

      const [query] = supabaseMock.queriesFor('gallery_events');
      // Escaped % becomes \%
      expect(query.calls).toContainEqual({
        method: 'or',
        args: ["title.ilike.%100\\% S'mores!%,description.ilike.%100\\% S'mores!%"],
      });
    });

    it('empty search query does not add title/description filter', async () => {
      supabaseMock.setDefault('gallery_events', {
        data: [],
        error: null,
      });

      await galleryRepository.getAlbumPage({
        limit: 12,
        search: '    ',
      });

      const [query] = supabaseMock.queriesFor('gallery_events');
      const orCalls = query.calls.filter((c) => c.method === 'or');
      expect(orCalls).toHaveLength(0);
    });

    it('calculates filtered count correctly', async () => {
      supabaseMock.setDefault('gallery_events', {
        data: null,
        error: null,
        count: 7,
      });

      const count = await galleryRepository.getFilteredAlbumCount({
        date_from: '2025-09-01',
        date_to: '2026-08-31',
        search: 'retreat',
      });

      expect(count).toBe(7);

      const [query] = supabaseMock.queriesFor('gallery_events');
      expect(query.calls).toContainEqual({ method: 'gte', args: ['date', '2025-09-01'] });
      expect(query.calls).toContainEqual({ method: 'lte', args: ['date', '2026-08-31'] });
      expect(query.calls).toContainEqual({
        method: 'or',
        args: ['title.ilike.%retreat%,description.ilike.%retreat%'],
      });
    });
  });
});
