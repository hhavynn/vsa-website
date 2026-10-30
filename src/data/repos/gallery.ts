import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';
import type { SiteEventType } from '../../types/database';

export interface RelatedEvent {
  id: string;
  name: string;
  date: string;
  academic_term_id?: string | null;
  /** Admins can read drafts through the join; only published events get a public link. */
  is_published?: boolean;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  description: string | null;
  date: string;
  google_photos_url: string;
  cover_image_url: string | null;
  cover_thumbnail_url: string | null;
  event_id: string | null;
  event: RelatedEvent | null;
}

/** A public album with a cover, as shown on a program page. */
export interface ProgramAlbum {
  id: string;
  title: string;
  date: string;
  google_photos_url: string;
  cover_image_url: string;
  cover_thumbnail_url: string | null;
}

export interface GalleryFilters {
  limit?: number;
  offset?: number;
  /** Inclusive "YYYY-MM-DD" bounds — gallery_events.date is a DATE column. */
  date_from?: string;
  date_to?: string;
}

export interface GalleryCursor {
  date: string;
  id: string;
}

export interface GalleryPage {
  albums: GalleryAlbum[];
  nextCursor: GalleryCursor | null;
}

export interface GalleryPageFilters {
  limit?: number;
  cursor?: GalleryCursor | null;
  /** Inclusive "YYYY-MM-DD" bounds — gallery_events.date is a DATE column. */
  date_from?: string;
  date_to?: string;
  search?: string;
}

/** Upper bound on albums the search index loads (newest first). */
export const PUBLIC_SEARCH_ALBUM_LIMIT = 300;

export interface PublicSearchAlbum {
  id: string;
  title: string;
  date: string;
  google_photos_url: string;
}

/**
 * Strips PostgREST filter metacharacters (, and ()) so a term cannot break .or().
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[,()]/g, ' ')
    .trim();
}

/**
 * Escapes SQL LIKE / PostgREST ILIKE wildcards so % and _ are matched literally.
 */
