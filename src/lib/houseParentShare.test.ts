/**
 * House Parent share copy (#654). What matters: only the allowlisted columns
 * (no email, member id, other House, points or rank), formulas defused, and a
 * filename that names the House and period.
 */
import type { RosterMember } from '../data/repos/houseRoster';
import { HOUSE_PARENT_SHARE_FIELDS, houseParentShareCsv, houseParentShareFilename } from './houseParentShare';

const member = (extra: Partial<RosterMember>): RosterMember => ({
  member_id: '30000000-0000-0000-0000-00000000000a', first_name: 'Fictional', last_name: 'Person', start_date: '2026-10-15', end_date: null,
  joined_in_period: false, other_house_memberships: 1, credited_attendance: 0, last_credited_at: null, events_attended: 7, ...extra,
});

it('writes only the allowlisted columns, sorted by name', () => {
  const csv = houseParentShareCsv([
    member({ first_name: 'Zed', last_name: 'Example', credited_attendance: 2, last_credited_at: '2026-10-21T02:00:00Z' }),
    member({ first_name: 'Ana', last_name: 'Example' }),
  ]);
  const [header, first, second] = csv.trim().split('\n');
  expect(header).toBe(HOUSE_PARENT_SHARE_FIELDS.map((field) => field.header).join(','));
  expect(first).toBe('Ana Example,2026-10-15,No,0,');
  // 2026-10-21T02:00Z is the evening of Oct 20 in Los Angeles.
  expect(second).toBe('Zed Example,2026-10-15,Yes,2,2026-10-20');
  expect(csv).not.toMatch(/30000000-|@|other|points|rank/i);
  expect(csv).not.toContain('7');
});

it('defuses spreadsheet formulas in names', () => {
  const csv = houseParentShareCsv([member({ first_name: '=HYPERLINK("x")', last_name: '' })]);
  expect(csv.split('\n')[1].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
});

it('names the file after the House and period', () => {
  expect(houseParentShareFilename('Twilight Sparkle', 2026, 'Fall 2026')).toBe('twilight-sparkle-2026-2027-fall-2026-house-parents.csv');
  expect(houseParentShareFilename('Rarity', 2026, null)).toBe('rarity-2026-2027-house-parents.csv');
});
