import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aceAssignmentsRepository } from '../../../data/repos/aceAssignments';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { toUserMessage } from '../../../data/errors';
import { ACE_ASSIGNMENT_CYCLES_KEY } from '../../../hooks/useAceAssignments';
import { aceEligibilityEventsKey, type AceEligibilityState } from '../../../hooks/useAceEligibility';
import { ACTIVITY_ACTIONS } from '../../../lib/adminActivity';
import { formatAcademicYear } from '../../../lib/aceAssignments';
import { aceEligibilityReviewCsv } from '../../../lib/aceEligibilityExport';
import { downloadCsv } from '../../../lib/housePlacementExport';
import {
  DEFAULT_BIG_MIN_EVENTS,
  DEFAULT_LITTLE_MIN_EVENTS,
  ELIGIBILITY_STATUSES,
  ELIGIBILITY_STATUS_LABEL,
  MAX_QUALIFYING_EVENTS,
  isValidMinimum,
  qualifyingEventProblem,
  unreachableMinimums,
  type AceEligibilityRole,
  type AceEligibilityRow,
  type AceEligibilityStatus,
} from '../../../lib/aceEligibility';
import { isAceEventAttendanceVerified } from '../../../lib/aceParticipationReview';
import { cn } from '../../../lib/utils';
import type { AceAssignmentCycle } from '../../../types';

const primaryBtnCls =
  'rounded border-0 bg-brand-600 px-3 py-1.5 font-sans text-xs font-medium text-white hover:bg-brand-700 dark:bg-brand-300 dark:text-brand-950 dark:hover:bg-brand-200 disabled:opacity-50';
const ghostBtnCls =
  'rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 font-sans text-xs font-medium text-[var(--color-text2)] transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50';
const inputCls =
  'rounded border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 font-sans text-sm text-[var(--color-text)] placeholder-[var(--color-text3)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

const STATUS_TONE: Record<AceEligibilityStatus, string> = {
  meets: 'border-green-600/40 text-green-700 dark:text-green-400',
  short: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  unknown: 'border-[var(--color-border)] text-[var(--color-text2)]',
  'needs-identity-review': 'border-[var(--color-border)] text-[var(--color-text2)]',
};

type StatusFilter = 'all' | 'attention' | AceEligibilityStatus;
type RoleFilter = 'all' | AceEligibilityRole;

const sameSet = (a: ReadonlySet<string>, b: readonly string[]) => a.size === b.length && b.every((id) => a.has(id));

function shortDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'no date';
}

interface AceEligibilityPanelProps {
  cycle: AceAssignmentCycle;
  eligibility: AceEligibilityState;
}

/**
 * Admin → ACE → Assignments → Eligibility. The ACE Chair saves the qualifying
 * events and the Little/Big minimums while the cycle is a draft; the check
 * below then shows who meets them. Private and read-only apart from the
 * policy: no per-person result is stored, published or turned into points.
 */
