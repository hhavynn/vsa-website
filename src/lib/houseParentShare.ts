// Protected domain — House membership / points. Admin-only "share copy" of one
// House's roster for that House's own Parents (#654), the fallback the issue
// asks for while no House Parent login has been approved. It never adds
// accounts or permissions: an admin reviews the exact list and downloads it.
//
// HOUSE_PARENT_SHARE_FIELDS is the provisional field allowlist. It must be
// approved by CRC/cabinet before it is relied on (docs/house-parent-access.md);
// it deliberately leaves out contact details, other Houses, House point totals
// and rank (embargoed, #692), member ids, and anything from applications.
// Every cell goes through csvCell, which defuses spreadsheet formulas.
import type { RosterMember } from '../data/repos/houseRoster';
import { csvCell } from './adminImportReview';

export const HOUSE_PARENT_SHARE_FIELDS = [
  { header: 'Name', describe: 'First and last name' },
  { header: 'In the House since', describe: 'Their House start date' },
  { header: 'Attended a House-credited event', describe: 'Yes or No for the period' },
  { header: 'House-credited events', describe: 'How many qualifying VSA events they attended after joining the House' },
  { header: 'Last House-credited event', describe: 'Date of the latest one' },
] as const;

function name(member: Pick<RosterMember, 'first_name' | 'last_name'>) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Unnamed member';
}

function day(value: string | null) {
  if (!value) return '';
  return value.length === 10 ? value : new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/** One row per member of this House, sorted by name. Nothing beyond the allowlist. */
export function houseParentShareCsv(members: readonly RosterMember[]): string {
  const lines = [HOUSE_PARENT_SHARE_FIELDS.map((field) => csvCell(field.header)).join(',')];
  [...members]
    .sort((a, b) => name(a).localeCompare(name(b)))
    .forEach((member) => {
      lines.push([
        name(member),
        day(member.start_date),
        member.credited_attendance > 0 ? 'Yes' : 'No',
        String(member.credited_attendance),
        day(member.last_credited_at),
      ].map(csvCell).join(','));
    });
  return `${lines.join('\n')}\n`;
}

/** "rarity-2026-2027-fall-2026-house-parents.csv". */
export function houseParentShareFilename(houseName: string, academicYearStart: number, periodLabel: string | null) {
  const parts = [houseName, `${academicYearStart}-${academicYearStart + 1}`, periodLabel ?? '', 'house-parents'];
  return `${parts.filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.csv`;
}
