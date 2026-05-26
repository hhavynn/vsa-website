import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

export interface RelatedEvent {
  id: string;
  name: string;
  date: string;
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
}

export class GalleryRepository {
  /**
   * Get gallery albums with optional pagination
   */
  async getAlbums(filters: GalleryFilters = {}): Promise<GalleryAlbum[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('gallery_events')
        .select('id, title, description, date, google_photos_url, cover_image_url, cover_thumbnail_url, event_id, event:events(id, name, date)')
        .not('google_photos_url', 'is', null)
        .order('date', { ascending: false });

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
