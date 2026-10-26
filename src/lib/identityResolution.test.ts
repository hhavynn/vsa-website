// Identity resolution for attendance imports. Synthetic people only.
import { member, scenario } from '../test-utils/identityFixtures';

const alex = member('alex', 'Alex', 'Nguyen', { college: 'Muir', year: '2nd Year', email: 'alex@gmail.com' });
const obs = (member_id: string, academic_year_start: number, year_label: string, source: 'attendance_import' | 'profile_estimate' = 'attendance_import') =>
  ({ member_id, academic_year_start, year_label, source });

describe('email switching', () => {
  it('Gmail first, UCSD later: name + college + fitting year matches and remembers the new address', () => {
    const { rows } = scenario(
      [{ name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: '3rd' }],
      [alex],
      { observations: [obs('alex', 2025, '2nd Year')] },
    );
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'name_college_year', matchedMember: alex });
    expect(rows[0].aliasPlan).toEqual([{ email: 'alex@ucsd.edu', method: 'unique_name_college_year' }]);
  });

  it('UCSD first, Gmail later works the same way', () => {
    const ucsd = { ...alex, email: 'alex@ucsd.edu' };
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@gmail.com', college: 'Muir', year: '3rd Year' }], [ucsd],
      { observations: [obs('alex', 2025, '2nd Year')] });
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'name_college_year' });
  });

  it('a previously confirmed alias matches by email even though it is not the stored contact email', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@ucsd.edu' }], [alex], { aliases: [{ member_id: 'alex', email: 'alex@ucsd.edu' }] });
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'known_email', matchedMember: alex });
    expect(rows[0].aliasPlan).toEqual([]);
  });

  it('several confirmed aliases all lead to the one member', () => {
    const aliases = ['alex@ucsd.edu', 'alex.n@yahoo.com'].map((email) => ({ member_id: 'alex', email }));
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex.n@yahoo.com' }, { name: 'Alex Nguyen', email: 'alex@ucsd.edu' }], [alex], { aliases });
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'known_email' });
    expect(rows[1]).toMatchObject({ status: 'duplicate', reason: 'same_member_as_row', duplicateOf: 'row-0' });
  });

  it('ignores case and surrounding spaces in emails', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: '  ALEX@Gmail.COM ' }], [alex]);
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'known_email' });
  });

  it('a known email with a clearly different name goes to review', () => {
    const { rows } = scenario([{ name: 'Brian Pham', email: 'alex@gmail.com' }], [alex]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'email_name_conflict', matchedMember: null });
    expect(rows[0].candidateMemberIds).toEqual(['alex']);
  });

  it('an email two members already claim goes to review, never to one of them', () => {
    const a = member('a', 'Ryan', 'Le', { email: 'shared@ucsd.edu' });
    const b = member('b', 'Ryan', 'Le', { email: 'shared@ucsd.edu' });
    const { rows } = scenario([{ name: 'Ryan Le', email: 'shared@ucsd.edu' }], [a, b]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'email_shared_by_members' });
    expect(rows[0].candidateMemberIds.sort()).toEqual(['a', 'b']);
  });

  it('an uncertain row plans no alias', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@ucsd.edu' }], [alex]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'identity_conflict' });
    expect(rows[0].aliasPlan).toEqual([]);
  });

  it('name + college without a usable year matches but does not remember the new address', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'John Muir College' }], [alex]);
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'name_college' });
    expect(rows[0].aliasPlan).toEqual([]);
  });

  it('two different school addresses are a contradiction, even with the same college', () => {
    const ucsd = { ...alex, email: 'anguyen@ucsd.edu' };
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex.nguyen@ucsd.edu', college: 'Muir', year: '2nd' }], [ucsd]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'identity_conflict' });
  });

  it('a second address on a row identified by a known email is remembered as the same submission', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@gmail.com', email2: 'alex@ucsd.edu' }], [alex]);
    expect(rows[0].aliasPlan).toEqual([{ email: 'alex@ucsd.edu', method: 'same_submission' }]);
  });
});

