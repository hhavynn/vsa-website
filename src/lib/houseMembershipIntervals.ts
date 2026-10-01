// Protected domain — House membership. Pure decision logic for placing a member
// in a House from an effective date. This is the interval behavior Admin ->
// Houses has always applied (close the open membership, insert the new one,
// stop it where a later membership already begins); it is extracted so the
// draft preflight and the publish step decide exactly the same way.
// Authority: AGENTS.md § "Things to never do"; vsa-change-control § 1.

export interface MemberYearMembership {
  id: string;
  house_profile_id: string;
  /** yyyy-mm-dd */
  effective_start_date: string;
  /** yyyy-mm-dd, exclusive. null = open-ended. */
  effective_end_date: string | null;
}

export type MembershipChangePlan =
  /** The member is already in this House from this date. Nothing to write. */
  | { kind: 'skip' }
  /** A different House already starts for this member on this date. */
  | { kind: 'conflict'; message: string }
  /** The new interval would overlap an existing one (the database would reject it). */
  | { kind: 'overlap'; message: string }
  | {
      kind: 'apply';
      /** Open memberships that started earlier and must end on the effective date. */
      closeIds: string[];
      /** End of the new membership: where the next existing one begins, or open-ended. */
      newEndDate: string | null;
    };

/**
 * Decides how to place a member in `houseProfileId` from `effectiveStartDate`,
 * given every membership they already hold for the academic year.
 *
 * Intervals are half-open [start, end), matching the overlap trigger on
 * house_memberships.
 */
export function planMembershipChange(
  existing: MemberYearMembership[],
  effectiveStartDate: string,
  houseProfileId: string,
): MembershipChangePlan {
  const sameStart = existing.filter((membership) => membership.effective_start_date === effectiveStartDate);
  if (sameStart.some((membership) => membership.house_profile_id === houseProfileId)) {
    return { kind: 'skip' };
  }

  const openFromStart = existing.filter(
    (membership) => membership.effective_end_date === null && membership.effective_start_date >= effectiveStartDate,
  );
  if (openFromStart.some((membership) => membership.effective_start_date === effectiveStartDate)) {
    return {
      kind: 'conflict',
      message: `An active membership in another House already starts on ${effectiveStartDate}.`,
    };
  }

  const newEndDate = openFromStart
    .map((membership) => membership.effective_start_date)
    .filter((date) => date > effectiveStartDate)
    .sort()[0] ?? null;

  const closeIds = existing
    .filter((membership) => membership.effective_end_date === null && membership.effective_start_date < effectiveStartDate)
    .map((membership) => membership.id);

  const closing = new Set(closeIds);
  const overlapping = existing.find((membership) => {
    if (closing.has(membership.id)) return false;
    const startsBeforeNewEnds = newEndDate === null || membership.effective_start_date < newEndDate;
    const endsAfterNewStarts = membership.effective_end_date === null || membership.effective_end_date > effectiveStartDate;
    return startsBeforeNewEnds && endsAfterNewStarts;
  });
  if (overlapping) {
    return {
      kind: 'overlap',
      message: `An existing membership from ${overlapping.effective_start_date} to ${overlapping.effective_end_date ?? 'open'} overlaps ${effectiveStartDate}.`,
    };
  }

  return { kind: 'apply', closeIds, newEndDate };
}
