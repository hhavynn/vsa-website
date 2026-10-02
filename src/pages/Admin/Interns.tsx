import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { MemberLinkPicker } from '../../components/features/admin/MemberLinkPicker';
import { internCohortRepository } from '../../data/repos/internCohort';
import { memberLookupRepository } from '../../data/repos/memberLookup';
import { logAdminActivity } from '../../data/repos/adminActivity';
import { useAuth } from '../../hooks/useAuth';
import { useOperatingYear } from '../../hooks/useOperatingYear';
import { useReviewMarks } from '../../hooks/useReviewMarks';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { useUrlFilter, useUrlParam } from '../../hooks/useUrlFilter';
import { ACTIVITY_ACTIONS, activitySummary, buildUndoMetadata } from '../../lib/adminActivity';
import { planInternMentor, planInternTrack, planMarkReviewed, pruneSelection, selectedRows, setSelection, toggleSelected } from '../../lib/adminBulk';
import { internDuplicates, duplicateRowIds } from '../../lib/adminConflicts';
import { applyQuickFilter, countByFilter } from '../../lib/adminFilters';
import { reviewInternNames } from '../../lib/adminImportReview';
import { NextStep, nextStepFor } from '../../lib/adminNextSteps';
import { buildReadiness, internIssues } from '../../lib/adminPreflight';
import { internProgress } from '../../lib/adminProgress';
import { INTERN_FILTERS, INTERN_FILTER_KEYS, InternRowFacts } from '../../lib/adminQueues';
import { describeYearContext } from '../../lib/adminYearContext';
import { internDraftsToPreviewMembers } from '../../lib/adminPreviewMappers';
import { InternCohortPreviewDialog } from '../../components/features/admin/preview/CohortPreviewDialogs';
import {
  BulkActionBar,
  BulkConfirm,
  EmptyState,
  FilterChips,
  ImportReviewPanel,
  NextStepBanner,
  PossibleDuplicates,
  ReadinessPanel,
  RowCheckbox,
  WorkflowProgress,
  YearContextBadge,
  bulkBtnCls,
} from '../../components/features/admin/ops';
import { normalizeMemberName } from '../../lib/memberLinkMatching';
import { formatYearSpan } from '../../lib/operationalStatus';
import { useCabinetYears } from '../../hooks/useCabinetYears';
import {
  InternCohortCycle,
  InternCohortDraft,
  MentorOption,
  buildInternDraftRows,
  buildInternPreflight,
  formatCohortYears,
  moveId,
  parseInternNames,
  resequence,
  sortDrafts,
} from '../../lib/internCohort';
import { InternDraftPatch } from '../../data/repos/internCohort';
import { MemberNameIndex, MemberOption, buildMemberNameIndex } from '../../lib/memberLinkMatching';
import { suggestMemberLink } from '../../lib/memberLinkSuggestion';

const fieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const smallFieldCls =
  'w-full rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';
const ghostBtn =
  'rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  locked: 'Locked',
  published: 'Published',
  archived: 'Archived',
};

interface InternRowProps {
  draft: InternCohortDraft;
  index: number;
  count: number;
  editable: boolean;
  busy: boolean;
  memberById: Map<string, MemberOption>;
  nameIndex: MemberNameIndex;
  claimedByOthers: ReadonlySet<string>;
  mentors: MentorOption[];
  selected: boolean;
  onToggleSelect: (id: string) => void;
  reviewed: boolean;
  highlighted: boolean;
  onSave: (draft: InternCohortDraft, patch: InternDraftPatch) => void;
  onMove: (draft: InternCohortDraft, direction: -1 | 1) => void;
  onRemove: (draft: InternCohortDraft) => void;
}