describe('weak evidence never becomes an automatic match or an alias (review findings)', () => {
  it('a known email with a merely similar name goes to review (siblings on a family email)', () => {
    const an = member('an', 'An', 'Nguyen', { email: 'nguyen.family@gmail.com' });
    const { rows } = scenario([{ name: 'Anh Nguyen', email: 'nguyen.family@gmail.com' }], [an]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'email_name_conflict' });
  });

  it('a known email with an implausible standing goes to review', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@gmail.com', year: '1st' }], [{ ...alex, year: '4th Year' }],
      { observations: [obs('alex', 2025, '4th Year')] });
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'email_name_conflict' });
  });

  it('never remembers a second school address that contradicts the owner\'s', () => {
    const owner = { ...alex, email: 'anguyen@ucsd.edu' };
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'anguyen@ucsd.edu', email2: 'other.person@ucsd.edu' }], [owner]);
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'known_email', aliasPlan: [] });
  });

  it('a repeated submission never remembers a school address that contradicts the member\'s', () => {
    const aliases = [{ member_id: 'alex', email: 'alex@ucsd.edu' }];
    const { rows } = scenario([
      { name: 'Alex Nguyen', email: 'alex@gmail.com' },
      { name: 'Alex Nguyen', email: 'alex@gmail.com', email2: 'other@ucsd.edu' },
    ], [alex], { aliases });
    expect(rows[0].reason).toBe('known_email');
    expect(rows[1]).toMatchObject({ status: 'duplicate', reason: 'duplicate_row', aliasPlan: [] });
    // The same rows with a personal second address still pass it on.
    const personal = scenario([
      { name: 'Alex Nguyen', email: 'alex@gmail.com' },
      { name: 'Alex Nguyen', email: 'alex@gmail.com', email2: 'alex.n@yahoo.com' },
    ], [alex], { aliases });
    expect(personal.rows[1].aliasPlan).toEqual([{ email: 'alex.n@yahoo.com', method: 'same_submission' }]);
  });

  it('a repeat group checks each repeat against the addresses it already accepted', () => {
    const { rows } = scenario([
      { name: 'Alex Nguyen', email: 'alex@gmail.com' },
      { name: 'Alex Nguyen', email: 'alex@gmail.com', email2: 'alex1@ucsd.edu' },
      { name: 'Alex Nguyen', email: 'alex@gmail.com', email2: 'alex2@ucsd.edu' },
    ], [alex]);
    expect(rows[1].aliasPlan).toEqual([{ email: 'alex1@ucsd.edu', method: 'same_submission' }]);
    expect(rows[2].aliasPlan).toEqual([]);
  });

  it('a repeat of a name-only match never confirms a new address', () => {
    const bare = member('alex', 'Alex', 'Nguyen');
    const { rows } = scenario([
      { name: 'Alex Nguyen', email: 'alex@gmail.com' },
      { name: 'Alex Nguyen', email: 'alex@gmail.com', email2: 'alex@ucsd.edu' },
    ], [bare]);
    expect(rows[0].reason).toBe('unique_name');
    expect(rows[1]).toMatchObject({ status: 'duplicate', reason: 'duplicate_row', aliasPlan: [] });
  });

  it('two rows matching one member by name alone are not collapsed into one credit', () => {
    const anh = member('anh', 'Anh', 'Nguyen');
    const { rows } = scenario([{ name: 'Anh Nguyen', email: 'anh.one@gmail.com' }, { name: 'Anh Nguyen', email: 'anh.two@gmail.com' }], [anh]);
    expect(rows[0].reason).toBe('unique_name');
    expect(rows[1]).toMatchObject({ status: 'review', reason: 'member_claimed_by_earlier_row', aliasPlan: [] });
  });

  it('a third new row with another school address is not folded into a group that already has one', () => {
    const { rows } = scenario([
      { name: 'Hoa Pham', email: 'hoa@gmail.com', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', email: 'hoa1@ucsd.edu', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', email: 'hoa2@ucsd.edu', college: 'Sixth', year: '1st' },
    ], []);
    expect(rows.map((r) => r.status)).toEqual(['new', 'duplicate', 'new']);
  });

  it('two new rows with one name and two personal emails stay two people', () => {
    const { rows } = scenario([
      { name: 'Hoa Pham', email: 'hoa.one@gmail.com', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', email: 'hoa.two@gmail.com', college: 'Sixth', year: '1st' },
    ], []);
    expect(rows.map((r) => r.status)).toEqual(['new', 'new']);
  });

  it('a personal + school pair is one new person only with the same college and year on both rows', () => {
    const { rows } = scenario([
      { name: 'Hoa Pham', email: 'hoa@gmail.com', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', email: 'hoa@ucsd.edu', college: 'Sixth' },
    ], []);
    expect(rows.map((r) => r.status)).toEqual(['new', 'new']);
  });
});

