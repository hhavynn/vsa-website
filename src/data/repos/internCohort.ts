import { supabase } from '../../lib/supabase';
import { InternCohortMember, PublicInternCohortMember } from '../../types';
import { withErrorHandling } from '../errors';

export type InternCohortMemberFormData = Omit<InternCohortMember, 'id' | 'created_at' | 'updated_at'>;

function byDisplayOrder<T extends { display_order: number; name: string }>(a: T, b: T) {
  const order = a.display_order - b.display_order;
  return order !== 0 ? order : a.name.localeCompare(b.name);
}

export class InternCohortRepository {
  async getPublishedMembers(academicYearStart: number): Promise<PublicInternCohortMember[]> {
    try {
      const { data, error } = await supabase
        .from('published_intern_cohort_members')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Using empty intern cohort:', error.message);
        return [];
      }

      return ((data ?? []) as PublicInternCohortMember[]).sort(byDisplayOrder);
    } catch (error) {
      console.warn('Using empty intern cohort:', error);
      return [];
    }
  }

  async getAdminMembers(academicYearStart: number): Promise<InternCohortMember[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('intern_cohort_members')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as InternCohortMember[]).sort(byDisplayOrder);
    }, 'Failed to fetch intern cohort members');
  }

  async upsertMember(member: Partial<InternCohortMemberFormData> & { id?: string; name: string }): Promise<InternCohortMember> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('intern_cohort_members')
        .upsert({
          ...member,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as InternCohortMember;
    }, 'Failed to save intern cohort member');
  }

  async deleteMember(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('intern_cohort_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, 'Failed to delete intern cohort member');
  }
}

export const internCohortRepository = new InternCohortRepository();
