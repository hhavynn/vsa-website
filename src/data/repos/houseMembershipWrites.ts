// Protected domain — House membership. The only write path for placing a member
// in a House from an effective date. It carries the dated-interval behavior
// Admin -> Houses has always had: close the member's open membership, insert the
// new one (ending where a later one begins), and refresh the legacy
// members.house display cache. Do not add other writers; reuse this.
// Authority: AGENTS.md § "Things to never do"; vsa-change-control § 1.
import { supabase } from '../../lib/supabase';
import {
  MemberYearMembership,
  MembershipChangePlan,
  planMembershipChange,
} from '../../lib/houseMembershipIntervals';
import { DatabaseError, ValidationError, withErrorHandling } from '../errors';

export interface ApplyHouseMembershipInput {
  memberId: string;
  houseProfileId: string;
  /** Written to members.house, the legacy display cache. */
  houseCacheLabel: string;
  academicYearStart: number;
  effectiveStartDate: string;
  source: string;
  /** Batch id when the change comes from a locked assignment batch. */
  sourceImportId?: string | null;
  notes: string;
  userId: string | null;
  /** Used in error messages only. */
  memberLabel: string;
  /** Pre-fetched memberships for this member and year; fetched when omitted. */
  existingMemberships?: MemberYearMembership[];
}

export type ApplyHouseMembershipResult = 'applied' | 'skipped';

export class HouseMembershipsWriteRepository {
  async listMembershipsForYear(academicYearStart: number): Promise<Map<string, MemberYearMembership[]>> {
    return withErrorHandling(async () => {
      const byMember = new Map<string, MemberYearMembership[]>();
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('house_memberships')
          .select('id, member_id, house_profile_id, effective_start_date, effective_end_date')
          .eq('academic_year_start', academicYearStart)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          const list = byMember.get(row.member_id) ?? [];
          list.push({
            id: row.id,
            house_profile_id: row.house_profile_id,
            effective_start_date: row.effective_start_date,
            effective_end_date: row.effective_end_date,
          });
          byMember.set(row.member_id, list);
        }
        if (!data || data.length < pageSize) return byMember;
      }
    }, 'Failed to load House memberships');
  }

  private async listForMember(memberId: string, academicYearStart: number): Promise<MemberYearMembership[]> {
    const { data, error } = await supabase
      .from('house_memberships')
      .select('id, house_profile_id, effective_start_date, effective_end_date')
      .eq('member_id', memberId)
      .eq('academic_year_start', academicYearStart);
    if (error) throw error;
    return (data ?? []) as MemberYearMembership[];
  }

  async applyMembership(input: ApplyHouseMembershipInput): Promise<ApplyHouseMembershipResult> {
    return withErrorHandling(async () => {
      const existing = input.existingMemberships
        ?? await this.listForMember(input.memberId, input.academicYearStart);
      const plan: MembershipChangePlan = planMembershipChange(existing, input.effectiveStartDate, input.houseProfileId);

      if (plan.kind === 'skip') return 'skipped';
      if (plan.kind === 'conflict') {
        throw new ValidationError(
          `${plan.message} Resolve manually for ${input.memberLabel} before re-importing.`,
          'house_memberships',
        );
      }
      if (plan.kind === 'overlap') {
        throw new ValidationError(`${plan.message} (${input.memberLabel}).`, 'house_memberships');
      }

      const now = new Date().toISOString();
      if (plan.closeIds.length > 0) {
        const { error: closeError } = await supabase
          .from('house_memberships')
          .update({
            effective_end_date: input.effectiveStartDate,
            updated_by: input.userId,
            updated_at: now,
          })
          .in('id', plan.closeIds);
        if (closeError) throw closeError;
      }

      const { error: insertError } = await supabase
        .from('house_memberships')
        .insert({
          member_id: input.memberId,
          house_profile_id: input.houseProfileId,
          academic_year_start: input.academicYearStart,
          academic_year_end: input.academicYearStart + 1,
          effective_start_date: input.effectiveStartDate,
          effective_end_date: plan.newEndDate,
          source: input.source,
          source_import_id: input.sourceImportId ?? null,
          notes: input.notes,
          created_by: input.userId,
          updated_by: input.userId,
        });
      if (insertError) throw insertError;

      const { error: cacheError } = await supabase
        .from('members')
        .update({ house: input.houseCacheLabel, updated_at: now })
        .eq('id', input.memberId);
      if (cacheError) throw new DatabaseError(cacheError.message, cacheError.code);

      return 'applied';
    }, 'Failed to apply House membership');
  }
}

export const houseMembershipsWriteRepository = new HouseMembershipsWriteRepository();
