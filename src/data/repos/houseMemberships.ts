// Protected domain — House membership. This repository only READS
// house_memberships; assignment and interval management belong to
// Admin -> Houses. Do not add writes here without an explicit owner request.
// Authority: AGENTS.md § "Things to never do"; vsa-change-control § 1.
import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

interface HouseProfileRef {
  display_name?: string | null;
  house_key?: string | null;
}

interface HouseMembershipRow {
  member_id: string;
  house_page_assets: HouseProfileRef | HouseProfileRef[] | null;
}

/**
 * PostgREST returns a many-to-one embed as an object, but some relationship
 * shapes hand back a single-element array. `src/types/database.ts` carries no
 * `Relationships` blocks, so the cardinality cannot be inferred from the
 * generated types and both forms have to be accepted — otherwise a shape
 * change would silently render every member as unassigned, which is
 * indistinguishable from the correct empty state before House Reveal.
 */
function readHouseLabel(embedded: HouseMembershipRow['house_page_assets']): string | null {
  const profile = Array.isArray(embedded) ? embedded[0] ?? null : embedded;
  return profile?.display_name ?? profile?.house_key ?? null;
}

export class HouseMembershipsRepository {
  /**
   * House label per member for the membership in effect on `onDate`.
   *
   * Filtering by academic year alone is not enough. Admin -> Houses handles a
   * reassignment by closing the open interval (`effective_end_date = <start of
   * the new one>`) and inserting a replacement, and it may insert a membership
   * that starts in the future. A member can therefore hold several rows for
   * one academic year, and picking an arbitrary one shows a House they have
   * been moved out of, or one they have not moved into yet.
   *
   * Members with no membership in effect are simply absent from the map.
   */
  async getHouseLabelsByMemberId(
    academicYearStart: number,
    onDate: string,
  ): Promise<Map<string, string>> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_memberships')
        .select('member_id, house_page_assets(display_name, house_key)')
        .eq('academic_year_start', academicYearStart)
        .lte('effective_start_date', onDate)
        .or(`effective_end_date.is.null,effective_end_date.gt.${onDate}`);

      if (error) throw error;

      const labels = new Map<string, string>();
      for (const row of (data ?? []) as HouseMembershipRow[]) {
        const label = readHouseLabel(row.house_page_assets);
        if (label) labels.set(row.member_id, label);
      }
      return labels;
    }, 'Failed to fetch House memberships');
  }
}

export const houseMembershipsRepository = new HouseMembershipsRepository();
