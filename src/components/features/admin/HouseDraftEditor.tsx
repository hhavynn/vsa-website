// Protected domain — House membership. Review/edit/preflight/lock/reveal for one
// persisted House assignment batch. Locking is private; only "Reveal" writes
// house_memberships, and it does so through the shared dated-membership writer.
// A timestamp-priority (automatic) batch keeps its House counts fixed: rows
// move only through a documented override or swap, never through bulk edits
// or the balance helper, so first-come-first-served priority is not undone
// silently.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from 'react-query';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { housePaymentsRepository } from '../../../data/repos/housePayments';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { useOperatingYear } from '../../../hooks/useOperatingYear';
import { useReviewMarks } from '../../../hooks/useReviewMarks';
import { useUrlFilter, useUrlParam } from '../../../hooks/useUrlFilter';
import { ACTIVITY_ACTIONS, activitySummary, buildUndoMetadata } from '../../../lib/adminActivity';
import { planHouseAssign, planHouseClear, planMarkReviewed, pruneSelection, selectedRows, setSelection, toggleSelected } from '../../../lib/adminBulk';
import { findPersonInTwoHouses, findSameMemberTwice } from '../../../lib/adminConflicts';
import { applyQuickFilter, countByFilter, matchesText } from '../../../lib/adminFilters';
import { NextStep, nextStepFor } from '../../../lib/adminNextSteps';
import { buildReadiness, houseIssues } from '../../../lib/adminPreflight';
import { houseProgress } from '../../../lib/adminProgress';
import { HOUSE_ROW_FILTERS, HOUSE_ROW_FILTER_KEYS, HouseRowFacts, houseRowIsIn } from '../../../lib/adminQueues';
import { describeYearContext } from '../../../lib/adminYearContext';
import {
  HouseAssignmentBatch,
  HouseAssignmentDraft,
  HouseProfileLite,
  achievedRank,
  buildBatchPreflight,
  computeHouseCounts,
  houseLabel,
  isOverridden,
  isTimestampRanked,
  readCapacityConfig,
  readExcludedApplicants,
  readPreferences,
  suggestBalancing,
} from '../../../lib/houseAssignmentDraft';
import { findPriorityViolations, ordinal } from '../../../lib/housePlacement';
import { formatFormTime } from '../../../lib/housePlacementImport';
import { exportRowsFromDrafts } from '../../../lib/housePlacementExport';
import type { BalanceSuggestion } from '../../../lib/houseAssignmentDraft';
import { HouseImportMember, getMemberName, normalizeHouseLookup } from '../../../lib/houseAssignmentImport';
import type { MemberYearMembership } from '../../../lib/houseMembershipIntervals';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { formatYearSpan } from '../../../lib/operationalStatus';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { HousePaymentGateCard } from './HousePaymentGateCard';
import { HouseRevealReadinessPanel, useRevealReadiness } from './HouseRevealReadinessPanel';
import { HousePlacementExportPanel } from './HousePlacementExportPanel';
import { MemberSearchSelect } from './MemberSearchSelect';
import { HouseRevealPreviewDialog } from './preview/HouseRevealPreviewDialog';
import { runBulkWrites } from '../../../lib/bulkWrites';
import {
  BulkActionBar,
  BulkConfirm,
  EmptyState,
  FilterChips,
  NextStepBanner,
  PossibleDuplicates,
  ReadinessPanel,
  RowCheckbox,
  WorkflowProgress,
  YearContextBadge,
  bulkBtnCls,
} from './ops';

export interface HouseDraftEditorProps {
  batch: HouseAssignmentBatch;
  initialDrafts: HouseAssignmentDraft[];
  profiles: HouseProfileLite[];
  existingMemberships: Map<string, MemberYearMembership[]>;
  members: HouseImportMember[];
  userId: string | null;
  onBack: () => void;
  onBatchChanged: () => void;
  /** Called after a reveal so the parent can reload the members.house cache. */
  onPublished: () => void;
  /** Shown on open, e.g. right after a draft was saved. */
  initialNextStep?: NextStep | null;
  /** A draft row to scroll to and highlight on open (Quick Search link). */
  highlightRowId?: string | null;
  /** Opens another batch, e.g. a rerun just saved from this one or its original. */
  onOpenBatch?: (batchId: string) => void;
}

const selectCls =
  'w-full rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const ghostBtn =
  'rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

interface OverrideMove {
  row: HouseAssignmentDraft;
  from: string | null;
  to: string | null;
}

interface OverridePlan {
  moves: OverrideMove[];
  error: string | null;
  /** An earlier applicant would lose a higher-ranked House to a later one. */
  breaksPriority: boolean;
}

