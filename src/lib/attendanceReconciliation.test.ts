// Second-pass reconciliation decisions. Every person here is invented.
import { member, RowSpec, scenario } from '../test-utils/identityFixtures';
import { buildIdentityIndex, IdentityMember } from './identityResolution';
import { personNameFromFull } from './personName';
import {
  canonicalEmail,
  CreditProvenance,
  hardContradictions,
  isSchoolLogin,
  reconcileRow,
  schoolEmailRelation,
} from './attendanceReconciliation';

function decide(
  specs: RowSpec[],
  members: IdentityMember[],
  options: Parameters<typeof scenario>[2] & { provenance?: Record<string, CreditProvenance[]> } = {},
) {
  const { rows, snapshot } = scenario(specs, members, options);
  const index = buildIdentityIndex(snapshot);
  const ctx = { index, rows, provenance: new Map(Object.entries(options.provenance ?? {})) };
  return { rows, ctx, decisions: rows.map((row) => reconcileRow(row, ctx)) };
}

describe('addresses', () => {
  it('fixes a mistyped school domain and leaves other addresses alone', () => {
    expect(canonicalEmail('abcd@ucsd.edy')).toBe('abcd@ucsd.edu');
    expect(canonicalEmail('xy123@UCSD.net')).toBe('xy123@ucsd.edu');
    expect(canonicalEmail('Cd045@ucsd.edi')).toBe('cd045@ucsd.edu');
    expect(canonicalEmail('person@gmail.com')).toBe('person@gmail.com');
    expect(canonicalEmail('person@ucsd.edu')).toBe('person@ucsd.edu');
  });

  it('tells a login (abc123) from a name-based alias (a8lastname)', () => {
    expect(isSchoolLogin('abc123@ucsd.edu')).toBe(true);
    expect(isSchoolLogin('a8lastname@ucsd.edu')).toBe(false);
    expect(isSchoolLogin('alastname@ucsd.edu')).toBe(false);
    expect(isSchoolLogin('abc123@gmail.com')).toBe(false);
  });

  it('compares school addresses: the digits on a login tell people apart', () => {
    expect(schoolEmailRelation(['abc036@ucsd.edu'], ['abc032@ucsd.edu'])).toBe('login_distinct');
    expect(schoolEmailRelation(['abc005@ucsd.edu'], ['a8lastname@ucsd.edu'])).toBe('mixed');
    expect(schoolEmailRelation(['b3lastname@ucsd.edu'], ['b2lastname@ucsd.edu'])).toBe('typo');
    expect(schoolEmailRelation(['evxqtz@ucsd.edu'], ['ezlastname@ucsd.edu'])).toBe('alias_distinct');
    expect(schoolEmailRelation(['same@ucsd.edu'], ['same@ucsd.edu'])).toBe('same');
    expect(schoolEmailRelation(['same@ucsd.edu'], ['same@gmail.com'])).toBe('none');
  });
});

describe('the resolver\'s verdict stands', () => {
  it('leaves automatic matches, already-credited members and new people alone', () => {
    const rue = member('rue', 'Rue', 'Calloway', { email: 'rue@ucsd.edu', college: 'Muir', year: '2nd Year' });
    const { decisions } = decide(
      [{ name: 'Rue Calloway', email: 'rue@ucsd.edu' }, { name: 'Ione Hargrove', email: 'ione@ucsd.edu' }],
      [rue],
      { attended: ['rue'] },
    );
    expect(decisions).toEqual([null, null]);
  });

  it('a row with no email and no college still matches the only member with that name', () => {
    const ione = member('ione', 'Ione', 'Hargrove', { college: 'Seventh', year: '2nd Year' });
    const { rows, decisions } = decide([{ name: 'Ione Hargrove' }], [ione]);
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'unique_name' });
    expect(decisions[0]).toBeNull();
  });
});

