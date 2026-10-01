import { draftInsertFromParsed } from './houseAssignmentDraft';
import {
  HouseImportMember,
  buildEmailMap,
  detectPreferenceColumns,
  parseLongRows,
  parseWideRows,
  profileMapByName,
} from './houseAssignmentImport';
import { HousePageAsset } from '../types';

function profile(key: string, order: number): HousePageAsset {
  return {
    id: `profile-${key.toLowerCase().replace(/\s+/g, '-')}`,
    academic_year_start: 2025,
    academic_year_end: 2026,
    house: key,
    house_key: key,
    display_name: key,
    display_order: order,
    is_active: true,
  } as HousePageAsset;
}

function member(id: string, first: string, last: string, email: string | null = null): HouseImportMember {
  return { id, first_name: first, last_name: last, college: 'Muir', year: 'Second Year', house: null, email, points: 0, events_attended: 0 };
}

const profiles = [profile('Bowser', 1), profile('Boo', 2), profile('Donkey Kong', 3), profile('Toad', 4)];
const profileMap = profileMapByName(profiles);
const members = [
  member('m-ai', 'Ai', 'Phan', 'aiphan@ucsd.edu'),
  member('m-kevin', 'Kevin', 'Tran', 'kevin@ucsd.edu'),
  member('m-sarah', 'Sarah', 'Nguyen'),
];
const emailMap = buildEmailMap(members);

describe('wide House sheet', () => {
  it('turns each non-empty cell under a House column into a matched row', () => {
    const rows = parseWideRows('Bowser,Toad\nAi Phan (first) (2025-10-15 20:55:54),Kevin Tran (second)', members, emailMap, profileMap);

    expect(rows.map((row) => [row.name, row.house, row.status, row.selectedMemberId])).toEqual([
      ['Ai Phan', 'Bowser', 'match', 'm-ai'],
      ['Kevin Tran', 'Toad', 'match', 'm-kevin'],
    ]);
    expect(rows.every((row) => row.houseProfile)).toBe(true);
  });
});

describe('long House sheet', () => {
  it('matches by email first and keeps the House text', () => {
    const [row] = parseLongRows('name,email,house\nA. Phan,AIPHAN@ucsd.edu,Bowser', members, emailMap, profileMap);
    expect(row).toMatchObject({ method: 'email', status: 'match', selectedMemberId: 'm-ai', house: 'Bowser' });
  });

  it('keeps a row with no House as an unassigned applicant instead of dropping it', () => {
    const [row] = parseLongRows('name,email\nKevin Tran,kevin@ucsd.edu', members, emailMap, profileMap);
    expect(row.houseProfile).toBeNull();
    expect(row.house).toBeNull();
    expect(row.selectedMemberId).toBe('m-kevin');
    expect(row.note).toContain('No House assigned yet');
  });

  it('flags an unrecognized House without hiding the member match', () => {
    const [row] = parseLongRows('name,house\nKevin Tran,Yoshi', members, emailMap, profileMap);
    expect(row.house).toBe('Yoshi');
    expect(row.houseProfile).toBeNull();
    expect(row.status).toBe('match');
    expect(row.note).toContain('no profile');
  });

  it('normalizes recognizable preference columns into ordered choices', () => {
    const csv = 'name,email,first choice,second choice,third choice\nKevin Tran,kevin@ucsd.edu,Toad,Boo,toad';
    const [row] = parseLongRows(csv, members, emailMap, profileMap);
    expect(row.preferences).toEqual(['Toad', 'Boo']);
  });

  it('reads "preference 1/2/3" headers and does not mistake them for the House or name columns', () => {
    const csv = 'Full Name,Preference 3,Preference 1,Preference 2\nKevin Tran,Bowser,Toad,Boo';
    const [row] = parseLongRows(csv, members, emailMap, profileMap);
    expect(row.name).toBe('Kevin Tran');
    expect(row.house).toBeNull();
    expect(row.preferences).toEqual(['Toad', 'Boo', 'Bowser']);
  });

  it('recognizes the supported preference header spellings only', () => {
    expect(
      detectPreferenceColumns(['First Choice', '2nd choice', 'Third Preference', 'Preference 4', 'House', 'Name', 'First Name']),
    ).toEqual(['First Choice', '2nd choice', 'Third Preference', 'Preference 4']);
  });
});

describe('persisted draft rows', () => {
  it('never carries an email into the draft payload', () => {
    const [row] = parseLongRows('name,email,house\nKevin Tran,kevin@ucsd.edu,Toad', members, emailMap, profileMap);
    const payload = draftInsertFromParsed(row, 0);

    expect(JSON.stringify(payload)).not.toContain('@');
    expect(payload).toMatchObject({
      source_name: 'Kevin Tran',
      source_house: 'Toad',
      member_id: 'm-kevin',
      house_profile_id: 'profile-toad',
      match_status: 'match',
      match_method: 'email',
      source_order: 0,
      preferences: null,
    });
  });

  it('stores a candidate for review rows but nothing for unmatched rows', () => {
    const review = parseLongRows('name,house\nSara Nguyn,Boo', members, emailMap, profileMap)[0];
    const unmatched = parseLongRows('name,house\nZzzz Qqqq,Boo', members, emailMap, profileMap)[0];

    expect(review.status).toBe('review');
    expect(draftInsertFromParsed(review, 1).member_id).toBe('m-sarah');
    expect(unmatched.status).toBe('unmatched');
    expect(draftInsertFromParsed(unmatched, 2)).toMatchObject({ member_id: null, match_status: 'unmatched', match_method: null });
  });

  it('persists parsed preferences as an ordered array', () => {
    const [row] = parseLongRows('name,first choice,second choice\nKevin Tran,Toad,Boo', members, emailMap, profileMap);
    expect(draftInsertFromParsed(row, 0).preferences).toEqual(['Toad', 'Boo']);
  });
});
