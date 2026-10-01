import {
  InternCohortDraft,
  InternMemberOption,
  buildInternDraftRows,
  buildInternPreflight,
  cabinetMemberFromIntern,
  matchInternToMember,
  moveId,
  parseInternNames,
  resequence,
} from './internCohort';

const directory: InternMemberOption[] = [
  { id: 'm-sarah', first_name: 'Sarah', last_name: 'Nguyen', college: 'Muir', year: 'Second Year' },
  { id: 'm-kevin', first_name: 'Kevin', last_name: 'Tran', college: 'Warren', year: 'First Year' },
  { id: 'm-kevin2', first_name: 'Kevin', last_name: 'Tran', college: 'Revelle', year: 'Third Year' },
  { id: 'm-emily', first_name: 'Emily', last_name: 'Nguyen', college: 'Marshall', year: 'Third Year' },
];

let n = 0;
function draft(overrides: Partial<InternCohortDraft> = {}): InternCohortDraft {
  n += 1;
  return {
    id: `d${n}`,
    cycle_id: 'c1',
    name: ['Ann Lee', 'Bo Chen', 'Cy Dao', 'Di Eng', 'Ed Fox'][n % 5],
    member_id: `m${n}`,
    mentor_cabinet_member_id: null,
    role_or_track: null,
    caption: null,
    internal_notes: null,
    display_order: n,
    published_cabinet_member_id: null,
    created_at: `2026-10-01T00:00:0${n % 10}Z`,
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}
beforeEach(() => { n = 0; });

describe('parseInternNames', () => {
  it('reads one intern per line with an optional track', () => {
    expect(parseInternNames('Name, Track\nsarah nguyen, Events / Operations\nKevin Tran\n\n')).toEqual([
      { name: 'Sarah Nguyen', roleOrTrack: 'Events / Operations' },
      { name: 'Kevin Tran', roleOrTrack: null },
    ]);
  });

  it('accepts tab and spaced-dash separators', () => {
    expect(parseInternNames('Sarah Nguyen\tMedia\nEmily Nguyen - Fundraising')).toEqual([
      { name: 'Sarah Nguyen', roleOrTrack: 'Media' },
      { name: 'Emily Nguyen', roleOrTrack: 'Fundraising' },
    ]);
  });
});

describe('member matching', () => {
  it('links one exact, unclaimed name', () => {
    expect(matchInternToMember('sarah nguyen', directory).memberId).toBe('m-sarah');
  });

  it('never links an ambiguous name, but offers every candidate', () => {
    const result = matchInternToMember('Kevin Tran', directory);
    expect(result.memberId).toBeNull();
    expect(result.suggestions.map((s) => s.member.id).sort()).toEqual(['m-kevin', 'm-kevin2']);
  });

  it('does not link a member already claimed by another intern', () => {
    expect(matchInternToMember('Sarah Nguyen', directory, new Set(['m-sarah'])).memberId).toBeNull();
  });

  it('suggests near-misses without linking them', () => {
    const result = matchInternToMember('Sara Nguyn', directory);
    expect(result.memberId).toBeNull();
    expect(result.suggestions[0].member.id).toBe('m-sarah');
  });

  it('links each canonical member at most once when building rows from a paste', () => {
    const rows = buildInternDraftRows(parseInternNames('Sarah Nguyen\nSarah Nguyen\nZed Unknown'), directory, 5);
    expect(rows.map((r) => [r.name, r.member_id, r.display_order])).toEqual([
      ['Sarah Nguyen', 'm-sarah', 5],
      ['Sarah Nguyen', null, 6],
      ['Zed Unknown', null, 7],
    ]);
  });
});

describe('ordering', () => {
  it('moves an id and resequences only rows that changed', () => {
    const drafts = [draft({ display_order: 0 }), draft({ display_order: 1 }), draft({ display_order: 2 })];
    const order = moveId(drafts.map((d) => d.id), 'd3', -1);
    expect(order).toEqual(['d1', 'd3', 'd2']);
    expect(resequence(drafts, order)).toEqual([
      { id: 'd3', display_order: 1 },
      { id: 'd2', display_order: 2 },
    ]);
    expect(moveId(order, 'd1', -1)).toEqual(order);
  });
});

describe('intern preflight', () => {
  it('counts accepted and linked interns, and treats mentors as optional', () => {
    const result = buildInternPreflight([draft(), draft({ member_id: null }), draft({ mentor_cabinet_member_id: 'cm1' })]);
    expect(result).toMatchObject({ accepted: 3, linked: 2, canLock: true, blockers: [] });
    expect(result.warnings.map((w) => w.code)).toEqual(['unlinked']);
    expect(result.notes[0]).toMatchObject({ code: 'missing_mentor' });
    expect(result.notes[0].draftIds).toHaveLength(2);
  });

  it('warns about duplicate names', () => {
    const result = buildInternPreflight([draft({ name: 'Sarah Nguyen' }), draft({ name: 'sarah  nguyen', member_id: null })]);
    expect(result.warnings.map((w) => w.code)).toContain('duplicate_name');
    expect(result.canLock).toBe(true);
  });

  it('blocks the same canonical member linked twice', () => {
    const result = buildInternPreflight([draft({ member_id: 'x' }), draft({ member_id: 'x' })]);
    expect(result.canLock).toBe(false);
    expect(result.blockers.map((b) => b.code)).toEqual(['duplicate_member']);
  });

  it('blocks an empty cohort', () => {
    expect(buildInternPreflight([]).canLock).toBe(false);
  });
});

describe('cabinet_members mapping', () => {
  it('maps only public-safe fields and defaults the role to Intern', () => {
    const row = cabinetMemberFromIntern(
      draft({ name: ' Sarah Nguyen ', member_id: 'm-sarah', display_order: 3, caption: 'bio', internal_notes: 'secret', mentor_cabinet_member_id: 'cm1' }),
      'year-1',
    );
    expect(row).toEqual({
      name: 'Sarah Nguyen',
      role: 'Intern',
      category: 'Interns',
      display_order: 3,
      member_id: 'm-sarah',
      cabinet_year_id: 'year-1',
    });
    expect(JSON.stringify(row)).not.toMatch(/secret|bio|cm1/);
  });

  it('uses the track as the public role when set', () => {
    expect(cabinetMemberFromIntern(draft({ role_or_track: 'Events / Operations' }), 'y').role).toBe('Events / Operations');
  });
});
