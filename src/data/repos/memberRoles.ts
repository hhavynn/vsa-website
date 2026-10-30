import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';
import {
  shapePublishedCabinetRoles,
  type PublicMemberRole,
  type PublishedCabinetRoleRow,
} from '../../lib/memberRoles';

/**
 * Read-only, bounded lookup for already-public roster entries. The source is
 * the same cabinet_members collection rendered at /cabinet, not an admin draft.
 * Selection is explicitly allowlisted: no names, bios, emails, photos or notes.
 *
 * A missing/ambiguous year returns no labels; a denied read throws so the
 * leaderboard can explain missing badges without hiding the point rankings.
 */
export async function getPublicMemberRoles(
  academicYearStart: number,
  memberIds: readonly string[],
): Promise<Map<string, PublicMemberRole[]>> {
  const ids = Array.from(new Set(memberIds.filter(Boolean))).sort();
  if (ids.length === 0) return new Map();
  // The public pager supports 25, 50, 100 and Show All. Large visible
  // selections must be chunked, never silently lose everyone's badges.
  if (ids.length > 2000) throw new Error('Role lookup exceeds a safe visible-member limit.');

  return withErrorHandling(async () => {
    const { data: years, error: yearError } = await supabase
      .from('cabinet_years')
      .select('id')
      .eq('start_year', academicYearStart)
      .limit(2);

    if (yearError) throw yearError;
    if (!years?.length) return new Map<string, PublicMemberRole[]>();
    if (years.length !== 1) throw new Error('Ambiguous Cabinet year. Role badges cannot be verified.');

    const matches: PublishedCabinetRoleRow[] = [];
    // One year lookup; <=50 IDs per PostgREST request, never an N+1 role
    // request per person. Page 100 / Show All require several safe batches.
    for (let from = 0; from < ids.length; from += 50) {
      const batch = ids.slice(from, from + 50);
      const { data, error } = await supabase
        .from('cabinet_members')
        .select('id, member_id, role, category')
        .eq('cabinet_year_id', years[0].id)
        .in('member_id', batch)
        .limit(501);
      if (error) throw error;
      if ((data ?? []).length >= 501) throw new Error('Public Cabinet role result exceeds safe bound.');
      matches.push(...((data ?? []) as PublishedCabinetRoleRow[]));
    }
    return shapePublishedCabinetRoles(matches, ids, academicYearStart);
  }, 'Failed to fetch published member roles');
}


/** The published Cabinet roster is the only approved year-specific Board source.
 * A roster read failure or missing Board publication MUST NOT classify every
 * member as a general member. This read uses ID/category only, never names,
 * admin drafts, scores or private attendance.
 */
export async function getPublishedBoardMemberIds(academicYearStart: number): Promise<Set<string>> {
  return withErrorHandling(async () => {
    const { data: years, error: yearError } = await supabase
      .from('cabinet_years')
      .select('id')
      .eq('start_year', academicYearStart)
      .limit(2);
    if (yearError) throw yearError;
    if (!years || years.length !== 1) throw new Error('Published Cabinet year is unavailable or ambiguous.');

    const ids = new Set<string>();
    let foundBoardPosition = false;
    let foundUnlinkedPosition = false;
    const pageSize = 500;
    for (let start = 0; start < 5000; start += pageSize) {
      const { data, error } = await supabase
        .from('cabinet_members')
        .select('id, member_id, category')
        .eq('cabinet_year_id', years[0].id)
        .order('id', { ascending: true })
        .range(start, start + pageSize - 1);
      if (error) throw error;
      const rows = data ?? [];
      for (const row of rows) {
        if (row.category !== 'Executive Board' && row.category !== 'General Board') continue;
        foundBoardPosition = true;
        if (row.member_id) ids.add(row.member_id);
        else foundUnlinkedPosition = true;
      }
      if (rows.length < pageSize) {
        if (!foundBoardPosition) throw new Error('Published Board roster is not yet available.');
        // An unlinked officer would otherwise be ranked as a general member.
        if (foundUnlinkedPosition) throw new Error('Published Board roster has unlinked positions.');
        return ids;
      }
    }
    throw new Error('Published Board roster exceeded safe maximum.');
  }, 'Failed to read the published Board roster');
}
