import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';
import type { CabinetRoleSource } from '../../lib/bulkRoleReview';

const PAGE_SIZE = 500;

/**
 * Admin-only review input from the already-published Cabinet directory.
 * Do not read private roster drafts or expose their status to public clients.
 * Supabase RLS remains the write boundary; this method never mutates roles.
 */
export async function listCabinetRoleReviewSources(cabinetYearId: string): Promise<CabinetRoleSource[]> {
  if (!cabinetYearId) return [];
  return withErrorHandling(async () => {
    const result: CabinetRoleSource[] = [];
    for (let start = 0; start < 5000; start += PAGE_SIZE) {
      const { data, error } = await supabase.from('cabinet_members')
        .select('id, name, role, category, member_id, cabinet_year_id')
        .eq('cabinet_year_id', cabinetYearId)
        .order('id', { ascending: true })
        .range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      result.push(...((data ?? []) as CabinetRoleSource[]));
      if (!data || data.length < PAGE_SIZE) return result;
    }
    throw new Error('Cabinet source review exceeded the safe read limit.');
  }, 'Failed to read Cabinet role sources for review');
}
