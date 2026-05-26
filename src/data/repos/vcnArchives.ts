import { supabase } from '../../lib/supabase';
import { VCNArchive } from '../../types';
import { withErrorHandling } from '../errors';

export type VCNArchiveFormData = Omit<VCNArchive, 'id' | 'created_at' | 'updated_at'>;

export class VCNArchivesRepository {
  async getPublishedArchives(): Promise<VCNArchive[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('published_vcn_archives')
        .select('id, year, title, annual_number, theme_name, event_date, event_time, venue, description, video_url, photo_album_url, album_source, cover_image_url, cover_thumbnail_url, poster_url, trailer_url, photo_credit, is_published, is_featured, is_current, ticket_status, ticket_url, ticket_note, display_order, created_at, updated_at')
        .eq('is_published', true)
        .order('display_order', { ascending: true })
        .order('year', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((archive) => ({
        ...archive,
        source_doc_url: null,
        internal_notes: null,
      })) as VCNArchive[];
    }, 'Failed to fetch VCN archives');
  }

  async getCurrentArchive(): Promise<VCNArchive | null> {
    try {
      const { data, error } = await supabase
        .from('published_vcn_archives')
        .select('id, year, title, annual_number, theme_name, event_date, event_time, venue, description, video_url, photo_album_url, album_source, cover_image_url, cover_thumbnail_url, poster_url, trailer_url, photo_credit, is_published, is_featured, is_current, ticket_status, ticket_url, ticket_note, display_order, created_at, updated_at')
        .eq('is_published', true)
        .order('is_current', { ascending: false })
        .order('is_featured', { ascending: false })
        .order('year', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Using fallback current VCN content:', error.message);
        return null;
      }

      if (!data) return null;
      return {
        ...(data as VCNArchive),
        source_doc_url: null,
        internal_notes: null,
      };
    } catch (error) {
      console.warn('Using fallback current VCN content:', error);
      return null;
    }
  }

  async getAllArchives(): Promise<VCNArchive[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('vcn_archives')
        .select('*')
        .order('display_order', { ascending: true })
        .order('year', { ascending: false });

      if (error) throw error;
      return (data ?? []) as VCNArchive[];
    }, 'Failed to fetch VCN archives');
  }

  async createArchive(archive: VCNArchiveFormData): Promise<VCNArchive> {
    return withErrorHandling(async () => {
      if (archive.is_current) {
        await supabase
          .from('vcn_archives')
          .update({ is_current: false, updated_at: new Date().toISOString() })
          .eq('is_current', true);
      }

      const { data, error } = await supabase
        .from('vcn_archives')
        .insert({
          ...archive,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as VCNArchive;
    }, 'Failed to create VCN archive');
  }

  async updateArchive(id: string, archive: Partial<VCNArchiveFormData>): Promise<VCNArchive> {
    return withErrorHandling(async () => {
      if (archive.is_current) {
        await supabase
          .from('vcn_archives')
          .update({ is_current: false, updated_at: new Date().toISOString() })
          .eq('is_current', true)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('vcn_archives')
        .update({
          ...archive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as VCNArchive;
    }, 'Failed to update VCN archive');
  }
}

export const vcnArchivesRepository = new VCNArchivesRepository();
