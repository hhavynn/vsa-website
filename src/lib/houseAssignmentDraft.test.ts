import {
  HouseAssignmentDraft,
  HouseProfileLite,
  buildPreflight,
  computeHouseCounts,
  publishableRows,
  suggestBalancing,
} from './houseAssignmentDraft';

const profiles: HouseProfileLite[] = ['Bowser', 'Boo', 'Donkey Kong', 'Toad'].map((name) => ({
  id: `p-${name}`,
  house_key: name,
  display_name: name,
  is_active: true,
}));
const [bowser, boo, dk, toad] = profiles;

let counter = 0;
function row(overrides: Partial<HouseAssignmentDraft> = {}): HouseAssignmentDraft {
  counter += 1;
  return {
    id: `r${counter}`,
    batch_id: 'b1',
    source_name: `Person ${counter}`,
    source_house: null,
    member_id: `m${counter}`,
    house_profile_id: null,
    match_status: 'match',
    match_method: 'name',
    match_score: 90,
    preferences: null,
    notes: null,
    source_order: counter,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const lookup = (text: string) => profiles.find((p) => p.house_key.toLowerCase() === text.toLowerCase())?.id ?? null;
const baseOptions = { effectiveStartDate: '2026-11-08', existingMemberships: new Map() };

beforeEach(() => { counter = 0; });

describe('House counts', () => {
  it('counts confirmed assignments per House and reports unassigned rows', () => {
    const rows = [
      row({ house_profile_id: bowser.id }),
      row({ house_profile_id: bowser.id }),
      row({ house_profile_id: toad.id }),
      row({ house_profile_id: null }),
      row({ house_profile_id: boo.id, member_id: null, match_status: 'unmatched' }),
    ];
    const counts = computeHouseCounts(rows, profiles);

    expect(Object.fromEntries(counts.perHouse.map((entry) => [entry.label, entry.count]))).toEqual({
      Bowser: 2, Boo: 0, 'Donkey Kong': 0, Toad: 1,
    });
    expect(counts.unassigned).toBe(1);
    expect(counts.needsMember).toBe(1);
  });

  it('does not count ambiguous matches as assigned until an admin confirms them', () => {
    const rows = [row({ house_profile_id: boo.id, match_status: 'review' })];
    expect(publishableRows(rows, profiles)).toHaveLength(0);
    expect(computeHouseCounts(rows, profiles).perHouse.find((entry) => entry.label === 'Boo')?.count).toBe(0);
  });
});

describe('House preflight', () => {
  it('blocks the same canonical member in two Houses', () => {
    const rows = [
      row({ member_id: 'kevin', house_profile_id: bowser.id }),
      row({ member_id: 'kevin', house_profile_id: toad.id }),
    ];
    const result = buildPreflight(rows, profiles, baseOptions);

    expect(result.canLock).toBe(false);
    expect(result.blockers.map((issue) => issue.code)).toContain('conflicting_house');
  });

  it('only warns when the same member is listed twice in the same House, and publishes them once', () => {
    const rows = [
      row({ member_id: 'kevin', house_profile_id: toad.id }),
      row({ member_id: 'kevin', house_profile_id: toad.id }),
    ];
    const result = buildPreflight(rows, profiles, baseOptions);

    expect(result.canLock).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toContain('duplicate_member');
    expect(publishableRows(rows, profiles)).toHaveLength(1);
    expect(result.assigned).toBe(1);
    expect(result.applicants).toBe(2);
  });

  it('blocks a House with no active profile for the year, whether unrecognized or removed', () => {
    const unrecognized = buildPreflight([row({ source_house: 'Yoshi', house_profile_id: null })], profiles, baseOptions);
    const removed = buildPreflight([row({ house_profile_id: 'gone' })], profiles, baseOptions);
    const inactive = buildPreflight(
      [row({ house_profile_id: boo.id })],
      profiles.map((p) => (p.id === boo.id ? { ...p, is_active: false } : p)),
      baseOptions,
    );

    [unrecognized, removed, inactive].forEach((result) => {
      expect(result.canLock).toBe(false);
      expect(result.blockers.map((issue) => issue.code)).toContain('invalid_house');
    });
  });

  it('blocks a placement that would violate House membership intervals', () => {
    const rows = [row({ member_id: 'kevin', source_name: 'Kevin Tran', house_profile_id: toad.id })];
    const closedOverlap = new Map([
      ['kevin', [{ id: 'x', house_profile_id: boo.id, effective_start_date: '2026-10-01', effective_end_date: '2026-12-01' }]],
    ]);
    const sameDayOtherHouse = new Map([
      ['kevin', [{ id: 'y', house_profile_id: boo.id, effective_start_date: '2026-11-08', effective_end_date: null }]],
    ]);

    [closedOverlap, sameDayOtherHouse].forEach((existingMemberships) => {
      const result = buildPreflight(rows, profiles, { effectiveStartDate: '2026-11-08', existingMemberships });
      expect(result.canLock).toBe(false);
      expect(result.blockers.map((issue) => issue.code)).toContain('interval');
      expect(result.blockers[0].message).toContain('Kevin Tran');
    });
  });

  it('does not treat a member already placed in the same House as a violation', () => {
    const rows = [row({ member_id: 'kevin', house_profile_id: toad.id })];
    const existing = new Map([
      ['kevin', [{ id: 'z', house_profile_id: toad.id, effective_start_date: '2026-11-08', effective_end_date: null }]],
    ]);
    expect(buildPreflight(rows, profiles, { effectiveStartDate: '2026-11-08', existingMemberships: existing }).canLock).toBe(true);
  });

  it('treats unassigned, ambiguous, unmatched, and imbalance as warnings, not blockers', () => {
    const rows = [
      ...Array.from({ length: 11 }, () => row({ house_profile_id: boo.id })),
      row({ house_profile_id: toad.id }),
      row({ house_profile_id: null }),
      row({ house_profile_id: bowser.id, match_status: 'review' }),
      row({ house_profile_id: dk.id, member_id: null, match_status: 'unmatched' }),
    ];
    const result = buildPreflight(rows, profiles, baseOptions);

    expect(result.canLock).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings.map((issue) => issue.code).sort()).toEqual(
      ['ambiguous_match', 'imbalance', 'unassigned', 'unmatched'].sort(),
    );
    expect(result.warnings.find((issue) => issue.code === 'imbalance')?.message).toBe('Boo has 11 more members than Bowser.');
  });

  it('refuses to lock an empty draft', () => {
    expect(buildPreflight([], profiles, baseOptions).canLock).toBe(false);
  });
});

describe('Balance helper', () => {
  function fill(profile: HouseProfileLite, count: number, extra: Partial<HouseAssignmentDraft> = {}) {
    return Array.from({ length: count }, () => row({ house_profile_id: profile.id, ...extra }));
  }

  it('only reports imbalance and unassigned people when the sheet has no preferences', () => {
    const rows = [...fill(boo, 6), ...fill(toad, 2), row({ house_profile_id: null, source_name: 'Kevin Tran' })];
    const report = suggestBalancing(rows, profiles, undefined, lookup);

    expect(report.hasPreferences).toBe(false);
    expect(report.suggestions).toEqual([]);
    expect(report.imbalance).toMatchObject({ gap: 6 });
    expect(report.imbalance?.largest.label).toBe('Boo');
    expect(report.unassigned.map((entry) => entry.source_name)).toEqual(['Kevin Tran']);
  });

  it('assigns an unassigned member to the smallest House they asked for, with a reason', () => {
    const kevin = row({
      house_profile_id: null,
      source_name: 'Kevin Tran',
      preferences: ['Boo', 'Toad'],
    });
    const rows = [...fill(boo, 5), ...fill(toad, 2), ...fill(bowser, 4), ...fill(dk, 4), kevin];
    const report = suggestBalancing(rows, profiles, undefined, lookup);

    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]).toMatchObject({
      rowId: kevin.id,
      kind: 'assign',
      fromProfileId: null,
      toProfileId: toad.id,
    });
    expect(report.suggestions[0].reason).toBe("Toad is smallest + Toad was Kevin's 2nd choice");
  });

  it('never suggests a House the person did not list', () => {
    const rows = [
      ...fill(boo, 6, { preferences: ['Boo'] }),
      ...fill(toad, 1),
      row({ house_profile_id: null, preferences: ['Boo'] }),
    ];
    const report = suggestBalancing(rows, profiles, undefined, lookup);

    report.suggestions.forEach((suggestion) => {
      const target = rows.find((r) => r.id === suggestion.rowId) as HouseAssignmentDraft;
      expect(target.preferences).toContain(profiles.find((p) => p.id === suggestion.toProfileId)?.house_key);
    });
  });

  it('moves someone toward a smaller House they ranked above their current one', () => {
    const mover = row({ house_profile_id: boo.id, preferences: ['Toad', 'Boo'], source_name: 'Kevin Tran' });
    const rows = [mover, ...fill(boo, 6), ...fill(toad, 2), ...fill(bowser, 4), ...fill(dk, 4)];
    const report = suggestBalancing(rows, profiles, undefined, lookup);

    expect(report.suggestions[0]).toMatchObject({ rowId: mover.id, kind: 'move', fromProfileId: boo.id, toProfileId: toad.id });
  });

  it('leaves someone alone when their current House is their first choice', () => {
    const rows = [
      ...fill(boo, 7, { preferences: ['Boo', 'Toad'] }),
      ...fill(toad, 1),
      ...fill(bowser, 4),
      ...fill(dk, 4),
    ];
    expect(suggestBalancing(rows, profiles, undefined, lookup).suggestions).toEqual([]);
  });

  it('does not change the rows it was given', () => {
    const rows = [...fill(boo, 4, { preferences: ['Toad', 'Boo'] }), ...fill(toad, 1)];
    const before = JSON.stringify(rows);
    suggestBalancing(rows, profiles, undefined, lookup);
    expect(JSON.stringify(rows)).toBe(before);
  });
});
