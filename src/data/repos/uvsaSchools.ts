import { supabase } from '../../lib/supabase';
import { withErrorHandling, NotFoundError, ValidationError } from '../errors';
import { UVSASchool } from '../../types';
import { Database } from '../../types/database';
import { getUploadExtension, prepareImageForUpload } from '../../lib/imageUpload';
import {
  UVSA_SCHOOL_ASSETS_BUCKET,
  buildSchoolLogoPath,
  isAcceptedSchoolLogoType,
} from '../../lib/uvsaSchoolLogos';

type UVSASchoolInsert = Database['public']['Tables']['uvsa_schools']['Insert'];

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
        .select<string, UVSASchool>(PUBLIC_UVSA_SCHOOL_COLUMNS)
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
        .select<string, UVSASchool>('*')
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
        .select<string, UVSASchool>(PUBLIC_UVSA_SCHOOL_COLUMNS)
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
        .select<string, UVSASchool>(PUBLIC_UVSA_SCHOOL_COLUMNS)
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
        .upsert(school as UVSASchoolInsert)
        .select<string, UVSASchool>()
        .single();

      if (error) throw error;
      return data;
    }, 'Failed to save school');
  }

  /**
   * Compress a logo / Instagram PFP and upload it to the public
   * `uvsa_school_assets` bucket under `<slug>/`. Returns the public URL; the
   * caller saves it into `uvsa_schools.logo_url`.
   *
   * Replaced or removed logos are intentionally not deleted from Storage
   * (AGENTS.md: never delete Storage files) — they are small and unreferenced.
   */
  async uploadSchoolLogo(slug: string, file: File): Promise<string> {
    return withErrorHandling(async () => {
      if (!isAcceptedSchoolLogoType(file)) {
        throw new ValidationError('Logo must be a PNG, JPG, or WebP image.', 'file');
      }

      const { file: prepared } = await prepareImageForUpload(file, 'logo');
      const path = buildSchoolLogoPath(slug, crypto.randomUUID(), getUploadExtension(prepared));

      const { error } = await supabase.storage.from(UVSA_SCHOOL_ASSETS_BUCKET).upload(path, prepared, {
        cacheControl: '31536000',
        contentType: prepared.type,
      });
      if (error) throw error;

      return supabase.storage.from(UVSA_SCHOOL_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
    }, 'Failed to upload school logo');
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
