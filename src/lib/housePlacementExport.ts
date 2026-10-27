// Private, admin-only CSV exports of a timestamp-priority House placement, for
// opening in Google Sheets (File → Import, or open the download from Drive).
// Columns are deliberately limited to placement facts: no email, phone, date of
// birth, allergies or other form answers. Every cell goes through csvCell, which
// quotes per RFC 4180 and defuses spreadsheet formulas (=, +, -, @ …).
// Exports are read-only copies: an edited sheet is never read back as a change.
import { csvCell } from './adminImportReview';
import { formatFormTime } from './housePlacementImport';
import {
  HouseAssignmentDraft,
  achievedRank,
  isOverridden,
  readPreferences,
} from './houseAssignmentDraft';

export type PlacementMemberMatch = 'Matched' | 'Needs review' | 'Unmatched';

export interface PlacementExportRow {
  /** 1-based first-come, first-served position. */
  priority: number;
  /** Row in the Google Form responses sheet. */
  sheetRow: number | null;
  /** The name as the applicant typed it. */
  applicantName: string;
  /** Canonical member the row is linked to, or ''. */
  linkedMember: string;
  submittedPacific: string;
  /** UTC ISO instant, or ''. */
  submittedUtc: string;
  /** House labels, first choice first. */
  preferences: string[];
  generatedHouseId: string | null;
  generatedHouse: string;
  houseId: string | null;
  house: string;
  achievedRank: number | null;
  placement: 'Automatic' | 'Manual override';
  overrideReason: string;
  memberMatch: PlacementMemberMatch;
  /** Why a human should look at this row; empty when nothing is outstanding. */
  reviewReasons: string[];
  /** house_assignment_drafts.id, or '' for an unsaved preview. */
  draftRowId: string;
}

const CHOICE_HEADERS = ['1st choice', '2nd choice', '3rd choice', '4th choice', '5th choice', '6th choice'];

function choiceCount(rows: readonly PlacementExportRow[]) {
  return Math.max(4, rows.reduce((max, row) => Math.max(max, row.preferences.length), 0));
}

function toCsv(rows: readonly PlacementExportRow[], choices: number) {
  const header = [
    'Priority', 'Sheet row', 'Applicant name', 'Linked member',
    'Submitted (Pacific)', 'Submitted (UTC)',
    ...Array.from({ length: choices }, (_, index) => CHOICE_HEADERS[index] ?? `Choice ${index + 1}`),
    'Generated House', 'Assigned House', 'Achieved rank', 'Placement', 'Override reason',
    'Member match', 'Needs review', 'Review reason', 'Draft row ID',
  ];
  const lines = [header.map(csvCell).join(',')];
  [...rows].sort((a, b) => a.priority - b.priority).forEach((row) => {
    lines.push([
      String(row.priority),
      row.sheetRow === null ? '' : String(row.sheetRow),
      row.applicantName,
      row.linkedMember,
      row.submittedPacific,
      row.submittedUtc,
      ...Array.from({ length: choices }, (_, index) => row.preferences[index] ?? ''),
      row.generatedHouse,
      row.house,
      row.achievedRank === null ? '' : String(row.achievedRank),
      row.placement,
      row.overrideReason,
      row.memberMatch,
      row.reviewReasons.length > 0 ? 'Yes' : 'No',
      row.reviewReasons.join('; '),
      row.draftRowId,
    ].map(csvCell).join(','));
  });
  return `${lines.join('\n')}\n`;
}

/** Every included applicant, in first-come, first-served order. */
export function placementRosterCsv(rows: readonly PlacementExportRow[]) {
  return toCsv(rows, choiceCount(rows));
}

/** One House's applicants, in priority order. */
export function houseRosterCsv(rows: readonly PlacementExportRow[], houseId: string) {
  return toCsv(rows.filter((row) => row.houseId === houseId), choiceCount(rows));
}

/** Rows with an outstanding member match, override or other exception. */
export function placementNeedsReviewCsv(rows: readonly PlacementExportRow[]) {
  return toCsv(rows.filter((row) => row.reviewReasons.length > 0), choiceCount(rows));
}

export type PlacementExportKind = { kind: 'full' } | { kind: 'house'; houseLabel: string } | { kind: 'review' };

/** "vsa-house-placement-2026-2027-full-roster.csv"; previews say "preview". */
export function placementExportFilename(academicYearStart: number, what: PlacementExportKind, preview = false) {
  const suffix = what.kind === 'full' ? 'full-roster' : what.kind === 'review' ? 'needs-review' : `${what.houseLabel}-roster`;
  const parts = ['vsa-house-placement', `${academicYearStart}-${academicYearStart + 1}`, preview ? 'preview' : '', suffix];
  return `${parts.filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.csv`;
}

const LINKED_STATUSES: ReadonlySet<string> = new Set(['match', 'manual']);

export function draftMemberMatch(row: Pick<HouseAssignmentDraft, 'member_id' | 'match_status'>): PlacementMemberMatch {
  if (row.member_id && LINKED_STATUSES.has(row.match_status)) return 'Matched';
  if (row.match_status === 'review') return 'Needs review';
  return 'Unmatched';
}

/**
 * Export rows for a persisted timestamp-priority draft, built from the rows as
 * they are now, so overrides and member links made in the editor are included.
 */
export function exportRowsFromDrafts(
  drafts: readonly HouseAssignmentDraft[],
  lookups: { houseLabel: (profileId: string) => string | null; memberName: (memberId: string) => string | null },
): PlacementExportRow[] {
  return [...drafts]
    .sort((a, b) => a.source_order - b.source_order || a.id.localeCompare(b.id))
    .map((row) => {
      const label = (id: string | null) => (id ? lookups.houseLabel(id) ?? 'Unknown House' : '');
      const memberMatch = draftMemberMatch(row);
      const overridden = isOverridden(row);
      const rank = achievedRank(row);
      const reviewReasons = [
        memberMatch === 'Needs review' ? 'Member match needs review' : null,
        memberMatch === 'Unmatched' ? 'No linked member' : null,
        overridden ? 'Manual override' : null,
        !row.house_profile_id ? 'No House assigned' : null,
        row.house_profile_id && rank === null ? 'Assigned House not in their ranking' : null,
      ].filter((reason): reason is string => !!reason);
      return {
        priority: row.source_order + 1,
        sheetRow: row.source_row_number,
        applicantName: row.source_name,
        linkedMember: row.member_id ? lookups.memberName(row.member_id) ?? '' : '',
        submittedPacific: row.submission_timestamp ? formatFormTime(row.submission_timestamp) : '',
        submittedUtc: row.submission_timestamp ? new Date(row.submission_timestamp).toISOString() : '',
        preferences: readPreferences(row.preferences).map((id) => label(id)),
        generatedHouseId: row.generated_house_profile_id,
        generatedHouse: label(row.generated_house_profile_id),
        houseId: row.house_profile_id,
        house: label(row.house_profile_id) || 'Unassigned',
        achievedRank: rank,
        placement: overridden ? 'Manual override' : 'Automatic',
        overrideReason: overridden ? row.override_reason ?? '' : '',
        memberMatch,
        reviewReasons,
        draftRowId: row.id,
      };
    });
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
