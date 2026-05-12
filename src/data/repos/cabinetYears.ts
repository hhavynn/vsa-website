import { supabase } from '../../lib/supabase';
import { CabinetYear } from '../../types';
import { withErrorHandling } from '../errors';

export class CabinetYearsRepository {
  async getYears(): Promise<CabinetYear[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_years')
        .select('*')
        .order('start_year', { ascending: false })
        .order('display_order', { ascending: false });

      if (error) throw error;
      return (data ?? []) as CabinetYear[];
    }, 'Failed to fetch cabinet years');
  }

  async createYear(year: Omit<CabinetYear, 'id' | 'created_at' | 'updated_at'>): Promise<CabinetYear> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_years')
        .insert({
          ...year,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as CabinetYear;
    }, 'Failed to create cabinet year');
  }

  async updateYear(id: string, year: Partial<Omit<CabinetYear, 'id' | 'created_at' | 'updated_at'>>): Promise<CabinetYear> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_years')
        .update({
          ...year,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as CabinetYear;
    }, 'Failed to update cabinet year');
  }

  async setActiveYear(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error: clearError } = await supabase
        .from('cabinet_years')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .neq('id', id);

      if (clearError) throw clearError;

      const { error } = await supabase
        .from('cabinet_years')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }, 'Failed to set active cabinet year');
  }
}

export const cabinetYearsRepository = new CabinetYearsRepository();
