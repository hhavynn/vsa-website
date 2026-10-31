// Read-only comparison of a PUBLISHED House batch with current-year canonical
// membership intervals. Nothing here grants eligibility or writes assignments.
import type { CoverageDraft } from '../data/repos/houseAssignmentCoverage';
import type { HouseProfileLite } from './houseAssignmentDraft';
import { planMembershipChange } from './houseMembershipIntervals';
import type { MemberYearMembership } from './houseMembershipIntervals';
import { isEligible } from './housePayments';

export type CoverageState =
  | 'linked' | 'scheduled' | 'unassigned' | 'unconfirmed' | 'missing-member' |
    'duplicate-member' | 'invalid-house' | 'missing-membership' | 'conflicting-membership';

export interface CoverageResult { row: CoverageDraft; state: CoverageState; reason: string }

export function reviewPublishedHouseBatchCoverage(
  rows: readonly CoverageDraft[],
  profiles: readonly HouseProfileLite[],
  memberIds: ReadonlySet<string>,
  memberships: ReadonlyMap<string, MemberYearMembership[]>,
  onDate: string,
): CoverageResult[] {
  const validProfiles = new Set(profiles.filter(p => p.is_active).map(p => p.id));
  const seen = new Map<string, number>();
  rows.forEach(row => { if (row.member_id) seen.set(row.member_id, (seen.get(row.member_id) ?? 0) + 1); });
  return rows.map((row) => {
    const make = (state: CoverageState, reason: string): CoverageResult => ({row, state, reason});
    if (!row.member_id || !['match','manual'].includes(row.match_status)) {
      return make('unconfirmed', 'Draft identity was not confirmed for publication. Review this row in the existing batch editor.');
    }
    if ((seen.get(row.member_id) ?? 0) > 1) return make('duplicate-member', 'The same canonical member appears in multiple rows in this batch.');
    if (!memberIds.has(row.member_id)) return make('missing-member', 'Linked canonical member could not be found in the complete member directory.');
    if (!row.house_profile_id && !row.source_house) {
      return make('unassigned', 'This confirmed applicant has intentionally not been placed in a House.');
    }
    if (!row.house_profile_id || !validProfiles.has(row.house_profile_id)) {
      return make('invalid-house', 'Assigned House profile is missing, inactive or not in the selected academic year.');
    }
    const intervals = memberships.get(row.member_id) ?? [];
    const active = intervals.filter(m => m.effective_start_date <= onDate &&
      (!m.effective_end_date || m.effective_end_date > onDate));
    if (active.length > 1) return make('conflicting-membership', 'More than one House interval is active at this date.');
    if (active.length === 1) {
      return active[0].house_profile_id === row.house_profile_id
        ? make('linked', 'Verified canonical member and correct House interval.')
        : make('conflicting-membership', 'Current House interval differs from this published assignment.');
    }
    const upcoming = intervals.filter(m => m.house_profile_id === row.house_profile_id &&
      m.effective_start_date > onDate);
    if (upcoming.length > 0) return make('scheduled', 'Correct House interval starts in the future; not assigned yet today.');
    return make('missing-membership', 'No matching effective House interval found for this published assignment.');
  }).sort((a,b) => a.row.source_order - b.row.source_order);
}

export function countHouseCoverage(items: readonly CoverageResult[]) {
  return {
    linked: items.filter(i=>i.state==='linked').length,
    scheduled: items.filter(i=>i.state==='scheduled').length,
    unassigned: items.filter(i=>i.state==='unassigned').length,
    needsReview: items.filter(i=>!['linked','scheduled','unassigned'].includes(i.state)).length,
    total: items.length,
  };
}


export type PopulationState =
  | 'assigned' | 'scheduled' | 'unassigned' | 'ambiguous-identity' | 'duplicate-applicant'
  | 'missing-member' | 'not-in-batch' | 'invalid-house' | 'conflicting-membership' | 'missing-membership';
export interface PopulationApplicant {
  id: string;
  source_name: string;
  member_id: string | null;
  match_status: string;
  payment_status: string;
  withdrawn_reason: string | null;
}
export interface PopulationResult {
  applicantId: string;
  sourceName: string;
  rowId: string | null;
  state: PopulationState;
  reason: string;
}

