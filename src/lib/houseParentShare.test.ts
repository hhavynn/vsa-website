/**
 * House Parent share copy (#654). What matters: only the allowlisted columns,
 * and no per-member count (House points are a count of credited attendance, so
 * counts would add up to the embargoed House score); only members publicly
 * revealed in this House; formulas defused; Excel-safe UTF-8; a filename that
 * names the House and period.
 */
import type { RosterMember } from '../data/repos/houseRoster';
import { HOUSE_PARENT_SHARE_FIELDS, houseParentShareCsv, houseParentShareFilename } from './houseParentShare';

const member = (extra: Partial<RosterMember>): RosterMember => ({
  member_id: '30000000-0000-0000-0000-00000000000a', first_name: 'Fictional', last_name: 'Person', start_date: '2026-10-15', end_date: null, stints: 1,
  joined_in_period: false, other_house_memberships: 0, credited_attendance: 0, last_credited_at: null, events_attended: 7, ...extra,
});
const lines = (csv: string) => csv.replace(/^﻿/, '').trim().split('\n');

it('writes only the allowlisted columns, no counts, for revealed members only', () => {
  const csv = houseParentShareCsv([
    member({ member_id: 'z', first_name: 'Zed', last_name: 'Example', credited_attendance: 9, last_credited_at: '2026-10-21T02:00:00Z' }),
    member({ member_id: 'a', first_name: 'Ana', last_name: 'Example' }),
    member({ member_id: 'hidden', first_name: 'Unrevealed', last_name: 'Example', credited_attendance: 3 }),
  ], new Set(['z', 'a']));
  const [header, first, second, third] = lines(csv);
  expect(header).toBe(HOUSE_PARENT_SHARE_FIELDS.map((field) => field.header).join(','));
  expect(first).toBe('Ana Example,2026-10-15,No,');
  // 2026-10-21T02:00Z is the evening of Oct 20 in Los Angeles.
  expect(second).toBe('Zed Example,2026-10-15,Yes,2026-10-20');
  expect(third).toBeUndefined();
  expect(csv).not.toContain('Unrevealed');
  expect(csv).not.toMatch(/\b9\b|\b3\b|\b7\b/);
  expect(csv).not.toMatch(/30000000-|@|points|rank/i);
});

it('starts with a UTF-8 byte order mark so Vietnamese names open correctly', () => {
  const csv = houseParentShareCsv([member({ member_id: 'n', first_name: 'Nguyễn', last_name: 'Thị' })], new Set(['n']));
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv).toContain('Nguyễn Thị');
});

it('defuses spreadsheet formulas, including after leading whitespace', () => {
  const csv = houseParentShareCsv([
    member({ member_id: 'f1', first_name: '=HYPERLINK("x")', last_name: '' }),
    member({ member_id: 'f2', first_name: ' +1+1', last_name: '' }),
    member({ member_id: 'f3', first_name: '@SUM(A1)', last_name: '' }),
  ], new Set(['f1', 'f2', 'f3']));
  const rows = lines(csv).slice(1);
  expect(rows).toEqual(expect.arrayContaining([
    expect.stringMatching(/^"'=HYPERLINK\(""x""\)"/),
    expect.stringMatching(/^' \+1\+1/),
    expect.stringMatching(/^'@SUM\(A1\)/),
  ]));
});

it('never writes "Invalid Date"', () => {
  expect(houseParentShareCsv([member({ member_id: 'x', last_credited_at: 'not a date' })], new Set(['x']))).not.toContain('Invalid');
});

it('names the file after the House and period', () => {
  expect(houseParentShareFilename('Twilight Sparkle', 2026, 'Fall 2026')).toBe('twilight-sparkle-2026-2027-fall-2026-house-parents.csv');
  expect(houseParentShareFilename('Rarity', 2026, null)).toBe('rarity-2026-2027-house-parents.csv');
});
