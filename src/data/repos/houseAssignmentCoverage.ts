// Admin-only, READ-ONLY House batch coverage. Never publishes assignments or
// writes memberships. The existing batch editor owns all reviewed corrections.
import { supabase } from '../../lib/supabase';
import type { HouseAssignmentDraft } from '../../lib/houseAssignmentDraft';
import { withErrorHandling } from '../errors';

export type CoverageDraft = Pick<HouseAssignmentDraft,
  'id' | 'member_id' | 'house_profile_id' | 'source_name' | 'source_order' | 'match_status'
>;
const PAGE_SIZE = 500;

/** Reads every row, not just PostgREST's default first 1,000. */
export async function getCompleteHouseBatchCoverage(batchId: string): Promise<CoverageDraft[]> {
  return withErrorHandling(async () => {
    const rows: CoverageDraft[] = [];
    for (let from = 0;; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('house_assignment_drafts')
        .select('id,member_id,house_profile_id,source_name,source_order,match_status')
        .eq('batch_id', batchId)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as CoverageDraft[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }, 'Failed to read complete House assignment coverage');
}
