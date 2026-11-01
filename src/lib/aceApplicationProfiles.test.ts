/**
 * Synthetic data only: every name, email, and answer below is made up.
 */
import {
  ApplicationProfile,
  activityLevel,
  checkPair,
  genderPreferenceOf,
  isNoneAnswer,
  matchProfilesToDrafts,
  matchProfilesToNodes,
  namesPerson,
  pairWarningIssues,
  parseApplicationProfiles,
  parseCapacity,
  parseYear,
  personRefFromName,
  suggestBigs,
  unmatchedProfiles,
  yearPreferenceOf,
  yesNoOf,
} from './aceApplicationProfiles';
import type { AceNodeRef } from './aceAssignments';
import type { AceAssignmentDraft } from '../types';

// Column order mirrors the real form: identity, never-read fields, shared
// answers, the Big section, then the Little section with " 2" headers.
const HEADERS = [
  'Timestamp',
  'Email Address',
  'Name (First, Middle Initial, Last)',
  'Preferred Name',
  'UCSD Email',
  'Phone Number',
  'Instagram',
  'Date of Birth',
  'Hometown',
  'Allergies',
  'Pants Size',
  'Major/Minor',
  'Which events have you attended?',
  'Are You Applying to be an Anh/Chi (Big) or Em (Little)? ',
  'Year?',
  'College?',
  'Pronouns',
  'Gender Identity',
  'How active are you in VSA?',
  // Big section
  'If you currently have family/line, which one?',
  'What are YOU looking for in a Little(s)?',
  'How many littles do you plan on picking up?',
  'Gender Preference? ',
  'Are you okay with having a Little the same year as you or older? ',
  'How many hours a week can you spend with your little(s)?',
  'Are you okay with your little(s) partaking in recreational activities (drinking, smoking)?',
  'If not, please elaborate',
  'Do you intend to partake in recreational activities?',
  'How active do you want your little(s) to be in VSA?',
  'Any preferences for littles?',
  'How introverted/extroverted are you?',
  'Are you an indoors or outdoors person?',
  'Are you a morning or night person?',
  'What are your hobbies?',
  'What are your favorite gifts to receive?',
  'What is your love language?',
  "Is there anyone in VSA who you don't want to be paired with or have problems with?",
  // Little section
  'What are YOU looking for in a Big?',
  'Gender Preference?  2',
  'Are you okay with having a big the same year or younger than you?',
  'Do you want to have a sib(s)/twin?',
  'How many hours a week can you spend with your little(s)? 2',
  'Are you okay with your big partaking in recreational activities?',
  'Do you intend to partake in recreational activities? 2',
  'How active do you want your Big to be in VSA?',
  'Any preferences for bigs?',
  'How introverted/extroverted are you? 2',
  'Are you an indoors or outdoors person? 2',
  'Are you a morning or night person? 2',
  'What are your hobbies? 2',
  'What are your favorite gifts to receive? 2',
  'What is your love language? 2',
  "Is there anyone in VSA who you don't want to be paired with or have problems with? 2",
];

type Answers = Record<string, string>;

function row(answers: Answers): string[] {
  return HEADERS.map((header) => answers[header] ?? '');
}

const SECRET = 'NEVER-SHOWN';
const neverRead: Answers = {
  'Email Address': 'personal@example.com',
  'Phone Number': SECRET,
  Instagram: SECRET,
  'Date of Birth': SECRET,
  Hometown: SECRET,
  Allergies: SECRET,
  'Pants Size': SECRET,
  'Major/Minor': SECRET,
  'Which events have you attended?': SECRET,
  'What are your favorite gifts to receive?': SECRET,
  'What are your favorite gifts to receive? 2': SECRET,
};

const big = (name: string, preferred: string, email: string, over: Answers = {}): Answers => ({
  ...neverRead,
  'Name (First, Middle Initial, Last)': name,
  'Preferred Name': preferred,
  'UCSD Email': email,
  'Are You Applying to be an Anh/Chi (Big) or Em (Little)? ': 'Anh/Chi (Big)',
  'Year?': '3rd',
  'College?': 'Revelle',
  'Gender Identity': 'Female',
  'How active are you in VSA?': 'Very active',
  'How many littles do you plan on picking up?': '2',
  'Gender Preference? ': 'No preference',
  'Are you okay with having a Little the same year as you or older? ': "Yes, I'm okay with it",
  'Are you okay with your little(s) partaking in recreational activities (drinking, smoking)?': 'Yes',
  'Do you intend to partake in recreational activities?': 'No',
  'How active do you want your little(s) to be in VSA?': 'Somewhat active',
  'How introverted/extroverted are you?': '6',
  'Are you an indoors or outdoors person?': '3',
  'Are you a morning or night person?': 'Night person',
  'What are your hobbies?': 'Bouldering, baking',
  'What is your love language?': 'Quality time',
  "Is there anyone in VSA who you don't want to be paired with or have problems with?": 'N/A',
  ...over,
});