export function reviewHouseBatchPopulation(input: {
  applicants: readonly PopulationApplicant[];
  rows: readonly CoverageDraft[];
  profiles: readonly HouseProfileLite[];
  memberIds: ReadonlySet<string>;
  memberships: ReadonlyMap<string, MemberYearMembership[]>;
  effectiveStartDate: string;
  onDate: string;
  revealed: boolean;
}): {
  results: PopulationResult[];
  excluded: { withdrawn: number; unpaid: number; unresolved: number };
  rowsNotEligible: CoverageDraft[];
  membershipsOutsideBatch: string[];
} {
  const { applicants, rows, profiles, memberIds, memberships, effectiveStartDate, onDate, revealed } = input;
  const excluded = { withdrawn: 0, unpaid: 0, unresolved: 0 };
  const eligible = applicants.filter((applicant) => {
    if (isEligible(applicant, 'final')) return true;
    if (applicant.withdrawn_reason) excluded.withdrawn++;
    else if (applicant.payment_status === 'unpaid') excluded.unpaid++;
    else excluded.unresolved++;
    return false;
  });
  const eligibleIds = new Set(eligible.map((a) => a.id));
  const duplicates = new Map<string, number>();
  eligible.forEach((a) => {
    if (a.member_id) duplicates.set(a.member_id, (duplicates.get(a.member_id) ?? 0) + 1);
  });
  const rowByApplicant = new Map<string, CoverageDraft>();
  [...rows].sort((a, b) => a.source_order - b.source_order).forEach((row) => {
    if (row.applicant_id && !rowByApplicant.has(row.applicant_id)) rowByApplicant.set(row.applicant_id, row);
  });
  const revealedByRow = revealed
    ? new Map(reviewPublishedHouseBatchCoverage(rows, profiles, memberIds, memberships, onDate)
      .map((result) => [result.row.id, result]))
    : null;
  const validHouses = new Set(profiles.filter((p) => p.is_active).map((p) => p.id));

  const results = eligible.map((applicant): PopulationResult => {
    const row = rowByApplicant.get(applicant.id);
    const make = (state: PopulationState, reason: string): PopulationResult =>
      ({ applicantId: applicant.id, sourceName: applicant.source_name, rowId: row?.id ?? null, state, reason });

    if (!applicant.member_id || !['match', 'manual'].includes(applicant.match_status)) {
      return make('ambiguous-identity', 'Canonical applicant identity requires explicit review.');
    }
    if ((duplicates.get(applicant.member_id) ?? 0) > 1) {
      return make('duplicate-applicant', 'Multiple paid or waived applicants share this canonical member.');
    }
    if (!row) return make('not-in-batch', 'Eligible applicant was not included in the selected batch.');
    if (row.member_id !== applicant.member_id || !['match', 'manual'].includes(row.match_status)) {
      return make('ambiguous-identity', 'Batch row identity is not confirmed for this applicant.');
    }
    if (!row.house_profile_id && !row.source_house) {
      return make('unassigned', 'No House chosen yet; no assignment inferred.');
    }
    if (!memberIds.has(applicant.member_id)) {
      return make('missing-member', 'Canonical member is absent from the complete directory.');
    }
    if (!row.house_profile_id || !validHouses.has(row.house_profile_id)) {
      return make('invalid-house', 'Assigned House is missing, inactive or in another year.');
    }
    if (revealed && revealedByRow) {
      const state = revealedByRow.get(row.id)?.state;
      if (state === 'linked') return make('assigned', 'Published membership matches this applicant.');
      if (state === 'scheduled') return make('scheduled', 'Approved membership begins at its future effective date.');
      if (state === 'unconfirmed' || state === 'duplicate-member') {
        return make('ambiguous-identity', 'Published batch member identity needs review.');
      }
      if (state === 'invalid-house') return make('invalid-house', 'Published House profile is not active for this year.');
      if (state === 'conflicting-membership') return make('conflicting-membership', 'Existing membership differs or overlaps.');
      return make('missing-membership', 'Published batch is not matched by an effective House membership.');
    }
    const plan = planMembershipChange(memberships.get(applicant.member_id) ?? [], effectiveStartDate, row.house_profile_id);
    if (plan.kind === 'conflict' || plan.kind === 'overlap') {
      return make('conflicting-membership', 'A House interval conflicts with the proposed effective date.');
    }
    return make('assigned', 'Valid reviewed assignment in the selected private batch (not revealed).');
  });
  const rowsNotEligible = rows.filter((r) => r.member_id && (!r.applicant_id || !eligibleIds.has(r.applicant_id)));
  const assignedMemberIds = new Set(rows.map((r) => r.member_id).filter((id): id is string => !!id));
  const membershipsOutsideBatch: string[] = [];
  memberships.forEach((intervals, memberId) => {
    if (!assignedMemberIds.has(memberId) && intervals.some((m) =>
      m.effective_start_date <= onDate && (!m.effective_end_date || m.effective_end_date > onDate))) {
      membershipsOutsideBatch.push(memberId);
    }
  });
  return { results, excluded, rowsNotEligible, membershipsOutsideBatch };
}
