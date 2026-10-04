import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

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

export interface GalleryFilters {
  limit?: number;
  offset?: number;
  /** Inclusive "YYYY-MM-DD" bounds — gallery_events.date is a DATE column. */
  date_from?: string;
  date_to?: string;
}

/** Upper bound on albums the search index loads (newest first). */
export const PUBLIC_SEARCH_ALBUM_LIMIT = 300;

export interface PublicSearchAlbum {
  id: string;
  title: string;
  date: string;
  google_photos_url: string;
}

export class GalleryRepository {
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
