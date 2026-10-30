// Public House lookup launch signal — no private assignment reads.
// An approved, published House batch is already filtered by the existing
// public_house_memberships view. A bounded existence check cannot disclose
// scores, hidden assignments, application notes, or the House roster.
import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

export async function hasRevealedHouseMemberships(year: number): Promise<boolean> {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('public_house_memberships')
      .select('member_id')
      .eq('academic_year_start', year)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }, 'Failed to check published House Reveal');
}
