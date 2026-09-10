import { supabase } from '../../lib/supabase';
import { withErrorHandling, NotFoundError } from '../errors';
import { UVSASchool } from '../../types';

/**
 * Every `uvsa_schools` column an anonymous visitor may read.
 *
 * `verification_notes` and `confidence_level` are deliberately absent: migration
 * 20260820000002_restrict_anon_uvsa_columns.sql revokes anon's table-wide SELECT
 * and re-grants only these columns (#382). A `select('*')` therefore fails for
 * anon, so public read paths must name their columns.
 *
 * Admin reads run as `authenticated`, which keeps table-level SELECT.
 */
export const PUBLIC_UVSA_SCHOOL_COLUMNS =
  'id, school_name, short_name, slug, system_type, city, vsa_name, instagram_url, linktree_url, website_url, facebook_url, youtube_url, tiktok_url, description, known_for, recurring_events, logo_url, image_url, is_active, sort_order, created_at, updated_at' as const;

export class UVSASchoolsRepository {
  /**
   * Get all active UVSA schools
   */
  async getSchools(): Promise<UVSASchool[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('uvsa_schools')
        .select(PUBLIC_UVSA_SCHOOL_COLUMNS)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    }, 'Failed to fetch UVSA schools');
  }

  /**
   * Get all UVSA schools (including inactive) for admin
   */
  async getAllSchools(): Promise<UVSASchool[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('uvsa_schools')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    }, 'Failed to fetch all UVSA schools');
  }

  /**
   * Get school by ID
   */
  async getSchoolById(id: string): Promise<UVSASchool> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('uvsa_schools')
        .select(PUBLIC_UVSA_SCHOOL_COLUMNS)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new NotFoundError('School not found', 'uvsa_schools', id);
      return data;
    }, 'Failed to fetch school');
  }

  /**
   * Get school by slug
   */
  async getSchoolBySlug(slug: string): Promise<UVSASchool> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('uvsa_schools')
        .select(PUBLIC_UVSA_SCHOOL_COLUMNS)
        .eq('slug', slug)
        .single();

      if (error) throw error;
      if (!data) throw new NotFoundError('School not found', 'uvsa_schools', slug);
      return data;
    }, 'Failed to fetch school by slug');
  }

  /**
   * Create or update school
   */
  async upsertSchool(school: Partial<UVSASchool>): Promise<UVSASchool> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('uvsa_schools')
        .upsert(school)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Failed to save school');
  }

  /**
   * Delete school
   */
  async deleteSchool(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('uvsa_schools')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, 'Failed to delete school');
  }
}

export const uvsaSchoolsRepository = new UVSASchoolsRepository();
