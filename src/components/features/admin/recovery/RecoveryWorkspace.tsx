import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { attendanceRecoveryRepository, RecoverResult } from '../../../../data/repos/attendanceRecovery';
import { toUserMessage } from '../../../../data/errors';
import { useAuth } from '../../../../hooks/useAuth';
import { useRecoveryLookups } from '../../../../hooks/useRecoveryLookups';
import { useRowSelection } from '../../../../hooks/useRowSelection';
import { useStagedRecovery } from '../../../../hooks/useStagedRecovery';
import {
  DismissReason,
  MemberSnapshot,
  OUTCOME_LABELS,
  RecoveryActionRecord,
  RecoveryFindingRecord,
  allowedActions,
  buildFindings,
  kindLabel,
  splitDisplayName,
} from '../../../../lib/attendanceRecovery';
import { HistoricalKind } from '../../../../lib/importHistoryAudit';
import {
  BulkKind,
  DEFAULT_FILTERS,
  LENS_LABELS,
  LensFilter,
  RowInsight,
  STATUS_LABELS,
  SortKey,
  StatusFilter,
  TIER_LABELS,
  TriageTier,
  WorkspaceFilters,
  bulkEligibility,
  countScope,
  eventProgress,
  filterInsights,
  insightFor,
  nextUnfinishedEvent,
  sortInsights,
} from '../../../../lib/recoveryTriage';
import {
  ApplyItemResult,
  KIND_LABELS,
  StageInput,
  isLocked,
  reconcileStaging,
  reconfirmMember,
  stageDecision,
  stagingError,
} from '../../../../lib/recoveryWorkspace';
import { cn } from '../../../../lib/utils';
import { Skeleton } from '../../../ui/Skeleton';
import { MemberAttendanceModal } from '../MemberAttendanceModal';
import { RecoveryFindingDialog } from '../RecoveryFindingDialog';
import { BatchReviewDialog } from './BatchReviewDialog';
import { BatchToolbar } from './BatchToolbar';
import { EditorKind, RecoveryRow } from './RecoveryRow';
import { RecoveryHistoryList } from './RecoveryHistoryList';
import { chip, formatDate, formatTime, inputCls, selectCls, smallBtn } from './recoveryUi';

/**
 * Every cached query a recovery can make stale: findings, history, imports, member
 * history and totals, yearly and House standings. Admin Members and Recent Changes
 * load on mount, so they are current the next time they open.
 */
export const RECOVERY_INVALIDATIONS: ReadonlyArray<readonly string[]> = [
  ['attendance-recovery'],
  ['import-jobs'],
  ['admin-member-history'],
  ['member-attendance'],
  ['find-my-points'],
  ['leaderboard-years'],
  ['individual-leaderboard'],
  ['house-detail', 'standings'],
  ['home'],
];

const FINDINGS_KEY = ['attendance-recovery', 'findings'];
const ACTIONS_KEY = ['attendance-recovery', 'actions'];
export const PAGE_SIZE = 50;

const SORT_LABELS: Record<SortKey, string> = {
  easiest: 'Straightforward first',
  risk: 'Risk (high first)',
  source: 'Source order',
  confidence: 'Match confidence',
  name: 'Name (groups duplicates)',
};

const SHORTCUTS: Array<[string, string]> = [
  ['↓ / j, ↑ / k', 'Next / previous row'],
  ['Space / x', 'Select row'],
  ['m', 'Match (or credit correct member)'],
  ['c', 'Create separate member'],
  ['d', 'Dismiss'],
  ['n', 'Needs more information'],
  ['u', 'Undo this row’s staged decision'],
  ['Shift+U', 'Undo last staging change'],
  ['Enter / e', 'Full review with stored source row'],
  ['?', 'Show or hide shortcuts'],
];

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

const rowIdOf = (insight: RowInsight) => insight.finding.record.row_id;

/**
 * Historical attendance reconciliation: one event at a time as a review table.
 * Admins stage decisions inline (or in homogeneous bulk), review them in one
 * consolidated confirmation, and apply them through the existing per-row
 * recovery function. Single-row Full review stays available for every row.
 */
