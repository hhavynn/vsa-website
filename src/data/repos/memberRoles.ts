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
  if (ids.length > 50) throw new Error('Role lookup exceeds the visible-member limit.');

  return withErrorHandling(async () => {
    const { data: years, error: yearError } = await supabase
      .from('cabinet_years')
      .select('id')
      .eq('start_year', academicYearStart)
      .limit(2);

    if (yearError) throw yearError;
    if (!years?.length) return new Map<string, PublicMemberRole[]>();
    if (years.length !== 1) throw new Error('Ambiguous Cabinet year. Role badges cannot be verified.');

    const { data, error } = await supabase
      .from('cabinet_members')
      .select('id, member_id, role, category')
      .eq('cabinet_year_id', years[0].id)
      .in('member_id', ids)
      .limit(501);

    if (error) throw error;
    if ((data ?? []).length >= 501) throw new Error('Public Cabinet role result exceeds safe bound.');
    return shapePublishedCabinetRoles(
      (data ?? []) as PublishedCabinetRoleRow[],
      ids,
      academicYearStart,
    );
  }, 'Failed to fetch published member roles');
}
