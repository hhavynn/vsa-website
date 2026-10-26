// Admin-only House Parent identity links (house_parents). Public pages show
// House Parents through house_page_assets.house_parent_* fields; this table
// only ties each House Parent to a canonical members.id. A null member_id
// means the link still needs an admin to review it.
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { withErrorHandling } from '../errors';

export type HouseParentRow = Database['public']['Tables']['house_parents']['Row'];

export interface HouseParentLink extends HouseParentRow {
  houseLabel: string;
  houseDisplayOrder: number;
}

export class HouseParentsRepository {
  /** Every House Parent for a year's House profiles, House order then slot order. */
  async listForYear(academicYearStart: number): Promise<HouseParentLink[]> {
    return withErrorHandling(async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('house_page_assets')
        .select('id, display_name, house_key, display_order')
        .eq('academic_year_start', academicYearStart);
      if (profilesError) throw profilesError;
      const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      if (byId.size === 0) return [];

      const { data, error } = await supabase
        .from('house_parents')
        .select('*')
        .in('house_profile_id', Array.from(byId.keys()));
      if (error) throw error;
      return (data ?? [])
        .map((row) => {
          const profile = byId.get(row.house_profile_id);
          return {
            ...row,
            houseLabel: profile?.display_name || profile?.house_key || 'Unknown House',
            houseDisplayOrder: profile?.display_order ?? 0,
          };
        })
        .sort((a, b) => a.houseDisplayOrder - b.houseDisplayOrder || a.display_order - b.display_order);
    }, 'Failed to load House Parents');
  }

  /** Links (or, with null, unlinks) a House Parent to a canonical member. */
  async setMember(parentId: string, memberId: string | null): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('house_parents')
        .update({ member_id: memberId, review_note: memberId ? null : 'Unlinked by an admin. Link the right member record.' })
        .eq('id', parentId);
      if (error) throw error;
    }, 'Failed to update the House Parent link');
  }
}

export const houseParentsRepository = new HouseParentsRepository();
