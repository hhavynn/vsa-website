/**
 * Cabinet rollover rules: a structure copy carries positions and never people,
 * pasted rosters fill the right slots and link only exact unambiguous members,
 * and the preflight blocks duplicates/empty slots but never a missing photo.
 */
import {
  CabinetRosterDraft,
  buildRosterPreflight,
  buildStructureRows,
  cabinetMemberFromDraft,
  cabinetMemberUpdateFromDraft,
  findExistingCabinetRow,
  guessCategory,
  normalizeRole,
  parseRosterPaste,
  planRosterFill,
  rosterLinkSuggestion,
  rosterPreflightLines,
} from './cabinetRoster';
import { MemberOption, buildMemberNameIndex, toMemberOption } from './memberLinkMatching';

function draft(n: number, overrides: Partial<CabinetRosterDraft> = {}): CabinetRosterDraft {
  return {
    id: `d${n}`,
    cycle_id: 'c1',
    role: `Role ${n}`,
    category: 'General Board',
    display_order: n,
    name: `Person ${n}`,
    member_id: `m${n}`,
    year: null,
    college: null,
    major: null,
    pronouns: null,
    favorite_snack: null,
    fun_fact: null,
    published_cabinet_member_id: null,
    created_at: `2026-10-02T00:00:${String(n).padStart(2, '0')}Z`,
    updated_at: '2026-10-02T00:00:00Z',
    ...overrides,
  };
}

function member(id: string, first: string, last: string): MemberOption {
  return toMemberOption({ id, first_name: first, last_name: last, college: 'Sixth', year: 'Fourth Year' });
}

describe('copying the position structure', () => {
  const previousYear = [
    { role: 'Co-President', category: 'Executive Board', display_order: 0, name: 'Old Person', member_id: 'old-1', image_url: 'x.png', fun_fact: 'bio' },
    { role: 'Co-President', category: 'Executive Board', display_order: 0, name: 'Old Person 2', member_id: 'old-2', image_url: 'y.png', fun_fact: 'bio' },
    { role: 'Historian', category: 'General Board', display_order: 7, name: 'Old Hist', member_id: 'old-3' },
    { role: 'Intern', category: 'Interns', display_order: 0, name: 'Old Intern', member_id: 'old-4' },
  ];

  it('keeps role, category and display_order and nothing else', () => {
    const rows = buildStructureRows(previousYear);
    expect(rows).toEqual([
      { role: 'Co-President', category: 'Executive Board', display_order: 0 },
      { role: 'Co-President', category: 'Executive Board', display_order: 0 },
      { role: 'Historian', category: 'General Board', display_order: 7 },
    ]);
  });

  it('never carries previous names, member ids, photos, or bios', () => {
    const serialized = JSON.stringify(buildStructureRows(previousYear));
    for (const leaked of ['Old Person', 'old-1', 'old-2', 'x.png', 'bio', 'Old Intern']) {
      expect(serialized).not.toContain(leaked);
    }
    buildStructureRows(previousYear).forEach((row) => {
      expect(Object.keys(row).sort()).toEqual(['category', 'display_order', 'role']);
    });
  });

  it('leaves interns to the intern cohort workflow', () => {
    expect(buildStructureRows(previousYear).some((row) => row.category === 'Interns')).toBe(false);
  });

  it('puts the Executive Board before the General Board, in order', () => {
    const rows = buildStructureRows([
      { role: 'B', category: 'General Board', display_order: 0 },
      { role: 'A', category: 'Executive Board', display_order: 3 },
      { role: 'C', category: 'Executive Board', display_order: 1 },
    ]);
    expect(rows.map((row) => row.role)).toEqual(['C', 'A', 'B']);
  });
});

describe('parseRosterPaste', () => {
  it('reads "Name, Role" lines', () => {
    expect(parseRosterPaste('Havyn Nguyen, Co-President\nApril Pham, Co-President')).toEqual([
      { name: 'Havyn Nguyen', role: 'Co-President' },
      { name: 'April Pham', role: 'Co-President' },
    ]);
  });

  it('accepts tabs and pipes, skips a header, numbering, and unusable lines', () => {
    const raw = 'Name\tRole\n1. Amy Nguyen\tCo-Events Chair\n- Kay Tran | Historian\njust a name\n, Orphan role';
    expect(parseRosterPaste(raw)).toEqual([
      { name: 'Amy Nguyen', role: 'Co-Events Chair' },
      { name: 'Kay Tran', role: 'Historian' },
    ]);
  });

  it('keeps commas inside the role', () => {
    expect(parseRosterPaste('Sam Le, VCN Director, Executive Producer')).toEqual([
      { name: 'Sam Le', role: 'VCN Director, Executive Producer' },
    ]);
  });
});