const little = (name: string, preferred: string, email: string, over: Answers = {}): Answers => ({
  ...neverRead,
  'Name (First, Middle Initial, Last)': name,
  'Preferred Name': preferred,
  'UCSD Email': email,
  'Are You Applying to be an Anh/Chi (Big) or Em (Little)? ': 'Em (Little)',
  'Year?': '1st',
  'College?': 'Muir',
  'Gender Identity': 'Male',
  'How active are you in VSA?': 'Somewhat',
  'Gender Preference?  2': 'No preference',
  'Are you okay with having a big the same year or younger than you?': 'Yes',
  'Do you want to have a sib(s)/twin?': 'IDC',
  'Are you okay with your big partaking in recreational activities?': 'Yes',
  'Do you intend to partake in recreational activities? 2': 'No',
  'How active do you want your Big to be in VSA?': 'Very active',
  'How introverted/extroverted are you? 2': '7',
  'Are you an indoors or outdoors person? 2': '3',
  'Are you a morning or night person? 2': 'Night',
  'What are your hobbies? 2': 'Drawing\nand\n"long" walks',
  'What is your love language? 2': 'Acts of service',
  "Is there anyone in VSA who you don't want to be paired with or have problems with? 2": 'nope',
  ...over,
});

function tsv(rows: string[][]): string {
  const cell = (value: string) => (/[\t\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [HEADERS, ...rows].map((r) => r.map(cell).join('\t')).join('\n');
}

function parse(...answers: Answers[]) {
  return parseApplicationProfiles(tsv(answers.map(row)));
}

const draft = (id: string, name: string, over: Partial<AceAssignmentDraft> = {}): AceAssignmentDraft => ({
  id,
  cycle_id: 'cycle',
  little_name: name,
  little_member_id: null,
  big_ace_member_id: null,
  published_ace_member_id: null,
  notes: null,
  display_order: 0,
  created_at: '',
  updated_at: '',
  ...over,
});

const node = (id: string, name: string): AceNodeRef => ({
  id,
  name,
  familyId: 'fam',
  familyName: 'Test Fam',
  memberId: null,
  parentId: null,
  roleLabel: null,
});

describe('parseApplicationProfiles', () => {
  it('reads Big and Little sections, including the " 2" headers and multi-line answers', () => {
    const result = parse(big('Ava, Q, Lin', 'Avi', 'alin'), little('Ben Q Ho', '', 'bho@ucsd.edu'));
    expect(result.bigCount).toBe(1);
    expect(result.littleCount).toBe(1);
    const [b, l] = result.profiles;

    expect(b).toMatchObject({ role: 'big', displayName: 'Avi Lin', fullName: 'Ava Lin', email: 'alin@ucsd.edu', capacity: 2, capacityText: '2' });
    expect(b.nameKeys).toEqual(expect.arrayContaining(['ava lin', 'avi lin', 'ava q lin']));
    expect(b.scales).toEqual({ introExtro: 6, routine: null, workEthic: null, indoorOutdoor: 3 });
    expect(b.favorites).toEqual([{ label: 'What are your hobbies?', value: 'Bouldering, baking' }]);
    expect(b.personality).toEqual([{ label: 'What is your love language?', value: 'Quality time' }]);

    expect(l).toMatchObject({ role: 'little', displayName: 'Ben Ho', genderPreference: 'No preference', sibling: 'IDC', intendsToPartake: 'No' });
    expect(l.year).toEqual({ text: '1st', value: 1, transfer: false });
    expect(l.scales.introExtro).toBe(7);
    expect(l.favorites).toEqual([{ label: 'What are your hobbies?', value: 'Drawing\nand\n"long" walks' }]);
    expect(l.doNotPair).toBe('nope');
  });

  it('never reads contact details, sizes, gifts, major, events, or other unlisted columns', () => {
    const result = parse(big('Ava Lin', '', 'alin'), little('Ben Ho', '', 'bho'));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('personal@example.com');
  });

  it('keeps the latest submission for a repeated UCSD email', () => {
    const result = parse(
      little('Ben Ho', '', 'BHO@ucsd.edu', { 'Year?': '1st' }),
      little('Ben Ho', '', 'bho', { 'Year?': '2nd Year Transfer' }),
    );
    expect(result.repeatsReplaced).toBe(1);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].year).toEqual({ text: '2nd Year Transfer', value: 2, transfer: true });
  });

  it('holds conflicting Big/Little submissions out of pairing, even if the newest answer looks valid', () => {
    const switched = parse(
      big('Ben Ho', '', 'BHO@ucsd.edu'),
      little('Ben Ho', '', 'bho'),
      little('Cy Do', '', 'cdo'),
    );
    expect(switched.repeatsReplaced).toBe(0);
    expect(switched.profiles.map((p) => p.fullName)).toEqual(['Cy Do']);
    expect(switched.warnings).toEqual([
      expect.stringContaining('1 applicant identity has both Big and Little submissions'),
    ]);
    expect(switched.warnings[0]).toContain('Ben Ho');
    expect(JSON.stringify(switched.warnings)).not.toContain('bho@ucsd.edu');

    const reversed = parse(little('Ben Ho', '', 'bho'), big('Ben Ho', '', 'bho'));
    expect(reversed.profiles).toEqual([]);
    expect(reversed.warnings).toHaveLength(1);
  });

  it('keeps previous behavior for an unreadable newest role, without guessing it', () => {
    const both = parse(little('Ben Ho', '', 'bho'), { ...little('Ben Ho', '', 'bho'), 'Are You Applying to be an Anh/Chi (Big) or Em (Little)? ': 'Big or Little' });
    expect(both.repeatsReplaced).toBe(1);
    expect(both.profiles).toHaveLength(0);
    expect(both.skipped).toBe(1);
  });

  it('does not confuse two distinct emails or consistent-role repeat submissions', () => {
    const result = parse(
      little('Ben Ho', '', 'bho'),
      big('Ben Ho', '', 'bho-other'),
      little('Ben Ho', '', 'bho'),
    );
    expect(result.profiles).toHaveLength(2);
    expect(result.repeatsReplaced).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it('skips rows with no name or role, and rejects a paste that is not the application', () => {
    const result = parse(little('', '', 'x'), { ...little('Cy Do', '', 'cdo'), 'Are You Applying to be an Anh/Chi (Big) or Em (Little)? ': '' });
    expect(result.profiles).toHaveLength(0);
    expect(result.skipped).toBe(2);
    expect(parseApplicationProfiles('name\tbig\nA B\tC D').warnings[0]).toMatch(/does not look like/);
  });
});

describe('answer parsing', () => {
  it.each([
    ['2', 2],
    ['3 but if any of my prefs dont want me then only 2', 3],
    ['two', 2],
    ['Not sure yet', null],
  ])('capacity %p → %p', (text, expected) => expect(parseCapacity(text)).toBe(expected));

  it('reads years', () => {
    expect(parseYear('4th')?.value).toBe(4);
    expect(parseYear('Third year')?.value).toBe(3);
  });

  it.each(['N/A', 'no', 'Nope!', 'none', 'Not that I know of', '', 'no one lol'])('%p names nobody', (answer) =>
    expect(isNoneAnswer(answer)).toBe(true),
  );

  it('matches full names and first names, with a one-letter typo on longer names', () => {
    const person = personRefFromName('Kaitlyn Vo');
    expect(namesPerson('Please not Kaitlyn Vo', person)).toBe('full');
    expect(namesPerson('kaitlin', person)).toBe('first');
    expect(namesPerson('N/A', person)).toBeNull();
    expect(namesPerson('Someone Else', person)).toBeNull();
    expect(namesPerson('an ex of mine', personRefFromName('An Tran'))).toBeNull();
    expect(namesPerson('An Tran', personRefFromName('An Tran'))).toBe('full');
  });

  it('classifies preferences', () => {
    expect(genderPreferenceOf('No preference', 'Male')).toBeNull();
    expect(genderPreferenceOf('Female', 'Male')).toEqual(new Set(['female']));
    expect(genderPreferenceOf('Same gender as me', 'Male')).toEqual(new Set(['male']));
    expect(yearPreferenceOf("Yes, I'm okay with it")).toBe('any');
    expect(yearPreferenceOf("Same year is fine but I don't want an older little")).toBe('same');
    expect(yearPreferenceOf('No, I want a younger little')).toBe('strict');
    expect(yesNoOf("I don't mind")).toBe('yes');
    expect(yesNoOf('Not sure')).toBe('maybe');
    expect(yesNoOf('No')).toBe('no');
    expect(activityLevel('Very active')).toBe(1);
    expect(activityLevel('No preference')).toBe('any');
  });
});

describe('matching', () => {
  const { profiles } = parse(
    big('Ava Lin', '', 'alin'),
    little('Ben Q Ho', '', 'bho'),
    little('Christopher Do', 'Chris', 'cdo'),
    little('Dana Le', '', 'dle'),
    little('Unknown Person', '', 'nobody'),
  );

  it('matches by linked member email first, then by name or preferred + last name', () => {
    const drafts = [draft('d-ben', 'Ben Ho'), draft('d-chris', 'Chris Do'), draft('d-dana', 'Totally Renamed', { little_member_id: 'm-dana' })];
    const matches = matchProfilesToDrafts(profiles, drafts, new Map([['dle@ucsd.edu', ['m-dana']]]));
    expect(matches.get('d-ben')?.fullName).toBe('Ben Ho');
    expect(matches.get('d-chris')?.displayName).toBe('Chris Do');
    expect(matches.get('d-dana')?.fullName).toBe('Dana Le');
  });

  it('never attaches an ambiguous match', () => {
    const matches = matchProfilesToDrafts(profiles, [draft('a', 'Ben Ho'), draft('b', 'ben  HO')]);
    expect(matches.size).toBe(0);
  });

  it('matches Bigs to tree nodes and lists everyone left over', () => {
    const drafts = matchProfilesToDrafts(profiles, [draft('d-ben', 'Ben Ho')]);
    const nodes = matchProfilesToNodes(profiles, [node('n-ava', 'Ava Lin'), node('n-ben', 'Ben Ho')]);
    expect(Array.from(nodes.keys())).toEqual(['n-ava']);
    expect(unmatchedProfiles(profiles, drafts, nodes).map((p) => p.fullName)).toEqual(['Christopher Do', 'Dana Le', 'Unknown Person']);
  });
});

describe('advisory checks', () => {
  const pair = (bigOver: Answers, littleOver: Answers) => {
    const [b, l] = parse(big('Ava Lin', '', 'alin', bigOver), little('Ben Ho', '', 'bho', littleOver)).profiles;
    return { b, l };
  };
  const codes = (b: ApplicationProfile, l: ApplicationProfile, incoming?: number) =>
    checkPair({ profile: b, name: b.fullName }, { profile: l, name: l.fullName }, incoming == null ? null : { current: 0, incoming }).map((w) => w.code);

  it('passes a compatible pair', () => {
    const { b, l } = pair({}, {});
    expect(codes(b, l, 1)).toEqual([]);
  });

  it('flags gender preference mismatches in either direction', () => {
    const { b, l } = pair({ 'Gender Preference? ': 'Female' }, { 'Gender Preference?  2': 'Male' });
    const warnings = checkPair({ profile: b, name: '' }, { profile: l, name: '' });
    expect(warnings.map((w) => w.code)).toEqual(['gender', 'gender']);
    expect(warnings[0].message).toMatch(/Ava Lin prefers a female Little/);
  });

  it('flags a Big over their planned capacity', () => {
    const { b, l } = pair({}, {});
    expect(codes(b, l, 2)).toEqual([]);
    expect(codes(b, l, 3)).toEqual(['capacity']);
  });

  it('flags a broken year preference on either side', () => {
    const older = pair({ 'Are you okay with having a Little the same year as you or older? ': 'No, I want a younger little' }, { 'Year?': '3rd' });
    expect(codes(older.b, older.l)).toEqual(['year']);
    const younger = pair({ 'Year?': '2nd' }, { 'Year?': '3rd', 'Are you okay with having a big the same year or younger than you?': 'No' });
    expect(codes(younger.b, younger.l)).toEqual(['year']);
  });

  it('flags substance-comfort mismatches', () => {
    const { b, l } = pair(
      { 'Are you okay with your little(s) partaking in recreational activities (drinking, smoking)?': 'No' },
      { 'Do you intend to partake in recreational activities? 2': 'Sometimes' },
    );
    expect(codes(b, l)).toEqual(['substance']);
  });

  it('flags a do-not-pair answer naming the other person, and ignores "N/A"', () => {
    const named = pair({ "Is there anyone in VSA who you don't want to be paired with or have problems with?": 'Ben Ho' }, {});
    expect(codes(named.b, named.l)).toEqual(['do_not_pair']);
    const firstOnly = pair({}, { "Is there anyone in VSA who you don't want to be paired with or have problems with? 2": 'ava' });
    expect(checkPair({ profile: firstOnly.b, name: '' }, { profile: firstOnly.l, name: '' })[0].message).toMatch(/mentions Ava Lin's first name/);
  });

  it('checks a do-not-pair answer against a draft name when the Little has no application', () => {
    const { b } = pair({ "Is there anyone in VSA who you don't want to be paired with or have problems with?": 'cy do' }, {});
    expect(checkPair({ profile: b, name: 'Ava Lin' }, { profile: null, name: 'Cy Do' }).map((w) => w.code)).toEqual(['do_not_pair']);
  });
});

describe('suggestBigs', () => {
  const { profiles } = parse(
    big('Ava Lin', '', 'alin', { 'How introverted/extroverted are you?': '7', 'Are you a morning or night person?': 'Night' }),
    big('Eve Ng', '', 'eng', { 'How introverted/extroverted are you?': '1', 'Are you a morning or night person?': 'Morning', 'How active are you in VSA?': 'Not very active' }),
    big('Gia Ta', '', 'gta', { 'Gender Preference? ': 'Female' }),
    big('Hal Vu', '', 'hvu', { 'How many littles do you plan on picking up?': '1' }),
    little('Ben Ho', '', 'bho'),
  );
  const [ava, eve, gia, hal, ben] = profiles;
  const load = (incoming: number) => ({ current: 0, incoming });

  it('never suggests a Big from gender alignment alone, but permits a real non-gender basis', () => {
    const { profiles } = parse(
      big('Fictional Big', '', 'fictional-big', { 'Gender Preference? ': 'Female' }),
      little('Fictional Little', '', 'fictional-little', {
        'Gender Identity': 'Female', 'Gender Preference?  2': 'Female',
      }),
    );
    const blankNonGender = (profile: ApplicationProfile): ApplicationProfile => ({
      ...profile,
      scales: { introExtro: null, routine: null, workEthic: null, indoorOutdoor: null },
      morningNight: null, fridayNight: null, activity: null, wantedActivity: null,
      genderIdentity: 'Female', genderPreference: 'Female',
    });
    const b = blankNonGender(profiles[0]);
    const l = blankNonGender(profiles[1]);
    const candidate = { nodeId: 'fictional-node', name: 'Fictional Big', profile: b, load: { current: 0, incoming: 0 } };
    expect(suggestBigs({ profile: l, name: 'Fictional Little' }, [candidate])).toEqual([]);

    // One shared activity/scale fact makes the suggestion eligible. The gender
    // preference alone did not establish compatibility or a score.
    const withScale = { ...b, scales: { ...b.scales, introExtro: 5 } };
    const littleWithScale = { ...l, scales: { ...l.scales, introExtro: 5 } };
    const selected = suggestBigs({ profile: littleWithScale, name: 'Fictional Little' }, [
      { ...candidate, profile: withScale },
    ]);
    expect(selected).toHaveLength(1);
    expect(selected[0].reasons).toContain('Similar introvert/extrovert (5 and 5)');
  });

  it('ranks closer answers higher, explains why, and leaves out conflicts and full Bigs', () => {
    const suggestions = suggestBigs({ profile: ben, name: 'Ben Ho' }, [
      { nodeId: 'eve', name: 'Eve Ng', profile: eve, load: load(0) },
      { nodeId: 'ava', name: 'Ava Lin', profile: ava, load: load(0) },
      { nodeId: 'gia', name: 'Gia Ta', profile: gia, load: load(0) },
      { nodeId: 'hal', name: 'Hal Vu', profile: hal, load: load(1) },
    ]);
    expect(suggestions.map((s) => s.nodeId)).toEqual(['ava', 'eve']);
    expect(suggestions[0].score).toBeGreaterThan(suggestions[1].score);
    expect(suggestions[0].reasons).toEqual(expect.arrayContaining(['Same morning/night answer']));
  });
});

describe('pairWarningIssues', () => {
  it('counts rows per warning type as non-blocking preflight warnings, with no names or answers', () => {
    const issues = pairWarningIssues([
      [
        { code: 'do_not_pair', message: 'Ava Lin asked not to be paired with Ben Ho' },
        { code: 'do_not_pair', message: 'Ben Ho asked not to be paired with Ava Lin' },
      ],
      [{ code: 'capacity', message: 'Ava Lin has 3 Littles' }],
      [],
    ]);
    expect(issues.map((i) => [i.id, i.level, i.count, i.title])).toEqual([
      ['ace-application:do_not_pair', 'warning', 1, '1 pairing names someone the other person asked not to be paired with'],
      ['ace-application:capacity', 'warning', 1, '1 Little goes to a Big over their planned number'],
    ]);
    expect(JSON.stringify(issues)).not.toMatch(/Ava|Ben/);
  });
});