export function AceEligibilityPanel({ cycle, eligibility }: AceEligibilityPanelProps) {
  const queryClient = useQueryClient();
  const { policy, savedEventIds, readiness, result, loading, refreshing, error } = eligibility;
  const editable = cycle.status === 'draft';

  const savedLittle = cycle.little_min_events ?? null;
  const savedBig = cycle.big_min_events ?? null;
  const [littleMin, setLittleMin] = useState(String(savedLittle ?? DEFAULT_LITTLE_MIN_EVENTS));
  const [bigMin, setBigMin] = useState(String(savedBig ?? DEFAULT_BIG_MIN_EVENTS));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(savedEventIds ?? []));
  const [policyOpen, setPolicyOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');

  const savedKey = (savedEventIds ?? []).join(',');
  useEffect(() => {
    setLittleMin(String(savedLittle ?? DEFAULT_LITTLE_MIN_EVENTS));
    setBigMin(String(savedBig ?? DEFAULT_BIG_MIN_EVENTS));
    setSelected(new Set(savedKey ? savedKey.split(',') : []));
  }, [cycle.id, savedLittle, savedBig, savedKey]);
  // Until the saved event ids are read, "not saved" and "not loaded" look the
  // same; never offer Save over a policy that might exist.
  const policyKnown = savedEventIds !== null;
  const hasPolicy = !!policy;
  useEffect(() => setPolicyOpen(policyKnown && !hasPolicy && editable), [cycle.id, policyKnown, hasPolicy, editable]);

  const now = useMemo(() => new Date(readiness?.checkedAt ?? Date.now()), [readiness]);
  const choosable = useMemo(
    () =>
      (readiness?.events ?? [])
        .filter((event) => qualifyingEventProblem(event, now) === null)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [readiness, now],
  );
  const choosableIds = useMemo(() => new Set(choosable.map((event) => event.id)), [choosable]);
  const hiddenCount = (readiness?.events.length ?? 0) - choosable.length;
  const droppedOnSave = Array.from(selected).filter((id) => !choosableIds.has(id)).length;

  const little = Number(littleMin);
  const big = Number(bigMin);
  const minimumsValid = isValidMinimum(little) && isValidMinimum(big);
  const dirty =
    !policy || little !== savedLittle || big !== savedBig || !sameSet(selected, savedEventIds ?? []);
  const selectedCountable = Array.from(selected).filter((id) => choosableIds.has(id)).length;
  const draftUnreachable = minimumsValid ? unreachableMinimums({ littleMin: little, bigMin: big }, selectedCountable) : [];

  const save = useMutation({
    mutationFn: () =>
      aceAssignmentsRepository.saveEligibilityPolicy(cycle.id, {
        littleMin: little,
        bigMin: big,
        eventIds: Array.from(selected).filter((id) => choosableIds.has(id)),
      }),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACE_ASSIGNMENT_CYCLES_KEY }),
        queryClient.invalidateQueries({ queryKey: aceEligibilityEventsKey(cycle.id) }),
      ]);
      logAdminActivity({
        action: ACTIVITY_ACTIONS.aceEligibilitySaved,
        entityType: 'ace_assignment_cycle',
        entityId: cycle.id,
        academicYearStart: cycle.academic_year_start,
        summary: `Saved the ${formatAcademicYear(cycle.academic_year_start)} ACE eligibility policy: Littles ${little}, Bigs ${big}, ${saved.eventCount} qualifying events`,
      });
      toast.success('Eligibility policy saved.');
      setPolicyOpen(false);
    },
    onError: (err) => {
      toast.error(toUserMessage(err, 'Could not save the eligibility policy'));
    },
  });

  const toggleEvent = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on && next.size < MAX_QUALIFYING_EVENTS) next.add(id);
      else if (!on) next.delete(id);
      return next;
    });
  const selectAllCompleted = () => setSelected(new Set(choosable.slice(0, MAX_QUALIFYING_EVENTS).map((event) => event.id)));

  const rows = useMemo<AceEligibilityRow[]>(() => (result ? [...result.littles, ...result.bigs] : []), [result]);
  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (statusFilter === 'all' || (statusFilter === 'attention' ? row.status !== 'meets' : row.status === statusFilter)) &&
      (roleFilter === 'all' || row.role === roleFilter) &&
      (!needle || row.name.toLowerCase().includes(needle)),
  );
  const attentionCount = rows.filter((row) => row.status !== 'meets' && (roleFilter === 'all' || row.role === roleFilter)).length;
  const statusCount = (status: AceEligibilityStatus) =>
    rows.filter((row) => row.status === status && (roleFilter === 'all' || row.role === roleFilter)).length;

  return (
    <section aria-label="ACE eligibility check" className="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-[var(--color-text)]">Eligibility check</h3>
          <p className="mt-0.5 max-w-prose font-sans text-xs text-[var(--color-text2)]">
            Who meets the attendance minimums before sorting. Private to admins and read-only: nothing here is stored per
            person, shown publicly or turned into points. Short people are warnings, not blockers; you keep the final say.
          </p>
        </div>
        <button type="button" onClick={() => setPolicyOpen((open) => !open)} aria-expanded={policyOpen} className={ghostBtnCls}>
          {policyOpen ? 'Hide policy' : editable ? 'Edit qualifying events & minimums' : 'View policy'}
        </button>
      </div>

      {!policyKnown ? (
        <p className="font-sans text-xs text-[var(--color-text3)]">{loading ? 'Loading the saved policy…' : 'The saved policy could not be read.'}</p>
      ) : policy ? (
        <p className="font-sans text-xs text-[var(--color-text2)]">
          Littles need <strong className="text-[var(--color-text)]">{policy.littleMin}</strong>, Bigs need{' '}
          <strong className="text-[var(--color-text)]">{policy.bigMin}</strong> of{' '}
          {policy.eventIds.length} qualifying {policy.eventIds.length === 1 ? 'event' : 'events'}.
          {!editable && ` The policy is frozen while the cycle is ${cycle.status}.`}
        </p>
      ) : (
        <p role="note" className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-sans text-xs text-[var(--color-text2)]">
          No minimums are saved for this cycle yet.{' '}
          {editable ? 'Choose the qualifying events and save the minimums to run the check.' : 'Unlock the cycle to save them.'}
        </p>
      )}

      {error && (
        <p role="alert" className="font-sans text-xs text-red-600 dark:text-red-400">
          Eligibility could not be checked: {error}
        </p>
      )}

      {policyOpen && (
        <div className="space-y-3 rounded border border-[var(--color-border)] p-3">
          <div className="flex flex-wrap items-end gap-4">
            <label className={labelCls}>
              Little minimum
              <input type="number" min={1} max={20} step={1} value={littleMin} disabled={!editable || save.isPending}
                onChange={(e) => setLittleMin(e.target.value)} className={cn(inputCls, 'mt-1 block w-24')} />
            </label>
            <label className={labelCls}>
              Big minimum
              <input type="number" min={1} max={20} step={1} value={bigMin} disabled={!editable || save.isPending}
                onChange={(e) => setBigMin(e.target.value)} className={cn(inputCls, 'mt-1 block w-24')} />
            </label>
            {!policy && editable && (
              <p className="font-sans text-[11px] text-[var(--color-text3)]">
                Pre-filled with VSA's usual {DEFAULT_LITTLE_MIN_EVENTS} and {DEFAULT_BIG_MIN_EVENTS}. Nothing is checked until you save.
              </p>
            )}
          </div>
          {!minimumsValid && <p role="alert" className="font-sans text-xs text-red-600 dark:text-red-400">Minimums must be whole numbers from 1 to 20.</p>}

          <div className="flex flex-wrap items-center gap-2">
            <p className="font-sans text-xs font-semibold text-[var(--color-text)]">
              Qualifying events · {selected.size} selected
            </p>
            {editable && (
              <>
                <button type="button" onClick={selectAllCompleted} disabled={!choosable.length || save.isPending} className={ghostBtnCls}>
                  Select all completed events this year
                </button>
                <button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size || save.isPending} className={ghostBtnCls}>
                  Clear
                </button>
              </>
            )}
          </div>
          {!readiness ? (
            <p className="font-sans text-xs text-[var(--color-text3)]">{loading ? 'Loading this year’s events…' : 'Events are unavailable.'}</p>
          ) : choosable.length === 0 ? (
            <p className="font-sans text-xs text-[var(--color-text3)]">
              No completed, dated, published events in {formatAcademicYear(cycle.academic_year_start)} yet.
            </p>
          ) : (
            <fieldset className="max-h-64 overflow-y-auto rounded border border-[var(--color-border)]">
              <legend className="sr-only">Qualifying events for {formatAcademicYear(cycle.academic_year_start)}</legend>
              {choosable.map((event) => (
                <label key={event.id} className="flex min-h-11 items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 font-sans text-xs text-[var(--color-text)] last:border-b-0">
                  <input type="checkbox" checked={selected.has(event.id)} disabled={!editable || save.isPending}
                    onChange={(e) => toggleEvent(event.id, e.target.checked)} />
                  <span className="min-w-0 flex-1">
                    {event.name}
                    <span className="text-[var(--color-text3)]"> · {shortDate(event.date)} · {event.term_label ?? 'no term'}</span>
                  </span>
                  {!isAceEventAttendanceVerified(event, now) && (
                    <span className="shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text3)]">
                      import not verified
                    </span>
                  )}
                </label>
              ))}
            </fieldset>
          )}
          <p className="font-sans text-[11px] text-[var(--color-text3)]">
            Only completed, dated, published events can qualify{hiddenCount > 0 ? ` (${hiddenCount} other ${hiddenCount === 1 ? 'event is' : 'events are'} hidden)` : ''}.
            Attendance at an event counts once its import is verified in Houses → Attendance status.
          </p>
          {droppedOnSave > 0 && editable && (
            <p role="note" className="font-sans text-xs text-amber-700 dark:text-amber-400">
              {droppedOnSave} saved {droppedOnSave === 1 ? 'event no longer qualifies and will be' : 'events no longer qualify and will be'} removed when you save.
            </p>
          )}
          {editable && draftUnreachable.length > 0 && (
            <p role="note" className="font-sans text-xs text-amber-700 dark:text-amber-400">
              Only {selectedCountable} qualifying {selectedCountable === 1 ? 'event is' : 'events are'} selected, fewer than the{' '}
              {draftUnreachable.map((role) => (role === 'little' ? 'Little' : 'Big')).join(' and ')} minimum: nobody could meet it,
              so everyone linked would show as short.
            </p>
          )}
          {editable && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => save.mutate()} disabled={!policyKnown || !minimumsValid || !dirty || save.isPending || !readiness} className={primaryBtnCls}>
                {save.isPending ? 'Saving…' : policy ? 'Save policy' : 'Save minimums & events'}
              </button>
              {dirty && policy && <span className="font-sans text-[11px] text-[var(--color-text3)]">Unsaved changes. The check below uses the saved policy.</span>}
            </div>
          )}
        </div>
      )}

      {policy && !result && !error && (
        <p className="font-sans text-xs text-[var(--color-text3)]">{loading ? 'Checking attendance…' : 'Waiting for assignments to load…'}</p>
      )}

      {result && (
        <div className="space-y-3" aria-live="polite">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(['little', 'big'] as const).map((role) => (
              <div key={role} className="rounded border border-[var(--color-border)] p-3">
                <p className={labelCls}>{role === 'little' ? 'Littles' : 'Bigs'} · need {role === 'little' ? policy?.littleMin : policy?.bigMin}</p>
                <dl className="mt-1 grid grid-cols-4 gap-2 font-sans text-xs">
                  {ELIGIBILITY_STATUSES.map((status) => (
                    <div key={status}>
                      <dt className="text-[var(--color-text3)]">{ELIGIBILITY_STATUS_LABEL[status]}</dt>
                      <dd className="font-serif text-lg font-bold text-[var(--color-text)]">{result.counts[role][status]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          {result.unverifiedEventIds.length > 0 && (
            <p className="font-sans text-xs text-[var(--color-text2)]">
              {result.unverifiedEventIds.length} of {result.verifiedEventIds.length + result.unverifiedEventIds.length} counted
              events still have incomplete import evidence. People who could still reach the minimum through them show as Unknown.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
              {(['all', 'attention', ...ELIGIBILITY_STATUSES] as const).map((status) => (
                <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}
                  className={cn(ghostBtnCls, statusFilter === status && 'border-brand-600 text-[var(--color-text)] dark:border-brand-300')}>
                  {status === 'all' ? `All (${rows.filter((row) => roleFilter === 'all' || row.role === roleFilter).length})` : status === 'attention' ? `Needs attention (${attentionCount})` : `${ELIGIBILITY_STATUS_LABEL[status]} (${statusCount(status)})`}
                </button>
              ))}
            </div>
            <label className={labelCls}>
              Role
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} className={cn(inputCls, 'mt-1 block')}>
                <option value="all">Littles & Bigs</option>
                <option value="little">Littles</option>
                <option value="big">Bigs</option>
              </select>
            </label>
            <label className={labelCls}>
              Name
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names…" className={cn(inputCls, 'mt-1 block w-48')} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={loading || refreshing || !!error || !readiness || visible.length === 0}
              className={ghostBtnCls}
              onClick={() => {
                if (!readiness || loading || refreshing || error || visible.length === 0) return;
                downloadCsv(
                  aceEligibilityReviewCsv(visible, {
                    academicYearStart: cycle.academic_year_start,
                    checkedAt: readiness.checkedAt,
                  }),
                  `ace-eligibility-${cycle.academic_year_start}-filtered.csv`,
                );
              }}
            >
              Download visible eligibility CSV
            </button>
            <p className="font-sans text-[11px] text-[var(--color-text3)]">
              Private local download of {visible.length} filtered {visible.length === 1 ? 'person' : 'people'}.
              Keep the names within ACE leadership. No emails, IDs, or application answers included.
            </p>
          </div>

          {visible.length === 0 ? (
            <p className="font-sans text-xs text-[var(--color-text3)]">Nobody matches these filters.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)]">
              {visible.map((row) => (
                <li key={row.key} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 font-sans text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)]">
                      {row.name}{' '}
                      <span className="font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-[var(--color-text3)]">
                        {row.role === 'little' ? 'Little' : `Big · ${row.draftIds.length} ${row.draftIds.length === 1 ? 'Little' : 'Littles'}`}
                      </span>
                    </p>
                    <p className="text-[var(--color-text2)]">
                      {row.reason}
                      {row.pendingAttended > 0 && ` · ${row.pendingAttended} more at unverified events`}
                    </p>
                  </div>
                  <span className={cn('shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]', STATUS_TONE[row.status])}>
                    {ELIGIBILITY_STATUS_LABEL[row.status]}
                    {row.status === 'short' && row.remaining !== null && ` · ${row.remaining} to go`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