describe('role normalization', () => {
  it('ignores case, "&" vs "and", hyphens, and spacing', () => {
    expect(normalizeRole('Co-President')).toBe(normalizeRole('co president'));
    expect(normalizeRole('Culture & Philanthropy Chair')).toBe(normalizeRole('culture and  philanthropy chair'));
  });

  it('guesses Executive Board for officer roles only', () => {
    expect(guessCategory('Internal Vice President')).toBe('Executive Board');
    expect(guessCategory('External Vice President / Intercollegiate Council')).toBe('Executive Board');
    expect(guessCategory('Historian')).toBe('General Board');
  });
});

describe('Cabinet draft member matching', () => {
  const directory = [
    member('m-havyn', 'Havyn', 'Nguyen'),
    member('m-april', 'April', 'Pham'),
    member('m-amy1', 'Amy', 'Nguyen'),
    member('m-amy2', 'Amy', 'Nguyen'),
    member('m-viet', 'Việt', 'Trần'),
  ];
  const index = buildMemberNameIndex(directory);

  const slots = [
    draft(0, { role: 'Co-President', category: 'Executive Board', name: null, member_id: null }),
    draft(1, { role: 'Co-President', category: 'Executive Board', name: null, member_id: null }),
    draft(2, { role: 'Historian', name: null, member_id: null }),
  ];

  it('fills the first empty slot for each role and links exact unique names', () => {
    const plan = planRosterFill(slots, parseRosterPaste('Havyn Nguyen, Co-President\nApril Pham, Co-President'), index);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      { draftId: 'd0', patch: { name: 'Havyn Nguyen', member_id: 'm-havyn' } },
      { draftId: 'd1', patch: { name: 'April Pham', member_id: 'm-april' } },
    ]);
    expect(plan.linked).toBe(2);
  });

  it('never auto-links an ambiguous name, but still places the person', () => {
    const plan = planRosterFill(slots, [{ name: 'Amy Nguyen', role: 'Historian' }], index);
    expect(plan.updates).toEqual([{ draftId: 'd2', patch: { name: 'Amy Nguyen', member_id: null } }]);
    expect(plan.linked).toBe(0);
  });

  it('offers both candidates for review when a name is ambiguous', () => {
    const suggestion = rosterLinkSuggestion({ name: 'Amy Nguyen', member_id: null }, index, new Set());
    expect(suggestion?.kind).toBe('review');
    expect(suggestion?.members.map((m) => m.id).sort()).toEqual(['m-amy1', 'm-amy2']);
  });

  it('recommends a single exact match and ignores diacritics', () => {
    expect(rosterLinkSuggestion({ name: 'Viet Tran', member_id: null }, index, new Set())).toMatchObject({ kind: 'recommended' });
  });

  it('does not link a member already linked to another position', () => {
    const taken = [draft(9, { role: 'Treasurer', name: 'Havyn Nguyen', member_id: 'm-havyn' }), ...slots];
    const plan = planRosterFill(taken, [{ name: 'Havyn Nguyen', role: 'Historian' }], index);
    expect(plan.updates[0].patch.member_id).toBeNull();
    expect(rosterLinkSuggestion({ name: 'Havyn Nguyen', member_id: null }, index, new Set(['m-havyn']))).toMatchObject({
      kind: 'review',
      note: expect.stringMatching(/already linked/),
    });
  });

  it('adds a new position, with a sensible board, for a role the structure lacks', () => {
    const plan = planRosterFill(slots, [{ name: 'April Pham', role: 'Community Outreach Chair' }], index);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([
      { role: 'Community Outreach Chair', category: 'General Board', display_order: 3, name: 'April Pham', member_id: 'm-april' },
    ]);
  });

  it('suggests nothing for someone with no member record or an already linked row', () => {
    expect(rosterLinkSuggestion({ name: 'Nobody Known', member_id: null }, index, new Set())).toBeNull();
    expect(rosterLinkSuggestion({ name: 'Havyn Nguyen', member_id: 'm-havyn' }, index, new Set())).toBeNull();
  });
});

