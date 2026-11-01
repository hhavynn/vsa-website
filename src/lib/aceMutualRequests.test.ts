import type { AceNodeRef } from './aceAssignments';
import type { MemberOption } from './memberLinkMatching';
import {
  MutualRespondent,
  classifyMutualRequests,
  cleanPersonName,
  editDistance,
  followUpReviewRows,
  parseMutualRequests,
  planMutualImport,
  possibleMatchKey,
  resolveRequestedName,
  splitRequestedNames,
} from './aceMutualRequests';

// Every name here is invented.
const HEADERS = [
  'Timestamp',
  'Email Address',
  'Name (First, Middle Initial, Last)',
  'Year',
  'College',
  'Fam (only big fill this out)',
  'UCSD Email',
  'Preferred Name',
  'Pronouns',
  'Gender Identity',
  'Phone Number ',
  'Facebook Profile Link',
  'Instagram Username ',
  'Which ACE Eligible VSA Events Have You Attended?',
  'Are you mutually requesting a Big or a Little?',
  'Who are you Mutually Requesting?',
];

interface Row {
  time?: string;
  name: string;
  email: string;
  wants: 'Big' | 'Little' | '';
  request: string;
  fam?: string;
  preferred?: string;
}

function tsv(rows: Row[]): string {
  const lines = rows.map((row, index) =>
    [
      row.time ?? `10/${String(index + 1).padStart(2, '0')}/2026 12:00:00`,
      'personal@example.com',
      row.name,
      'Second',
      'Muir',
      row.fam ?? (row.wants === 'Big' ? 'Im a little' : ''),
      row.email,
      row.preferred ?? '',
      'they/them',
      '',
      '555-0100',
      'https://facebook.example/x',
      '@example',
      'GBM 1',
      row.wants,
      row.request.includes('\n') ? `"${row.request}"` : row.request,
    ].join('\t'),
  );
  return [HEADERS.join('\t'), ...lines].join('\n');
}

function respondent(overrides: Partial<MutualRespondent> & Pick<MutualRespondent, 'id' | 'name' | 'role'>): MutualRespondent {
  return {
    line: 2,
    email: null,
    preferredName: null,
    fam: null,
    requestText: '',
    requested: [],
    submissions: 1,
    rolesSeen: overrides.role ? [overrides.role] : [],
    ...overrides,
  };
}

const node = (id: string, name: string): AceNodeRef => ({
  id,
  name,
  familyId: 'fam-1',
  familyName: 'Fam One',
  memberId: null,
  parentId: null,
  roleLabel: null,
});

const member = (id: string): MemberOption => ({ id, fullName: 'x', college: null, year: null, displayName: 'x' });