function InternRow({ draft, index, count, editable, busy, memberById, nameIndex, claimedByOthers, mentors, selected, onToggleSelect, reviewed, highlighted, onSave, onMove, onRemove }: InternRowProps) {
  const [name, setName] = useState(draft.name);
  const [track, setTrack] = useState(draft.role_or_track ?? '');
  const [caption, setCaption] = useState(draft.caption ?? '');
  const [notes, setNotes] = useState(draft.internal_notes ?? '');
  const member = draft.member_id ? memberById.get(draft.member_id) ?? null : null;
  const mentor = mentors.find((option) => option.id === draft.mentor_cabinet_member_id) ?? null;

  function commit<K extends keyof InternDraftPatch>(key: K, value: string, current: string | null) {
    const next = value.trim();
    if (key === 'name' && !next) {
      setName(draft.name);
      return;
    }
    if (next === (current ?? '')) return;
    onSave(draft, { [key]: key === 'name' ? next : next || null } as InternDraftPatch);
  }

  return (
    <li id={`intern-row-${draft.id}`} className={`rounded border p-4 ${highlighted ? 'ring-2 ring-brand-600 dark:ring-brand-400' : ''}`} style={{ borderColor: 'var(--color-border)' }} data-testid="intern-row" data-reviewed={reviewed}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="pt-6">
          <RowCheckbox checked={selected} onChange={() => onToggleSelect(draft.id)} label={`Select ${draft.name}`} />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-name-${draft.id}`}>Name</label>
          <input
            id={`intern-name-${draft.id}`}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={name}
            disabled={!editable || busy}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => commit('name', name, draft.name)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>#{index + 1}</span>
          <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} disabled={!editable || busy || index === 0} onClick={() => onMove(draft, -1)} aria-label={`Move ${draft.name} up`}>↑</button>
          <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} disabled={!editable || busy || index === count - 1} onClick={() => onMove(draft, 1)} aria-label={`Move ${draft.name} down`}>↓</button>
          {editable && (
            <button type="button" className="bg-transparent p-0 text-[11px] font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }} disabled={busy} onClick={() => onRemove(draft)} aria-label={`Remove ${draft.name}`}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <span className={labelCls} style={{ color: 'var(--color-text3)' }}>Member</span>
          <MemberLinkPicker
            linkedMemberId={draft.member_id}
            linkedMember={member}
            suggestion={suggestMemberLink(draft.name, draft.member_id, nameIndex, claimedByOthers)}
            busy={busy}
            disabledReason={editable ? null : 'Reopen the cohort to change links.'}
            onLink={(option) => onSave(draft, { member_id: option.id })}
            onUnlink={() => onSave(draft, { member_id: null })}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-mentor-${draft.id}`}>Mentor (optional)</label>
          <select
            id={`intern-mentor-${draft.id}`}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={draft.mentor_cabinet_member_id ?? ''}
            disabled={!editable || busy}
            onChange={(event) => onSave(draft, { mentor_cabinet_member_id: event.target.value || null })}
          >
            <option value="">No mentor</option>
            {mentors.map((option) => (
              <option key={option.id} value={option.id}>{option.name} · {option.role}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-track-${draft.id}`}>Role / track</label>
          <input
            id={`intern-track-${draft.id}`}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            placeholder="Intern"
            value={track}
            disabled={!editable || busy}
            onChange={(event) => setTrack(event.target.value)}
            onBlur={() => commit('role_or_track', track, draft.role_or_track)}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-caption-${draft.id}`}>Caption / bio (private for now)</label>
          <textarea
            id={`intern-caption-${draft.id}`}
            rows={2}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={caption}
            disabled={!editable || busy}
            onChange={(event) => setCaption(event.target.value)}
            onBlur={() => commit('caption', caption, draft.caption)}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }} htmlFor={`intern-notes-${draft.id}`}>Internal notes</label>
          <textarea
            id={`intern-notes-${draft.id}`}
            rows={2}
            className={smallFieldCls}
            style={{ borderColor: 'var(--color-border)' }}
            value={notes}
            disabled={!editable || busy}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => commit('internal_notes', notes, draft.internal_notes)}
          />
        </div>
      </div>

      <p className="mt-3 text-xs" style={{ color: 'var(--color-text2)' }}>
        {draft.member_id ? '✅' : '⚠'} {draft.name}
        {' · '}Member: {member ? member.displayName : 'not linked'}
        {' · '}Mentor: {mentor ? `${mentor.name} · ${mentor.role}` : 'none'}
        {' · '}Track: {draft.role_or_track || 'Intern'}
        {draft.published_cabinet_member_id ? ' · published' : ''}
        {reviewed ? ' · ✓ reviewed' : ''}
      </p>
    </li>
  );
}

