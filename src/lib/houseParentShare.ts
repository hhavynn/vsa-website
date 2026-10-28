// Protected domain — House membership / points. Admin-only "share copy" of one
// House's roster for that House's own Parents (#654), the fallback the issue
// asks for while no House Parent login has been approved. It never adds
// accounts or permissions: an admin reviews the exact list and downloads it.
//
// HOUSE_PARENT_SHARE_FIELDS is the provisional field allowlist. It must be
// approved by CRC/cabinet before it is relied on (docs/house-parent-access.md);
// it deliberately leaves out contact details, other Houses, member ids,
// anything from applications, and any per-member count: House scores sum awarded points; individual credit counts can still
// reveal participation and must not be shared without a reviewed field list.
// embargoed House score (#692). Only members publicly revealed in this House
// are included. Every cell goes through csvCell, which defuses formulas.
import type { RosterMember } from '../data/repos/houseRoster';
import { csvCell } from './adminImportReview';

// Default-off governance gate: no member-level participation export until
// CRC/cabinet record the date and approved fields in docs/house-parent-access.md.
// This constant is intentionally not exposed as a public/admin setting.
export const HOUSE_PARENT_SHARE_APPROVED = false;

export const HOUSE_PARENT_SHARE_FIELDS = [
  { header: 'Name', describe: 'First and last name' },
  { header: 'In the House since', describe: 'Their House start date' },
  { header: 'Attended a House-credited event', describe: 'Yes or No for the period' },
  { header: 'Last House-credited event', describe: 'Date of the latest one' },
] as const;

function name(member: Pick<RosterMember, 'first_name' | 'last_name'>) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Unnamed member';
}

/** YYYY-MM-DD in Los Angeles, independent of locale; '' when missing or invalid. */
function day(value: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * One row per member publicly revealed in this House (`revealedMemberIds`),
 * sorted by name. Nothing beyond the allowlist. Starts with a UTF-8 byte order
 * mark so Excel shows Vietnamese names correctly.
 */
export function houseParentShareCsv(members: readonly RosterMember[], revealedMemberIds: ReadonlySet<string>): string {
  const lines = [HOUSE_PARENT_SHARE_FIELDS.map((field) => csvCell(field.header)).join(',')];
  members
    .filter((member) => revealedMemberIds.has(member.member_id))
    .sort((a, b) => name(a).localeCompare(name(b)))
    .forEach((member) => {
      lines.push([
        name(member),
        day(member.start_date),
        member.credited_attendance > 0 ? 'Yes' : 'No',
        day(member.last_credited_at),
      ].map(csvCell).join(','));
    });
  return `\uFEFF${lines.join('\n')}\n`;
}

/** "rarity-2026-2027-fall-2026-house-parents.csv". */
export function houseParentShareFilename(houseName: string, academicYearStart: number, periodLabel: string | null) {
  const parts = [houseName, `${academicYearStart}-${academicYearStart + 1}`, periodLabel ?? '', 'house-parents'];
  return `${parts.filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.csv`;
}