function OverrideForm({
  row,
  profiles,
  drafts,
  houseNameOf,
  personNameOf,
  plan,
  busy,
  onApply,
  onCancel,
}: {
  row: HouseAssignmentDraft;
  profiles: HouseProfileLite[];
  drafts: HouseAssignmentDraft[];
  houseNameOf: (id: string | null | undefined) => string | null;
  personNameOf: (row: HouseAssignmentDraft) => string;
  plan: (toHouseId: string, swapWithId: string | null) => OverridePlan;
  busy: boolean;
  onApply: (plan: OverridePlan, reason: string) => void;
  onCancel: () => void;
}) {
  const [toHouseId, setToHouseId] = useState('');
  const [swapWithId, setSwapWithId] = useState('');
  const [reason, setReason] = useState('');
  const current = toHouseId ? plan(toHouseId, swapWithId || null) : null;
  const inTarget = drafts
    .filter((item) => item.house_profile_id === toHouseId && item.id !== row.id)
    .sort((a, b) => a.source_order - b.source_order);
  const rankText = (item: HouseAssignmentDraft, houseId: string | null) => {
    const index = houseId ? readPreferences(item.preferences).indexOf(houseId) : -1;
    return index === -1 ? 'not ranked' : `${ordinal(index + 1)} choice`;
  };

  return (
    <div className="space-y-3 rounded border p-3 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }} data-testid="override-form">
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
        Manual override for {personNameOf(row)} (priority #{row.source_order + 1}). Currently {houseNameOf(row.house_profile_id) ?? 'unassigned'} ({rankText(row, row.house_profile_id)}).
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`override-house-${row.id}`} className={labelCls} style={{ color: 'var(--color-text3)' }}>Move to</label>
          <select id={`override-house-${row.id}`} value={toHouseId} onChange={(event) => { setToHouseId(event.target.value); setSwapWithId(''); }} className={selectCls} style={{ borderColor: 'var(--color-border)' }}>
            <option value="">Choose a House…</option>
            {profiles.filter((profile) => profile.is_active && profile.id !== row.house_profile_id).map((profile) => (
              <option key={profile.id} value={profile.id}>{houseLabel(profile)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`override-swap-${row.id}`} className={labelCls} style={{ color: 'var(--color-text3)' }}>Swap with (if full)</label>
          <select id={`override-swap-${row.id}`} value={swapWithId} disabled={!toHouseId} onChange={(event) => setSwapWithId(event.target.value)} className={selectCls} style={{ borderColor: 'var(--color-border)' }}>
            <option value="">No swap</option>
            {inTarget.map((item) => (
              <option key={item.id} value={item.id}>#{item.source_order + 1} {personNameOf(item)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`override-reason-${row.id}`} className={labelCls} style={{ color: 'var(--color-text3)' }}>Reason (required)</label>
          <input id={`override-reason-${row.id}`} type="text" value={reason} onChange={(event) => setReason(event.target.value)} className={selectCls} style={{ borderColor: 'var(--color-border)' }} placeholder="e.g. House Parent conflict approved by president" />
        </div>
      </div>
      {current && (
        <div style={{ color: 'var(--color-text2)' }}>
          {current.error ? (
            <p role="alert" className="text-red-600 dark:text-red-400">{current.error}</p>
          ) : (
            <ul className="space-y-0.5">
              {current.moves.map((move) => (
                <li key={move.row.id}>
                  {personNameOf(move.row)}: {houseNameOf(move.from) ?? 'unassigned'} ({rankText(move.row, move.from)}) → {houseNameOf(move.to)} ({rankText(move.row, move.to)})
                </li>
              ))}
            </ul>
          )}
          {current.breaksPriority && !current.error && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              Warning: this breaks first-come, first-served — an earlier applicant would miss a higher-ranked House that a later applicant gets.
            </p>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={busy || !current || !!current.error || !reason.trim()} onClick={() => current && onApply(current, reason)} className="vsa-btn-primary px-4 py-1.5 text-xs disabled:opacity-50">
          Apply override
        </button>
        <button type="button" onClick={onCancel} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>Cancel</button>
      </div>
    </div>
  );
}

function statusTone(status: string) {
  if (status === 'match' || status === 'manual') return 'text-emerald-700 dark:text-emerald-400';
  if (status === 'review') return 'text-amber-700 dark:text-amber-400';
  if (status === 'unmatched') return 'text-text-muted';
  return 'text-red-600 dark:text-red-400';
}

function batchBadge(status: string) {
  if (status === 'published') return 'Revealed';
  if (status === 'locked') return 'Locked';
  if (status === 'archived') return 'Archived';
  return 'Draft';
}

export function HouseDraftEditor({
  batch: initialBatch,
  initialDrafts,
  profiles,
  existingMemberships,
  members,
  userId,
  onBack,
  onBatchChanged,
  onPublished,
  initialNextStep = null,
  highlightRowId = null,
  onOpenBatch,
}: HouseDraftEditorProps) {
  const [batch, setBatch] = useState(initialBatch);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [busy, setBusy] = useState(false);
  const operatingYear = useOperatingYear();
  const [filter, setFilter] = useUrlFilter(HOUSE_ROW_FILTER_KEYS);
  const [houseFilter, setHouseFilter] = useUrlParam('house');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pendingClear, setPendingClear] = useState(false);
  const [nextStep, setNextStep] = useState<NextStep | null>(initialNextStep);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revealConfirmed, setRevealConfirmed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addMemberId, setAddMemberId] = useState<string | null>(null);
  const [addHouseId, setAddHouseId] = useState('');

  const editable = batch.status === 'draft';
  const auto = isTimestampRanked(batch);
  const capacityConfig = useMemo(() => readCapacityConfig(batch.capacity_config), [batch.capacity_config]);
  const [placementFilter, setPlacementFilter] = useState<'all' | 'automatic' | 'override'>('all');
  const [overrideRowId, setOverrideRowId] = useState<string | null>(null);
  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.is_active), [profiles]);
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, getMemberName(member)])),
    [members],
  );
  const houseIdByText = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((profile) => {
      // Automatic batches store preferences as profile ids.
      [profile.id, profile.house_key, profile.display_name].forEach((value) => map.set(normalizeHouseLookup(value), profile.id));
    });
    return map;
  }, [profiles]);

  const basePreflight = useMemo(
    () => buildBatchPreflight(batch, drafts, profiles, { effectiveStartDate: batch.effective_start_date, existingMemberships, memberNames }),
    [batch, drafts, profiles, existingMemberships, memberNames],
  );
  // The database's own payment gate (#660). It refuses Lock and Reveal again
  // server-side; showing it here only keeps the buttons honest.
  const paymentGate = useQuery(
    ['admin', 'house-batch-payment-blockers', batch.id, batch.status, batch.updated_at, drafts.length],
    () => housePaymentsRepository.getBatchBlockers(batch.id),
    { enabled: auto, retry: false, staleTime: 0 },
  );
  const preflight = useMemo(() => {
    const blockers = !auto ? []
      : paymentGate.isError ? ['Payment eligibility could not be checked.']
        : paymentGate.isLoading ? ['Checking payment eligibility…']
          : paymentGate.data ?? [];
    if (blockers.length === 0) return basePreflight;
    const gateIssues = blockers.map((message) => ({ code: 'payment_gate' as const, message, rowIds: [] }));
    return { ...basePreflight, blockers: [...gateIssues, ...basePreflight.blockers], canLock: false };
  }, [auto, basePreflight, paymentGate.data, paymentGate.isError, paymentGate.isLoading]);
  const queryClient = useQueryClient();
  const readiness = useRevealReadiness({
    batch,
    drafts,
    profiles,
    preflight: basePreflight,
    paymentBlockers: !auto ? null : paymentGate.isError || paymentGate.isLoading ? undefined : paymentGate.data ?? null,
  });
  const counts = useMemo(() => computeHouseCounts(drafts, profiles), [drafts, profiles]);
  const balance = useMemo(
    () => suggestBalancing(drafts, profiles, memberNames, (text) => houseIdByText.get(normalizeHouseLookup(text)) ?? null),
    [drafts, profiles, memberNames, houseIdByText],
  );

  const duplicateRowIds = useMemo(() => {
    const ids = new Set<string>();
    preflight.blockers.concat(preflight.warnings)
      .filter((issue) => issue.code === 'duplicate_member' || issue.code === 'conflicting_house')
      .forEach((issue) => issue.rowIds.forEach((id) => ids.add(id)));
    return ids;
  }, [preflight]);

  const draftIds = useMemo(() => drafts.map((row) => row.id), [drafts]);
  const { reviewed, markReviewed } = useReviewMarks('house_assignment_draft', batch.id, draftIds, batch.academic_year_start);
  const resolveHouseId = useCallback((text: string) => houseIdByText.get(normalizeHouseLookup(text)) ?? null, [houseIdByText]);

  const facts = useMemo<HouseRowFacts[]>(
    () =>
      drafts.map((row) => ({
        row,
        duplicate: duplicateRowIds.has(row.id),
        profile: row.house_profile_id ? profileById.get(row.house_profile_id) ?? null : null,
        resolveHouseId,
        reviewed: reviewed.has(row.id),
      })),
    [drafts, duplicateRowIds, profileById, resolveHouseId, reviewed],
  );
  const filterCounts = useMemo(() => countByFilter(facts, HOUSE_ROW_FILTERS), [facts]);
  const houseFilterValid = !!houseFilter && profileById.has(houseFilter);

  const visibleFacts = useMemo(() => {
    const byFilter = applyQuickFilter(facts, HOUSE_ROW_FILTERS, filter);
    return byFilter.filter((item) => {
      if (houseFilterValid && !houseRowIsIn(item, houseFilter as string)) return false;
      if (auto && placementFilter !== 'all' && (placementFilter === 'override') !== isOverridden(item.row)) return false;
      const name = (item.row.member_id && memberNames.get(item.row.member_id)) || item.row.source_name;
      return matchesText(search, name, item.row.source_name);
    });
  }, [facts, filter, houseFilter, houseFilterValid, search, memberNames, auto, placementFilter]);
  const visibleRows = useMemo(() => visibleFacts.map((item) => item.row), [visibleFacts]);

  // Possible duplicates the admin should see before locking.
  const conflicts = useMemo(() => {
    const identities = drafts
      .filter((row) => row.member_id)
      .map((row) => ({ id: row.id, label: (row.member_id && memberNames.get(row.member_id)) || row.source_name, memberId: row.member_id }));
    const houses = drafts
      .filter((row) => row.member_id)
      .map((row) => ({
        id: row.id,
        label: (row.member_id && memberNames.get(row.member_id)) || row.source_name,
        memberId: row.member_id,
        houseId: row.house_profile_id,
        houseLabel: row.house_profile_id ? profileById.get(row.house_profile_id)?.display_name ?? null : null,
      }));
    const twoHouses = findPersonInTwoHouses(houses);
    const flagged = new Set(twoHouses.flatMap((group) => group.items.map((item) => item.id)));
    const sameMember = findSameMemberTwice(identities.filter((item) => !flagged.has(item.id)), 'same_member_twice', 'row');
    return [...twoHouses, ...sameMember];
  }, [drafts, memberNames, profileById]);

  useEffect(() => {
    if (highlightRowId) document.getElementById(`house-row-${highlightRowId}`)?.scrollIntoView?.({ block: 'center' });
  }, [highlightRowId]);

  useEffect(
    () =>
      setSelected((current) => {
        const next = pruneSelection(current, draftIds);
        return next.size === current.size ? current : next;
      }),
    [draftIds],
  );

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  function patchLocal(rowId: string, patch: Partial<HouseAssignmentDraft>) {
    setDrafts((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  const houseNameOf = (profileId: string | null | undefined) => (profileId && profileById.get(profileId) ? houseLabel(profileById.get(profileId) as HouseProfileLite) : null);
  const personNameOf = (row: HouseAssignmentDraft) => (row.member_id && memberNames.get(row.member_id)) || row.source_name;

  function logHouseChange(row: HouseAssignmentDraft, patch: Partial<HouseAssignmentDraft>) {
    if (!('house_profile_id' in patch) || (patch.house_profile_id ?? null) === (row.house_profile_id ?? null)) return;
    logAdminActivity({
      action: ACTIVITY_ACTIONS.houseAssignmentChanged,
      entityType: 'house_assignment_draft',
      entityId: row.id,
      academicYearStart: batch.academic_year_start,
      summary: activitySummary.houseChanged(personNameOf(row), houseNameOf(row.house_profile_id), houseNameOf(patch.house_profile_id)),
      // The one-row House undo can't restore an automatic batch's swap partner
      // or override reason, so automatic batches log without an undo action.
      metadata: auto
        ? undefined
        : buildUndoMetadata({
            kind: 'house_draft_house',
            target: { batchId: batch.id, draftId: row.id },
            before: row.house_profile_id ?? null,
            after: patch.house_profile_id ?? null,
          }),
    });
  }

  function editRow(row: HouseAssignmentDraft, patch: Partial<HouseAssignmentDraft>, failure = 'Failed to update the row.') {
    return run(async () => {
      await houseAssignmentsRepository.updateDraft(batch.id, row.id, patch);
      patchLocal(row.id, patch);
      logHouseChange(row, patch);
    }, failure);
  }

  function setMember(row: HouseAssignmentDraft, memberId: string | null) {
    return editRow(row, memberId
      ? { member_id: memberId, match_status: 'manual', match_method: 'manual', match_score: null }
      : { member_id: null, match_status: 'unmatched', match_method: null, match_score: null });
  }

  function acceptSuggestion(suggestion: BalanceSuggestion) {
    const row = drafts.find((item) => item.id === suggestion.rowId);
    if (!row) return;
    return editRow(row, { house_profile_id: suggestion.toProfileId }, 'Failed to apply the suggestion.');
  }

  // ─── Automatic placement: overrides ────────────────────────────────────────
  const priorityOrdered = useMemo(
    () => [...drafts].sort((a, b) => a.source_order - b.source_order || a.id.localeCompare(b.id)),
    [drafts],
  );
  const placedIn = useCallback((houseId: string) => drafts.filter((row) => row.house_profile_id === houseId).length, [drafts]);
  const preferenceLabels = (row: HouseAssignmentDraft) => readPreferences(row.preferences).map((id) => houseNameOf(id) ?? id);

  function planOverride(row: HouseAssignmentDraft, toHouseId: string, swapWithId: string | null): OverridePlan {
    const moves: OverrideMove[] = [];
    if (!toHouseId || toHouseId === row.house_profile_id) return { moves, error: 'Choose a different House.', breaksPriority: false };
    const capacity = capacityConfig?.[toHouseId];
    if (capacity === undefined) return { moves, error: 'That House has no capacity in this placement.', breaksPriority: false };
    const partner = swapWithId ? drafts.find((item) => item.id === swapWithId) ?? null : null;
    if (partner && partner.house_profile_id !== toHouseId) return { moves, error: 'Choose someone currently in that House to swap with.', breaksPriority: false };
    if (!partner && placedIn(toHouseId) + 1 > capacity) {
      return { moves, error: `${houseNameOf(toHouseId)} is full (${capacity}). Choose someone to swap with, or the move would exceed capacity.`, breaksPriority: false };
    }
    moves.push({ row, from: row.house_profile_id, to: toHouseId });
    if (partner) moves.push({ row: partner, from: partner.house_profile_id, to: row.house_profile_id });
    const after = new Map(moves.map((move) => [move.row.id, move.to]));
    const breaksPriority = findPriorityViolations(priorityOrdered.map((item) => ({
      id: item.id,
      preferences: readPreferences(item.preferences),
      houseId: after.has(item.id) ? after.get(item.id) ?? null : item.house_profile_id,
    }))).length > 0;
    return { moves, error: null, breaksPriority };
  }

  /**
   * Applies a move or swap through the transactional override RPC, then shows
   * the rows the database returned. On any failure the persisted rows are
   * reloaded, so the screen never shows a half-applied change.
   */
  function commitOverride(moves: OverrideMove[], reason: string | null, success: string, failure: string) {
    return run(async () => {
      let updated: HouseAssignmentDraft[];
      try {
        updated = await houseAssignmentsRepository.applyPlacementOverride(
          batch.id,
          moves.map((move) => ({ draftId: move.row.id, houseProfileId: move.to as string })),
          reason,
        );
      } catch (err) {
        try {
          setDrafts(await houseAssignmentsRepository.getDrafts(batch.id));
        } catch (reloadErr) {
          console.error(reloadErr);
          throw new Error(`${err instanceof Error && err.message ? err.message : failure} The saved rows could not be reloaded; refresh the page before making more changes.`);
        }
        throw new Error(`${err instanceof Error && err.message ? err.message : failure} The rows were reloaded from the saved draft.`);
      }
      const byId = new Map(updated.map((row) => [row.id, row]));
      setDrafts((current) => current.map((row) => byId.get(row.id) ?? row));
      for (const move of moves) {
        logAdminActivity({
          action: ACTIVITY_ACTIONS.houseAssignmentChanged,
          entityType: 'house_assignment_draft',
          entityId: move.row.id,
          academicYearStart: batch.academic_year_start,
          summary: reason
            ? `${activitySummary.houseChanged(personNameOf(move.row), houseNameOf(move.from), houseNameOf(move.to))} Manual override of the automatic placement: ${reason}`
            : `${activitySummary.houseChanged(personNameOf(move.row), houseNameOf(move.from), houseNameOf(move.to))} Restored the automatic placement.`,
        });
      }
      setOverrideRowId(null);
      toast.success(success);
    }, failure);
  }

  function applyOverride(plan: OverridePlan, reason: string) {
    const why = reason.trim();
    if (!why) {
      toast.error('A reason is required for a manual override.');
      return;
    }
    if (plan.error || plan.moves.length === 0) {
      toast.error(plan.error ?? 'Nothing to change.');
      return;
    }
    return commitOverride(
      plan.moves,
      why,
      plan.moves.length > 1 ? 'Swapped. Both rows are marked as manual overrides.' : 'Moved. The row is marked as a manual override.',
      'Failed to apply the override.',
    );
  }

  const exportRows = useMemo(
    () => exportRowsFromDrafts(drafts, {
      houseLabel: (id) => houseNameOf(id),
      memberName: (id) => memberNames.get(id) ?? null,
    }),
    // houseNameOf only reads profileById.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, memberNames, profileById],
  );

  function restoreAutomatic(row: HouseAssignmentDraft) {
    const target = row.generated_house_profile_id;
    if (!target) return;
    const capacity = capacityConfig?.[target] ?? 0;
    if (placedIn(target) + 1 > capacity) {
      toast.error(`${houseNameOf(target)} is full. Swap someone out of it instead.`);
      return;
    }
    return commitOverride(
      [{ row, from: row.house_profile_id, to: target }],
      null,
      'Restored the automatic placement.',
      'Failed to restore the automatic placement.',
    );
  }

  function removeRow(row: HouseAssignmentDraft) {
    return run(async () => {
      await houseAssignmentsRepository.removeDraft(batch.id, row.id);
      setDrafts((current) => current.filter((item) => item.id !== row.id));
    }, 'Failed to remove the row.');
  }

  function addPerson() {
    const member = addMemberId ? memberById.get(addMemberId) : null;
    if (!member) {
      toast.error('Choose a member to add.');
      return;
    }
    return run(async () => {
      const nextOrder = drafts.reduce((max, row) => Math.max(max, row.source_order), -1) + 1;
      const created = await houseAssignmentsRepository.addDraft(batch.id, {
        source_name: getMemberName(member),
        source_house: null,
        member_id: member.id,
        house_profile_id: addHouseId || null,
        match_status: 'manual',
        match_method: 'manual',
        notes: 'Added manually.',
        source_order: nextOrder,
      });
      setDrafts((current) => [...current, created]);
      setAddMemberId(null);
      setAddHouseId('');
    }, 'Failed to add the person.');
  }

  // ─── Bulk actions ──────────────────────────────────────────────────────────
  const [bulkHouseId, setBulkHouseId] = useState('');
  const selectedRowList = useMemo(() => selectedRows(drafts, selected, (row) => row.id), [drafts, selected]);
  const assignPlan = useMemo(() => planHouseAssign(selectedRowList, bulkHouseId, editable), [selectedRowList, bulkHouseId, editable]);
  const clearPlan = useMemo(() => planHouseClear(selectedRowList, editable), [selectedRowList, editable]);
  const reviewPlan = useMemo(() => planMarkReviewed(selectedRowList, reviewed), [selectedRowList, reviewed]);

  function bulkAssign() {
    if (!bulkHouseId) {
      toast.error('Choose a House first.');
      return;
    }
    const target = assignPlan.eligible;
    if (target.length === 0) {
      toast.error(assignPlan.skipped[0]?.reason ?? 'Nothing to change.');
      return;
    }
    return run(async () => {
      let done = 0;
      try {
        await runBulkWrites(async () => {
          for (const row of target) {
            await houseAssignmentsRepository.updateDraft(batch.id, row.id, { house_profile_id: bulkHouseId });
            patchLocal(row.id, { house_profile_id: bulkHouseId });
            done += 1;
          }
        });
      } catch (failure) {
        if (done > 0) toast.error(`Assigned ${done} of ${target.length} rows before it failed. The rest were not changed.`);
        throw failure;
      }
      logAdminActivity({
        action: ACTIVITY_ACTIONS.houseBulkChanged,
        entityType: 'house_assignment_batch',
        entityId: batch.id,
        academicYearStart: batch.academic_year_start,
        summary: activitySummary.houseBulk(target.length, houseNameOf(bulkHouseId)),
      });
      toast.success(`Assigned ${target.length} ${target.length === 1 ? 'row' : 'rows'} to ${houseNameOf(bulkHouseId)}.${assignPlan.skipped.length ? ` ${assignPlan.skipped.length} skipped.` : ''}`);
      setSelected(new Set());
    }, 'Failed to assign the selected rows.');
  }

  function bulkClear() {
    const target = clearPlan.eligible;
    return run(async () => {
      let done = 0;
      try {
        await runBulkWrites(async () => {
          for (const row of target) {
            await houseAssignmentsRepository.updateDraft(batch.id, row.id, { house_profile_id: null });
            patchLocal(row.id, { house_profile_id: null });
            done += 1;
          }
        });
      } catch (failure) {
        if (done > 0) toast.error(`Cleared ${done} of ${target.length} rows before it failed. The rest were not changed.`);
        throw failure;
      }
      logAdminActivity({
        action: ACTIVITY_ACTIONS.houseBulkChanged,
        entityType: 'house_assignment_batch',
        entityId: batch.id,
        academicYearStart: batch.academic_year_start,
        summary: activitySummary.houseBulk(target.length, null),
      });
      toast.success(`Cleared the House on ${target.length} ${target.length === 1 ? 'row' : 'rows'}.`);
      setPendingClear(false);
      setSelected(new Set());
    }, 'Failed to clear the selected rows.');
  }

  function bulkMarkReviewed() {
    return run(async () => {
      if (reviewPlan.eligible.length === 0) {
        toast('All selected rows are already reviewed.');
        return;
      }
      await markReviewed(reviewPlan.eligible.map((row) => row.id));
      toast.success(`Marked ${reviewPlan.eligible.length} reviewed.`);
      setSelected(new Set());
    }, 'Failed to mark rows reviewed.');
  }

  async function refreshBatch() {
    const fresh = await houseAssignmentsRepository.getBatch(batch.id);
    setBatch(fresh);
    onBatchChanged();
  }

  function lock() {
    return run(async () => {
      await houseAssignmentsRepository.lockBatch(batch.id, memberNames);
      await refreshBatch();
      logAdminActivity({
        action: ACTIVITY_ACTIONS.houseBatchLocked,
        entityType: 'house_assignment_batch',
        entityId: batch.id,
        academicYearStart: batch.academic_year_start,
        summary: activitySummary.cycleLocked('House', batch.academic_year_start),
      });
      setNextStep(nextStepFor({ type: 'house_locked' }));
      toast.success('Locked. Nothing is public until you reveal.');
    }, 'Failed to lock.');
  }

  function reopen() {
    return run(async () => {
      await houseAssignmentsRepository.reopenBatch(batch.id);
      setRevealConfirmed(false);
      await refreshBatch();
      logAdminActivity({
        action: ACTIVITY_ACTIONS.houseBatchReopened,
        entityType: 'house_assignment_batch',
        entityId: batch.id,
        academicYearStart: batch.academic_year_start,
        summary: activitySummary.cycleUnlocked('House', batch.academic_year_start),
      });
      toast.success('Reopened for editing.');
    }, 'Failed to reopen.');
  }

  function reveal() {
    if (!readiness.canReveal) return Promise.resolve();
    return run(async () => {
      const result = await houseAssignmentsRepository.publishBatch(batch.id, userId);
      await refreshBatch();
      setRevealConfirmed(false);
      if (!result.alreadyPublished) {
        logAdminActivity({
          action: ACTIVITY_ACTIONS.houseBatchPublished,
          entityType: 'house_assignment_batch',
          entityId: batch.id,
          academicYearStart: batch.academic_year_start,
          summary: activitySummary.published('House assignments', batch.academic_year_start, result.applied),
        });
      }
      toast.success(
        result.alreadyPublished
          ? 'Already revealed.'
          : `Revealed: ${result.applied} membership${result.applied === 1 ? '' : 's'} created${result.skipped ? `, ${result.skipped} already in place` : ''}.`,
      );
      // Public lookups and House pages in this browser show the new Houses at once.
      queryClient.invalidateQueries('find-my-points');
      queryClient.invalidateQueries({ predicate: (query) => {
        const [first, second] = Array.isArray(query.queryKey) ? query.queryKey : [query.queryKey];
        return [first, second].some((part) => typeof part === 'string' && part.startsWith('house'));
      } });
      onPublished();
    }, 'Failed to reveal. Nothing was lost; fix the issue and reveal again.');
  }

  // Runs from the confirm dialog. A failure is re-thrown so the dialog stays
  // open and shows it. deleteBatch only accepts a draft, so a published batch
  // and its House memberships can never be removed from here.
  async function deleteDraft() {
    setBusy(true);
    try {
      await houseAssignmentsRepository.deleteBatch(batch.id);
      toast.success('Draft deleted.');
      onBatchChanged();
      onBack();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message ? err.message : 'Failed to delete the draft.';
      toast.error(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }

  const toneBlock = 'rounded border p-3 text-xs';
  const imbalance = balance.imbalance;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-2 bg-transparent p-0 text-xs font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }}>
            ← All drafts
          </button>
          <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {formatAcademicYear(batch.academic_year_start)} House assignments
          </h2>
          <YearContextBadge context={describeYearContext(batch.academic_year_start, operatingYear)} className="mt-1" />
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
            {batchBadge(batch.status)} · effective {batch.effective_start_date}
            {batch.source_label ? ` · ${batch.source_label}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {batch.status === 'draft' && (
            <>
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                Delete draft
              </button>
              <button type="button" onClick={lock} disabled={busy || !preflight.canLock} className="vsa-btn-primary px-5 py-2 text-xs disabled:opacity-50">
                Lock assignments
              </button>
            </>
          )}
          <ConfirmDialog
            open={confirmDelete}
            title={`Delete the ${formatAcademicYear(batch.academic_year_start)} House draft?`}
            description={`This deletes the draft and its ${drafts.length} assignment ${drafts.length === 1 ? 'row' : 'rows'}, including edits made here. It cannot be undone.`}
            consequences={[
              'Only the draft is removed. Published House assignments and memberships are not affected.',
              'A draft has not been revealed, so no member’s House changes.',
            ]}
            confirmLabel="Delete draft"
            onConfirm={deleteDraft}
            onClose={() => setConfirmDelete(false)}
          />
          {batch.status === 'locked' && (
            <button type="button" onClick={reopen} disabled={busy} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
              Reopen draft
            </button>
          )}
        </div>
      </div>

      {auto && (
        <HousePaymentGateCard
          batch={batch}
          drafts={drafts}
          profiles={profiles}
          userId={userId}
          blockers={paymentGate.isLoading ? undefined : paymentGate.data}
          blockersFailed={paymentGate.isError}
          onOpenBatch={onOpenBatch}
        />
      )}

      {batch.status === 'locked' && (
        <HouseRevealReadinessPanel readiness={readiness} assigned={preflight.assigned} yearLabel={formatAcademicYear(batch.academic_year_start)} />
      )}

      {batch.status === 'locked' && (
        <div className={toneBlock} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Locked — still private.</p>
          <p className="mt-1">
            Revealing creates {preflight.assigned} dated House membership{preflight.assigned === 1 ? '' : 's'} starting {batch.effective_start_date} and refreshes the legacy House label on each member. Earlier event attendance keeps individual points but does not earn House points.
          </p>
          <label className="mt-3 flex cursor-pointer select-none items-start gap-2">
            <input
              type="checkbox"
              checked={revealConfirmed}
              onChange={(event) => setRevealConfirmed(event.target.checked)}
              className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]"
            />
            <span style={{ color: 'var(--color-text)' }}>
              I confirm: reveal these {preflight.assigned} assignments for {formatAcademicYear(batch.academic_year_start)}.
            </span>
          </label>
          <button type="button" onClick={reveal} disabled={busy || !revealConfirmed || preflight.blockers.length > 0 || !readiness.canReveal} className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50">
            {busy ? 'Revealing…' : 'Reveal House assignments'}
          </button>
        </div>
      )}
      {batch.status === 'published' && (
        <div className={toneBlock} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
          Revealed {batch.published_at ? new Date(batch.published_at).toLocaleString() : ''}. This batch is read-only.
        </div>
      )}

      <NextStepBanner step={nextStep} onFilter={setFilter} onPreview={() => setPreviewOpen(true)} onDismiss={() => setNextStep(null)} />

      <WorkflowProgress
        title={`${formatYearSpan(batch.academic_year_start)} Houses`}
        steps={houseProgress({
          status: batch.status,
          rows: drafts.length,
          matched: drafts.filter((row) => !!row.member_id && (row.match_status === 'match' || row.match_status === 'manual')).length,
          assigned: counts.perHouse.reduce((sum, house) => sum + house.count, 0),
        })}
      />

      {(batch.status === 'draft' || batch.status === 'locked') && drafts.length > 0 && (
        <div>
          <button type="button" onClick={() => setPreviewOpen(true)} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            Preview reveal
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="House counts">
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>House counts</h3>
          <dl className="mt-3 space-y-1.5 font-mono text-sm">
            {counts.perHouse.map((entry) => (
              <div key={entry.profileId} className="flex justify-between gap-4" data-testid={`house-count-${entry.label}`}>
                <dt style={{ color: 'var(--color-text2)' }}>{entry.label}</dt>
                <dd style={{ color: 'var(--color-text)' }}>{entry.count}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-1.5" style={{ borderColor: 'var(--color-border)' }} data-testid="house-count-Unassigned">
              <dt style={{ color: 'var(--color-text2)' }}>Unassigned</dt>
              <dd style={{ color: 'var(--color-text)' }}>{counts.unassigned}</dd>
            </div>
          </dl>
          {counts.needsMember > 0 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text3)' }}>
              {counts.needsMember} more row{counts.needsMember === 1 ? ' has' : 's have'} a House but no confirmed member yet.
            </p>
          )}
        </section>

        <ReadinessPanel
          readiness={buildReadiness(houseIssues(preflight), { ready: batch.status === 'locked' ? 'Ready to Reveal' : 'Ready to Lock' })}
          onFilter={setFilter}
          passed={[`${preflight.applicants} applicants`, `${preflight.assigned} assigned`]}
        />
      </div>

      <PossibleDuplicates duplicates={conflicts} onCompare={() => setFilter('duplicates')} />

      {auto ? (
        <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Automatic placement">
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Automatic placement · first-come, first-served</h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
            Generated by submission time, then ranked choices, within these capacities. Rows move only through a documented override. Every applicant must be linked to a member before locking; nobody is skipped at reveal.
          </p>
          <div className="mt-3 space-y-2">
            {activeProfiles.map((profile) => {
              const count = placedIn(profile.id);
              const capacity = capacityConfig?.[profile.id];
              return (
                <div key={profile.id} className="flex justify-between gap-4 font-mono text-sm" data-testid={`placement-capacity-${houseLabel(profile)}`}>
                  <span style={{ color: 'var(--color-text2)' }}>{houseLabel(profile)}</span>
                  <span className={capacity !== undefined && count > capacity ? 'text-red-600 dark:text-red-400' : undefined} style={capacity !== undefined && count > capacity ? undefined : { color: 'var(--color-text)' }}>
                    {count} / {capacity ?? '?'}
                  </span>
                </div>
              );
            })}
          </div>
          {readExcludedApplicants(batch.excluded_applicants).length > 0 && (
            <details className="mt-3 text-xs" style={{ color: 'var(--color-text2)' }}>
              <summary className="cursor-pointer font-semibold">{readExcludedApplicants(batch.excluded_applicants).length} not placed (excluded or repeat submission)</summary>
              <ul className="mt-1 space-y-0.5">
                {readExcludedApplicants(batch.excluded_applicants).map((item) => (
                  <li key={item.source_row_number}>Row {item.source_row_number} · {item.name || 'no name'} — {item.reason}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4">
            <HousePlacementExportPanel
              rows={exportRows}
              houses={activeProfiles.map((profile) => ({ id: profile.id, label: houseLabel(profile) }))}
              academicYearStart={batch.academic_year_start}
            />
          </div>
        </section>
      ) : (
      <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Balance helper">
        <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Balance helper</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
          Suggestions only. Nobody moves until you accept it.
        </p>
        {imbalance ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--color-text)' }}>
            {imbalance.largest.label} has {imbalance.gap} more member{imbalance.gap === 1 ? '' : 's'} than {imbalance.smallest.label}.
          </p>
        ) : (
          <p className="mt-3 text-sm" style={{ color: 'var(--color-text)' }}>The Houses are evenly sized.</p>
        )}
        {balance.unassigned.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text2)' }}>
            Unassigned: {balance.unassigned.map((row) => (row.member_id && memberNames.get(row.member_id)) || row.source_name).join(', ')}
          </p>
        )}
        {!balance.hasPreferences ? (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text3)' }}>
            This sheet has no House preferences, so there are no suggestions. Move people by hand in the table below.
          </p>
        ) : balance.suggestions.length === 0 ? (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text3)' }}>No preference-based moves would improve balance.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {balance.suggestions.map((suggestion) => (
              <li key={suggestion.rowId} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {suggestion.name} → {houseLabel(profileById.get(suggestion.toProfileId) as HouseProfileLite)}
                  </p>
                  <p style={{ color: 'var(--color-text3)' }}>Reason: {suggestion.reason}</p>
                </div>
                <button type="button" disabled={busy || !editable} onClick={() => acceptSuggestion(suggestion)} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  Accept
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      <section className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Assignment rows">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Rows</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rows…"
              aria-label="Search rows"
              className="rounded border px-2 py-1.5 text-xs"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
            />
            <select
              value={houseFilterValid ? (houseFilter as string) : ''}
              onChange={(event) => setHouseFilter(event.target.value || null)}
              aria-label="Filter by House"
              className={`${selectCls} w-auto`}
              style={{ borderColor: 'var(--color-border)' }}
            >
              <option value="">By House: all</option>
              {activeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{houseLabel(profile)}</option>
              ))}
            </select>
            {auto && (
              <select
                value={placementFilter}
                onChange={(event) => setPlacementFilter(event.target.value as typeof placementFilter)}
                aria-label="Filter by placement"
                className={`${selectCls} w-auto`}
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="all">Placement: all</option>
                <option value="automatic">Automatically assigned</option>
                <option value="override">Manually overridden</option>
              </select>
            )}
          </div>
        </div>

        <div className="border-b px-5 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <FilterChips filters={HOUSE_ROW_FILTERS} counts={filterCounts} active={filter} onChange={setFilter} label="Filter rows" />
        </div>

        <BulkActionBar count={selected.size} noun="row" onClear={() => { setSelected(new Set()); setPendingClear(false); }}>
          {editable && !auto && (
            <>
              <label htmlFor="bulk-house" className="sr-only">House for selected rows</label>
              <select id="bulk-house" value={bulkHouseId} onChange={(event) => setBulkHouseId(event.target.value)} className={`${selectCls} w-auto`} style={{ borderColor: 'var(--color-border)' }}>
                <option value="">Assign selected →</option>
                {activeProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{houseLabel(profile)}</option>
                ))}
              </select>
              <button type="button" disabled={busy || !bulkHouseId} onClick={bulkAssign} className={bulkBtnCls}>Assign</button>
              <button type="button" disabled={busy} onClick={() => setPendingClear(true)} className={bulkBtnCls}>Clear assignment</button>
            </>
          )}
          <button type="button" disabled={busy} onClick={bulkMarkReviewed} className={bulkBtnCls}>Mark reviewed</button>
        </BulkActionBar>
        {pendingClear && selected.size > 0 && (
          <BulkConfirm plan={clearPlan} busy={busy} onConfirm={bulkClear} onCancel={() => setPendingClear(false)} skippedLabel={(row) => personNameOf(row)} />
        )}

        {editable && !auto && (
          <div className="flex flex-wrap items-end gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="min-w-[240px] flex-1">
              <span className={labelCls} style={{ color: 'var(--color-text3)' }}>Add someone manually</span>
              <MemberSearchSelect members={members} value={addMemberId} onChange={setAddMemberId} label="new row" disabled={busy} />
            </div>
            <div className="min-w-[160px]">
              <label htmlFor="add-house" className={labelCls} style={{ color: 'var(--color-text3)' }}>House</label>
              <select id="add-house" value={addHouseId} onChange={(event) => setAddHouseId(event.target.value)} className={selectCls} style={{ borderColor: 'var(--color-border)' }}>
                <option value="">Unassigned</option>
                {activeProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{houseLabel(profile)}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={addPerson} disabled={busy || !addMemberId} className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              Add
            </button>
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No House assignment rows yet."
              description="Add someone manually above, or go back and import a sheet."
              action={{ label: 'Back to Import Assignments', onClick: onBack }}
            />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
            No rows match this filter.{' '}
            <button type="button" onClick={() => { setFilter('all'); setHouseFilter(null); setSearch(''); }} className="bg-transparent p-0 font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--brand)' }}>
              Show all {drafts.length}
            </button>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="w-10 px-4 py-3 text-left">
                    <RowCheckbox
                      checked={visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.id))}
                      onChange={() => setSelected(setSelection(visibleRows.map((row) => row.id), !visibleRows.every((row) => selected.has(row.id))))}
                      label="Select all visible rows"
                    />
                  </th>
                  {[auto ? 'Applicant' : 'Sheet entry', 'Member', 'House', 'Match', ''].map((heading) => (
                    <th key={heading || 'actions'} className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {visibleRows.map((row) => {
                  const profile = row.house_profile_id ? profileById.get(row.house_profile_id) : null;
                  const brokenHouse = (!!row.house_profile_id && !profile?.is_active) || (!row.house_profile_id && !!row.source_house);
                  const prefs = auto ? preferenceLabels(row) : readPreferences(row.preferences);
                  const rank = auto ? achievedRank(row) : null;
                  const overridden = auto && isOverridden(row);
                  return (
                    <Fragment key={row.id}>
                    <tr id={`house-row-${row.id}`} data-testid="house-draft-row" data-reviewed={reviewed.has(row.id)} data-highlighted={row.id === highlightRowId} className={row.id === highlightRowId ? 'bg-brand-600/10 dark:bg-brand-400/10' : undefined}>
                      <td className="px-4 py-3 align-top">
                        <RowCheckbox checked={selected.has(row.id)} onChange={() => setSelected((current) => toggleSelected(current, row.id))} label={`Select ${row.source_name}`} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
                          {auto && <span className="mr-1 font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>#{row.source_order + 1}</span>}
                          {row.source_name || '—'}
                        </p>
                        {auto && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>Submitted {formatFormTime(row.submission_timestamp)} · sheet row {row.source_row_number ?? '—'}</p>}
                        {reviewed.has(row.id) && <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-green-700 dark:text-green-400">✓ Reviewed</p>}
                        {prefs.length > 0 && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>Prefers: {prefs.join(' › ')}</p>}
                        {duplicateRowIds.has(row.id) && <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">Duplicate member</p>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <MemberSearchSelect
                          members={members}
                          value={row.member_id}
                          onChange={(memberId) => setMember(row, memberId)}
                          disabled={busy || !editable}
                          label={row.source_name}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {auto ? (
                          <div>
                            <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{houseNameOf(row.house_profile_id) ?? 'Unassigned'}</p>
                            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>{rank ? `${ordinal(rank)} choice` : 'Not ranked'}</p>
                            <p className={`mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${overridden ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                              {overridden ? 'Manually overridden' : 'Automatically assigned'}
                            </p>
                            {overridden && (
                              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text2)' }}>
                                Automatic: {houseNameOf(row.generated_house_profile_id) ?? '—'}. Reason: {row.override_reason || 'none recorded'}
                              </p>
                            )}
                            {editable && (
                              <div className="mt-1 flex gap-3">
                                <button type="button" disabled={busy} onClick={() => setOverrideRowId(overrideRowId === row.id ? null : row.id)} className="bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--brand)' }}>
                                  Override…
                                </button>
                                {overridden && (
                                  <button type="button" disabled={busy} onClick={() => restoreAutomatic(row)} className="bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }}>
                                    Restore automatic
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                        <select
                          value={row.house_profile_id ?? ''}
                          disabled={busy || !editable}
                          onChange={(event) => editRow(row, { house_profile_id: event.target.value || null })}
                          aria-label={`House for ${row.source_name}`}
                          className={selectCls}
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <option value="">Unassigned</option>
                          {activeProfiles.map((option) => (
                            <option key={option.id} value={option.id}>{houseLabel(option)}</option>
                          ))}
                        </select>
                        )}
                        {brokenHouse && (
                          <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                            {row.source_house ? `"${row.source_house}" has no profile this year.` : 'House profile unavailable.'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className={`font-mono text-[11px] font-bold uppercase ${statusTone(row.match_status)}`}>{row.match_status}</p>
                        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>
                          {row.match_method && row.match_score != null ? `${row.match_score}% ${row.match_method}` : row.match_method ?? ''}
                        </p>
                        {row.notes && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>{row.notes}</p>}
                        {editable && row.match_status === 'review' && row.member_id && (
                          <button type="button" disabled={busy} onClick={() => editRow(row, { match_status: 'manual' })} className="mt-1 bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--brand)' }}>
                            Confirm match
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {editable && !auto && (
                          <button type="button" disabled={busy} onClick={() => removeRow(row)} aria-label={`Remove ${row.source_name}`} className="bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                    {auto && editable && overrideRowId === row.id && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-4">
                          <OverrideForm
                            row={row}
                            profiles={profiles}
                            drafts={drafts}
                            houseNameOf={houseNameOf}
                            personNameOf={personNameOf}
                            plan={(toHouseId, swapWithId) => planOverride(row, toHouseId, swapWithId)}
                            busy={busy}
                            onApply={applyOverride}
                            onCancel={() => setOverrideRowId(null)}
                          />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {previewOpen && (
        <HouseRevealPreviewDialog
          yearLabel={formatYearSpan(batch.academic_year_start)}
          effectiveDate={batch.effective_start_date}
          houses={counts.perHouse.map((house) => ({
            label: house.label,
            members: drafts
              .filter((row) => row.house_profile_id === house.profileId && !!row.member_id && (row.match_status === 'match' || row.match_status === 'manual'))
              .map((row) => personNameOf(row))
              .sort((a, b) => a.localeCompare(b)),
          }))}
          notRevealed={drafts.filter((row) => !row.house_profile_id || !row.member_id).length}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
