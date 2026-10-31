import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';
import { shapePublicMemberRoles } from '../../lib/memberRoles';
import type { PublicMemberRole, PublicMemberRoleRow } from '../../lib/memberRoles';

/**
 * One bounded, public-safe read by canonical member ID and selected year.
 * The new RPC migration MUST be applied by the owner before this cutover
 * ships; missing/denied RPCs throw rather than inventing roles.
 */
export async function getPublicMemberRoles(
  academicYearStart: number, memberIds: readonly string[],
): Promise<Map<string, PublicMemberRole[]>> {
  const ids = Array.from(new Set(memberIds.filter(Boolean))).sort();
  if (ids.length === 0) return new Map();
  if (ids.length > 2000) throw new Error('Role lookup exceeds a safe visible-member limit.');

  return withErrorHandling(async () => {
    const rows: PublicMemberRoleRow[] = [];
    for (let from = 0; from < ids.length; from += 200) {
      const { data, error } = await supabase.rpc('public_member_roles', {
        p_year: academicYearStart, p_member_ids: ids.slice(from, from + 200),
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Public role projection returned invalid data.');
      if (data.length > ids.slice(from, from + 200).length * 25) {
        throw new Error('Public role projection exceeded the safe response budget.');
      }
      rows.push(...(data as PublicMemberRoleRow[]));
    }
    return shapePublicMemberRoles(rows, ids, academicYearStart);
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