describe('names', () => {
  it('matches a unique exact name with nothing on file against it', () => {
    const bao = member('bao', 'Bao', 'Le');
    const { rows } = scenario([{ name: 'bao  LE' }], [bao]);
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'unique_name' });
  });

  it('matches across full-name and first/last forms, middle initials and Vietnamese accents', () => {
    const an = member('an', 'Văn An', 'Nguyễn');
    const kevin = member('kevin', 'Kevin', 'Tran');
    const { rows } = scenario([{ name: 'Van An Nguyen' }, { name: 'Kevin J. Tran' }], [an, kevin]);
    expect(rows.map((r) => r.reason)).toEqual(['unique_name', 'unique_name']);
  });

  it('matches an omitted middle name only with college, a fitting year and no other email', () => {
    const vincent = member('v', 'Vincent', 'Nguyen', { college: 'Warren', year: '2nd Year' });
    const ok = scenario([{ name: 'Vincent Truong Nguyen', college: 'Warren', year: '2nd' }], [vincent]).rows[0];
    expect(ok).toMatchObject({ status: 'match', reason: 'middle_name_college_year' });
    const noCollege = scenario([{ name: 'Vincent Truong Nguyen', year: '2nd' }], [vincent]).rows[0];
    expect(noCollege).toMatchObject({ status: 'review', reason: 'similar_name' });
  });

  it('suggests a shortened first name but never matches it on its own', () => {
    const alexander = member('al', 'Alexander', 'Nguyen', { college: 'Muir', year: '2nd Year' });
    const { rows } = scenario([{ name: 'Alex Nguyen', college: 'Muir', year: '2nd' }], [alexander]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'similar_name' });
    expect(rows[0].candidates[0].name).toBe('first_name_prefix');
  });

  it('two people with the same name always go to review, whatever their colleges', () => {
    const a = member('a', 'Ryan', 'Le', { college: 'Muir' });
    const b = member('b', 'Ryan', 'Le', { college: 'Sixth' });
    const { rows } = scenario([{ name: 'Ryan Le', college: 'Muir' }], [a, b]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'multiple_candidates', matchedMember: null });
    // Best evidence first, but nothing is preselected.
    expect(rows[0].candidateMemberIds).toEqual(['a', 'b']);
  });

  it('a common surname alone matches nobody', () => {
    const members = ['An', 'Bao', 'Chi', 'Duc'].map((f, i) => member(`m${i}`, f, 'Nguyen'));
    const { rows } = scenario([{ name: 'Huy Nguyen' }], members);
    expect(rows[0]).toMatchObject({ status: 'new', reason: 'new_member' });
  });

  it('a close but different Vietnamese name is a suggestion, not a match', () => {
    const anh = member('anh', 'Anh', 'Nguyen', { college: 'Muir' });
    const { rows } = scenario([{ name: 'An Nguyen', college: 'Muir' }], [anh]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'similar_name' });
  });

  it('creates a new member when every look-alike is ruled out by college', () => {
    const anh = member('anh', 'Anh', 'Nguyen', { college: 'Warren' });
    const { rows } = scenario([{ name: 'An Nguyen', college: 'Muir' }], [anh]);
    expect(rows[0]).toMatchObject({ status: 'new', canForceMatch: true });
    expect(rows[0].candidateMemberIds).toEqual(['anh']);
  });

  it('missing email, college and year are unknown, not contradictions', () => {
    const lan = member('lan', 'Lan', 'Tran', { college: 'Muir', year: '2nd Year', email: 'lan@ucsd.edu' });
    const { rows } = scenario([{ name: 'Lan Tran' }], [lan]);
    expect(rows[0]).toMatchObject({ status: 'match', reason: 'unique_name' });
  });

  it('a different college on file sends an exact name to review', () => {
    const lan = member('lan', 'Lan', 'Tran', { college: 'Muir' });
    const { rows } = scenario([{ name: 'Lan Tran', college: 'Revelle' }], [lan]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'identity_conflict' });
  });

  it('a different personal email with no college to confirm goes to review', () => {
    const lan = member('lan', 'Lan', 'Tran', { email: 'lan@ucsd.edu' });
    const { rows } = scenario([{ name: 'Lan Tran', email: 'lan.tran.two@gmail.com' }], [lan]);
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'identity_conflict' });
  });
});

describe('academic standing', () => {
  it.each([
    ['1st Year', '2nd'], ['2nd Year', '3rd'], ['3rd Year', '4th'],
  ])('%s last year → %s this year is the same student', (before, now) => {
    const m = { ...alex, year: before };
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: now }], [m],
      { observations: [obs('alex', 2025, before)] });
    expect(rows[0].reason).toBe('name_college_year');
  });

  it('a backfill from an older academic year still matches its then-standing', () => {
    const m = { ...alex, year: '3rd Year' };
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: '1st' }], [m],
      { observations: [obs('alex', 2026, '3rd Year')], eventYear: 2024 });
    expect(rows[0].reason).toBe('name_college_year');
  });

  it('a clearly contradictory standing for that year sends an exact name to review', () => {
    const m = { ...alex, year: '4th Year' };
    const { rows } = scenario([{ name: 'Alex Nguyen', college: 'Muir', year: '1st' }], [m],
      { observations: [obs('alex', 2025, '4th Year')] });
    expect(rows[0]).toMatchObject({ status: 'review', reason: 'identity_conflict' });
  });

  it('an unrecognized standing neither helps nor blocks', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', college: 'Muir', year: 'idk lol' }], [{ ...alex, email: null }]);
    expect(rows[0].reason).toBe('name_college');
  });
});

