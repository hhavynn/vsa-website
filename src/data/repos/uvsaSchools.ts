import { supabase } from '../../lib/supabase';
import { withErrorHandling, NotFoundError } from '../errors';
import { UVSASchool } from '../../types';

export class UVSASchoolsRepository {
  /**
   * Get all active UVSA schools
   */
  async getSchools(): Promise<UVSASchool[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('uvsa_schools')
        .select('*')
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
        .select('*')
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
        .select('*')
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