export default function AdminInterns() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { cabinetYears } = useCabinetYears();
  const [cycles, setCycles] = useState<InternCohortCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<InternCohortDraft[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [directory, setDirectory] = useState<MemberOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCabinetYearId, setNewCabinetYearId] = useState('');
  const [pasted, setPasted] = useState('');
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const operatingYear = useOperatingYear();
  const [filter, setFilter] = useUrlFilter(INTERN_FILTER_KEYS);
  const [cycleParam] = useUrlParam('cycle');
  const [rowParam] = useUrlParam('row');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkMentorId, setBulkMentorId] = useState('');
  const [bulkTrack, setBulkTrack] = useState('');
  const [pendingRemoveMentor, setPendingRemoveMentor] = useState(false);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Pasted names that have not been added to the cohort yet are unsaved work.
  useUnsavedChangesGuard(pasted.trim().length > 0, busy);

  const cycle = useMemo(() => cycles.find((item) => item.id === cycleId) ?? null, [cycles, cycleId]);
  const cabinetYear = useMemo(() => cabinetYears.find((year) => year.id === cycle?.cabinet_year_id) ?? null, [cabinetYears, cycle]);
  const editable = cycle?.status === 'draft';
  const ordered = useMemo(() => sortDrafts(drafts), [drafts]);
  const memberById = useMemo(() => new Map(directory.map((member) => [member.id, member])), [directory]);
  const preflight = useMemo(() => buildInternPreflight(ordered), [ordered]);
  const needReview = preflight.accepted - preflight.linked;
  const duplicates = useMemo(() => internDuplicates(ordered.map((draft) => ({ id: draft.id, label: draft.name, memberId: draft.member_id }))), [ordered]);
  const duplicateIds = useMemo(() => duplicateRowIds(duplicates.filter((item) => item.exact)), [duplicates]);
  const draftIds = useMemo(() => ordered.map((draft) => draft.id), [ordered]);
  const { reviewed, markReviewed } = useReviewMarks('intern_cohort_draft', cycle?.id ?? null, draftIds, cycle?.academic_year_start ?? null);
  const facts = useMemo<InternRowFacts[]>(
    () => ordered.map((draft) => ({ draft, duplicate: duplicateIds.has(draft.id), reviewed: reviewed.has(draft.id) })),
    [ordered, duplicateIds, reviewed],
  );
  const filterCounts = useMemo(() => countByFilter(facts, INTERN_FILTERS), [facts]);
  const visibleFacts = useMemo(() => applyQuickFilter(facts, INTERN_FILTERS, filter), [facts, filter]);
  const mentorNameOf = useCallback((id: string | null) => (id ? mentors.find((option) => option.id === id)?.name ?? null : null), [mentors]);

  const nameIndex = useMemo(() => buildMemberNameIndex(directory), [directory]);
  const linkedIds = useMemo(() => ordered.map((draft) => draft.member_id).filter((id): id is string => !!id), [ordered]);

  const loadCycles = useCallback(async () => {
    try {
      setCycles(await internCohortRepository.listCycles());
    } catch (err) {
      console.error(err);
      toast.error('Failed to load intern cohorts.');
    } finally {
      setLoadingCycles(false);
    }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);
  useEffect(() => {
    memberLookupRepository.listMemberDirectory().then(setDirectory).catch((err) => {
      console.error(err);
      toast.error('Failed to load members for linking.');
    });
  }, []);

  useEffect(() => {
    setPublishConfirmed(false);
    if (!cycle) {
      setDrafts([]);
      setMentors([]);
      return;
    }
    internCohortRepository.getDrafts(cycle.id).then(setDrafts).catch((err) => {
      console.error(err);
      toast.error('Failed to load interns.');
    });
    internCohortRepository.listMentorOptions(cycle.cabinet_year_id).then(setMentors).catch(() => setMentors([]));
  }, [cycle]);

  // Quick Search deep link: ?cycle=<id>&row=<draft id> opens that cohort and scrolls to the intern.
  const appliedCycleParam = useRef<string | null>(null);
  useEffect(() => {
    if (!cycleParam || appliedCycleParam.current === cycleParam) return;
    if (cycles.some((item) => item.id === cycleParam)) {
      appliedCycleParam.current = cycleParam;
      setCycleId(cycleParam);
    }
  }, [cycleParam, cycles]);
  useEffect(() => {
    if (rowParam && drafts.some((draft) => draft.id === rowParam)) {
      document.getElementById(`intern-row-${rowParam}`)?.scrollIntoView?.({ block: 'center' });
    }
  }, [rowParam, drafts]);

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

  function createCycle(yearId: string = newCabinetYearId) {
    const year = cabinetYears.find((item) => item.id === yearId);
    if (!year) {
      toast.error('Choose a cabinet year.');
      return;
    }
    return run(async () => {
      const created = await internCohortRepository.createCycle({ academicYearStart: year.start_year, cabinetYearId: year.id, userId });
      await loadCycles();
      setCycleId(created.id);
      logAdminActivity({
        action: ACTIVITY_ACTIONS.internCycleStarted,
        entityType: 'intern_cohort_cycle',
        entityId: created.id,
        academicYearStart: year.start_year,
        summary: `Started the ${formatYearSpan(year.start_year)} intern cohort`,
      });
    }, 'Failed to start the cohort.');
  }

  function importNames() {
    if (!cycle) return;
    const parsed = parseInternNames(pasted);
    if (parsed.length === 0) {
      toast.error('Paste at least one name.');
      return;
    }
    return run(async () => {
      const startingOrder = ordered.reduce((max, draft) => Math.max(max, draft.display_order), -1) + 1;
      const rows = buildInternDraftRows(parsed, nameIndex, startingOrder, ordered.map((d) => d.member_id).filter((id): id is string => !!id));
      const created = await internCohortRepository.addDrafts(cycle.id, rows);
      setDrafts((current) => [...current, ...created]);
      setPasted('');
      toast.success(`Added ${created.length} intern${created.length === 1 ? '' : 's'} (${created.filter((d) => d.member_id).length} linked).`);
      logAdminActivity({
        action: ACTIVITY_ACTIONS.internAdded,
        entityType: 'intern_cohort_cycle',
        entityId: cycle.id,
        academicYearStart: cycle.academic_year_start,
        summary: activitySummary.internAdded(created.length, cycle.academic_year_start),
      });
      setNextStep({ id: 'intern_added', message: `${created.length} ${created.length === 1 ? 'intern' : 'interns'} added`, actions: created.some((d) => !d.member_id) ? [{ label: `Review ${created.filter((d) => !d.member_id).length} Unlinked`, filter: 'unlinked' }] : [{ label: 'Review Missing Mentor', filter: 'missing_mentor' }] });
    }, 'Failed to add interns.');
  }

  function saveDraft(draft: InternCohortDraft, patch: InternDraftPatch) {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.updateDraft(cycle.id, draft.id, patch);
      setDrafts((current) => current.map((item) => (item.id === draft.id ? { ...item, ...patch } : item)));
      if ('mentor_cabinet_member_id' in patch && (patch.mentor_cabinet_member_id ?? null) !== (draft.mentor_cabinet_member_id ?? null)) {
        logAdminActivity({
          action: ACTIVITY_ACTIONS.internMentorChanged,
          entityType: 'intern_cohort_draft',
          entityId: draft.id,
          academicYearStart: cycle.academic_year_start,
          summary: activitySummary.internMentor(draft.name, mentorNameOf(draft.mentor_cabinet_member_id), mentorNameOf(patch.mentor_cabinet_member_id ?? null)),
          metadata: buildUndoMetadata({
            kind: 'intern_mentor',
            target: { cycleId: cycle.id, draftId: draft.id },
            before: draft.mentor_cabinet_member_id ?? null,
            after: patch.mentor_cabinet_member_id ?? null,
          }),
        });
      } else if ('member_id' in patch && (patch.member_id ?? null) !== (draft.member_id ?? null)) {
        logAdminActivity({
          action: ACTIVITY_ACTIONS.memberLinkChanged,
          entityType: 'intern_cohort_draft',
          entityId: draft.id,
          academicYearStart: cycle.academic_year_start,
          summary: activitySummary.memberLink(draft.name, patch.member_id ? memberById.get(patch.member_id)?.fullName ?? 'a member' : null),
        });
      }
    }, 'Failed to save.');
  }

  function moveDraft(draft: InternCohortDraft, direction: -1 | 1) {
    if (!cycle) return;
    const nextOrder = moveId(ordered.map((item) => item.id), draft.id, direction);
    const changes = resequence(ordered, nextOrder);
    if (changes.length === 0) return;
    return run(async () => {
      await internCohortRepository.reorder(cycle.id, changes);
      const byId = new Map(changes.map((change) => [change.id, change.display_order]));
      setDrafts((current) => current.map((item) => (byId.has(item.id) ? { ...item, display_order: byId.get(item.id) as number } : item)));
    }, 'Failed to reorder.');
  }

  function removeDraft(draft: InternCohortDraft) {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.removeDraft(cycle.id, draft.id);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      logAdminActivity({
        action: ACTIVITY_ACTIONS.internRemoved,
        entityType: 'intern_cohort_draft',
        entityId: null,
        academicYearStart: cycle.academic_year_start,
        summary: activitySummary.internRemoved(draft.name),
      });
    }, 'Failed to remove.');
  }

  async function refreshCycle() {
    if (!cycle) return;
    const fresh = await internCohortRepository.getCycle(cycle.id);
    setCycles((current) => current.map((item) => (item.id === fresh.id ? fresh : item)));
    setDrafts(await internCohortRepository.getDrafts(cycle.id));
  }

  function lock() {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.lockCycle(cycle.id);
      await refreshCycle();
      logAdminActivity({
        action: ACTIVITY_ACTIONS.internCohortLocked,
        entityType: 'intern_cohort_cycle',
        entityId: cycle.id,
        academicYearStart: cycle.academic_year_start,
        summary: activitySummary.cycleLocked('Intern', cycle.academic_year_start),
      });
      setNextStep(nextStepFor({ type: 'intern_locked' }));
      toast.success('Locked. The cohort is still private.');
    }, 'Failed to lock.');
  }

  function reopen() {
    if (!cycle) return;
    return run(async () => {
      await internCohortRepository.reopenCycle(cycle.id);
      await refreshCycle();
    }, 'Failed to reopen.');
  }

  function publish() {
    if (!cycle) return;
    return run(async () => {
      const result = await internCohortRepository.publishCycle(cycle.id);
      await refreshCycle();
      if (!result.alreadyPublished) {
        logAdminActivity({
          action: ACTIVITY_ACTIONS.internCohortPublished,
          entityType: 'intern_cohort_cycle',
          entityId: cycle.id,
          academicYearStart: cycle.academic_year_start,
          summary: activitySummary.published('Intern cohort', cycle.academic_year_start, result.created + result.updated),
        });
      }
      toast.success(result.alreadyPublished ? 'Already published.' : `Published: ${result.created} added, ${result.updated} updated.`);
    }, 'Failed to publish. Nothing was lost; fix the issue and publish again.');
  }

  function discard() {
    if (!cycle || !window.confirm('Delete this draft cohort? This cannot be undone.')) return;
    return run(async () => {
      await internCohortRepository.deleteCycle(cycle.id);
      setCycleId(null);
      await loadCycles();
    }, 'Failed to delete.');
  }

  // ─── Bulk actions ──────────────────────────────────────────────────────────
  const selectedDrafts = useMemo(() => selectedRows(ordered, selected, (draft) => draft.id), [ordered, selected]);
  const mentorPlan = useMemo(() => planInternMentor(selectedDrafts, bulkMentorId || null, !!editable), [selectedDrafts, bulkMentorId, editable]);
  const removeMentorPlan = useMemo(() => planInternMentor(selectedDrafts, null, !!editable), [selectedDrafts, editable]);
  const trackPlan = useMemo(() => planInternTrack(selectedDrafts, bulkTrack, !!editable), [selectedDrafts, bulkTrack, editable]);
  const reviewPlan = useMemo(() => planMarkReviewed(selectedDrafts, reviewed, 'intern'), [selectedDrafts, reviewed]);

  async function applyBulk(targets: InternCohortDraft[], patch: InternDraftPatch, summary: string, success: string) {
    if (!cycle) return;
    await run(async () => {
      for (const draft of targets) {
        await internCohortRepository.updateDraft(cycle.id, draft.id, patch);
      }
      const ids = new Set(targets.map((draft) => draft.id));
      setDrafts((current) => current.map((item) => (ids.has(item.id) ? { ...item, ...patch } : item)));
      logAdminActivity({
        action: ACTIVITY_ACTIONS.internBulkChanged,
        entityType: 'intern_cohort_cycle',
        entityId: cycle.id,
        academicYearStart: cycle.academic_year_start,
        summary,
      });
      toast.success(success);
      setSelected(new Set());
      setPendingRemoveMentor(false);
    }, 'Failed to update the selected interns.');
  }

  function bulkSetMentor() {
    if (!bulkMentorId) {
      toast.error('Choose a mentor first.');
      return;
    }
    if (mentorPlan.eligible.length === 0) {
      toast.error(mentorPlan.skipped[0]?.reason ?? 'Nothing to change.');
      return;
    }
    return applyBulk(mentorPlan.eligible, { mentor_cabinet_member_id: bulkMentorId }, activitySummary.bulk(`Set mentor ${mentorNameOf(bulkMentorId) ?? ''} for`, mentorPlan.eligible.length, 'intern'), `Set the mentor for ${mentorPlan.eligible.length} ${mentorPlan.eligible.length === 1 ? 'intern' : 'interns'}.`);
  }
  function bulkRemoveMentor() {
    return applyBulk(removeMentorPlan.eligible, { mentor_cabinet_member_id: null }, activitySummary.bulk('Removed the mentor from', removeMentorPlan.eligible.length, 'intern'), `Removed the mentor from ${removeMentorPlan.eligible.length} ${removeMentorPlan.eligible.length === 1 ? 'intern' : 'interns'}.`);
  }
  function bulkSetTrack() {
    if (trackPlan.eligible.length === 0) {
      toast.error(trackPlan.skipped[0]?.reason ?? 'Nothing to change.');
      return;
    }
    return applyBulk(trackPlan.eligible, { role_or_track: bulkTrack.trim() }, activitySummary.bulk(`Set track "${bulkTrack.trim()}" for`, trackPlan.eligible.length, 'intern'), `Set the track for ${trackPlan.eligible.length} ${trackPlan.eligible.length === 1 ? 'intern' : 'interns'}.`);
  }
  function bulkMarkReviewed() {
    return run(async () => {
      if (reviewPlan.eligible.length === 0) {
        toast('All selected interns are already reviewed.');
        return;
      }
      await markReviewed(reviewPlan.eligible.map((draft) => draft.id));
      toast.success(`Marked ${reviewPlan.eligible.length} reviewed.`);
      setSelected(new Set());
    }, 'Failed to mark interns reviewed.');
  }

  const usedCabinetYearIds = new Set(cycles.map((item) => item.cabinet_year_id));
  const availableYears = cabinetYears.filter((year) => !usedCabinetYearIds.has(year.id));

  return (
    <>
      <PageTitle title="Intern Cohort" />
      <Toaster position="top-right" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Intern Cohort</h1>
        <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          Prepare the accepted intern cohort privately. Nothing is public until you publish; publishing adds the interns to the Cabinet page&apos;s Interns group, which is what the Internship page shows.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/admin/cabinet" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>Cabinet admin</Link>
          <Link to="/intern-program" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>View public Internship page</Link>
        </div>
      </div>

      {!cycle ? (
        <div className="grid gap-6 p-4 sm:p-6 lg:p-8 lg:grid-cols-2">
          <section className="scrapbook-paper p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Cohorts</h2>
            {loadingCycles ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--color-text3)' }}>Loading…</p>
            ) : cycles.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No Intern cohort has been started."
                  description="Start the cohort for the next cabinet year, then paste the accepted names."
                  action={
                    availableYears[0]
                      ? { label: `Start ${formatYearSpan(availableYears[0].start_year)} Cohort`, onClick: () => createCycle(availableYears[0].id), disabled: busy }
                      : undefined
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {cycles.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatCohortYears(item)} Intern Cohort</p>
                      <p className="text-xs" style={{ color: 'var(--color-text3)' }}>{STATUS_LABEL[item.status]}</p>
                    </div>
                    <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} onClick={() => setCycleId(item.id)}>Open</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="scrapbook-paper p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Start a cohort</h2>
            <label htmlFor="new-cohort-year" className={`${labelCls} mt-4`} style={{ color: 'var(--color-text3)' }}>Cabinet year</label>
            <select id="new-cohort-year" className={fieldCls} style={{ borderColor: 'var(--color-border)' }} value={newCabinetYearId} onChange={(event) => setNewCabinetYearId(event.target.value)}>
              <option value="">Choose a cabinet year…</option>
              {availableYears.map((year) => (
                <option key={year.id} value={year.id}>{year.label}</option>
              ))}
            </select>
            <button type="button" className="vsa-btn-primary mt-4 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !newCabinetYearId} onClick={() => createCycle()}>Start cohort</button>
          </section>
        </div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button type="button" onClick={() => setCycleId(null)} className="mb-2 bg-transparent p-0 text-xs font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--color-text2)' }}>← All cohorts</button>
              <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{formatCohortYears(cycle)} Intern Cohort</h2>
              <YearContextBadge context={describeYearContext(cycle.academic_year_start, operatingYear)} className="mt-1" />
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>{STATUS_LABEL[cycle.status]} · cabinet year {cabinetYear?.label ?? '…'}</p>
              <p className="mt-2 font-mono text-sm" style={{ color: 'var(--color-text)' }}>
                {preflight.accepted} accepted · {preflight.linked} linked · {needReview} need review
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cycle.status === 'draft' && (
                <>
                  <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }} disabled={busy} onClick={discard}>Delete draft</button>
                  <button type="button" className="vsa-btn-primary px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !preflight.canLock} onClick={lock}>Lock cohort</button>
                </>
              )}
              {cycle.status === 'locked' && (
                <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }} disabled={busy} onClick={reopen}>Reopen draft</button>
              )}
            </div>
          </div>

          <NextStepBanner step={nextStep} onFilter={setFilter} onPreview={() => setPreviewOpen(true)} onDismiss={() => setNextStep(null)} />

          <WorkflowProgress
            title={`${formatYearSpan(cycle.academic_year_start)} Interns`}
            steps={internProgress({
              status: cycle.status,
              accepted: preflight.accepted,
              linked: preflight.linked,
              mentored: ordered.filter((draft) => !!draft.mentor_cabinet_member_id).length,
            })}
          />

          {cycle.status !== 'published' && cycle.status !== 'archived' && ordered.length > 0 && (
            <div>
              <button type="button" className={ghostBtn} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} onClick={() => setPreviewOpen(true)}>
                Preview cohort
              </button>
            </div>
          )}

          {cycle.status === 'locked' && (
            <div className="rounded border p-3 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Locked — still private.</p>
              <p className="mt-1">Publishing adds or updates {preflight.accepted} intern{preflight.accepted === 1 ? '' : 's'} in the Cabinet&apos;s Interns group for {cabinetYear?.label ?? 'this cabinet year'}. Interns already published are updated, not duplicated.</p>
              <label className="mt-3 flex cursor-pointer select-none items-start gap-2">
                <input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]" />
                <span style={{ color: 'var(--color-text)' }}>I confirm: make this cohort public.</span>
              </label>
              <button type="button" className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !publishConfirmed} onClick={publish}>
                {busy ? 'Publishing…' : 'Publish cohort'}
              </button>
            </div>
          )}
          {cycle.status === 'published' && (
            <div className="rounded border p-3 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text2)' }}>
              Published. This cohort is read-only here; edit published interns from Cabinet admin.
            </div>
          )}

          <ReadinessPanel
            readiness={buildReadiness(internIssues(preflight), { ready: cycle.status === 'locked' ? 'Ready to Publish' : 'Ready to Lock' })}
            onFilter={setFilter}
            passed={[`${preflight.accepted} accepted`, `${preflight.linked} linked`]}
          />
          <PossibleDuplicates duplicates={duplicates} onCompare={() => setFilter('needs_review')} />

          {editable && (
            <section className="scrapbook-paper p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} aria-label="Import names">
              <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>Add interns</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>One per line: &quot;Name&quot; or &quot;Name, Track&quot;. Exact, unambiguous names link to members automatically; everything else is left for you to review.</p>
              <label htmlFor="intern-paste" className="sr-only">Pasted intern names</label>
              <textarea id="intern-paste" rows={5} className={`${fieldCls} mt-3 font-mono text-xs`} style={{ borderColor: 'var(--color-border)' }} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'Sarah Nguyen, Events / Operations\nKevin Tran'} />
              <ImportReviewPanel
                rows={reviewInternNames(parseInternNames(pasted), { nameIndex, existingNames: new Set(ordered.map((draft) => normalizeMemberName(draft.name))) })}
                hasInput={pasted.trim().length > 0}
                filename="intern-import-problem-rows"
              />
              <button type="button" className="vsa-btn-primary mt-3 px-5 py-2 text-xs disabled:opacity-50" disabled={busy || !pasted.trim()} onClick={importNames}>Add to cohort</button>
            </section>
          )}

          <section aria-label="Interns">
            {ordered.length > 0 && (
              <div className="mb-3">
                <FilterChips filters={INTERN_FILTERS} counts={filterCounts} active={filter} onChange={setFilter} label="Filter interns" />
              </div>
            )}
            <div className="mb-3 overflow-hidden rounded border" style={{ borderColor: selected.size > 0 ? 'var(--color-border)' : 'transparent' }}>
              <BulkActionBar count={selected.size} noun="intern" onClear={() => { setSelected(new Set()); setPendingRemoveMentor(false); }}>
                {editable && (
                  <>
                    <label htmlFor="bulk-mentor" className="sr-only">Mentor for selected interns</label>
                    <select id="bulk-mentor" className={`${smallFieldCls} w-auto`} style={{ borderColor: 'var(--color-border)' }} value={bulkMentorId} onChange={(event) => setBulkMentorId(event.target.value)}>
                      <option value="">Set mentor →</option>
                      {mentors.map((option) => (
                        <option key={option.id} value={option.id}>{option.name} · {option.role}</option>
                      ))}
                    </select>
                    <button type="button" className={bulkBtnCls} disabled={busy || !bulkMentorId} onClick={bulkSetMentor}>Set mentor</button>
                    <button type="button" className={bulkBtnCls} disabled={busy} onClick={() => setPendingRemoveMentor(true)}>Remove mentor</button>
                    <label htmlFor="bulk-track" className="sr-only">Track for selected interns</label>
                    <input id="bulk-track" className={`${smallFieldCls} w-40`} style={{ borderColor: 'var(--color-border)' }} placeholder="Track…" value={bulkTrack} onChange={(event) => setBulkTrack(event.target.value)} />
                    <button type="button" className={bulkBtnCls} disabled={busy || !bulkTrack.trim()} onClick={bulkSetTrack}>Set track</button>
                  </>
                )}
                <button type="button" className={bulkBtnCls} disabled={busy} onClick={bulkMarkReviewed}>Mark reviewed</button>
              </BulkActionBar>
              {pendingRemoveMentor && selected.size > 0 && (
                <BulkConfirm plan={removeMentorPlan} busy={busy} onConfirm={bulkRemoveMentor} onCancel={() => setPendingRemoveMentor(false)} skippedLabel={(draft) => draft.name} />
              )}
            </div>
            {ordered.length === 0 ? (
              <EmptyState
                title={`No interns in the ${formatYearSpan(cycle.academic_year_start)} cohort yet.`}
                description={editable ? 'Paste the accepted names above to add them.' : undefined}
              />
            ) : visibleFacts.length === 0 ? (
              <p className="rounded border px-5 py-10 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
                No interns match this filter.{' '}
                <button type="button" onClick={() => setFilter('all')} className="bg-transparent p-0 font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--brand)' }}>
                  Show all {ordered.length}
                </button>
              </p>
            ) : (
              <ul className="space-y-3">
                {visibleFacts.map(({ draft, reviewed: isReviewed }) => {
                  const index = ordered.findIndex((item) => item.id === draft.id);
                  return (
                    <InternRow
                      key={draft.id}
                      draft={draft}
                      index={index}
                      count={ordered.length}
                      editable={!!editable}
                      busy={busy}
                      memberById={memberById}
                      nameIndex={nameIndex}
                      claimedByOthers={new Set(linkedIds.filter((id) => id !== draft.member_id))}
                      mentors={mentors}
                      selected={selected.has(draft.id)}
                      onToggleSelect={(id) => setSelected((current) => toggleSelected(current, id))}
                      reviewed={isReviewed}
                      highlighted={rowParam === draft.id}
                      onSave={saveDraft}
                      onMove={moveDraft}
                      onRemove={removeDraft}
                    />
                  );
                })}
              </ul>
            )}
          </section>

          {previewOpen && cycle && (
            <InternCohortPreviewDialog
              members={internDraftsToPreviewMembers(ordered, cycle.cabinet_year_id)}
              yearLabel={formatYearSpan(cycle.academic_year_start)}
              onClose={() => setPreviewOpen(false)}
            />
          )}
        </div>
      )}
    </>
  );
}
