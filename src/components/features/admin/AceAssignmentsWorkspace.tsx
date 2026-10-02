import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from 'react-query';
import { aceAssignmentsRepository, AceAssignmentDraftPatch } from '../../../data/repos/aceAssignments';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { toUserMessage } from '../../../data/errors';
import {
  ACE_ASSIGNMENT_CYCLES_KEY,
  ACE_NODE_REFS_KEY,
  aceAssignmentDraftsKey,
  useAceAssignmentCycles,
  useAceAssignmentDrafts,
  useAceNodeRefs,
} from '../../../hooks/useAceAssignments';
import { ACE_MEMBER_LINKS_QUERY_KEY } from '../../../hooks/useAceFamilies';
import { useMemberDirectory } from '../../../hooks/useMemberDirectory';
import { useOperatingYear } from '../../../hooks/useOperatingYear';
import { useReviewMarks } from '../../../hooks/useReviewMarks';
import { useUrlFilter } from '../../../hooks/useUrlFilter';
import {
  ACTIVITY_ACTIONS,
  activitySummary,
  buildUndoMetadata,
} from '../../../lib/adminActivity';
import { planAceLinkExactMatches, planMarkReviewed, pruneSelection, selectedRows, setSelection, toggleSelected } from '../../../lib/adminBulk';
import { findAceLittleDuplicates } from '../../../lib/adminConflicts';
import { applyQuickFilter, countByFilter } from '../../../lib/adminFilters';
import { NextStep, nextStepFor } from '../../../lib/adminNextSteps';
import { aceProgress } from '../../../lib/adminProgress';
import { ACE_DRAFT_FILTERS, ACE_DRAFT_FILTER_KEYS, AceDraftFacts } from '../../../lib/adminQueues';
import { describeYearContext } from '../../../lib/adminYearContext';
import {
  ImportResolution,
  buildPublishPreview,
  computeBigLoad,
  computePreflight,
  formatAcademicYear,
  isCycleEditable,
  reviewUnlinkedLittles,
  selectBulkLittleLinks,
} from '../../../lib/aceAssignments';
import { AceAssignmentCycle, AceAssignmentDraft } from '../../../types';
import { AceAssignmentImportPanel } from './AceAssignmentImportPanel';
import { AceAssignmentPreflightPanel } from './AceAssignmentPreflightPanel';
import { AceAssignmentRow } from './AceAssignmentRow';
import {
  BulkActionBar,
  EmptyState,
  FilterChips,
  NextStepBanner,
  PossibleDuplicates,
  RowCheckbox,
  WorkflowProgress,
  YearContextBadge,
  bulkBtnCls,
} from './ops';

const STATUS_COPY: Record<AceAssignmentCycle['status'], { label: string; hint: string }> = {
  draft: { label: 'Draft', hint: 'Private. Edit freely; nothing here is public.' },
  locked: { label: 'Locked', hint: 'Frozen for final review. Still private: locking does not publish anything.' },
  published: { label: 'Published', hint: 'These Littles are now on the public ACE tree.' },
  archived: { label: 'Archived', hint: 'Kept for reference.' },
};

const primaryBtnCls =
  'rounded border-0 bg-[var(--color-text)] px-3 py-1.5 font-sans text-xs font-medium text-[var(--color-bg)] disabled:opacity-50';
const ghostBtnCls =
  'rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 font-sans text-xs font-medium text-[var(--color-text2)] transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';
const inputCls =
  'rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 font-sans text-sm text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]';

function currentAcademicYearStart(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-serif text-2xl font-bold text-[var(--color-text)]">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text3)]">{label}</p>
    </div>
  );
}

/**
 * Admin → ACE → Assignments. Drafts the upcoming Big/Little sorting in
 * private tables, then lock → preflight → publish. Only Publish touches the
 * live ACE tree. Every edit saves to the draft record as it is made; filters,
 * bulk actions, the activity log, and undo sit on top of that.
 */
