// Protected domain — House membership. "Export for Google Sheets" for an
// automatic House placement, shared by the unsaved preview and the saved
// draft. Downloads only: nothing is uploaded, and an edited sheet is never
// read back as a change to the draft.
import {
  PlacementExportRow,
  downloadCsv,
  houseRosterCsv,
  placementExportFilename,
  placementNeedsReviewCsv,
  placementRosterCsv,
} from '../../../lib/housePlacementExport';

export interface HousePlacementExportPanelProps {
  rows: readonly PlacementExportRow[];
  houses: ReadonlyArray<{ id: string; label: string }>;
  academicYearStart: number;
  /** An unsaved preview: files are named "…-preview-…" and carry no draft row IDs. */
  preview?: boolean;
}

const btnCls =
  'rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50 border-[var(--color-border)] text-text-primary';

export function HousePlacementExportPanel({ rows, houses, academicYearStart, preview = false }: HousePlacementExportPanelProps) {
  const needsReview = rows.filter((row) => row.reviewReasons.length > 0).length;
  const name = (what: Parameters<typeof placementExportFilename>[1]) => placementExportFilename(academicYearStart, what, preview);

  return (
    <section className="rounded border p-4 border-[var(--color-border)] bg-surface2" aria-label="Export for Google Sheets">
      <h4 className="font-serif text-base font-bold text-text-primary">Export for Google Sheets</h4>
      <p className="mt-1 text-xs text-text-secondary">
        Download a CSV, then in Google Sheets choose File → Import → Upload (or open the file from Google Drive). Rows stay in first-come, first-served order; sort or filter the sheet by House, achieved rank or Needs review as you like.
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {preview
          ? 'This is an unsaved preview. Save the draft to export with draft row IDs.'
          : 'Exports reflect the draft as it is now, including overrides and member links.'}{' '}
        Editing the sheet does not change the draft. Emails and other form answers are never included.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnCls} disabled={rows.length === 0} onClick={() => downloadCsv(placementRosterCsv(rows), name({ kind: 'full' }))}>
          Full roster ({rows.length})
        </button>
        {houses.map((house) => {
          const count = rows.filter((row) => row.houseId === house.id).length;
          return (
            <button
              key={house.id}
              type="button"
              className={btnCls}
              disabled={count === 0}
              onClick={() => downloadCsv(houseRosterCsv(rows, house.id), name({ kind: 'house', houseLabel: house.label }))}
            >
              {house.label} roster ({count})
            </button>
          );
        })}
        <button type="button" className={btnCls} disabled={needsReview === 0} onClick={() => downloadCsv(placementNeedsReviewCsv(rows), name({ kind: 'review' }))}>
          Needs review ({needsReview})
        </button>
      </div>
    </section>
  );
}
