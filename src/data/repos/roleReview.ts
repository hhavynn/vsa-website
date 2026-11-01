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
    const seenIds = new Set<string>();
    for (let start = 0; start < 5000; start += PAGE_SIZE) {
      const { data, error } = await supabase.from('cabinet_members')
        .select('id, name, role, category, member_id, cabinet_year_id')
        .eq('cabinet_year_id', cabinetYearId)
        .order('id', { ascending: true })
        .range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > PAGE_SIZE) {
        throw new Error('Cabinet role sources returned an invalid page. Refresh before linking.');
      }
      // The UI may say "Ready" only when all reviewed source rows really
      // belong to this Cabinet year, have valid published-record fields and
      // have unique IDs across *all* pages. Never select a first duplicate.
      const page = data as CabinetRoleSource[];
      for (const row of page) {
        if (!row || typeof row.id !== 'string' || !row.id.trim() ||
            typeof row.name !== 'string' || typeof row.role !== 'string' ||
            typeof row.category !== 'string' || row.cabinet_year_id !== cabinetYearId ||
            (row.member_id !== null && typeof row.member_id !== 'string') ||
            seenIds.has(row.id)) {
          throw new Error('Cabinet role sources are incomplete or inconsistent. Refresh before linking.');
        }
        seenIds.add(row.id);
      }
      result.push(...page);
      if (page.length < PAGE_SIZE) return result;
    }
    throw new Error('Cabinet source review exceeded the safe read limit.');
  }, 'Failed to read Cabinet role sources for review');
}