describe('mutual source identity safety', () => {
  it('never deduplicates email-less rows solely because names are identical', () => {
    const parsed = parseMutualRequests(tsv([
      { name: 'Wren Halloway', email: 'wren', wants: 'Little', request: 'Tamsin Vale' },
      { name: 'Tamsin Vale', email: '', wants: 'Big', request: 'Wren Halloway' },
      { name: 'Tamsin Vale', email: '', wants: 'Big', request: 'Someone Else' },
    ]));
    expect(parsed.respondents).toHaveLength(3);
    expect(parsed.repeatsReplaced).toBe(0);
    const twins = parsed.respondents.filter((item) => item.name === 'Tamsin Vale');
    expect(twins).toHaveLength(2);
    expect(twins[0].id).not.toBe(twins[1].id);
    expect(parsed.warnings).toEqual([expect.stringContaining('multiple submissions without a UCSD email')]);
    expect(classifyMutualRequests(parsed.respondents).pairs).toEqual([]);
    expect(classifyMutualRequests(parsed.respondents).conflicts).toEqual([
      expect.objectContaining({ kind: 'duplicate_name', person: expect.objectContaining({ name: 'Tamsin Vale' }) }),
    ]);
  });

  it('withholds reciprocal pairs where a duplicate full name spans distinct source identities', () => {
    const parsed = parseMutualRequests(tsv([
      { name: 'Wren Halloway', email: 'wren', wants: 'Little', request: 'Tamsin Vale' },
      { name: 'Tamsin Vale', email: 'tamsin', wants: 'Big', request: 'Wren Halloway' },
      { name: 'Tamsin Vale', email: '', wants: 'Little', request: 'Nobody' },
    ]));
    expect(parsed.respondents).toHaveLength(3);
    const check = classifyMutualRequests(parsed.respondents);
    expect(check.pairs).toEqual([]);
    expect(check.conflicts).toEqual([
      expect.objectContaining({ kind: 'duplicate_name', person: expect.objectContaining({ name: 'Tamsin Vale' }) }),
    ]);
    expect(check.conflicts[0].others).toHaveLength(1);
    const followUps = followUpReviewRows(check);
    expect(followUps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Tamsin Vale',
        category: 'needs_review',
        reason: expect.stringContaining('distinct/unverified identities'),
      }),
    ]));
    expect(JSON.stringify(followUps)).not.toContain('@ucsd.edu');
    expect(JSON.stringify(followUps)).not.toContain('555-0100');
  });

  it('still replaces genuine repeat submissions sharing one normalized UCSD email', () => {
    const parsed = parseMutualRequests(tsv([
      { name: 'Tamsin Vale', email: 'TVALE', wants: 'Big', request: 'Wren Halloway' },
      { name: 'Tamsin Vale', email: 'tvale@ucsd.edu', wants: 'Big', request: 'Wren Halloway' },
    ]));
    expect(parsed.respondents).toHaveLength(1);
    expect(parsed.repeatsReplaced).toBe(1);
    expect(parsed.warnings.every((warning) => !warning.includes('multiple submissions without a UCSD email'))).toBe(true);
    expect(classifyMutualRequests(parsed.respondents).conflicts).toEqual([]);
  });
});

describe('splitRequestedNames', () => {
  it.each([
    ['Im a little, requesting Wren Halloway to be my big', ['Wren Halloway']],
    ['Wren Halloway (Im requesting a big)', ['Wren Halloway']],
    ['Wren Halloway (this is my second time filling out the form)', ['Wren Halloway']],
    ['Wren Halloway, this is my second time filling out the form', ['Wren Halloway']],
    ['Tamsin Vale, Orrin Pike & Juno Marsh', ['Tamsin Vale', 'Orrin Pike', 'Juno Marsh']],
    ['Tamsin Vale and Orrin Pike / Juno Marsh', ['Tamsin Vale', 'Orrin Pike', 'Juno Marsh']],
    ['Tamsin Vale\nOrrin Pike', ['Tamsin Vale', 'Orrin Pike']],
    ['my littles are tamsin vale and ORRIN PIKE 💕✨', ['Tamsin Vale', 'Orrin Pike']],
    ['Wren Halloway is my big!!', ['Wren Halloway']],
    ['Big: Wren Halloway', ['Wren Halloway']],
    ['I’m a little requesting Wren', ['Wren']],
    ['Im a little', []],
    ['', []],
  ])('%j → %j', (text, expected) => {
    expect(splitRequestedNames(text)).toEqual(expected);
  });

  it('keeps short given names that look like filler words', () => {
    expect(splitRequestedNames('requesting My Quill and An Brook')).toEqual(['My Quill', 'An Brook']);
    expect(splitRequestedNames('My')).toEqual(['My']);
  });

  it('drops a repeated name', () => {
    expect(splitRequestedNames('Orrin Pike, orrin pike')).toEqual(['Orrin Pike']);
  });
});

describe('cleanPersonName', () => {
  it('drops middle initials, commas and emoji, and fixes all-lowercase names', () => {
    expect(cleanPersonName('Tamsin, R, Vale')).toBe('Tamsin Vale');
    expect(cleanPersonName('orrin j. pike 🌸')).toBe('Orrin Pike');
    expect(cleanPersonName('Juno Rae Marsh')).toBe('Juno Rae Marsh');
    expect(cleanPersonName('McKenna Lowe')).toBe('McKenna Lowe');
  });
});

