// "Copy position structure from <year>" for an existing Cabinet roster. Copies
// roles, boards (categories), and display order only — never people, member
// links, photos, or bios — and only for positions the roster does not already
// have, so running it twice never creates duplicates.
import {
  CabinetRosterDraft,
  CabinetRosterDraftInsert,
  StructureSource,
  buildStructureRows,
  normalizeRole,
} from './cabinetRoster';

export interface StructureCopyPlan {
  inserts: Array<Pick<CabinetRosterDraftInsert, 'role' | 'category' | 'display_order'>>;
  /** Positions in the source the roster already has. */
  alreadyPresent: number;
}

export function planStructureCopy(
  existing: ReadonlyArray<Pick<CabinetRosterDraft, 'role' | 'category' | 'display_order'>>,
  source: readonly StructureSource[],
): StructureCopyPlan {
  const have = new Set(existing.map((draft) => `${draft.category}|${normalizeRole(draft.role)}`));
  const rows = buildStructureRows(source);
  const fresh = rows.filter((row) => !have.has(`${row.category}|${normalizeRole(row.role)}`));
  // Keep the source order but continue numbering after what is already there.
  const start = existing.reduce((max, draft) => Math.max(max, draft.display_order), -1) + 1;
  return {
    inserts: fresh.map((row, index) => ({ ...row, display_order: existing.length === 0 ? row.display_order : start + index })),
    alreadyPresent: rows.length - fresh.length,
  };
}
