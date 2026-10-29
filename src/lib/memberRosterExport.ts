import type { AdminMemberListRow } from '../data/repos/adminMembers';
import { csvCell } from './adminImportReview';

type ExportMember = AdminMemberListRow & { current_house: string | null };

/**
 * Admin-only export of the fully loaded roster. All cells use the shared
 * formula-safe RFC 4180 serializer; the UTF-8 BOM preserves Vietnamese names
 * when an admin opens the download in Excel.
 */
export function memberRosterCsv(members: readonly ExportMember[], houseLookupFailed: boolean): string {
  const lines = [
    ['First Name', 'Last Name', 'Email', 'Year', 'College', 'House', 'Points', 'Events']
      .map(csvCell).join(','),
  ];

  for (const member of members) {
    lines.push([
      member.first_name,
      member.last_name,
      member.email ?? '',
      member.year ?? '',
      member.college ?? '',
      houseLookupFailed ? 'unknown' : member.current_house ?? '',
      String(member.points),
      String(member.events_attended),
    ].map(csvCell).join(','));
  }

  return '\uFEFF' + lines.join('\n') + '\n';
}
