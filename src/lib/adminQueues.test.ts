import { applyQuickFilter, countByFilter } from './adminFilters';
import {
  ACE_DRAFT_FILTERS,
  ACE_NODE_FILTERS,
  AceDraftFacts,
  HOUSE_ROW_FILTERS,
  HouseRowFacts,
  INTERN_FILTERS,
  InternRowFacts,
  MEMBER_FILTERS,
  ROSTER_FILTERS,
  RosterRowFacts,
  hasPreferenceConflict,
  houseRowIsIn,
} from './adminQueues';

const aceDraft = (id: string, patch: Partial<AceDraftFacts['draft']> = {}, extra: Partial<AceDraftFacts> = {}): AceDraftFacts => ({
  draft: { id, little_name: id, little_member_id: null, big_ace_member_id: null, ...patch } as AceDraftFacts['draft'],
  issues: [],
  reviewed: false,
  ...extra,
});

describe('ACE draft filters', () => {
  const rows: AceDraftFacts[] = [
    aceDraft('linked-assigned', { little_member_id: 'm1', big_ace_member_id: 'b1' }),
    aceDraft('unlinked-unassigned', {}, { review: { status: 'recommended' } as never }),
    aceDraft('ambiguous', { big_ace_member_id: 'b1' }, { review: { status: 'ambiguous' } as never }),
    aceDraft('no-match', { big_ace_member_id: 'b1' }, { review: { status: 'none' } as never }),
    aceDraft('dup', { big_ace_member_id: 'b1', little_member_id: 'm2' }, { issues: [{ code: 'duplicate_member', severity: 'blocker', message: '', draftIds: [] }] }),
    aceDraft('dup-reviewed', { big_ace_member_id: 'b1', little_member_id: 'm3' }, { issues: [{ code: 'duplicate_member', severity: 'blocker', message: '', draftIds: [] }], reviewed: true }),
  ];

  it('counts each domain filter', () => {
    expect(countByFilter(rows, ACE_DRAFT_FILTERS)).toEqual({
      all: 6,
      needs_review: 1,
      unlinked: 3,
      possible_match: 2,
      no_match: 1,
      unassigned: 1,
      duplicates: 2,
    });
  });

  it('stops listing a reviewed row under Needs Review but keeps it under Duplicates', () => {
    expect(applyQuickFilter(rows, ACE_DRAFT_FILTERS, 'needs_review').map((row) => row.draft.id)).toEqual(['dup']);
    expect(applyQuickFilter(rows, ACE_DRAFT_FILTERS, 'duplicates')).toHaveLength(2);
  });

  it('offers only ACE-relevant filters', () => {
    expect(ACE_DRAFT_FILTERS.map((filter) => filter.key)).not.toContain('missing_photo');
  });
});

describe('ACE node filters', () => {
  it('splits unlinked nodes by whether a member could match', () => {
    const nodes = [
      { node: { id: 'a', member_id: 'm' } },
      { node: { id: 'b', member_id: null }, review: { status: 'recommended' } },
      { node: { id: 'c', member_id: null }, review: { status: 'none' } },
    ] as never[];
    expect(countByFilter(nodes, ACE_NODE_FILTERS)).toEqual({ all: 3, unlinked: 2, possible_match: 1, no_match: 1 });
  });
});