describe('same person, different address', () => {
  it('personal address on file, school address on the sheet, no college anywhere: credits the only member of that name', () => {
    const rue = member('rue', 'Rue', 'Calloway', { email: 'rue@gmail.com', year: '2nd Year' });
    const { decisions } = decide([{ name: 'Rue Calloway', email: 'rue@ucsd.edu', year: '2nd Year' }], [rue]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'rue', rule: 'unique_candidate', rememberEmail: false });
  });

  it('a login on the sheet and a name-based alias on file, same college and standing: same student', () => {
    const mira = member('mira', 'Mira', 'Quill', { email: 'm8quill@ucsd.edu', college: 'Sixth', year: '1st Year' });
    const { decisions } = decide([{ name: 'Mira Quill', email: 'mqu005@ucsd.edu', college: 'Sixth', year: '1st Year' }], [mira]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'mira', rule: 'unique_candidate', rememberEmail: true });
  });

  it('a one-character slip in an alias is a typo, not a second person', () => {
    const orin = member('orin', 'Orin', 'Vale', { email: 'o2vale@ucsd.edu', college: 'Muir', year: '1st Year' });
    const { decisions } = decide([{ name: 'Orin Vale', email: 'o3vale@ucsd.edu', college: 'Muir', year: '1st Year' }], [orin]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'orin', rememberEmail: false });
  });

  it('the same account digits with mistyped letters are one login when name, college and standing agree', () => {
    const dara = member('dara', 'Dara', 'Lindqvist', { email: 'dal068@ucsd.edu', college: 'Warren', year: '1st Year Transfer' });
    const { decisions } = decide(
      [{ name: 'Dara Lindqvist', email: 'dlind068@ucsd.edu', college: 'Warren', year: '1st Year Transfer' }],
      [dara],
    );
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'dara' });
  });

  it('a middle initial never separates two records; a one-letter login slip goes to an admin when college is not on file', () => {
    const odessa = member('odessa', 'Odessa T', 'Marrow', { email: 'otm004@ucsd.edu', year: '1st Year' });
    const { rows, decisions } = decide([{ name: 'Odessa Marrow', email: 'otn004@ucsd.edu', college: 'Eighth', year: '1st Year' }], [odessa]);
    expect(rows[0].candidates[0].name).toBe('exact');
    expect(decisions[0]).toMatchObject({ kind: 'pending' });
    expect((decisions[0] as { note: string }).note).toMatch(/near-identical school login/i);
  });

  it('a near-identical login is one student when college and class year both agree', () => {
    const odessa = member('odessa', 'Odessa T', 'Marrow', { email: 'otm004@ucsd.edu', college: 'Eighth', year: '1st Year' });
    const { decisions } = decide([{ name: 'Odessa Marrow', email: 'otn004@ucsd.edu', college: 'Eighth', year: '1st Year' }], [odessa]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'odessa', rememberEmail: false });
  });

  it('a near-identical login with another college or another class year is a different student', () => {
    const odessa = member('odessa', 'Odessa', 'Marrow', { email: 'otm004@ucsd.edu', college: 'Eighth', year: '1st Year' });
    const otherCollege = decide([{ name: 'Odessa Marrow', email: 'otn004@ucsd.edu', college: 'Muir', year: '1st Year' }], [odessa]);
    expect(otherCollege.decisions[0]).toMatchObject({ kind: 'new', rule: 'different_person' });
    const otherYear = decide([{ name: 'Odessa Marrow', email: 'otn004@ucsd.edu', college: 'Eighth', year: '3rd Year' }], [odessa]);
    expect(otherYear.decisions[0]).toMatchObject({ kind: 'new', rule: 'different_person' });
  });

  it('a different login with a full middle name (not an initial) is still a different person', () => {
    const ann = member('ann', 'Odessa Ann', 'Marrow', { email: 'oam004@ucsd.edu', year: '2nd Year' });
    const { decisions } = decide([{ name: 'Odessa Marrow', email: 'otm004@ucsd.edu', college: 'Eighth', year: '1st Year' }], [ann]);
    expect(decisions[0]?.kind).toBe('new');
  });

  it('an email owner whose name was mistyped still gets the credit', () => {
    const wren = member('wren', 'Wren', 'Alder', { email: 'wea007@ucsd.edu', college: 'ERC', year: '2nd Year' });
    const { decisions } = decide([{ name: 'Wern Alder', email: 'wea007@ucsd.edu', college: 'ERC', year: '2nd Year' }], [wren]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'wren', rule: 'email_owner' });
  });

  it('a nickname on the same school address is the address owner', () => {
    const theodore = member('theodore', 'Theodore', 'Ostrow', { email: 'tko014@ucsd.edu', college: 'Muir', year: '2nd Year Transfer' });
    const { decisions } = decide([{ name: 'Teddy Ostrow', email: 'tko014@ucsd.edu', college: 'Muir', year: '2nd Year Transfer' }], [theodore]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'theodore', rule: 'email_owner' });
  });

  it('a middle name added or left out still finds the one member', () => {
    const nico = member('nico', 'Nico', 'De Vance', { email: 'ndv002@ucsd.edu' });
    const { decisions } = decide([{ name: 'Nico Vance' }], [nico]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'nico' });
  });
});

