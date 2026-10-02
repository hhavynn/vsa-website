// Bulk-action planning for the admin work queues. A plan separates the rows an
// action may touch from the rows it must skip (with a concrete reason), and says
// whether the admin has to confirm first. Nothing here writes: pages run the
// plan's eligible rows through the same repository methods single edits use.
//
// Rule that every planner below enforces: a bulk action never resolves an
// ambiguous identity. It may only apply a decision the admin already made
// (assign these rows to this House) or an exact, unclaimed one-to-one match.
import type { LittleLinkReviewItem } from './aceAssignments';
import { pluralize } from './operationalStatus';

export interface BulkSkip<T> {
  row: T;
  reason: string;
}

export interface BulkPlan<T> {
  eligible: T[];
  skipped: Array<BulkSkip<T>>;
  /** Rows the admin selected. */
  total: number;
  destructive: boolean;
  /** True for destructive actions with something to do: the page must confirm first. */
  needsConfirm: boolean;
  /** "Clear House for 12 rows? This can be redone by hand." */
  confirmText: string;
  /** "12 of 14 selected rows will change. 2 skipped." */
  summary: string;
}

export interface PlanBulkOptions {
  /** Short verb phrase used in copy, e.g. "Clear House for". */
  verb: string;
  noun?: string;
  nounPlural?: string;
  destructive?: boolean;
}

/**
 * `check` returns null when the row may change, or the reason it may not.
 */
export function planBulk<T>(rows: readonly T[], check: (row: T) => string | null, options: PlanBulkOptions): BulkPlan<T> {
  const noun = options.noun ?? 'row';
  const nounPlural = options.nounPlural ?? `${noun}s`;
  const eligible: T[] = [];
  const skipped: Array<BulkSkip<T>> = [];
  for (const row of rows) {
    const reason = check(row);
    if (reason === null) eligible.push(row);
    else skipped.push({ row, reason });
  }
  const destructive = options.destructive === true;
  const count = eligible.length;
  const summary =
    rows.length === 0
      ? `Select ${nounPlural} first.`
      : skipped.length === 0
        ? `${count} of ${rows.length} selected ${rows.length === 1 ? noun : nounPlural} will change.`
        : `${count} of ${rows.length} selected ${rows.length === 1 ? noun : nounPlural} will change. ${skipped.length} skipped.`;
  return {
    eligible,
    skipped,
    total: rows.length,
    destructive,
    needsConfirm: destructive && count > 0,
    confirmText: `${options.verb} ${pluralize(count, noun, nounPlural)}?`,
    summary,
  };
}

// ─── Selection helpers ───────────────────────────────────────────────────────

export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Select (or clear) exactly the given ids, e.g. every row in the current filter. */
export function setSelection(ids: readonly string[], on: boolean): Set<string> {
  return on ? new Set(ids) : new Set();
}

/** Drops selected ids that are no longer in `validIds` (row removed, year switched). */
export function pruneSelection(selected: ReadonlySet<string>, validIds: Iterable<string>): Set<string> {
  const valid = new Set(validIds);
  return new Set(Array.from(selected).filter((id) => valid.has(id)));
}

export function selectedRows<T>(rows: readonly T[], selected: ReadonlySet<string>, idOf: (row: T) => string): T[] {
  return rows.filter((row) => selected.has(idOf(row)));
}

// ─── ACE ─────────────────────────────────────────────────────────────────────

const LITTLE_LINK_SKIP: Record<LittleLinkReviewItem['status'], string | null> = {
  recommended: null,
  ambiguous: 'More than one member shares this name. Choose one manually.',
  conflict: 'That member is already used by another record. Review it manually.',
  none: 'No member has this exact name.',
};

/**
 * "Link selected exact matches": only a unique exact name match that no other
 * record claims or also wants. Ambiguous, conflicting, and unmatched Littles
 * are skipped with their reason, never guessed at.
 */