describe('parseMutualRequests', () => {
  it('reads the form, ignores contact columns, and maps the role answer', () => {
    const parsed = parseMutualRequests(
      tsv([
        { name: 'Wren Halloway', email: 'whalloway', wants: 'Little', request: 'Tamsin Vale', fam: 'Fam Moss' },
        { name: 'Tamsin R Vale', email: 'TVALE@ucsd.edu', wants: 'Big', request: 'Wren Halloway', preferred: 'Tam' },
      ]),
    );
    expect(parsed.warnings).toEqual([]);
    expect(parsed.respondents).toHaveLength(2);
    const [big, little] = parsed.respondents;
    expect(big).toMatchObject({ name: 'Wren Halloway', role: 'big', fam: 'Fam Moss', email: 'whalloway@ucsd.edu', line: 2 });
    expect(little).toMatchObject({ name: 'Tamsin Vale', role: 'little', fam: null, email: 'tvale@ucsd.edu', preferredName: 'Tam' });
    const all = JSON.stringify(parsed);
    expect(all).not.toContain('555-0100');
    expect(all).not.toContain('personal@example.com');
    expect(all).not.toContain('facebook');
  });

  it('keeps the latest submission per UCSD email, even when the role changed, and records both roles', () => {
    const parsed = parseMutualRequests(
      tsv([
        { time: '10/02/2026 09:00:00', name: 'Orrin Pike', email: 'opike', wants: 'Big', request: 'Wren Halloway' },
        { time: '10/01/2026 09:00:00', name: 'Juno Marsh', email: 'jmarsh', wants: 'Big', request: 'Wren Halloway' },
        { time: '10/05/2026 09:00:00', name: 'Orrin Pike', email: 'OPIKE@ucsd.edu', wants: 'Little', request: 'Tamsin Vale' },
      ]),
    );
    expect(parsed.repeatsReplaced).toBe(1);
    const orrin = parsed.respondents.find((r) => r.name === 'Orrin Pike');
    expect(orrin).toMatchObject({ role: 'big', requested: ['Tamsin Vale'], submissions: 2 });
    expect(orrin?.rolesSeen.sort()).toEqual(['big', 'little']);
    expect(parsed.warnings.join(' ')).toMatch(/1 earlier submission replaced/);
  });

  it('uses timestamps, not row order, to pick the latest', () => {
    const parsed = parseMutualRequests(
      tsv([
        { time: '10/09/2026 09:00:00', name: 'Juno Marsh', email: 'jmarsh', wants: 'Big', request: 'Newer Pick' },
        { time: '10/01/2026 09:00:00', name: 'Juno Marsh', email: 'jmarsh', wants: 'Big', request: 'Older Pick' },
      ]),
    );
    expect(parsed.respondents[0].requested).toEqual(['Newer Pick']);
  });

  it('handles a multi-line request cell copied from Sheets', () => {
    const parsed = parseMutualRequests(tsv([{ name: 'Wren Halloway', email: 'w', wants: 'Little', request: 'Tamsin Vale\nOrrin Pike' }]));
    expect(parsed.respondents[0].requested).toEqual(['Tamsin Vale', 'Orrin Pike']);
  });

  it('asks for the header row when the needed columns are missing', () => {
    const parsed = parseMutualRequests('Wren Halloway\tLittle\tTamsin Vale');
    expect(parsed.respondents).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/header row/);
  });
});

describe('editDistance', () => {
  it('counts single edits', () => {
    expect(editDistance('vale', 'vail')).toBe(2);
    expect(editDistance('pike', 'pyke')).toBe(1);
    expect(editDistance('marsh', 'marsh')).toBe(0);
  });
});