describe('different people are kept apart', () => {
  it('same name, same college, different logins: a new person', () => {
    const tavi = member('tavi', 'Tavi', 'Holm', { email: 'tho002@ucsd.edu', college: 'Revelle', year: '1st Year' });
    const { decisions } = decide([{ name: 'Tavi Holm', email: 'thv004@ucsd.edu', college: 'Revelle', year: '1st Year' }], [tavi]);
    expect(decisions[0]).toMatchObject({ kind: 'new', rule: 'different_person' });
  });

  it('a middle-name look-alike with a different login is not credited', () => {
    const ann = member('ann', 'Tavi Ann', 'Holm', { email: 'tah004@ucsd.edu', year: '2nd Year' });
    const { decisions } = decide([{ name: 'Tavi Holm', email: 'thv004@ucsd.edu', college: 'Eighth', year: '1st Year' }], [ann]);
    expect(decisions[0]?.kind).toBe('new');
  });

  it('a different login and a different college on the same name: a new person', () => {
    const lena = member('lena', 'Lena', 'Fisk', { email: 'lef032@ucsd.edu', college: 'Eighth', year: '2nd Year' });
    const { decisions } = decide([{ name: 'Lena Fisk', email: 'lef036@ucsd.edu', college: 'Warren', year: '2nd Year' }], [lena]);
    expect(decisions[0]).toMatchObject({ kind: 'new', rule: 'different_person' });
  });

  it('only another college differs and nothing else can be checked: an admin decides', () => {
    const soren = member('soren', 'Soren', 'Imai', { email: 'sai067@ucsd.edu', college: 'Marshall', year: '1st Year' });
    const { decisions } = decide([{ name: 'Soren Imai', college: 'Warren', year: '1st Year' }], [soren]);
    expect(decisions[0]).toMatchObject({ kind: 'pending' });
  });

  it('a member already attending through their own address is somebody else when this row has another', () => {
    const pia = member('pia', 'Pia', 'Rask', { email: 'pir038@ucsd.edu', college: 'Sixth', year: '2nd Year' });
    const { rows, ctx } = decide(
      [
        { name: 'Pia Rask', email: 'pir038@ucsd.edu', college: 'Sixth', year: '2nd Year' },
        { name: 'Pia Rask', email: 'pir043@ucsd.edu', college: 'ERC', year: '1st Year' },
      ],
      [pia],
    );
    expect(hardContradictions(rows[1], 'pia', ctx).length).toBeGreaterThan(0);
  });
});

describe('several members share the name', () => {
  const juno = (id: string, college: string | null) => member(id, 'Juno', 'Brandt', { email: `${id}@ucsd.edu`, college, year: '2nd Year' });
  const row: RowSpec = { name: 'Juno Brandt', email: 'jb275@gmail.com', year: '2nd Year' };

  it('the credit already recorded from this very row is kept', () => {
    const { decisions } = decide([row], [juno('a', 'Sixth'), juno('b', 'Muir')], {
      provenance: { a: [{ name: personNameFromFull('Juno Brandt'), emails: [] }] },
    });
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'a', rule: 'preserved_credit' });
  });

  it('with nothing to separate them, it stays for an admin', () => {
    const { decisions } = decide([row], [juno('a', 'Sixth'), juno('b', 'Muir')]);
    expect(decisions[0]).toMatchObject({ kind: 'pending' });
  });
});

