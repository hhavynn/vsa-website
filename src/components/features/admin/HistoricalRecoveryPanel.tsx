import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { attendanceRecoveryRepository, RecoverResult } from '../../../data/repos/attendanceRecovery';
import { toUserMessage } from '../../../data/errors';
import {
  BUCKET_LABELS,
  FindingFilters,
  OUTCOME_LABELS,
  RecoveryBucket,
  RecoveryFinding,
  buildFindings,
  countByBucket,
  filterFindings,
  kindLabel,
} from '../../../lib/attendanceRecovery';
import { HistoricalKind } from '../../../lib/importHistoryAudit';
import { cn } from '../../../lib/utils';
import { RecoveryFindingDialog } from './RecoveryFindingDialog';

type Tab = RecoveryBucket | 'history';
const TABS: Tab[] = ['unresolved', 'needs_info', 'recovered', 'dismissed', 'history'];
const selectCls =
  'rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:focus:border-brand-400 dark:focus:ring-brand-400';

const PRIORITY_CLS = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-[var(--color-surface2)] text-[var(--color-text2)]',
} as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

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
];

export function HistoricalRecoveryPanel() {
  const client = useQueryClient();
  const records = useQuery(['attendance-recovery', 'findings'], () => attendanceRecoveryRepository.listFindingRecords(), { staleTime: 30_000 });
  const actions = useQuery(['attendance-recovery', 'actions'], () => attendanceRecoveryRepository.listActions(), { staleTime: 30_000 });
  const [tab, setTab] = useState<Tab>('unresolved');
  const [filters, setFilters] = useState<Omit<FindingFilters, 'bucket'>>({ eventId: '', importJobId: '', kind: '' });
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const findings = useMemo(
    () => (records.data && actions.data ? buildFindings(records.data, actions.data) : []),
    [records.data, actions.data],
  );
  const counts = useMemo(() => countByBucket(findings), [findings]);
  const findingByRow = useMemo(() => new Map(findings.map((f) => [f.record.row_id, f])), [findings]);
  const openFinding = openRowId ? findingByRow.get(openRowId) ?? null : null;

  const eventOptions = useMemo(() => {
    const map = new Map<string, string>();
    findings.forEach((f) => { if (f.record.event_id) map.set(f.record.event_id, `${f.record.event_name ?? 'Event'} · ${formatDate(f.record.event_date)}`); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [findings]);
  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    findings
      .filter((f) => !filters.eventId || f.record.event_id === filters.eventId)
      .forEach((f) => map.set(f.record.import_job_id, `${formatDate(f.record.job_created_at)} · ${f.record.event_name ?? 'Event'}`));
    return Array.from(map.entries());
  }, [findings, filters.eventId]);
  const kindOptions = useMemo(
    () => Array.from(new Set(findings.map((f) => f.classification.kind))).sort() as HistoricalKind[],
    [findings],
  );

  const visible = tab === 'history' ? [] : filterFindings(findings, { ...filters, bucket: tab });
  const history = useMemo(() => {
    const rows = (actions.data ?? []).filter((action) => {
      const finding = findingByRow.get(action.import_job_row_id);
      if (!finding) return !filters.eventId && !filters.importJobId && !filters.kind;
      return (!filters.eventId || finding.record.event_id === filters.eventId)
        && (!filters.importJobId || finding.record.import_job_id === filters.importJobId)
        && (!filters.kind || finding.classification.kind === filters.kind);
    });
    return rows.slice(0, 200);
  }, [actions.data, findingByRow, filters]);

  const refreshAfterRecovery = async (result: RecoverResult) => {
    await Promise.all(RECOVERY_INVALIDATIONS.map((key) => client.invalidateQueries(key as string[])));
    toast.success(result.replayed ? 'Already applied earlier; nothing was written twice.' : OUTCOME_LABELS[result.outcome]);
  };

  const loading = records.isLoading || actions.isLoading;
  const loadError: unknown = records.error ?? actions.error;
  const hasLoadError = loadError != null;

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]" aria-labelledby="historical-recovery-title">
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="historical-recovery-title" className="font-sans text-base font-semibold tracking-[-0.01em] text-[var(--color-text)]">
              Historical Recovery
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text2)]">
              Audited import rows that may have skipped someone or credited the wrong member. A flag is a reason to look, not proof.
              Each fix is one confirmed action; points change only through attendance and its triggers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void records.refetch(); void actions.refetch(); }}
            className="shrink-0 rounded border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text2)] hover:bg-[var(--color-surface2)]"
          >
            Refresh
          </button>
        </div>

        <div role="tablist" aria-label="Finding status" className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                tab === key
                  ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-[#050810]'
                  : 'border-[var(--color-border)] text-[var(--color-text2)] hover:bg-[var(--color-surface2)]',
              )}
            >
              {key === 'history' ? 'Recovery history' : BUCKET_LABELS[key]}
              {key !== 'history' && <span className="ml-1 opacity-80">{counts[key]}</span>}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="recovery-event">Event</label>
          <select id="recovery-event" className={selectCls} value={filters.eventId} onChange={(e) => setFilters({ ...filters, eventId: e.target.value, importJobId: '' })}>
            <option value="">All events</option>
            {eventOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <label className="sr-only" htmlFor="recovery-job">Import job</label>
          <select id="recovery-job" className={selectCls} value={filters.importJobId} onChange={(e) => setFilters({ ...filters, importJobId: e.target.value })}>
            <option value="">All imports</option>
            {jobOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <label className="sr-only" htmlFor="recovery-kind">Issue type</label>
          <select id="recovery-kind" className={selectCls} value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value as HistoricalKind | '' })}>
            <option value="">All issue types</option>
            {kindOptions.map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="px-5 py-8 text-sm text-[var(--color-text3)]">Loading findings…</div>}
      {hasLoadError && (
        <div role="alert" className="px-5 py-4 text-sm text-red-700 dark:text-red-300">
          {toUserMessage(loadError, 'Unable to load historical findings.')} If this is a new deployment, the recovery migration may not be applied yet.
        </div>
      )}

      {!loading && !hasLoadError && tab !== 'history' && (
        visible.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--color-text3)]">Nothing here for these filters.</div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map((finding) => <FindingRow key={finding.record.row_id} finding={finding} onOpen={() => setOpenRowId(finding.record.row_id)} />)}
          </ul>
        )
      )}

      {!loading && !hasLoadError && tab === 'history' && (
        history.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--color-text3)]">No recovery actions yet.</div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {history.map((action) => {
              const finding = findingByRow.get(action.import_job_row_id);
              return (
                <li key={action.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-[var(--color-text)]">
                      {OUTCOME_LABELS[action.outcome]}
                      {finding && <span className="font-normal text-[var(--color-text2)]"> · {finding.record.display_name || 'Unnamed row'} · {finding.record.event_name ?? 'Event'} · row {finding.sheetRow}</span>}
                    </span>
                    <span className="text-xs text-[var(--color-text3)]">{formatDateTime(action.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text2)]">
                    {action.points_awarded > 0 ? `${action.points_awarded} points awarded` : 'No points awarded'}
                    {action.created_member ? ' · new member created' : ''}
                    {action.removed_attendance ? ' · original attendance removed (kept in history)' : ''}
                    {action.reason_code ? ` · ${action.reason_code.replace(/_/g, ' ')}` : ''}
                    {action.note ? ` · “${action.note}”` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        )
      )}

      {openFinding && (
        <RecoveryFindingDialog
          key={openFinding.record.row_id}
          finding={openFinding}
          onClose={() => setOpenRowId(null)}
          onRecovered={refreshAfterRecovery}
        />
      )}
    </section>
  );
}

function FindingRow({ finding, onOpen }: { finding: RecoveryFinding; onOpen: () => void }) {
  const { record, classification, latestAction } = finding;
  return (
    <li aria-labelledby={`finding-${record.row_id}`} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span id={`finding-${record.row_id}`} className="font-medium text-[var(--color-text)]">{record.display_name || 'Unnamed row'}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', PRIORITY_CLS[classification.priority])}>{classification.priority}</span>
          <span className="rounded-full bg-[var(--color-surface2)] px-2 py-0.5 text-[11px] text-[var(--color-text2)]">{kindLabel(classification.kind)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--color-text2)]">
          {record.event_name ?? 'Event'} · {formatDate(record.event_date)} · import {formatDate(record.job_created_at)} · row {finding.sheetRow}
          {record.csv_email ? ` · ${record.csv_email}` : ''}
        </p>
        {latestAction && (
          <p className="mt-0.5 text-xs text-[var(--color-text3)]">
            {OUTCOME_LABELS[latestAction.outcome]} {formatDate(latestAction.created_at)}{latestAction.note ? ` · “${latestAction.note}”` : ''}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 self-start rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)] sm:self-center"
      >
        {finding.status === 'recovered' ? 'View' : 'Review'}
      </button>
    </li>
  );
}
