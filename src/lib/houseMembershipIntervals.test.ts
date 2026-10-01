import { MemberYearMembership, planMembershipChange } from './houseMembershipIntervals';

function membership(
  id: string,
  profile: string,
  start: string,
  end: string | null = null,
): MemberYearMembership {
  return { id, house_profile_id: profile, effective_start_date: start, effective_end_date: end };
}

describe('planMembershipChange', () => {
  it('places a member with no history from the effective date, open-ended', () => {
    expect(planMembershipChange([], '2026-11-08', 'toad')).toEqual({
      kind: 'apply',
      closeIds: [],
      newEndDate: null,
    });
  });

  it('closes the open membership that started earlier', () => {
    const plan = planMembershipChange([membership('m1', 'boo', '2026-09-20')], '2026-11-08', 'toad');
    expect(plan).toEqual({ kind: 'apply', closeIds: ['m1'], newEndDate: null });
  });

  it('ends the new membership where a later one already begins', () => {
    const plan = planMembershipChange(
      [membership('m1', 'boo', '2026-09-20'), membership('m2', 'bowser', '2027-01-10')],
      '2026-11-08',
      'toad',
    );
    expect(plan).toEqual({ kind: 'apply', closeIds: ['m1'], newEndDate: '2027-01-10' });
  });

  it('skips a member already in the same House from the same date, open or closed', () => {
    expect(planMembershipChange([membership('m1', 'toad', '2026-11-08')], '2026-11-08', 'toad')).toEqual({ kind: 'skip' });
    expect(
      planMembershipChange([membership('m1', 'toad', '2026-11-08', '2027-01-10')], '2026-11-08', 'toad'),
    ).toEqual({ kind: 'skip' });
  });

  it('refuses a different House that already starts on the same date', () => {
    const plan = planMembershipChange([membership('m1', 'boo', '2026-11-08')], '2026-11-08', 'toad');
    expect(plan.kind).toBe('conflict');
  });

  it('reports an overlap with a closed membership instead of letting the database reject it', () => {
    const plan = planMembershipChange([membership('m1', 'boo', '2026-10-01', '2026-12-01')], '2026-11-08', 'toad');
    expect(plan.kind).toBe('overlap');
  });

  it('allows a new membership that begins exactly where a closed one ends', () => {
    const plan = planMembershipChange([membership('m1', 'boo', '2026-10-01', '2026-11-08')], '2026-11-08', 'toad');
    expect(plan).toEqual({ kind: 'apply', closeIds: [], newEndDate: null });
  });
});