describe('duplicates inside one file', () => {
  it('identical repeated rows collapse into the first', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@gmail.com' }, { name: 'Alex Nguyen', email: 'alex@gmail.com' }], [alex]);
    expect(rows[1]).toMatchObject({ status: 'duplicate', reason: 'duplicate_row', duplicateOf: 'row-0' });
  });

  it('one member with two emails in the file gets one credit and both addresses', () => {
    const { rows } = scenario([
      { name: 'Alex Nguyen', email: 'alex@gmail.com', college: 'Muir', year: '3rd' },
      { name: 'Alex Nguyen', email: 'alex@ucsd.edu', college: 'Muir', year: '3rd' },
    ], [alex], { observations: [obs('alex', 2025, '2nd Year')] });
    expect(rows[0].reason).toBe('known_email');
    expect(rows[1]).toMatchObject({ status: 'duplicate', reason: 'same_member_as_row', duplicateOf: 'row-0' });
    expect(rows[1].aliasPlan).toEqual([{ email: 'alex@ucsd.edu', method: 'unique_name_college_year' }]);
  });

  it('the same email with a different name is reviewed, not collapsed', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@gmail.com' }, { name: 'Bao Le', email: 'alex@gmail.com' }], [alex]);
    expect(rows[1]).toMatchObject({ status: 'review', reason: 'email_reused_in_file' });
  });

  it('two school addresses for one matched member are treated as possibly two people', () => {
    const m = { ...alex, email: null };
    const { rows } = scenario([
      { name: 'Alex Nguyen', email: 'alex1@ucsd.edu', college: 'Muir' },
      { name: 'Alex Nguyen', email: 'alex2@ucsd.edu', college: 'Muir' },
    ], [m]);
    expect(rows[1]).toMatchObject({ status: 'review', reason: 'member_claimed_by_earlier_row' });
  });

  it('a new person who submitted twice becomes one new member', () => {
    const { rows } = scenario([
      { name: 'Hoa Pham', email: 'hoa@gmail.com', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', email: 'hoa@ucsd.edu', college: 'Sixth', year: '1st' },
    ], []);
    expect(rows[0].status).toBe('new');
    expect(rows[1]).toMatchObject({ status: 'duplicate', reason: 'same_person_as_new_row', duplicateOf: 'row-0' });
  });

  it('two new people with one name but different school addresses stay two people', () => {
    const { rows } = scenario([
      { name: 'Hoa Pham', email: 'hoa1@ucsd.edu', college: 'Sixth' },
      { name: 'Hoa Pham', email: 'hoa2@ucsd.edu', college: 'Sixth' },
    ], []);
    expect(rows.map((r) => r.status)).toEqual(['new', 'new']);
  });

  it('rows without email repeat only on the same name, college and year', () => {
    const { rows } = scenario([
      { name: 'Hoa Pham', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', college: 'Sixth', year: '1st' },
      { name: 'Hoa Pham', college: 'Muir', year: '1st' },
    ], []);
    expect(rows.map((r) => r.status)).toEqual(['new', 'duplicate', 'new']);
  });

  it('a matched member who already attended is reported as already recorded', () => {
    const { rows } = scenario([{ name: 'Alex Nguyen', email: 'alex@gmail.com' }], [alex], { attended: ['alex'] });
    expect(rows[0]).toMatchObject({ status: 'already', reason: 'known_email' });
  });
});

describe('scale', () => {
  // Realistic shape: many members share a few surnames, given names vary.
  const given = (i: number) => `${'abcdefghijklmnopqrstuvwxyz'[i % 26]}${'aeiou'[i % 5]}${'nmhtl'[(i >> 3) % 5]}${i}`;
  const surname = (i: number) => ['Nguyen', 'Tran', 'Le', 'Pham'][i % 4] ?? 'Ho';
  const members = Array.from({ length: 3000 }, (_, i) => member(`m${i}`, given(i), surname(i), { email: `m${i}@ucsd.edu`, college: 'Muir' }));

  it('resolves known emails across a large roster quickly', () => {
    const specs = Array.from({ length: 800 }, (_, i) => ({ name: `${given(i * 3)} ${surname(i * 3)}`, email: `m${i * 3}@ucsd.edu` }));
    const started = Date.now();
    const { rows } = scenario(specs, members);
    expect(rows.every((r) => r.reason === 'known_email')).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('resolves names without emails across a large roster quickly', () => {
    const specs = Array.from({ length: 800 }, (_, i) => ({ name: `${given(i * 3)} ${surname(i * 3)}`, college: 'Muir' }));
    const started = Date.now();
    const { rows } = scenario(specs, members);
    expect(rows.every((r) => r.status === 'match')).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