export function planAceLinkExactMatches(
  selectedIds: ReadonlySet<string>,
  review: ReadonlyArray<LittleLinkReviewItem>,
  linkedDraftIds: ReadonlySet<string> = new Set(),
): BulkPlan<LittleLinkReviewItem> {
  const chosen = review.filter((item) => selectedIds.has(item.draft.id));
  const alreadyLinkedSelected = Array.from(selectedIds).filter((id) => linkedDraftIds.has(id));
  const plan = planBulk(chosen, (item) => LITTLE_LINK_SKIP[item.status], {
    verb: 'Link',
    noun: 'Little',
    nounPlural: 'Littles',
  });
  // Selected rows that are already linked are not in the review list; count them
  // as skipped so the totals match what the admin ticked.
  return { ...plan, total: plan.total + alreadyLinkedSelected.length, summary: appendAlreadyLinked(plan.summary, alreadyLinkedSelected.length) };
}

function appendAlreadyLinked(summary: string, count: number): string {
  return count > 0 ? `${summary} ${pluralize(count, 'selected row is', 'selected rows are')} already linked.` : summary;
}

// ─── Houses ──────────────────────────────────────────────────────────────────

export interface HouseBulkRow {
  id: string;
  house_profile_id: string | null;
}

export function planHouseAssign<T extends HouseBulkRow>(rows: readonly T[], houseProfileId: string, editable: boolean): BulkPlan<T> {
  return planBulk(
    rows,
    (row) => {
      if (!editable) return 'The batch is locked. Reopen it to edit.';
      if (row.house_profile_id === houseProfileId) return 'Already in this House.';
      return null;
    },
    { verb: 'Assign', noun: 'row' },
  );
}

export function planHouseClear<T extends HouseBulkRow>(rows: readonly T[], editable: boolean): BulkPlan<T> {
  return planBulk(
    rows,
    (row) => {
      if (!editable) return 'The batch is locked. Reopen it to edit.';
      if (!row.house_profile_id) return 'Already unassigned.';
      return null;
    },
    { verb: 'Clear the House for', noun: 'row', destructive: true },
  );
}

// ─── Interns ─────────────────────────────────────────────────────────────────

export interface InternBulkRow {
  id: string;
  mentor_cabinet_member_id: string | null;
  role_or_track: string | null;
}

export function planInternMentor<T extends InternBulkRow>(rows: readonly T[], mentorId: string | null, editable: boolean): BulkPlan<T> {
  return planBulk(
    rows,
    (row) => {
      if (!editable) return 'The cohort is locked. Reopen it to edit.';
      if ((row.mentor_cabinet_member_id ?? null) === mentorId) return mentorId ? 'Already has this mentor.' : 'Already has no mentor.';
      return null;
    },
    { verb: mentorId ? 'Set the mentor for' : 'Remove the mentor from', noun: 'intern', destructive: mentorId === null },
  );
}

export function planInternTrack<T extends InternBulkRow>(rows: readonly T[], track: string, editable: boolean): BulkPlan<T> {
  const next = track.trim();
  return planBulk(
    rows,
    (row) => {
      if (!editable) return 'The cohort is locked. Reopen it to edit.';
      if (!next) return 'Enter a track first.';
      if ((row.role_or_track ?? '') === next) return 'Already has this track.';
      return null;
    },
    { verb: 'Set the track for', noun: 'intern' },
  );
}

// ─── Cabinet ─────────────────────────────────────────────────────────────────

export interface CabinetBulkRow {
  id: string;
  category: string;
}

export function planCabinetCategory<T extends CabinetBulkRow>(rows: readonly T[], category: string, editable: boolean): BulkPlan<T> {
  return planBulk(
    rows,
    (row) => {
      if (!editable) return 'The roster is locked. Reopen it to edit.';
      if (row.category === category) return 'Already in this board.';
      return null;
    },
    { verb: 'Move', noun: 'position' },
  );
}

// ─── Reviewed marks (shared) ─────────────────────────────────────────────────

export function planMarkReviewed<T extends { id: string }>(
  rows: readonly T[],
  reviewedIds: ReadonlySet<string>,
  noun = 'row',
): BulkPlan<T> {
  return planBulk(rows, (row) => (reviewedIds.has(row.id) ? 'Already reviewed.' : null), {
    verb: 'Mark reviewed',
    noun,
  });
}

// ─── Members ─────────────────────────────────────────────────────────────────

export function planMemberClearReview<T extends { id: string; needs_review: boolean | null }>(rows: readonly T[]): BulkPlan<T> {
  return planBulk(rows, (row) => (row.needs_review ? null : 'Not flagged for review.'), {
    verb: 'Clear the review flag on',
    noun: 'member',
  });
}
