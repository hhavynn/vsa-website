// Private, admin-only CSV exports of a timestamp-priority House placement.
// Columns are deliberately limited to placement facts: no email, phone, date of
// birth, allergies or other form answers. Every cell goes through csvCell, which
// quotes per RFC 4180 and defuses spreadsheet formulas (=, +, -, @ …).
import { csvCell } from './adminImportReview';
import { ordinal } from './housePlacement';

export interface PlacementExportRow {
  priority: number;
  name: string;
  houseId: string | null;
  house: string;
  submitted: string;
  /** House labels, first choice first. */
  preferences: string[];
  achievedRank: number | null;
  placement: 'Automatic' | 'Manual override';
  overrideReason: string;
  memberMatch: string;
  /** Needs a human: unmatched/ambiguous member, override, or no House. */
  exception: boolean;
}

function toCsv(rows: readonly PlacementExportRow[], rankCount: number) {
  const header = [
    'Priority', 'Name', 'Assigned House', 'Submitted (Pacific)',
    ...Array.from({ length: rankCount }, (_, index) => `${ordinal(index + 1)} choice`),
    'Result', 'Placement', 'Override reason', 'Member match',
  ];
  const lines = [header.map(csvCell).join(',')];
  [...rows].sort((a, b) => a.priority - b.priority).forEach((row) => {
    lines.push([
      String(row.priority),
      row.name,
      row.house,
      row.submitted,
      ...Array.from({ length: rankCount }, (_, index) => row.preferences[index] ?? ''),
      row.achievedRank ? `${ordinal(row.achievedRank)} choice` : 'Not ranked',
      row.placement,
      row.overrideReason,
      row.memberMatch,
    ].map(csvCell).join(','));
  });
  return `${lines.join('\n')}\n`;
}

function rankCountOf(rows: readonly PlacementExportRow[]) {
  return rows.reduce((max, row) => Math.max(max, row.preferences.length), 0);
}

export function placementRosterCsv(rows: readonly PlacementExportRow[]) {
  return toCsv(rows, rankCountOf(rows));
}

export function houseRosterCsv(rows: readonly PlacementExportRow[], houseId: string) {
  return toCsv(rows.filter((row) => row.houseId === houseId), rankCountOf(rows));
}

export function placementExceptionsCsv(rows: readonly PlacementExportRow[]) {
  return toCsv(rows.filter((row) => row.exception), rankCountOf(rows));
}

export function exportFilename(...parts: string[]) {
  return `${parts.join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.csv`;
}

/** Hands the CSV to the browser as a download; nothing is uploaded or stored. */
export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
