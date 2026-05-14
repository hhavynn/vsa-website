import { supabase } from '../../lib/supabase';
import { ProgramContent, ProgramPageKey, ProgramSectionKey } from '../../types';
import { withErrorHandling } from '../errors';

export type ProgramContentFormData = Omit<ProgramContent, 'id' | 'created_at' | 'updated_at'>;

const PUBLIC_PROGRAM_CONTENT_SELECT = [
  'id',
  'page_key',
  'section_key',
  'title',
  'body',
  'status',
  'primary_link_label',
  'primary_link_url',
  'secondary_link_label',
  'secondary_link_url',
  'open_at',
  'close_at',
  'deadline_at',
  'event_date',
  'venue',
  'is_published',
  'display_order',
  'created_at',
  'updated_at',
].join(', ');

export class ProgramContentRepository {
  async getPublishedContent(
    pageKey: ProgramPageKey,
    sectionKey: ProgramSectionKey = 'current_cycle',
  ): Promise<ProgramContent | null> {
    try {
      const { data, error } = await supabase
        .from('program_content')
        .select(PUBLIC_PROGRAM_CONTENT_SELECT)
        .eq('page_key', pageKey)
        .eq('section_key', sectionKey)
        .eq('is_published', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Using fallback program content:', error.message);
        return null;
      }

      if (!data) return null;
      return {
        ...(data as unknown as ProgramContent),
        source_doc_url: null,
        internal_notes: null,
      };
    } catch (error) {
      console.warn('Using fallback program content:', error);
      return null;
    }
  }

  async getAllContent(): Promise<ProgramContent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('program_content')
        .select('*')
        .order('display_order', { ascending: true })
        .order('page_key', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ProgramContent[];
    }, 'Failed to fetch program content');
  }

  async upsertContent(content: ProgramContentFormData): Promise<ProgramContent> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('program_content')
        .upsert(
          {
            ...content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'page_key,section_key' },
        )
        .select('*')
        .single();

      if (error) throw error;
      return data as ProgramContent;
    }, 'Failed to save program content');
  }
}

export const programContentRepository = new ProgramContentRepository();