export function RecoveryWorkspace() {
  const client = useQueryClient();
  const { user } = useAuth();
  const records = useQuery(FINDINGS_KEY, () => attendanceRecoveryRepository.listFindingRecords(), { staleTime: 30_000 });
  const actions = useQuery(ACTIONS_KEY, () => attendanceRecoveryRepository.listActions(), { staleTime: 30_000 });
  const staging = useStagedRecovery(user?.id ?? null);

  const findings = useMemo(
    () => (records.data && actions.data ? buildFindings(records.data, actions.data) : []),
    [records.data, actions.data],
  );
  const findingByRow = useMemo(() => new Map(findings.map((f) => [f.record.row_id, f])), [findings]);
  const progress = useMemo(() => eventProgress(findings, staging.ids), [findings, staging.ids]);

  const [view, setView] = useState<'reconcile' | 'history'>('reconcile');
  const [eventId, setEventId] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkspaceFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('easiest');
  const [page, setPage] = useState(0);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ rowId: string; kind: EditorKind; member: MemberSnapshot | null } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ rowId: string; n: number } | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [attendanceMemberId, setAttendanceMemberId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Resume where work is: an event with staged decisions, else the first with open findings.
  useEffect(() => {
    if (eventId && progress.some((p) => p.eventId === eventId)) return;
    const resume = progress.find((p) => p.staged > 0) ?? progress.find((p) => p.open > 0) ?? progress[0];
    setEventId(resume?.eventId ?? null);
  }, [progress, eventId]);

  const eventFindings = useMemo(() => findings.filter((f) => f.record.event_id === eventId), [findings, eventId]);
  const { lookup, loading: lookupsLoading, error: lookupError, refetch: refetchLookups } = useRecoveryLookups(eventFindings, eventId);
  const insights = useMemo(() => eventFindings.map((f) => insightFor(f, lookup)), [eventFindings, lookup]);
  const counts = useMemo(() => countScope(insights, staging.ids), [insights, staging.ids]);
  const visible = useMemo(() => sortInsights(filterInsights(insights, filters, staging.ids), sort), [insights, filters, staging.ids, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(() => visible.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE), [visible, safePage]);
  const selection = useRowSelection(visible, pageRows, rowIdOf);
  const current = progress.find((p) => p.eventId === eventId) ?? null;
  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    eventFindings.forEach((f) => map.set(f.record.import_job_id, `Import of ${formatDate(f.record.job_created_at)}`));
    return Array.from(map.entries());
  }, [eventFindings]);
  const kindOptions = useMemo(() => Array.from(new Set(insights.map((i) => i.finding.classification.kind))).sort() as HistoricalKind[], [insights]);
  const stagedEventCount = useMemo(() => new Set(staging.list.map((d) => d.eventId)).size, [staging.list]);
  const issueCount = staging.list.filter((d) => d.issue).length;
  const effectiveActive = activeRowId && pageRows.some((r) => rowIdOf(r) === activeRowId) ? activeRowId : pageRows[0] ? rowIdOf(pageRows[0]) : null;

  useEffect(() => { setPage(0); }, [eventId, filters, sort]);
  useEffect(() => {
    if (!focusRequest) return;
    rowRefs.current.get(focusRequest.rowId)?.focus();
  }, [focusRequest]);

  // Stable callbacks for memoized rows read the latest values from a ref.
  const latest = useRef({ findingByRow, pageRows, staging, safePage, pageCount, visible });
  latest.current = { findingByRow, pageRows, staging, safePage, pageCount, visible };

  const focusRow = useCallback((rowId: string) => {
    setActiveRowId(rowId);
    setFocusRequest((prev) => ({ rowId, n: (prev?.n ?? 0) + 1 }));
  }, []);

  const registerRef = useCallback((rowId: string, element: HTMLDivElement | null) => {
    if (element) rowRefs.current.set(rowId, element);
    else rowRefs.current.delete(rowId);
  }, []);

  const onEditor = useCallback((rowId: string, kind: EditorKind | null, member?: MemberSnapshot | null) => {
    setActiveRowId(rowId);
    if (!kind) {
      setEditor(null);
      focusRow(rowId);
      return;
    }
    if (isLocked(latest.current.staging.staged.get(rowId))) return;
    setEditor({ rowId, kind, member: member ?? null });
  }, [focusRow]);

  const onStage = useCallback((rowId: string, input: StageInput) => {
    const { findingByRow: byRow, pageRows: rows, staging: stage } = latest.current;
    const finding = byRow.get(rowId);
    if (!finding) return;
    const problem = stagingError(finding, input);
    if (problem) { toast.error(problem); return; }
    stage.stage(stageDecision(finding, input));
    setEditor(null);
    const count = stage.staged.has(rowId) ? stage.count : stage.count + 1;
    setAnnouncement(`Staged ${KIND_LABELS[input.kind]} for ${finding.record.display_name || 'row'} (sheet row ${finding.sheetRow}). ${count} staged.`);
    const index = rows.findIndex((r) => rowIdOf(r) === rowId);
    const next = rows[index + 1] ?? rows[index];
    if (next) focusRow(rowIdOf(next));
  }, [focusRow]);

  const onUnstage = useCallback((rowId: string) => {
    latest.current.staging.unstage(rowId);
    setAnnouncement('Staged decision removed.');
    focusRow(rowId);
  }, [focusRow]);

  const onToggle = selection.toggle;
  const onOpenFull = useCallback((rowId: string) => setOpenRowId(rowId), []);

  const moveTo = (index: number) => {
    const { pageRows: rows, safePage: p, pageCount: count } = latest.current;
    if (index >= rows.length && p < count - 1) { setPage(p + 1); return; }
    if (index < 0 && p > 0) { setPage(p - 1); return; }
    const target = rows[Math.max(0, Math.min(index, rows.length - 1))];
    if (target) focusRow(rowIdOf(target));
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === '?' && !isTypingTarget(event.target)) { event.preventDefault(); setShowHelp((v) => !v); return; }
    const target = event.target as HTMLElement;
    const rowElement = target.closest('[data-row-id]');
    // Shortcuts act only when the row itself has focus, never inside its inputs or buttons.
    if (!rowElement || target !== rowElement) return;
    const rowId = rowElement.getAttribute('data-row-id') as string;
    const finding = findingByRow.get(rowId);
    if (!finding) return;
    const index = pageRows.findIndex((r) => rowIdOf(r) === rowId);
    const allowed = allowedActions(finding);
    const decidable = !isLocked(staging.staged.get(rowId));
    const open = (kind: EditorKind) => { if (decidable && allowed.includes(kind)) onEditor(rowId, kind); };
    switch (event.key) {
      case 'ArrowDown': case 'j': moveTo(index + 1); break;
      case 'ArrowUp': case 'k': moveTo(index - 1); break;
      case 'Home': moveTo(0); break;
      case 'End': moveTo(pageRows.length - 1); break;
      case ' ': case 'x': selection.toggle(rowId); break;
      case 'm': open(allowed.includes('reassign') ? 'reassign' : 'restore'); break;
      case 'c': open('create_member'); break;
      case 'd': open('dismiss'); break;
      case 'n': if (finding.status !== 'needs_info') open('needs_info'); break;
      case 'u': onUnstage(rowId); break;
      case 'U': if (event.shiftKey) staging.undoLast(); break;
      case 'Enter': case 'e': setOpenRowId(rowId); break;
      default: return;
    }
    event.preventDefault();
  };

  const changeEvent = (next: string | null) => {
    setEditor(null);
    setEventId(next);
    setFilters((f) => ({ ...f, importJobId: '' }));
  };

  const eligibility = useCallback((kind: BulkKind, reason?: DismissReason) =>
    bulkEligibility(kind, selection.selectedRows.filter((r) => !isLocked(staging.staged.get(rowIdOf(r)))), { reason }),
  [selection.selectedRows, staging.staged]);

  const onBulkStage = (kind: BulkKind, options: { note: string; reason: DismissReason }) => {
    const plan = eligibility(kind, options.reason);
    const decisions = plan.eligible.map((insight) => {
      const { record } = insight.finding;
      const input: StageInput = kind === 'needs_info' ? { kind, note: options.note }
        : kind === 'dismiss' ? { kind, reason: options.reason, note: options.note }
        : {
          kind: 'create_member',
          newMember: {
            ...splitDisplayName(record.display_name),
            email: record.csv_email ?? '', college: record.csv_college ?? '', year: record.csv_year ?? '',
          },
        };
      return { insight, input, problem: stagingError(insight.finding, input) };
    });
    const ok = decisions.filter((d) => !d.problem);
    staging.stageMany(ok.map((d) => stageDecision(d.insight.finding, d.input, { origin: 'bulk' })));
    const failed = decisions.length - ok.length;
    setAnnouncement(`Staged ${ok.length} row${ok.length === 1 ? '' : 's'}${failed ? `; ${failed} could not be staged` : ''}.`);
    if (failed) toast.error(`${failed} row${failed === 1 ? '' : 's'} could not be staged: ${decisions.find((d) => d.problem)?.problem}`);
    selection.clear();
  };

  const onClearStaged = () => {
    if (staging.count === 0) return;
    if (!window.confirm(`Clear ${staging.count} staged decision${staging.count === 1 ? '' : 's'}? Nothing has been written; this only discards your staged work.`)) return;
    staging.clearAll();
    setAnnouncement('Staged decisions cleared.');
  };

  const onFresh = useCallback((freshRecords: RecoveryFindingRecord[], freshActions: RecoveryActionRecord[]) => {
    client.setQueryData(FINDINGS_KEY, freshRecords);
    client.setQueryData(ACTIONS_KEY, freshActions);
  }, [client]);

  const onCommittedFound = useCallback((rowIds: ReadonlySet<string>) => {
    const { staging: stage } = latest.current;
    stage.replaceAll(stage.list.filter((d) => !rowIds.has(d.rowId)));
  }, []);

  const onUnknownResolved = useCallback((rowIds: ReadonlySet<string>) => {
    const { staging: stage } = latest.current;
    stage.replaceAll(stage.list.map((d) => (rowIds.has(d.rowId) && d.issue?.status === 'unknown'
      ? { ...d, issue: { status: 'failed' as const, message: `No record of the earlier attempt as of ${formatTime(Date.now())}. Applying again is safe and won't write twice.` } }
      : d)));
  }, []);

  const onReconfirm = useCallback((rowId: string, member: MemberSnapshot) => {
    const { staging: stage } = latest.current;
    const decision = stage.staged.get(rowId);
    if (decision && !isLocked(decision)) stage.stage(reconfirmMember(decision, member));
  }, []);

  const onBatchFinished = useCallback(async (results: ApplyItemResult[]) => {
    const { staging: stage } = latest.current;
    stage.replaceAll(reconcileStaging(stage.list, results));
    await Promise.all(RECOVERY_INVALIDATIONS.map((key) => client.invalidateQueries(key as string[])));
    setAnnouncement(`Batch finished: ${results.filter((r) => r.status === 'applied' || r.status === 'replayed').length} of ${results.length} applied.`);
  }, [client]);

  const refreshAfterSingle = async (result: RecoverResult) => {
    if (openRowId && staging.staged.has(openRowId)) staging.unstage(openRowId);
    await Promise.all(RECOVERY_INVALIDATIONS.map((key) => client.invalidateQueries(key as string[])));
    toast.success(result.replayed ? 'Already applied earlier; nothing was written twice.' : OUTCOME_LABELS[result.outcome]);
  };

  const loading = records.isLoading || actions.isLoading;
  const loadError: unknown = records.error ?? actions.error;
  const openFinding = openRowId ? findingByRow.get(openRowId) ?? null : null;
  const nextEvent = nextUnfinishedEvent(progress, eventId);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const setFilter = <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]" aria-labelledby="historical-recovery-title">
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      <div className="border-b border-[var(--color-border)] px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="historical-recovery-title" className="font-sans text-base font-semibold tracking-[-0.01em] text-[var(--color-text)]">
              Historical Recovery
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text2)]">
              Review one event at a time. Stage decisions inline, then check and apply them together. A flag is a reason to look, not proof; nothing is written until you apply, and attendance is never removed here.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5" role="tablist" aria-label="Recovery view">
            {(['reconcile', 'history'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400',
                  view === key
                    ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-[#050810]'
                    : 'border-[var(--color-border)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]',
                )}
              >
                {key === 'reconcile' ? 'Reconcile' : 'Recovery history'}
              </button>
            ))}
            <button type="button" className={smallBtn} onClick={() => { void records.refetch(); void actions.refetch(); refetchLookups(); }}>
              Refresh
            </button>
          </div>
        </div>

        {!loading && loadError == null && progress.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-64">
              <label htmlFor="recovery-event" className="mb-1 block text-xs font-medium text-[var(--color-text2)]">Event</label>
              <select id="recovery-event" className={cn(selectCls, 'w-full text-sm')} value={eventId ?? ''} onChange={(e) => changeEvent(e.target.value || null)}>
                {progress.map((p) => (
                  <option key={p.eventId} value={p.eventId}>
                    {p.name} · {formatDate(p.date)} — {p.open} open{p.staged ? ` · ${p.staged} staged` : ''} · {p.done}/{p.total} done
                  </option>
                ))}
              </select>
            </div>
            {jobOptions.length > 1 && (
              <div>
                <label htmlFor="recovery-job" className="mb-1 block text-xs font-medium text-[var(--color-text2)]">Import job</label>
                <select id="recovery-job" className={selectCls} value={filters.importJobId} onChange={(e) => setFilter('importJobId', e.target.value)}>
                  <option value="">All imports</option>
                  {jobOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
            )}
            {nextEvent && (
              <button type="button" className={smallBtn} onClick={() => changeEvent(nextEvent)}>Next unfinished event →</button>
            )}
          </div>
        )}

        {current && view === 'reconcile' && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text2)]" aria-label="Counts for this event">
              <span><strong className="tabular-nums text-[var(--color-text)]">{counts.total}</strong> total</span>
              <span><strong className="tabular-nums text-[var(--color-text)]">{counts.unresolved}</strong> unresolved</span>
              <span><strong className="tabular-nums text-amber-700 dark:text-amber-300">{counts.staged}</strong> staged</span>
              <span><strong className="tabular-nums text-[var(--color-text)]">{counts.recovered}</strong> recovered</span>
              <span><strong className="tabular-nums text-[var(--color-text)]">{counts.dismissed}</strong> dismissed</span>
              <span><strong className="tabular-nums text-[var(--color-text)]">{counts.needsInfo}</strong> need info</span>
              <span><strong className="tabular-nums text-[var(--color-text)]">{counts.investigate}</strong> investigating</span>
              <span><strong className="tabular-nums text-[var(--color-text)]">{counts.ambiguous}</strong> ambiguous left</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${current.name} completion`}
              aria-valuemin={0}
              aria-valuemax={current.total}
              aria-valuenow={current.done}
              aria-valuetext={`${current.done} of ${current.total} findings recovered or dismissed`}
              className="mt-2 h-1.5 overflow-hidden rounded bg-[var(--color-surface2)]"
            >
              <div className="h-full bg-emerald-600 transition-all dark:bg-emerald-400" style={{ width: `${current.total ? (current.done / current.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {view === 'reconcile' && current && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="recovery-search">Search attendee or member</label>
            <input
              id="recovery-search"
              type="search"
              className={cn(inputCls, 'w-full py-1 text-xs sm:w-56')}
              placeholder="Search name or email"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
            <label className="sr-only" htmlFor="recovery-status">Status</label>
            <select id="recovery-status" className={selectCls} value={filters.status} onChange={(e) => setFilter('status', e.target.value as StatusFilter)}>
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => <option key={key} value={key}>{STATUS_LABELS[key]}</option>)}
            </select>
            <label className="sr-only" htmlFor="recovery-tier">Triage</label>
            <select id="recovery-tier" className={selectCls} value={filters.tier} onChange={(e) => setFilter('tier', e.target.value as TriageTier | '')}>
              <option value="">All triage groups</option>
              {(Object.keys(TIER_LABELS) as TriageTier[]).map((key) => <option key={key} value={key}>{TIER_LABELS[key]}</option>)}
            </select>
            <label className="sr-only" htmlFor="recovery-kind">Issue type</label>
            <select id="recovery-kind" className={selectCls} value={filters.kind} onChange={(e) => setFilter('kind', e.target.value as HistoricalKind | '')}>
              <option value="">All issue types</option>
              {kindOptions.map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}
            </select>
            <label className="sr-only" htmlFor="recovery-sort">Sort</label>
            <select id="recovery-sort" className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => <option key={key} value={key}>Sort: {SORT_LABELS[key]}</option>)}
            </select>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Quick lenses">
              {(Object.keys(LENS_LABELS) as Array<Exclude<LensFilter, ''>>).map((lens) => (
                <button
                  key={lens}
                  type="button"
                  aria-pressed={filters.lens === lens}
                  onClick={() => setFilter('lens', filters.lens === lens ? '' : lens)}
                  className={cn(chip, 'border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                    filters.lens === lens ? 'border-brand-600 bg-brand-600/10 text-brand-700 dark:border-brand-400 dark:text-brand-400' : 'border-[var(--color-border)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]')}
                >
                  {LENS_LABELS[lens]}
                </button>
              ))}
            </div>
            {filtersActive && <button type="button" className={smallBtn} onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>}
            <button type="button" className={cn(smallBtn, 'ml-auto')} aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)}>Shortcuts (?)</button>
          </div>
        )}
        {showHelp && view === 'reconcile' && (
          <dl className="mt-2 grid gap-x-6 gap-y-1 rounded border border-[var(--color-border)] p-3 text-xs sm:grid-cols-2" aria-label="Keyboard shortcuts">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={keys} className="flex gap-2">
                <dt className="w-28 shrink-0 font-mono text-[var(--color-text)]">{keys}</dt>
                <dd className="text-[var(--color-text2)]">{label}</dd>
              </div>
            ))}
            <p className="text-[var(--color-text3)] sm:col-span-2">Shortcuts work when a row has focus (click it or Tab to the table), never while typing.</p>
          </dl>
        )}
      </div>

      {loading && (
        <div className="space-y-2 px-5 py-6" aria-busy="true" aria-label="Loading findings">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}
      {loadError != null && (
        <div role="alert" className="px-5 py-4 text-sm text-red-700 dark:text-red-300">
          {toUserMessage(loadError, 'Unable to load historical findings.')} If this is a new deployment, the recovery migration may not be applied yet.
        </div>
      )}
      {!loading && loadError == null && progress.length === 0 && (
        <div className="px-5 py-8 text-sm text-[var(--color-text3)]">No historical import findings need review.</div>
      )}

      {!loading && loadError == null && view === 'history' && (
        <RecoveryHistoryList actions={actions.data ?? []} findingByRow={findingByRow} eventId={eventId} importJobId={filters.importJobId} />
      )}

      {!loading && loadError == null && view === 'reconcile' && current && (
        <>
          {lookupError != null && (
            <div role="alert" className="mx-4 mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              Member details could not be loaded, so suggestions are incomplete. Identity decisions still work through the picker.
              <button type="button" className={cn(smallBtn, 'ml-2')} onClick={refetchLookups}>Retry</button>
            </div>
          )}
          <div role="grid" aria-label={`Findings for ${current.name}`} aria-rowcount={visible.length + 1} aria-busy={lookupsLoading} onKeyDown={onGridKeyDown}>
            <div role="row" aria-rowindex={1} className="hidden border-b border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-label text-[var(--color-text3)] md:grid md:grid-cols-[1.75rem_minmax(0,1.15fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.25fr)] md:gap-x-4">
              <span role="columnheader"><span className="sr-only">Selected</span></span>
              <span role="columnheader">Attendee on the sheet</span>
              <span role="columnheader">Issue and evidence</span>
              <span role="columnheader">Suggested or credited member</span>
              <span role="columnheader">Status and decision</span>
            </div>
            {pageRows.length === 0 ? (
              <div role="row" className="px-5 py-8 text-sm text-[var(--color-text3)]">
                <span role="gridcell">
                  Nothing matches these filters.{' '}
                  {filtersActive && <button type="button" className="underline" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>}
                </span>
              </div>
            ) : pageRows.map((insight, index) => {
              const rowId = rowIdOf(insight);
              return (
                <RecoveryRow
                  key={rowId}
                  insight={insight}
                  staged={staging.staged.get(rowId)}
                  selected={selection.isSelected(rowId)}
                  active={effectiveActive === rowId}
                  editor={editor?.rowId === rowId ? editor.kind : null}
                  editorMember={editor?.rowId === rowId ? editor.member : null}
                  lookup={lookup}
                  rowIndex={safePage * PAGE_SIZE + index}
                  onToggle={onToggle}
                  onActivate={setActiveRowId}
                  onEditor={onEditor}
                  onStage={onStage}
                  onUnstage={onUnstage}
                  onOpenFull={onOpenFull}
                  registerRef={registerRef}
                />
              );
            })}
          </div>
          {pageCount > 1 && (
            <nav className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-[var(--color-text2)]" aria-label="Findings pages">
              <span>Rows {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, visible.length)} of {visible.length}</span>
              <span className="flex gap-1.5">
                <button type="button" className={smallBtn} disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
                <button type="button" className={smallBtn} disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button>
              </span>
            </nav>
          )}
        </>
      )}

      {!loading && loadError == null && view === 'reconcile' && (current || staging.count > 0) && (
        <BatchToolbar
          selectedCount={selection.count}
          allOnPage={selection.allOnPage}
          pageCount={pageRows.length}
          canSelectAllMatching={selection.canSelectAllMatching}
          totalMatching={selection.totalMatching}
          onSelectPage={selection.selectPage}
          onSelectAllMatching={selection.selectAllMatching}
          onClearSelection={selection.clear}
          stagedCount={staging.count}
          stagedEventCount={stagedEventCount}
          issueCount={issueCount}
          canUndo={staging.canUndo}
          onUndo={staging.undoLast}
          onClearStaged={onClearStaged}
          onReview={() => { setEditor(null); setReviewOpen(true); }}
          eligibility={eligibility}
          onBulkStage={onBulkStage}
        />
      )}

      {reviewOpen && (
        <BatchReviewDialog
          staged={staging.list}
          onClose={() => setReviewOpen(false)}
          onFresh={onFresh}
          onCommittedFound={onCommittedFound}
          onUnknownResolved={onUnknownResolved}
          onReconfirm={onReconfirm}
          onFinished={onBatchFinished}
        />
      )}
      {openFinding && !attendanceMemberId && (
        <RecoveryFindingDialog
          key={openFinding.record.row_id}
          finding={openFinding}
          onClose={() => { setOpenRowId(null); focusRow(openFinding.record.row_id); }}
          onRecovered={refreshAfterSingle}
          onOpenMemberAttendance={setAttendanceMemberId}
          allRecords={records.data}
        />
      )}
      {attendanceMemberId && (
        <MemberAttendanceModal
          memberId={attendanceMemberId}
          onClose={() => setAttendanceMemberId(null)}
          onChanged={() => client.invalidateQueries(['attendance-recovery'])}
        />
      )}
    </section>
  );
}