export function escapeIlikePattern(query: string): string {
  return query
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export class GalleryRepository {
  /**
   * Get gallery albums with cursor-based pagination and deterministic date/id ordering.
   * Lookahead fetch (limit + 1) computes exact end-of-list nextCursor without an extra request.
   */
  async getAlbumPage(filters: GalleryPageFilters = {}): Promise<GalleryPage> {
    return withErrorHandling(async () => {
      const limit = filters.limit ?? 12;
      let query = supabase
        .from('gallery_events')
        .select('id, title, description, date, google_photos_url, cover_image_url, cover_thumbnail_url, event_id, event:events(id, name, date, academic_term_id, is_published)')
        .not('google_photos_url', 'is', null)
        .order('date', { ascending: false })
        .order('id', { ascending: false });

      if (filters.cursor?.date && filters.cursor?.id) {
        // Enforce strict lexicographic cursor order:
        // date < cursor.date OR (date = cursor.date AND id < cursor.id)
        query = query.or(
          `date.lt.${filters.cursor.date},and(date.eq.${filters.cursor.date},id.lt.${filters.cursor.id})`
        );
      }

      if (filters.date_from) query = query.gte('date', filters.date_from);
      if (filters.date_to) query = query.lte('date', filters.date_to);

      if (filters.search) {
        const clean = sanitizeSearchQuery(filters.search);
        if (clean.length > 0) {
          const escaped = escapeIlikePattern(clean);
          query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
        }
      }

      query = query.limit(limit + 1);

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) {
        return { albums: [], nextCursor: null };
      }

      const hasNext = data.length > limit;
      const rawAlbums = hasNext ? data.slice(0, limit) : data;

      const albums = rawAlbums.map((row: any) => ({
        ...row,
        event: Array.isArray(row.event) ? (row.event[0] ?? null) : (row.event ?? null),
      })) as GalleryAlbum[];

      const lastAlbum = albums[albums.length - 1];
      const nextCursor: GalleryCursor | null =
        hasNext && lastAlbum ? { date: lastAlbum.date, id: lastAlbum.id } : null;

      return { albums, nextCursor };
    }, 'Failed to fetch gallery albums');
  }

  /**
   * Returns distinct academic years (start years, sorted newest first)
   * that have public albums.
   */
  async getAlbumYears(): Promise<number[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('gallery_events')
        .select('date')
        .not('google_photos_url', 'is', null);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const yearsSet = new Set<number>();
      for (const row of data as { date: string }[]) {
        if (!row.date) continue;
        const match = /^(\d{4})-(\d{2})/.exec(row.date);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          // September 1 rollover: Sept-Dec is start year, Jan-Aug is previous year
          const academicYearStart = month >= 9 ? year : year - 1;
          yearsSet.add(academicYearStart);
        }
      }

      return Array.from(yearsSet).sort((a, b) => b - a);
    }, 'Failed to fetch gallery academic years');
  }

  /**
   * Get total or filtered count of public gallery albums.
   */
  async getFilteredAlbumCount(filters: { date_from?: string; date_to?: string; search?: string } = {}): Promise<number> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('gallery_events')
        .select('*', { count: 'exact', head: true })
        .not('google_photos_url', 'is', null);

      if (filters.date_from) query = query.gte('date', filters.date_from);
      if (filters.date_to) query = query.lte('date', filters.date_to);

      if (filters.search) {
        const clean = sanitizeSearchQuery(filters.search);
        if (clean.length > 0) {
          const escaped = escapeIlikePattern(clean);
          query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
        }
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }, 'Failed to fetch gallery count');
  }
  /**
   * Get gallery albums with optional pagination
   */
  async getAlbums(filters: GalleryFilters = {}): Promise<GalleryAlbum[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('gallery_events')
        .select('id, title, description, date, google_photos_url, cover_image_url, cover_thumbnail_url, event_id, event:events(id, name, date, academic_term_id, is_published)')
        .not('google_photos_url', 'is', null)
        .order('date', { ascending: false });

      if (filters.date_from) query = query.gte('date', filters.date_from);
      if (filters.date_to) query = query.lte('date', filters.date_to);

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset !== undefined) {
        const limit = filters.limit || 12;
        query = query.range(filters.offset, filters.offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data) return [];

      // Normalize event relation (Supabase might return array)
      return data.map((row: any) => ({
        ...row,
        event: Array.isArray(row.event) ? (row.event[0] ?? null) : (row.event ?? null),
      })) as GalleryAlbum[];
    }, 'Failed to fetch gallery albums');
  }

  /**
   * The newest public albums with a cover, linked to a published event of one
   * of these types: a program page's photography (VCN, Wild N' Culture) comes
   * from what admins filed under that kind of event, never a hardcoded file.
   */
  async getProgramAlbums(eventTypes: SiteEventType[], limit = 2): Promise<ProgramAlbum[]> {
    return withErrorHandling(async () => {
      if (eventTypes.length === 0) return [];
      const { data, error } = await supabase
        .from('gallery_events')
        .select('id, title, date, google_photos_url, cover_image_url, cover_thumbnail_url, event:events!inner(event_type, is_published)')
        .not('google_photos_url', 'is', null)
        .not('cover_image_url', 'is', null)
        .in('event.event_type', eventTypes)
        .eq('event.is_published', true)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title ?? 'Photo album',
        date: row.date,
        google_photos_url: row.google_photos_url,
        cover_image_url: row.cover_image_url,
        cover_thumbnail_url: row.cover_thumbnail_url ?? null,
      }));
    }, 'Failed to fetch program photos');
  }

  /**
   * The slim projection site search indexes. Same visibility rule as getAlbums
   * (an album is public exactly when it has a Google Photos URL), one bounded
   * query fetched once per session -- not per keystroke.
   */
  async getPublicSearchAlbums(limit: number = PUBLIC_SEARCH_ALBUM_LIMIT): Promise<PublicSearchAlbum[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('gallery_events')
        .select('id, title, date, google_photos_url')
        .not('google_photos_url', 'is', null)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as PublicSearchAlbum[];
    }, 'Failed to fetch gallery albums for search');
  }

  /**
   * Get total count of gallery albums
   */
  async getAlbumCount(): Promise<number> {
    return withErrorHandling(async () => {
      const { count, error } = await supabase
        .from('gallery_events')
        .select('*', { count: 'exact', head: true })
        .not('google_photos_url', 'is', null);

      if (error) throw error;
      return count || 0;
    }, 'Failed to fetch gallery count');
  }
}

export const galleryRepository = new GalleryRepository();
