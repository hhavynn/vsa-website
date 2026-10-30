// Public House lookup launch signal — no private assignment reads.
// An approved, published House batch is already filtered by the existing
// public_house_memberships view. A HEAD-only existence check (no returned rows) cannot disclose
// scores, hidden assignments, application notes, or the House roster.
import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

export async function hasRevealedHouseMemberships(year: number): Promise<boolean> {
  return withErrorHandling(async () => {
    const { count, error } = await supabase
      .from('public_house_memberships')
      .select('member_id', { count: 'exact', head: true })
      .eq('academic_year_start', year);
    if (error) throw error;
    if (count === null) throw new Error('House Reveal availability count was not returned.');
    return count > 0;
  }, 'Failed to check published House Reveal');
}
