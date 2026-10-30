// Read-only comparison of a PUBLISHED House batch with current-year canonical
// membership intervals. Nothing here grants eligibility or writes assignments.
import type { CoverageDraft } from '../data/repos/houseAssignmentCoverage';
import type { HouseProfileLite } from './houseAssignmentDraft';
import type { MemberYearMembership } from './houseMembershipIntervals';

export type CoverageState =
  | 'linked' | 'scheduled' | 'unconfirmed' | 'missing-member' |
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
    needsReview: items.filter(i=>!['linked','scheduled'].includes(i.state)).length,
    total: items.length,
  };
}