describe('resolveRequestedName', () => {
  const bigs = [
    respondent({ id: 'a', name: 'Wren Ivy Halloway', role: 'big' }),
    respondent({ id: 'b', name: 'Bartholomew Pike', preferredName: 'Bart', role: 'big' }),
    respondent({ id: 'c', name: 'Juno Marsh', role: 'big' }),
    respondent({ id: 'd', name: 'Juno Fairweather', role: 'big' }),
    respondent({ id: 'e', name: 'Seraphina Okonkwo', role: 'big' }),
  ];

  it('tries exact, then first + last, then preferred + last, then a unique first name', () => {
    expect(resolveRequestedName('wren ivy HALLOWAY', bigs)).toMatchObject({ kind: 'exact', method: 'full_name', target: { id: 'a' } });
    expect(resolveRequestedName('Wren Halloway', bigs)).toMatchObject({ kind: 'exact', method: 'first_last', target: { id: 'a' } });
    expect(resolveRequestedName('Juno Q Marsh', bigs)).toMatchObject({ kind: 'exact', method: 'first_last', target: { id: 'c' } });
    expect(resolveRequestedName('Bart Pike', bigs)).toMatchObject({ kind: 'exact', method: 'preferred_last', target: { id: 'b' } });
    expect(resolveRequestedName('bart', bigs)).toMatchObject({ kind: 'exact', method: 'first_only', target: { id: 'b' } });
    expect(resolveRequestedName('Wren', bigs)).toMatchObject({ kind: 'exact', method: 'first_only', target: { id: 'a' } });
  });

  it('refuses a first name that several people share', () => {
    const result = resolveRequestedName('Juno', bigs);
    expect(result).toMatchObject({ kind: 'ambiguous', candidates: [{ id: 'c' }, { id: 'd' }] });
  });

  it('offers a misspelling only as a possible match', () => {
    expect(resolveRequestedName('Juno Marsch', bigs)).toMatchObject({ kind: 'possible', target: { id: 'c' }, distance: 1 });
    expect(resolveRequestedName('Seraphina Okonkow', bigs)).toMatchObject({ kind: 'possible', target: { id: 'e' }, distance: 2 });
    expect(resolveRequestedName('Seraphine', bigs)).toMatchObject({ kind: 'possible', target: { id: 'e' } });
  });

  it('scales the allowed typos to the name length', () => {
    expect(resolveRequestedName('Juno Mxxsh', bigs).kind).toBe('none');
    expect(resolveRequestedName('Nobody Known', bigs).kind).toBe('none');
    expect(resolveRequestedName('Jun', bigs).kind).toBe('none');
  });
});

