import { supabase } from '../../lib/supabase';
import { AcademicTerm } from '../../types';
import {
  getAcademicTermDateRange,
  getAcademicTermDisplayOrder,
  getAcademicTermMeta,
} from '../../lib/academicTerms';
import { withErrorHandling } from '../errors';

export class AcademicTermsRepository {
  async getTerms(): Promise<AcademicTerm[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('academic_terms')
        .select('*')
        .order('academic_year_start', { ascending: false })
        .order('display_order', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AcademicTerm[];
    }, 'Failed to fetch academic terms');
  }

  async ensureTermForDate(value: string | Date): Promise<AcademicTerm | null> {
    return withErrorHandling(async () => {
      const meta = getAcademicTermMeta(value);
      if (!meta) return null;

      const range = getAcademicTermDateRange(meta.quarter, meta.calendarYear);
      const displayOrder = getAcademicTermDisplayOrder(meta.quarter, meta.academicYearStart);

      const { data, error } = await supabase
        .from('academic_terms')
        .upsert(
          {
            code: meta.code,
            label: meta.label,
            academic_year_start: meta.academicYearStart,
            academic_year_end: meta.academicYearEnd,
            quarter: meta.quarter,
            starts_on: range.startsOn,
            ends_on: range.endsOn,
            display_order: displayOrder,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'code' }
        )
        .select('*')
        .single();

      if (error) throw error;
      return data as AcademicTerm;
    }, 'Failed to ensure academic term');
  }

  async createTerm(term: Omit<AcademicTerm, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicTerm> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('academic_terms')
        .insert({
          ...term,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as AcademicTerm;
    }, 'Failed to create academic term');
  }

  async updateTerm(id: string, term: Partial<Omit<AcademicTerm, 'id' | 'created_at' | 'updated_at'>>): Promise<AcademicTerm> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('academic_terms')
        .update({
          ...term,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as AcademicTerm;
    }, 'Failed to update academic term');
  }

  async setActiveTerm(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error: clearError } = await supabase
        .from('academic_terms')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .neq('id', id);

      if (clearError) throw clearError;

      const { error } = await supabase
        .from('academic_terms')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }, 'Failed to set active academic term');
  }
}

export const academicTermsRepository = new AcademicTermsRepository();
