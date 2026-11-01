import { csvCell } from './adminImportReview';
import { ELIGIBILITY_STATUS_LABEL, type AceEligibilityRow } from './aceEligibility';

export interface AceEligibilityExportContext {
  academicYearStart: number;
  /** Authoritative event-readiness snapshot; never generated from the user's clock. */
  checkedAt: string;
}

/**
 * Admin-only local download for the filtered pre-sort eligibility queue.
 * Excludes canonical member IDs, draft IDs, emails and answer text.
 * Not a decision, proof of self-report, or a change to attendance/points.
 */
export function aceEligibilityReviewCsv(rows: readonly AceEligibilityRow[], context: AceEligibilityExportContext): string {
  const headers = [
    'Academic year', 'Readiness checked at (UTC)', 'Role', 'Name',
    'Eligibility', 'Verified qualifying events', 'Minimum required',
    'Unverified-event credits', 'Events still needed', 'Reason', 'Draft Little count',
  ];
  const year = `${context.academicYearStart}-${context.academicYearStart + 1}`;
  const lines = [headers, ...rows.map((row) => [
    year,
    context.checkedAt,
    row.role === 'big' ? 'Big' : 'Little',
    row.name,
    ELIGIBILITY_STATUS_LABEL[row.status],
    String(row.attended),
    String(row.required),
    String(row.pendingAttended),
    row.remaining === null ? '' : String(row.remaining),
    row.reason,
    String(row.draftIds.length),
  ])];
  // The BOM keeps Vietnamese names intact when the file opens in Excel.
  return `\uFEFF${lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