describe('classifyMutualRequests', () => {
  const big = (id: string, name: string, requested: string[], extra: Partial<MutualRespondent> = {}) =>
    respondent({ id, name, role: 'big', requested, requestText: requested.join(', '), ...extra });
  const little = (id: string, name: string, requested: string[], extra: Partial<MutualRespondent> = {}) =>
    respondent({ id, name, role: 'little', requested, requestText: requested.join(', '), ...extra });

  it('confirms pairs that requested each other, including a Big with two Littles', () => {
    const check = classifyMutualRequests([
      big('b1', 'Wren Halloway', ['Tamsin Vale', 'Orrin']),
      little('l1', 'Tamsin Vale', ['Wren Halloway']),
      little('l2', 'Orrin Pike', ['Wren']),
    ]);
    expect(check.pairs.map((p) => [p.big.id, p.little.id])).toEqual([
      ['b1', 'l1'],
      ['b1', 'l2'],
    ]);
    expect(check.oneSided).toEqual([]);
    expect(check.unresolved).toEqual([]);
  });

  it('reports one-sided requests in both directions', () => {
    const check = classifyMutualRequests([
      big('b1', 'Wren Halloway', ['Tamsin Vale']),
      big('b2', 'Juno Marsh', []),
      little('l1', 'Tamsin Vale', ['Juno Marsh']),
    ]);
    expect(check.pairs).toEqual([]);
    expect(check.oneSided.map((o) => [o.from.id, o.to.id])).toEqual([
      ['b1', 'l1'],
      ['l1', 'b2'],
    ]);
  });

  it('only matches the opposite role, and says when the name is a same-role respondent', () => {
    const check = classifyMutualRequests([big('b1', 'Wren Halloway', ['Juno Marsh']), big('b2', 'Juno Marsh', ['Wren Halloway'])]);
    expect(check.pairs).toEqual([]);
    expect(check.unresolved).toHaveLength(2);
    expect(check.unresolved[0].reason).toMatch(/also answered as a Big/);
  });

  it('lists unresolved and ambiguous names', () => {
    const check = classifyMutualRequests([
      big('b1', 'Juno Marsh', []),
      big('b2', 'Juno Fairweather', []),
      little('l1', 'Tamsin Vale', ['Nobody Known', 'Juno']),
    ]);
    expect(check.unresolved.map((u) => u.requested)).toEqual(['Nobody Known', 'Juno']);
    expect(check.unresolved[0].reason).toMatch(/Nobody in the form/);
    expect(check.unresolved[1].reason).toMatch(/Juno Marsh or Juno Fairweather/);
  });

  it('holds a fuzzy match until the chair accepts it, and treats a rejection as unresolved', () => {
    const people = [big('b1', 'Wren Halloway', ['Tamsin Vael']), little('l1', 'Tamsin Vale', ['Wren Halloway'])];
    const pending = classifyMutualRequests(people);
    expect(pending.possible).toHaveLength(1);
    expect(pending.possible[0]).toMatchObject({ decision: 'pending', candidate: { id: 'l1' } });
    expect(pending.pairs).toEqual([]);
    expect(pending.oneSided.map((o) => o.from.id)).toEqual(['l1']);

    const key = possibleMatchKey('b1', 'Tamsin Vael', 'l1');
    const accepted = classifyMutualRequests(people, new Map([[key, 'accepted']]));
    expect(accepted.pairs).toHaveLength(1);
    expect(accepted.pairs[0].confirmedByChair).toBe(true);
    expect(accepted.oneSided).toEqual([]);

    const rejected = classifyMutualRequests(people, new Map([[key, 'rejected']]));
    expect(rejected.pairs).toEqual([]);
    expect(rejected.unresolved[0].reason).toMatch(/rejected/);
  });

  it('does not carry an accepted spelling over to a different person after the paste changes', () => {
    const key = possibleMatchKey('b1', 'Tamsin Vael', 'l1');
    const repasted = [big('b1', 'Wren Halloway', ['Tamsin Vael']), little('l9', 'Tamsin Vahl', ['Wren Halloway'])];
    const check = classifyMutualRequests(repasted, new Map([[key, 'accepted']]));
    expect(check.possible[0]).toMatchObject({ decision: 'pending', candidate: { id: 'l9' } });
    expect(check.pairs).toEqual([]);
  });

  it('flags a Little mutually matched with two Bigs and keeps them out of the confirmed pairs', () => {
    const check = classifyMutualRequests([
      big('b1', 'Wren Halloway', ['Tamsin Vale']),
      big('b2', 'Juno Marsh', ['Tamsin Vale']),
      little('l1', 'Tamsin Vale', ['Wren Halloway', 'Juno Marsh']),
    ]);
    expect(check.pairs).toEqual([]);
    expect(check.conflicts).toHaveLength(1);
    expect(check.conflicts[0]).toMatchObject({ kind: 'multiple_bigs', person: { id: 'l1' } });
    expect(check.conflicts[0].others.map((o) => o.id)).toEqual(['b1', 'b2']);
  });

  it('flags someone who answered as both roles and keeps their pairs out', () => {
    const check = classifyMutualRequests([
      big('b1', 'Wren Halloway', ['Tamsin Vale'], { rolesSeen: ['little', 'big'], submissions: 2 }),
      little('l1', 'Tamsin Vale', ['Wren Halloway']),
    ]);
    expect(check.pairs).toEqual([]);
    expect(check.conflicts[0]).toMatchObject({ kind: 'both_roles', person: { id: 'b1' } });
  });

  it('runs end to end on a messy paste', () => {
    const parsed = parseMutualRequests(
      tsv([
        { name: 'Wren I. Halloway', email: 'whalloway', wants: 'Little', request: 'tamsin vale & Orrin', fam: 'Fam Moss' },
        { name: 'Tamsin Vale', email: 'tvale', wants: 'Big', request: 'Im a little, requesting Wren Haloway to be my big' },
        { name: 'Orrin Pike', email: 'opike', wants: 'Big', request: 'Wren Halloway (Im requesting a big) 🙏' },
        { name: 'Juno Marsh', email: 'jmarsh', wants: 'Big', request: 'Someone Unknown' },
      ]),
    );
    const first = classifyMutualRequests(parsed.respondents);
    expect(first.pairs.map((p) => p.little.name)).toEqual(['Orrin Pike']);
    expect(first.possible.map((p) => p.requested)).toEqual(['Wren Haloway']);
    expect(first.unresolved.map((u) => u.requested)).toEqual(['Someone Unknown']);

    const decided = classifyMutualRequests(parsed.respondents, new Map([[first.possible[0].key, 'accepted']]));
    expect(decided.pairs.map((p) => p.little.name).sort()).toEqual(['Orrin Pike', 'Tamsin Vale']);
  });
});

