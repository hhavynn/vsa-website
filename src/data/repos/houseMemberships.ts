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
  id: string;
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

/** A member's publicly announced House for one academic year. No points. */
export interface PublicMemberHouse {
  houseProfileId: string;
  houseKey: string | null;
  label: string;
  accentColor: string | null;
  academicYearStart: number;
}

interface PublicHouseMembershipRow {
  member_id: string;
  academic_year_start: number;
  effective_start_date: string;
  effective_end_date: string | null;
  house_profile_id: string;
  house_key: string | null;
  display_name: string | null;
  accent_color: string | null;
}

const PUBLIC_PAGE = 1000;

/**
 * The membership to show for a member, from their newest academic year: the
 * one in effect on `onDate`; for a year that is over, the one they ended it
 * in; for a year still running, the next upcoming one (announced at Reveal,
 * starting later). A membership that ended this year with no successor shows
 * nothing rather than a House the member left.
 */
function pickRow(rows: PublicHouseMembershipRow[], onDate: string): PublicHouseMembershipRow | null {
  const sorted = [...rows].sort((a, b) =>
    b.academic_year_start - a.academic_year_start || b.effective_start_date.localeCompare(a.effective_start_date));
  const newestYear = sorted[0].academic_year_start;
  const inYear = sorted.filter((row) => row.academic_year_start === newestYear);
  const inEffect = inYear.find((row) => row.effective_start_date <= onDate && (!row.effective_end_date || row.effective_end_date > onDate));
  if (inEffect) return inEffect;
  const yearOver = onDate >= `${newestYear + 1}-07-01`;
  if (yearOver) return inYear.find((row) => row.effective_start_date <= onDate) ?? null;
  return [...inYear].reverse().find((row) => row.effective_start_date > onDate) ?? null;
}

export class HouseMembershipsRepository {
  /**
   * Publicly announced House per member, from public_house_memberships
   * (Reveal-gated and score-free). Never reads the members.house cache, which
   * can hold a previous year's House. `academicYearStart = 'all'` shows each
   * member's most recent revealed House. Every page is read; a failed page
   * fails the whole read.
   */
  async getPublicHousesByMemberId(academicYearStart: number | 'all', onDate: string): Promise<Map<string, PublicMemberHouse>> {
    return withErrorHandling(async () => {
      const rows: PublicHouseMembershipRow[] = [];
      for (let from = 0; ; from += PUBLIC_PAGE) {
        let query = supabase
          .from('public_house_memberships')
          .select('member_id, academic_year_start, effective_start_date, effective_end_date, house_profile_id, house_key, display_name, accent_color');
        if (academicYearStart !== 'all') query = query.eq('academic_year_start', academicYearStart);
        const { data, error } = await query
          .order('member_id', { ascending: true })
          .order('academic_year_start', { ascending: true })
          .order('effective_start_date', { ascending: true })
          .range(from, from + PUBLIC_PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as PublicHouseMembershipRow[];
        rows.push(...page);
        if (page.length < PUBLIC_PAGE) break;
      }
      const byMember = new Map<string, PublicHouseMembershipRow[]>();
      rows.forEach((row) => byMember.set(row.member_id, [...(byMember.get(row.member_id) ?? []), row]));
      const houses = new Map<string, PublicMemberHouse>();
      byMember.forEach((memberRows, memberId) => {
        const row = pickRow(memberRows, onDate);
        if (!row) return;
        houses.set(memberId, {
          houseProfileId: row.house_profile_id,
          houseKey: row.house_key,
          label: row.display_name || row.house_key || 'House',
          accentColor: row.accent_color,
          academicYearStart: row.academic_year_start,
        });
      });
      return houses;
    }, 'Failed to fetch public House memberships');
  }

  /**
   * Visible leaderboard badges: one bounded, year-scoped public view query for
   * at most 100 canonical IDs, not one RPC for each row or a full public roster
   * read. The view is Reveal-gated and excludes House scores/attendance.
   */
  async getPublishedHousesForMemberIds(
    academicYearStart: number,
    memberIds: readonly string[],
    onDate: string,
  ): Promise<Map<string, PublicMemberHouse>> {
    if (!Number.isInteger(academicYearStart) || academicYearStart < 2000 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(onDate)) throw new Error('Invalid published House year or date');
    const ids = Array.from(new Set(memberIds)).sort();
    if (ids.length > 100) throw new Error('Public House badge lookup exceeds 100 visible members');
    if (ids.length === 0) return new Map();
    return withErrorHandling(async () => {
      const rows: PublicHouseMembershipRow[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from('public_house_memberships')
          .select('member_id,academic_year_start,effective_start_date,effective_end_date,house_profile_id,house_key,display_name,accent_color')
          .eq('academic_year_start', academicYearStart)
          .in('member_id', ids)
          .order('member_id', { ascending: true })
          .order('effective_start_date', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const page = (data ?? []) as PublicHouseMembershipRow[];
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      const grouped = new Map<string, PublicHouseMembershipRow[]>();
      for (const row of rows) {
        if (row.academic_year_start !== academicYearStart || !ids.includes(row.member_id)) {
          throw new Error('Unexpected House badge row for a different year or member');
        }
        grouped.set(row.member_id, [...(grouped.get(row.member_id) ?? []), row]);
      }
      const badges = new Map<string, PublicMemberHouse>();
      grouped.forEach((history, memberId) => {
        const current = pickRow(history, onDate);
        if (current) badges.set(memberId, {
          houseProfileId: current.house_profile_id,
          houseKey: current.house_key,
          label: current.display_name || current.house_key || 'House',
          accentColor: current.accent_color,
          academicYearStart: current.academic_year_start,
        });
      });
      return badges;
    }, 'Failed to fetch visible published House badges');
  }

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
      const labels = new Map<string, string>();
      let lastId: string | null = null;

      for (;;) {
        // The admin member directory can exceed PostgREST's single-query row
        // limit. Read ALL current-year intervals before reporting unassigned.
        let query = supabase
          .from('house_memberships')
          .select('id, member_id, house_page_assets(display_name, house_key)')
          .eq('academic_year_start', academicYearStart)
          .lte('effective_start_date', onDate)
          .or(`effective_end_date.is.null,effective_end_date.gt.${onDate}`)
          .order('id', { ascending: true })
          .limit(500);

        if (lastId) query = query.gt('id', lastId);

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data ?? []) as HouseMembershipRow[];
        for (const row of rows) {
          const label = readHouseLabel(row.house_page_assets);
          if (label) labels.set(row.member_id, label);
        }
        if (rows.length < 500) break;

        const nextId = rows[rows.length - 1].id;
        if (!nextId || (lastId && nextId <= lastId)) {
          throw new Error('House membership pagination cursor did not advance');
        }
        lastId = nextId;
      }

      return labels;
    }, 'Failed to fetch House memberships');
  }
}

export const houseMembershipsRepository = new HouseMembershipsRepository();

/**
 * HEAD-only public existence check. An approved House Reveal creates visible
 * rows in the existing score-free projection; a denied/unknown read fails closed.
 * No member IDs, assignments, points or roster rows reach the browser.
 */
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