describe('records and repeats', () => {
  it('one row listing two addresses held by two records means one person: keep the busier record, merge the other', () => {
    const school = member('school', 'Bramley', 'Ostrow', { email: 'bko014@ucsd.edu', college: 'Muir', year: '2nd Year', points: 42 });
    const personal = member('personal', 'Bram', 'Ostrow', { email: 'bram@gmail.com', year: '2nd Year', points: 1 });
    const { decisions } = decide(
      [{ name: 'Bram Ostrow', email: 'bko014@ucsd.edu', email2: 'bram@gmail.com', college: 'Muir', year: '2nd Year' }],
      [school, personal],
    );
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'school', rule: 'same_submission', mergeMemberIds: ['personal'] });
  });

  it('an address two members share is never evidence that they are one person', () => {
    const ann = member('ann', 'Ann', 'Tran', { email: 'family@gmail.com', college: 'Muir', year: '2nd Year', points: 1 });
    const anh = member('anh', 'Anh', 'Tran', { email: 'family@gmail.com', college: 'Warren', year: '2nd Year', points: 9 });
    const { decisions } = decide([{ name: 'Ann Tran', email: 'family@gmail.com', college: 'Muir', year: '2nd Year' }], [ann, anh]);
    expect(decisions[0]).toMatchObject({ kind: 'pending' });
  });

  it('two addresses on one row, each held by a different record, still merge', () => {
    const a = member('a', 'Cleo', 'Marsh', { email: 'cm014@ucsd.edu', year: '2nd Year', points: 3 });
    const b = member('b', 'Cleo', 'Marsh', { email: 'cleo@gmail.com', year: '2nd Year', points: 1 });
    const { decisions } = decide([{ name: 'Cleo Marsh', email: 'cm014@ucsd.edu', email2: 'cleo@gmail.com', year: '2nd Year' }], [a, b]);
    expect(decisions[0]).toMatchObject({ kind: 'match', memberId: 'a', rule: 'same_submission', mergeMemberIds: ['b'] });
  });

  it('a full candidate list is never read as complete: no new member is created from it', () => {
    const lena = (id: string, login: string) => member(id, 'Lena', 'Fisk', { email: `${login}@ucsd.edu`, college: 'Eighth', year: '2nd Year' });
    const roster = [lena('l1', 'lef031'), lena('l2', 'lef032'), lena('l3', 'lef033'), lena('l4', 'lef034'), lena('l5', 'lef035'),
      member('ann', 'Lena Ann', 'Fisk', { year: '2nd Year' })];
    const { rows, decisions } = decide([{ name: 'Lena Fisk', email: 'lef036@ucsd.edu', college: 'Eighth', year: '2nd Year' }], roster);
    expect(rows[0].candidates.length).toBe(5);
    expect(decisions[0]).toMatchObject({ kind: 'pending' });
  });

  it('a second row for a member an earlier row already claimed is a repeat, not a second credit', () => {
    const hana = member('hana', 'Hana', 'Okoye', { email: 'hokoye@ucsd.edu' });
    const { rows, decisions } = decide(
      [{ name: 'Hana Okoye', email: 'hanaokoye@ucsd.edu' }, { name: 'Hana Okoye', email: 'hokoye@ucsd.edu' }],
      [hana],
      { aliases: [{ member_id: 'hana', email: 'hanaokoye@ucsd.edu' }] },
    );
    expect(rows[0]).toMatchObject({ status: 'match', matchedMember: hana });
    expect(rows[1]).toMatchObject({ status: 'review', reason: 'member_claimed_by_earlier_row' });
    expect(decisions[0]).toBeNull();
    expect(decisions[1]).toMatchObject({ kind: 'skip', rule: 'repeat_submission' });
  });

  it('a year recorded last year still fits this year\'s sheet', () => {
    const kit = member('kit', 'Kit', 'Marlow', { email: 'kit@gmail.com', college: 'Muir', year: '1st Year' });
    const { rows, decisions } = decide(
      [{ name: 'Kit Marlow', email: 'kit@ucsd.edu', college: 'Muir', year: '2nd Year' }],
      [kit],
      { observations: [{ member_id: 'kit', academic_year_start: 2025, year_label: '1st Year', source: 'attendance_import' }] },
    );
    expect(rows[0].status).toBe('match');
    expect(decisions[0]).toBeNull();
  });
});