describe('Cabinet preflight', () => {
  function roster(count: number) {
    return Array.from({ length: count }, (_, i) => draft(i, { role: `Role ${i}` }));
  }

  it('reports the 19 / 17 / 2 / 15 summary', () => {
    const drafts = roster(19).map((d, i) => (i >= 17 ? { ...d, member_id: null } : d));
    const photos = new Set(drafts.filter((d) => d.member_id).slice(0, 15).map((d) => d.member_id as string));
    const preflight = buildRosterPreflight(drafts, photos);
    expect(preflight).toMatchObject({ positions: 19, filled: 19, linked: 17, needReview: 2, photosAvailable: 15, canLock: true });
    expect(preflight.passed).toEqual(['19 positions filled', 'No duplicate role slot mistakes', '17 canonical member links']);
    expect(preflight.warnings.map((w) => w.message)).toEqual([
      '2 unresolved links (no approved photo until linked).',
      '2 missing approved photos (a photo is not required to publish).',
    ]);
  });

  it('blocks an empty position', () => {
    const drafts = [...roster(3), draft(4, { role: 'Treasurer', name: null, member_id: null })];
    const preflight = buildRosterPreflight(drafts);
    expect(preflight.canLock).toBe(false);
    expect(preflight.blockers[0]).toMatchObject({ code: 'empty_slot', draftIds: ['d4'] });
    expect(preflight.blockers[0].message).toContain('Treasurer');
  });

  it('blocks a duplicate canonical member', () => {
    const drafts = [draft(0, { member_id: 'same' }), draft(1, { member_id: 'same' }), draft(2)];
    const preflight = buildRosterPreflight(drafts);
    expect(preflight.canLock).toBe(false);
    expect(preflight.blockers.map((b) => b.code)).toContain('duplicate_member');
  });

  it('blocks an empty roster', () => {
    expect(buildRosterPreflight([]).blockers.map((b) => b.code)).toEqual(['empty']);
  });

  it('never blocks on a missing photo', () => {
    const preflight = buildRosterPreflight(roster(5), new Set());
    expect(preflight.canLock).toBe(true);
    expect(preflight.photosAvailable).toBe(0);
    expect(preflight.warnings.map((w) => w.code)).toContain('missing_photos');
  });

  it('allows the same role twice (co-chairs) but flags a crowded role as a likely mistake', () => {
    const co = [draft(0, { role: 'Co-Events Chair' }), draft(1, { role: 'Co-Events Chair' })];
    expect(buildRosterPreflight(co).warnings.map((w) => w.code)).not.toContain('duplicate_role');
    const crowded = [...co, draft(2, { role: 'Co-Events Chair' })];
    expect(buildRosterPreflight(crowded).warnings.map((w) => w.code)).toContain('duplicate_role');
  });

  it('flags the same person typed twice into one role', () => {
    const same = [draft(0, { role: 'Treasurer', name: 'Ann Le', member_id: null }), draft(1, { role: 'Treasurer', name: 'ann  le', member_id: null })];
    expect(buildRosterPreflight(same).warnings.map((w) => w.code)).toContain('duplicate_role');
  });

  it('renders passed, blocking, and attention lines for the shared UI', () => {
    const lines = rosterPreflightLines(buildRosterPreflight([draft(0), draft(1, { name: null, member_id: null })]));
    expect(lines.map((line) => line.severity)).toEqual(expect.arrayContaining(['ok', 'blocker']));
  });
});

describe('publishing helpers', () => {
  it('maps a draft to a public row without any photo field', () => {
    const row = cabinetMemberFromDraft(draft(1, { name: '  Havyn Nguyen ', role: ' Co-President ', fun_fact: 'hi' }), 'cy-2027');
    expect(row).toMatchObject({ name: 'Havyn Nguyen', role: 'Co-President', member_id: 'm1', cabinet_year_id: 'cy-2027', fun_fact: 'hi' });
    expect(row).not.toHaveProperty('image_url');
    expect(row).not.toHaveProperty('thumbnail_url');
  });

  it('never lets a blank draft field erase what an existing public row already has', () => {
    const update = cabinetMemberUpdateFromDraft(draft(1, { member_id: null, fun_fact: null, college: 'Sixth College' }), 'cy-2027');
    expect(update).toMatchObject({ name: 'Person 1', role: 'Role 1', college: 'Sixth College', cabinet_year_id: 'cy-2027' });
    for (const field of ['member_id', 'year', 'major', 'pronouns', 'favorite_snack', 'fun_fact']) {
      expect(update).not.toHaveProperty(field);
    }
    // A new row still records the nulls explicitly.
    expect(cabinetMemberFromDraft(draft(1, { member_id: null }), 'cy-2027')).toHaveProperty('member_id', null);
  });

  it('adopts the recorded row, then an unclaimed same-member row, never a claimed one', () => {
    const existing = [
      { id: 'a', name: 'Havyn Nguyen', member_id: 'm1' },
      { id: 'b', name: 'Other', member_id: 'm2' },
    ];
    expect(findExistingCabinetRow(draft(1, { published_cabinet_member_id: 'b' }), existing, new Set())?.id).toBe('b');
    expect(findExistingCabinetRow(draft(1), existing, new Set())?.id).toBe('a');
    expect(findExistingCabinetRow(draft(1), existing, new Set(['a']))).toBeNull();
  });

  it('matches an unlinked draft to an unlinked row by name only', () => {
    const existing = [
      { id: 'linked', name: 'Zed Unknown', member_id: 'someone' },
      { id: 'byname', name: 'zed unknown', member_id: null },
    ];
    expect(findExistingCabinetRow(draft(1, { name: 'Zed Unknown', member_id: null }), existing, new Set())?.id).toBe('byname');
  });
});