describe('planMutualImport', () => {
  const wren = respondent({ id: 'b1', name: 'Wren Ivy Halloway', role: 'big' });
  const juno = respondent({ id: 'b2', name: 'Juno Marsh', role: 'big' });
  const tamsin = respondent({ id: 'l1', name: 'Tamsin Vale', role: 'little', email: 'tvale@ucsd.edu' });
  const orrin = respondent({ id: 'l2', name: 'Orrin Pike', role: 'little', email: 'opike@ucsd.edu' });
  const bao = respondent({ id: 'l3', name: 'Bao Lark', role: 'little' });

  it('links by unique email, assigns a Big on exactly one node, and notes the rest', () => {
    const plan = planMutualImport(
      [
        { big: wren, little: tamsin, confirmedByChair: false },
        { big: juno, little: orrin, confirmedByChair: false },
        { big: juno, little: bao, confirmedByChair: false },
      ],
      {
        nodes: [node('n1', 'Wren Halloway'), node('n2', 'Juno Marsh'), node('n3', 'Juno Marsh')],
        membersByEmail: new Map([
          ['tvale@ucsd.edu', [member('m1')]],
          ['opike@ucsd.edu', [member('m2'), member('m3')]],
        ]),
        existingNames: [],
      },
    );
    expect(plan.alreadyInDraft).toBe(0);
    expect(plan.resolution).toEqual({
      seeds: [
        { little_name: 'Tamsin Vale', little_member_id: 'm1', big_ace_member_id: 'n1', notes: null },
        { little_name: 'Orrin Pike', little_member_id: null, big_ace_member_id: null, notes: 'Mutual Big: Juno Marsh (several on tree)' },
        { little_name: 'Bao Lark', little_member_id: null, big_ace_member_id: null, notes: 'Mutual Big: Juno Marsh (several on tree)' },
      ],
      emailLinked: 1,
      bigMatched: 1,
      bigUnresolved: 2,
    });
    expect(JSON.stringify(plan)).not.toContain('@ucsd.edu');
  });

  it('notes a Big who is not on the tree and skips Littles already in the draft', () => {
    const plan = planMutualImport(
      [
        { big: wren, little: tamsin, confirmedByChair: false },
        { big: wren, little: orrin, confirmedByChair: false },
      ],
      { nodes: [], membersByEmail: new Map(), existingNames: ['  tamsin VALE '] },
    );
    expect(plan.alreadyInDraft).toBe(1);
    expect(plan.resolution.seeds).toEqual([
      { little_name: 'Orrin Pike', little_member_id: null, big_ace_member_id: null, notes: 'Mutual Big: Wren Ivy Halloway (not on tree)' },
    ]);
  });
});

describe('followUpReviewRows', () => {
  it('exports names and request text only', () => {
    const check = classifyMutualRequests([
      respondent({ id: 'b1', name: 'Wren Halloway', role: 'big', requested: ['Tamsin Vale'], requestText: 'Tamsin Vale', email: 'w@ucsd.edu' }),
      respondent({ id: 'l1', name: 'Tamsin Vale', role: 'little', requested: ['Nobody Known'], requestText: 'Nobody Known', line: 3 }),
    ]);
    const rows = followUpReviewRows(check);
    expect(rows.map((row) => [row.label, row.category])).toEqual([
      ['Wren Halloway', 'needs_review'],
      ['Tamsin Vale', 'unmatched'],
    ]);
    expect(rows[0].reason).toMatch(/Asked for Tamsin Vale, who did not ask for them \(asked for Nobody Known\)/);
    expect(Object.keys(rows[0].raw ?? {})).toEqual(['Role', 'Requested', 'Request text']);
    expect(JSON.stringify(rows)).not.toContain('@ucsd.edu');
  });
});