export function AceAssignmentsWorkspace() {
  const queryClient = useQueryClient();
  const operatingYear = useOperatingYear();
  const { cycles, loading: cyclesLoading, error: cyclesError } = useAceAssignmentCycles();
  const [pickedCycleId, setPickedCycleId] = useState<string | null>(null);
  const cycle = useMemo(
    () => cycles.find((c) => c.id === pickedCycleId) ?? cycles.find((c) => c.status !== 'archived') ?? null,
    [cycles, pickedCycleId],
  );
  const cycleId = cycle?.id ?? null;

  const { drafts, loading: draftsLoading, error: draftsError } = useAceAssignmentDrafts(cycleId);
  const { nodes, loading: nodesLoading, error: nodesError } = useAceNodeRefs(!!cycleId);
  const { byId: directoryById, nameIndex, loading: directoryLoading, error: directoryError } = useMemberDirectory(!!cycleId);

  const [busy, setBusy] = useState(false);
  const [newYear, setNewYear] = useState(String(currentAcademicYearStart()));
  const [newLittle, setNewLittle] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [filter, setFilter] = useUrlFilter(ACE_DRAFT_FILTER_KEYS);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [nextStep, setNextStep] = useState<NextStep | null>(null);

  const ready = !!cycle && !draftsLoading && !nodesLoading && !directoryLoading && !draftsError && !nodesError && !directoryError;
  const editable = !!cycle && isCycleEditable(cycle.status);
  const yearStart = cycle?.academic_year_start ?? null;

  const preflight = useMemo(
    () => (cycle && ready ? computePreflight(drafts, nodes, nameIndex, cycle.status) : null),
    [cycle, ready, drafts, nodes, nameIndex],
  );
  const issuesByDraft = useMemo(() => {
    const map = new Map<string, NonNullable<typeof preflight>['issues']>();
    for (const issue of preflight?.issues ?? []) {
      for (const id of issue.draftIds) map.set(id, [...(map.get(id) ?? []), issue]);
    }
    return map;
  }, [preflight]);
  const reviewItems = useMemo(() => reviewUnlinkedLittles(drafts, nameIndex), [drafts, nameIndex]);
  const reviewByDraft = useMemo(() => new Map(reviewItems.map((item) => [item.draft.id, item])), [reviewItems]);
  const obviousLinks = useMemo(() => selectBulkLittleLinks(reviewItems), [reviewItems]);
  const publishPreview = useMemo(() => buildPublishPreview(drafts, nodes), [drafts, nodes]);
  const loadFor = (bigId: string) => computeBigLoad(bigId, drafts, nodes);
  const nodeNameById = useMemo(() => new Map(nodes.map((node) => [node.id, node.name])), [nodes]);

  const draftIds = useMemo(() => drafts.map((draft) => draft.id), [drafts]);
  const { reviewed, markReviewed } = useReviewMarks('ace_assignment_draft', cycleId, draftIds, yearStart);

  const facts = useMemo<AceDraftFacts[]>(
    () =>
      drafts.map((draft) => ({
        draft,
        review: reviewByDraft.get(draft.id),
        issues: issuesByDraft.get(draft.id) ?? [],
        reviewed: reviewed.has(draft.id),
      })),
    [drafts, reviewByDraft, issuesByDraft, reviewed],
  );
  const counts = useMemo(() => countByFilter(facts, ACE_DRAFT_FILTERS), [facts]);
  const visible = useMemo(() => applyQuickFilter(facts, ACE_DRAFT_FILTERS, filter), [facts, filter]);
  const duplicates = useMemo(
    () => findAceLittleDuplicates(drafts.map((draft) => ({ id: draft.id, label: draft.little_name, memberId: draft.little_member_id }))),
    [drafts],
  );

  // Selection only ever refers to rows that still exist in this cycle.
  useEffect(
    () =>
      setSelected((current) => {
        const next = pruneSelection(current, draftIds);
        return next.size === current.size ? current : next;
      }),
    [draftIds],
  );
  useEffect(() => setSelected((current) => (current.size === 0 ? current : new Set())), [cycleId]);

  // "All current members linked": offer the preflight the moment the last Little gets linked.
  const wasAllLinked = useRef<boolean | null>(null);
  const allLinked = !!preflight && preflight.littleCount > 0 && preflight.linkedCount === preflight.littleCount;
  useEffect(() => {
    if (!preflight) return;
    if (wasAllLinked.current === false && allLinked) setNextStep(nextStepFor({ type: 'ace_all_linked' }));
    wasAllLinked.current = allLinked;
  }, [allLinked, preflight]);

  const refreshDrafts = () => queryClient.invalidateQueries(aceAssignmentDraftsKey(cycleId));
  const refreshCycles = () => queryClient.invalidateQueries(ACE_ASSIGNMENT_CYCLES_KEY);

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(toUserMessage(error, failure));
    } finally {
      setBusy(false);
    }
  }

  const createCycle = (event: FormEvent) => {
    event.preventDefault();
    const start = Number(newYear);
    if (!Number.isInteger(start) || start < 2000 || start > 2100) {
      toast.error('Enter a four-digit start year, like 2026.');
      return;
    }
    void run(async () => {
      const created = await aceAssignmentsRepository.createCycle(start);
      setPickedCycleId(created.id);
      await refreshCycles();
      logAdminActivity({
        action: ACTIVITY_ACTIONS.aceCycleStarted,
        entityType: 'ace_assignment_cycle',
        entityId: created.id,
        academicYearStart: start,
        summary: `Started the ${formatAcademicYear(start)} ACE assignment cycle`,
      });
      toast.success(`Started ACE ${formatAcademicYear(start)} assignments.`);
    }, 'Could not start the cycle');
  };

  /** Records the change a patch made, with an undo spec for a changed Big. */
  const recordPatch = (before: AceAssignmentDraft | undefined, patch: AceAssignmentDraftPatch) => {
    if (!before) return;
    if ('big_ace_member_id' in patch && (patch.big_ace_member_id ?? null) !== (before.big_ace_member_id ?? null)) {
      logAdminActivity({
        action: ACTIVITY_ACTIONS.aceAssignmentChanged,
        entityType: 'ace_assignment_draft',
        entityId: before.id,
        academicYearStart: yearStart,
        summary: activitySummary.aceAssignmentChanged(
          before.little_name,
          before.big_ace_member_id ? nodeNameById.get(before.big_ace_member_id) ?? null : null,
          patch.big_ace_member_id ? nodeNameById.get(patch.big_ace_member_id) ?? null : null,
        ),
        metadata: buildUndoMetadata({
          kind: 'ace_draft_big',
          target: { draftId: before.id },
          before: before.big_ace_member_id ?? null,
          after: patch.big_ace_member_id ?? null,
        }),
      });
    }
    if ('little_member_id' in patch && (patch.little_member_id ?? null) !== (before.little_member_id ?? null)) {
      logAdminActivity({
        action: ACTIVITY_ACTIONS.memberLinkChanged,
        entityType: 'ace_assignment_draft',
        entityId: before.id,
        academicYearStart: yearStart,
        summary: activitySummary.memberLink(before.little_name, patch.little_member_id ? directoryById.get(patch.little_member_id)?.fullName ?? 'a member' : null),
      });
    }
  };

  const patchDraft = (id: string, patch: AceAssignmentDraftPatch) =>
    run(async () => {
      const before = drafts.find((draft) => draft.id === id);
      await aceAssignmentsRepository.updateDraft(id, patch);
      recordPatch(before, patch);
      await refreshDrafts();
    }, 'Could not save');

  const removeDraft = (id: string) =>
    run(async () => {
      await aceAssignmentsRepository.deleteDraft(id);
      await refreshDrafts();
    }, 'Could not remove');

  const nextOrder = () => drafts.reduce((max, d) => Math.max(max, d.display_order), -1) + 1;

  const addLittle = (event: FormEvent) => {
    event.preventDefault();
    const name = newLittle.replace(/\s+/g, ' ').trim();
    if (!name || !cycleId) return;
    void run(async () => {
      await aceAssignmentsRepository.addDrafts(
        cycleId,
        [{ little_name: name, little_member_id: null, big_ace_member_id: null, notes: null }],
        nextOrder(),
      );
      setNewLittle('');
      await refreshDrafts();
    }, 'Could not add');
  };

  const importLittles = async (resolution: ImportResolution) => {
    if (!cycleId) return;
    await aceAssignmentsRepository.addDrafts(cycleId, resolution.seeds, nextOrder());
    await refreshDrafts();
    const parts = [`Added ${resolution.seeds.length} to the draft.`];
    if (resolution.emailLinked > 0) parts.push(`${resolution.emailLinked} linked by email.`);
    if (resolution.bigUnresolved > 0) parts.push(`${resolution.bigUnresolved} Bigs need a manual pick (see notes).`);
    toast.success(parts.join(' '));
    logAdminActivity({
      action: ACTIVITY_ACTIONS.aceImportAdded,
      entityType: 'ace_assignment_cycle',
      entityId: cycleId,
      academicYearStart: yearStart,
      summary: `Imported ${resolution.seeds.length} ${resolution.seeds.length === 1 ? 'Little' : 'Littles'} into the ${yearStart ? formatAcademicYear(yearStart) : ''} ACE draft`,
    });
    const needsLook = resolution.seeds.filter((seed) => !seed.little_member_id || !seed.big_ace_member_id).length;
    setNextStep(nextStepFor({ type: 'ace_imported', count: resolution.seeds.length, issues: needsLook }));
    setImportOpen(false);
  };

  const linkMatches = (links: ReadonlyArray<{ draftId: string; memberId: string }>, skippedNote = '') =>
    run(async () => {
      const { linked, skipped } = await aceAssignmentsRepository.linkDraftMembers(links);
      await refreshDrafts();
      if (linked.length > 0) {
        logAdminActivity({
          action: ACTIVITY_ACTIONS.aceBulkLinked,
          entityType: 'ace_assignment_cycle',
          entityId: cycleId,
          academicYearStart: yearStart,
          summary: activitySummary.aceBulkLinked(linked.length),
        });
      }
      toast.success(
        `Linked ${linked.length} ${linked.length === 1 ? 'Little' : 'Littles'}` +
          (skipped.length > 0 ? `; ${skipped.length} changed meanwhile and were skipped.` : '.') +
          skippedNote,
      );
    }, 'Could not link');

  const linkObvious = () => linkMatches(obviousLinks);

  // ─── Bulk actions ──────────────────────────────────────────────────────────
  const selectedFacts = useMemo(() => selectedRows(facts, selected, (item) => item.draft.id), [facts, selected]);
  const linkedDraftIds = useMemo(() => new Set(drafts.filter((draft) => draft.little_member_id).map((draft) => draft.id)), [drafts]);
  const linkPlan = useMemo(() => planAceLinkExactMatches(selected, reviewItems, linkedDraftIds), [selected, reviewItems, linkedDraftIds]);
  const reviewPlan = useMemo(() => planMarkReviewed(selectedFacts.map((item) => item.draft), reviewed, 'Little'), [selectedFacts, reviewed]);

  const bulkLink = () => {
    if (linkPlan.eligible.length === 0) {
      toast.error(linkPlan.skipped[0]?.reason ?? 'None of the selected Littles has a unique exact match.');
      return;
    }
    const skippedNote = linkPlan.skipped.length > 0 ? ` ${linkPlan.skipped.length} selected were not exact matches and were left for you to review.` : '';
    void linkMatches(selectBulkLittleLinks(linkPlan.eligible), skippedNote).then(() => setSelected(new Set()));
  };

  const bulkMarkReviewed = () =>
    run(async () => {
      if (reviewPlan.eligible.length === 0) {
        toast('All selected Littles are already reviewed.');
        return;
      }
      await markReviewed(reviewPlan.eligible.map((draft) => draft.id));
      toast.success(`Marked ${reviewPlan.eligible.length} reviewed.`);
      setSelected(new Set());
    }, 'Could not mark reviewed');

  const toggleRow = (id: string) => setSelected((current) => toggleSelected(current, id));
  const visibleIds = visible.map((item) => item.draft.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const setStatus = (to: 'draft' | 'locked' | 'archived') =>
    cycle &&
    run(async () => {
      await aceAssignmentsRepository.setCycleStatus(cycle.id, cycle.status, to);
      setConfirmPublish(false);
      await refreshCycles();
      if (to === 'locked' || to === 'draft') {
        logAdminActivity({
          action: to === 'locked' ? ACTIVITY_ACTIONS.aceCycleLocked : ACTIVITY_ACTIONS.aceCycleUnlocked,
          entityType: 'ace_assignment_cycle',
          entityId: cycle.id,
          academicYearStart: cycle.academic_year_start,
          summary: (to === 'locked' ? activitySummary.cycleLocked : activitySummary.cycleUnlocked)('ACE', cycle.academic_year_start),
        });
      }
      if (to === 'locked') setNextStep(nextStepFor({ type: 'ace_locked' }));
      toast.success(to === 'locked' ? 'Assignments locked. Nothing is public yet.' : to === 'draft' ? 'Unlocked.' : 'Archived.');
    }, 'Could not update the cycle');

  const publish = () =>
    cycle &&
    run(async () => {
      const result = await aceAssignmentsRepository.publishCycle(cycle.id);
      setConfirmPublish(false);
      await Promise.all([refreshCycles(), refreshDrafts()]);
      await queryClient.invalidateQueries(ACE_NODE_REFS_KEY);
      await queryClient.invalidateQueries(ACE_MEMBER_LINKS_QUERY_KEY);
      await queryClient.invalidateQueries('ace-family-members');
      if (!result.alreadyPublished) {
        logAdminActivity({
          action: ACTIVITY_ACTIONS.aceCyclePublished,
          entityType: 'ace_assignment_cycle',
          entityId: cycle.id,
          academicYearStart: cycle.academic_year_start,
          summary: activitySummary.published('ACE assignments', cycle.academic_year_start, result.created),
        });
      }
      toast.success(
        result.alreadyPublished ? 'Already published. Nothing new was added.' : `Published ${result.created} Littles to the ACE tree.`,
      );
    }, 'Could not publish');

  if (cyclesLoading) return <p className="px-7 py-6 font-sans text-sm text-[var(--color-text3)]">Loading assignments…</p>;
  if (cyclesError) {
    return <p className="px-7 py-6 font-sans text-sm text-red-500">Failed to load assignment cycles.</p>;
  }

  if (!cycle) {
    const startYear = Number(newYear) || operatingYear;
    return (
      <div className="px-7 py-6">
        <form
          onSubmit={createCycle}
          className="max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <h2 className="font-serif text-xl font-bold text-[var(--color-text)]">Start ACE assignments</h2>
          <p className="mt-1 font-sans text-xs text-[var(--color-text2)]">
            No ACE assignment cycle exists for {formatAcademicYear(startYear)}. Prepare the upcoming Big/Little sorting privately; nothing is public until you publish.
          </p>
          <label htmlFor="ace-cycle-year" className="mt-4 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]">
            Academic year starts
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="ace-cycle-year"
              inputMode="numeric"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className={`${inputCls} w-28`}
            />
            <button type="submit" disabled={busy} className={primaryBtnCls}>
              Create {formatAcademicYear(startYear)} Assignment Cycle
            </button>
          </div>
        </form>
      </div>
    );
  }

  const status = STATUS_COPY[cycle.status];
  const bigCount = preflight?.bigCount ?? 0;
  const loadError = !!(draftsError || nodesError || directoryError);
  const yearContext = describeYearContext(cycle.academic_year_start, operatingYear);
  const progress = aceProgress({
    status: cycle.status,
    littles: preflight?.littleCount ?? 0,
    assigned: preflight?.assignedCount ?? 0,
    linked: preflight?.linkedCount ?? 0,
    blockers: preflight?.blockers.length ?? 0,
    warnings: preflight?.warnings.length ?? 0,
  });
  const unassignedCount = preflight?.unassignedCount ?? 0;

  return (
    <div className="space-y-5 px-7 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[var(--color-text)]">
            ACE {formatAcademicYear(cycle.academic_year_start)} Assignment
          </h2>
          <YearContextBadge context={yearContext} className="mt-1" />
          <p className="mt-1 font-sans text-xs text-[var(--color-text2)]">
            <span className="mr-2 rounded border border-[var(--color-border)] px-2 py-0.5 font-semibold text-[var(--color-text)]">
              {status.label}
            </span>
            {status.hint}
          </p>
        </div>
        {cycles.filter((c) => c.status !== 'archived').length > 1 && (
          <select
            aria-label="Assignment cycle"
            value={cycle.id}
            onChange={(e) => {
              setPickedCycleId(e.target.value);
              setFilter('all');
            }}
            className={inputCls}
          >
            {cycles
              .filter((c) => c.status !== 'archived')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  ACE {formatAcademicYear(c.academic_year_start)} · {STATUS_COPY[c.status].label}
                </option>
              ))}
          </select>
        )}
      </div>

      {yearContext.isArchived && (
        <p role="note" className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-sans text-xs text-text-secondary">
          This cycle is from an earlier year. Check the year above before changing anything.
        </p>
      )}

      {loadError && (
        <p role="alert" className="font-sans text-xs text-red-500">
          Could not load everything this workspace needs. Refresh to try again.
        </p>
      )}

      <NextStepBanner step={nextStep} onFilter={setFilter} onDismiss={() => setNextStep(null)} />

      {preflight && <WorkflowProgress title={`${formatAcademicYear(cycle.academic_year_start)} ACE`} steps={progress} />}

      {preflight && (
        <div className="grid grid-cols-2 gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-4">
          <Stat value={preflight.littleCount} label="Littles" />
          <Stat value={bigCount} label="Bigs" />
          <Stat value={preflight.assignedCount} label="Assigned" />
          <Stat value={preflight.unassignedCount} label="Unassigned" />
        </div>
      )}

      {preflight && cycle.status !== 'published' && cycle.status !== 'archived' && (
        <div className="space-y-3">
          <AceAssignmentPreflightPanel
            preflight={preflight}
            heading={cycle.status === 'locked' ? 'Preflight before publishing' : 'Preflight before locking'}
            readyLabel={cycle.status === 'locked' ? 'Ready to Publish' : 'Ready to Lock'}
            onFilter={setFilter}
          />
          <PossibleDuplicates duplicates={duplicates} onCompare={() => setFilter('duplicates')} />
          <div className="flex flex-wrap items-center gap-2">
            {cycle.status === 'draft' && (
              <button type="button" onClick={() => setStatus('locked')} disabled={busy || preflight.littleCount === 0} className={primaryBtnCls}>
                Lock assignments
              </button>
            )}
            {cycle.status === 'locked' && (
              <>
                <button type="button" onClick={() => setStatus('draft')} disabled={busy} className={ghostBtnCls}>
                  Unlock to edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmPublish(true)}
                  disabled={busy || !preflight.canPublish}
                  className={primaryBtnCls}
                >
                  Publish to ACE tree…
                </button>
                {!preflight.canPublish && (
                  <span className="font-sans text-[11px] text-[var(--color-text3)]">Fix the blocking items first.</span>
                )}
              </>
            )}
          </div>
          {confirmPublish && cycle.status === 'locked' && (
            <div
              role="alertdialog"
              aria-label="Confirm publish"
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-sans text-xs"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
                Admin preview — not public
              </p>
              <p className="mt-1 font-semibold text-[var(--color-text)]">
                This adds {publishPreview.nodes.length} {publishPreview.nodes.length === 1 ? 'Little' : 'Littles'} to{' '}
                {publishPreview.familyCount} {publishPreview.familyCount === 1 ? 'fam' : 'fams'} on the ACE tree.
              </p>
              <p className="mt-1 text-[var(--color-text2)]">
                Each Little joins their Big's fam with the Big as parent. Fams that are live show them immediately.
              </p>
              <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-[var(--color-text2)]" aria-label="What will be added">
                {publishPreview.nodes.slice(0, 40).map((node) => (
                  <li key={node.draftId}>
                    {node.name} <span aria-hidden>→</span> under {nodeNameById.get(node.parentMemberId) ?? 'their Big'}
                  </li>
                ))}
                {publishPreview.nodes.length > 40 && <li>…and {publishPreview.nodes.length - 40} more.</li>}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={publish} disabled={busy} className={primaryBtnCls}>
                  {busy ? 'Publishing…' : 'Confirm publish'}
                </button>
                <button type="button" onClick={() => setConfirmPublish(false)} disabled={busy} className={ghostBtnCls}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {cycle.status === 'published' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-sans text-xs text-[var(--color-text2)]">
          <span>
            {drafts.filter((d) => d.published_ace_member_id).length} of {drafts.length} Littles are on the ACE tree.
          </span>
          <button type="button" onClick={() => setStatus('archived')} disabled={busy} className={ghostBtnCls}>
            Archive cycle
          </button>
        </div>
      )}

      {editable && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={addLittle} className="flex items-center gap-2">
              <label htmlFor="ace-new-little" className="sr-only">
                New Little name
              </label>
              <input
                id="ace-new-little"
                value={newLittle}
                onChange={(e) => setNewLittle(e.target.value)}
                placeholder="Add a Little…"
                className={`${inputCls} w-56`}
              />
              <button type="submit" disabled={busy || !newLittle.trim()} className={ghostBtnCls}>
                Add
              </button>
            </form>
            <button type="button" onClick={() => setImportOpen((open) => !open)} className={ghostBtnCls}>
              {importOpen ? 'Close import' : 'Import CSV / TSV'}
            </button>
            {obviousLinks.length > 0 && (
              <button type="button" onClick={linkObvious} disabled={busy} className={ghostBtnCls}>
                Link {obviousLinks.length} obvious member {obviousLinks.length === 1 ? 'match' : 'matches'}
              </button>
            )}
          </div>
          {importOpen && (
            <AceAssignmentImportPanel
              nodes={nodes}
              nameIndex={nameIndex}
              existingNames={drafts.map((draft) => draft.little_name)}
              onImport={importLittles}
              onClose={() => setImportOpen(false)}
            />
          )}
        </div>
      )}

      {drafts.length > 0 && (
        <FilterChips filters={ACE_DRAFT_FILTERS} counts={counts} active={filter} onChange={setFilter} label="Filter Littles" />
      )}

      <section aria-label="Assignments" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <BulkActionBar count={selected.size} noun="Little" onClear={() => setSelected(new Set())}>
          {editable && (
            <button type="button" onClick={bulkLink} disabled={busy} className={bulkBtnCls}>
              Link selected exact matches
            </button>
          )}
          <button type="button" onClick={bulkMarkReviewed} disabled={busy} className={bulkBtnCls}>
            Mark selected reviewed
          </button>
        </BulkActionBar>
        <div className="hidden items-center border-b border-[var(--color-border)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)] md:grid md:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-3">
          <span>
            <RowCheckbox
              checked={allVisibleSelected}
              onChange={() => setSelected(setSelection(visibleIds, !allVisibleSelected))}
              label="Select all visible Littles"
            />
          </span>
          <span>Little</span>
          <span>Member</span>
          <span>Big</span>
          <span className="w-12" />
        </div>
        {!ready ? (
          <p className="px-4 py-8 text-center font-sans text-xs text-[var(--color-text3)]">Loading…</p>
        ) : drafts.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={`No Littles in the ${formatAcademicYear(cycle.academic_year_start)} draft yet.`}
              description="Add one above or import a pasted list."
              action={editable ? { label: 'Import Littles', onClick: () => setImportOpen(true) } : undefined}
            />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center font-sans text-xs text-[var(--color-text3)]">
            No Littles match this filter.{' '}
            <button type="button" onClick={() => setFilter('all')} className="bg-transparent p-0 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
              Show all {drafts.length}
            </button>
          </p>
        ) : (
          <ul>
            {visible.map(({ draft, review, issues, reviewed: isReviewed }) => (
              <AceAssignmentRow
                key={draft.id}
                draft={draft}
                editable={editable}
                nodes={nodes}
                linkedMember={draft.little_member_id ? directoryById.get(draft.little_member_id) ?? null : null}
                review={review}
                issues={issues}
                loadFor={loadFor}
                busy={busy}
                selected={selected.has(draft.id)}
                onToggleSelect={toggleRow}
                reviewed={isReviewed}
                onPatch={patchDraft}
                onRemove={removeDraft}
              />
            ))}
          </ul>
        )}
        {preflight && unassignedCount > 0 && filter !== 'unassigned' && editable && (
          <p className="border-t border-[var(--color-border)] px-4 py-2 font-sans text-[11px] text-[var(--color-text3)]">
            {unassignedCount} {unassignedCount === 1 ? 'Little still needs' : 'Littles still need'} a Big.{' '}
            <button type="button" onClick={() => setFilter('unassigned')} className="bg-transparent p-0 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
              Review Unassigned
            </button>
          </p>
        )}
      </section>
    </div>
  );
}