describe('House row filters', () => {
  const toad = { id: 'toad', house_key: 'toad', display_name: 'Toad', is_active: true };
  const boo = { id: 'boo', house_key: 'boo', display_name: 'Boo', is_active: true };
  const resolve = (text: string) => ({ toad: 'toad', boo: 'boo' } as Record<string, string>)[text.toLowerCase()] ?? null;
  const house = (id: string, patch: Partial<HouseRowFacts['row']> = {}, extra: Partial<HouseRowFacts> = {}): HouseRowFacts => ({
    row: { id, source_house: null, house_profile_id: null, member_id: 'm', match_status: 'match', preferences: null, ...patch } as HouseRowFacts['row'],
    duplicate: false,
    profile: null,
    resolveHouseId: resolve,
    reviewed: false,
    ...extra,
  });

  const rows = [
    house('assigned', { house_profile_id: 'toad' }, { profile: toad }),
    house('unassigned'),
    house('ambiguous', { house_profile_id: 'boo', match_status: 'review' }, { profile: boo }),
    house('no-member', { house_profile_id: 'boo', member_id: null }, { profile: boo }),
    house('dup', { house_profile_id: 'boo' }, { profile: boo, duplicate: true }),
    house('pref-conflict', { house_profile_id: 'boo', preferences: ['Toad'] as never }, { profile: boo }),
    house('pref-ok', { house_profile_id: 'toad', preferences: ['Boo', 'Toad'] as never }, { profile: toad }),
  ];

  it('counts every House filter', () => {
    expect(countByFilter(rows, HOUSE_ROW_FILTERS)).toEqual({
      all: 7,
      needs_review: 4,
      unassigned: 1,
      ambiguous: 1,
      unmatched: 1,
      duplicates: 1,
      preference_conflict: 1,
    });
  });

  it('flags a preference conflict only when the assigned House is not among their choices', () => {
    expect(hasPreferenceConflict(rows[5])).toBe(true);
    expect(hasPreferenceConflict(rows[6])).toBe(false);
    expect(hasPreferenceConflict(rows[0])).toBe(false);
  });

  it('supports By House', () => {
    expect(rows.filter((facts) => houseRowIsIn(facts, 'boo'))).toHaveLength(4);
  });
});

describe('Roster filters', () => {
  const roster = (id: string, patch: Partial<RosterRowFacts['draft']>, extra: Partial<RosterRowFacts> = {}): RosterRowFacts => ({
    draft: { id, name: null, member_id: null, ...patch } as RosterRowFacts['draft'],
    hasPhoto: false,
    reviewed: false,
    ...extra,
  });
  const rows = [
    roster('empty', {}),
    roster('unlinked', { name: 'Ada' }),
    roster('linked-photo', { name: 'Bo', member_id: 'm1' }, { hasPhoto: true }),
    roster('linked-nophoto', { name: 'Cy', member_id: 'm2' }),
    roster('empty-reviewed', {}, { reviewed: true }),
  ];

  it('separates unfilled, unlinked and missing-photo positions', () => {
    expect(countByFilter(rows, ROSTER_FILTERS)).toEqual({ all: 5, needs_review: 2, unfilled: 2, unlinked: 1, missing_photo: 1 });
  });
});

describe('Intern filters', () => {
  const intern = (id: string, patch: Partial<InternRowFacts['draft']>, extra: Partial<InternRowFacts> = {}): InternRowFacts => ({
    draft: { id, member_id: null, mentor_cabinet_member_id: null, role_or_track: null, caption: null, ...patch } as InternRowFacts['draft'],
    duplicate: false,
    reviewed: false,
    ...extra,
  });
  const rows = [
    intern('complete', { member_id: 'm', mentor_cabinet_member_id: 'c', role_or_track: 'Events', caption: 'hi' }),
    intern('bare', {}),
    intern('no-caption', { member_id: 'm2', mentor_cabinet_member_id: 'c', role_or_track: 'Events' }),
  ];

  it('counts missing mentor and profile info independently of linking', () => {
    expect(countByFilter(rows, INTERN_FILTERS)).toEqual({ all: 3, needs_review: 1, unlinked: 1, missing_mentor: 1, missing_info: 2 });
  });
});

describe('Member filters', () => {
  const members = [
    { id: '1', needs_review: true, current_house: null, hasPhoto: false, events_attended: 0 },
    { id: '2', needs_review: false, current_house: 'Toad', hasPhoto: true, events_attended: 5 },
    { id: '3', needs_review: null, current_house: 'Boo', hasPhoto: false, events_attended: 2 },
  ];

  it('counts review, house, photo and attendance gaps', () => {
    expect(countByFilter(members, MEMBER_FILTERS)).toEqual({ all: 3, needs_review: 1, no_house: 1, missing_photo: 2, no_attendance: 1 });
  });
});
