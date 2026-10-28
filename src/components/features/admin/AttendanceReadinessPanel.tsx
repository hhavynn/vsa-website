// Protected domain — attendance / House points. Admin → Houses → Attendance
// status (#653): after each event, has its sign-in sheet been imported, is
// anything left to review, and was it checked? Read-only apart from an admin's
// recorded statement ("no sign-in", "checked by hand"), which never changes
// attendance or points. House credits shown here are private (#692).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { ATTENDANCE_READINESS_UNAVAILABLE, ReadinessEvent, attendanceReadinessRepository } from '../../../data/repos/attendanceReadiness';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { AttendanceState, STATE_LABEL, STATE_ORDER, eventStatus, isQualifying, summarize } from '../../../lib/attendanceReadiness';
import { cn } from '../../../lib/utils';

const QUERY_KEY = ['admin', 'attendance-readiness'];
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted';
const btn = 'min-h-[36px] touch:min-h-11 rounded border bg-transparent px-2.5 py-1 text-xs font-semibold border-[var(--color-border)] text-text-primary hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50';

const STATE_TONE: Record<AttendanceState, string> = {
  failed: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
  needs_review: 'border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300',
  pending_import: 'border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300',
  unknown: 'border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300',
  imported: 'border-[var(--color-border)] text-text-secondary',
  verified: 'border-emerald-400 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300',
  no_signin: 'border-[var(--color-border)] text-text-secondary',
  upcoming: 'border-[var(--color-border)] text-text-muted',
};

function laDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' });
}

type Attesting = { event: ReadinessEvent; status: 'no_signin' | 'verified' | 'cleared' };

export function AttendanceReadinessPanel({ selectedYear }: { selectedYear: number | null }) {
  const queryClient = useQueryClient();
  const { terms } = useAcademicTerms();
  const yearTerms = useMemo(() => terms.filter((term) => term.academic_year_start === selectedYear), [terms, selectedYear]);
  const [termId, setTermId] = useState<string | null>(null);
  const [qualifyingOnly, setQualifyingOnly] = useState(true);
  const [stateFilter, setStateFilter] = useState<AttendanceState | 'outstanding' | 'all'>('outstanding');
  const [attesting, setAttesting] = useState<Attesting | null>(null);
  const [note, setNote] = useState('');

  const readiness = useQuery(
    [...QUERY_KEY, selectedYear, termId],
    () => attendanceReadinessRepository.getReadiness(selectedYear as number, termId),
    { enabled: selectedYear !== null, retry: false, staleTime: 0, refetchOnWindowFocus: false },
  );
  const attest = useMutation(
    ({ event, status }: Attesting) => attendanceReadinessRepository.attest(event.id, status, note.trim() || null),
    { onSuccess: () => queryClient.invalidateQueries(QUERY_KEY) },
  );

  const now = useMemo(() => new Date(readiness.data?.checkedAt ?? Date.now()), [readiness.data?.checkedAt]);
  const scoped = useMemo(
    () => (readiness.data?.events ?? []).filter((event) => !qualifyingOnly || isQualifying(event)),
    [readiness.data, qualifyingOnly],
  );
  const summary = useMemo(() => summarize(scoped, now), [scoped, now]);
  const rows = useMemo(() => scoped
    .map((event) => ({ event, status: eventStatus(event, now) }))
    .filter(({ status }) => stateFilter === 'all'
      || (stateFilter === 'outstanding' ? ['failed', 'needs_review', 'pending_import', 'unknown'].includes(status.state) : status.state === stateFilter))
    .sort((a, b) => STATE_ORDER.indexOf(a.status.state) - STATE_ORDER.indexOf(b.status.state) || (b.event.date ?? '').localeCompare(a.event.date ?? '')),
  [scoped, now, stateFilter]);

  if (selectedYear === null) return <p className="p-6 text-sm text-text-muted">Choose an academic year.</p>;

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <section className="scrapbook-paper space-y-3 p-5 border-[var(--color-border)] bg-surface" aria-label="Attendance status">
        <div>
          <h2 className="font-serif text-xl font-bold text-text-primary">Attendance status · {formatAcademicYear(selectedYear)}</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Which events have their sign-in sheet imported and checked. House standings only reflect attendance that has been imported, so a quiet House may just be a missing import. Private: House credits stay embargoed. Nothing here changes attendance or points.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="readiness-term" className={labelCls}>Term</label>
            <select id="readiness-term" value={termId ?? ''} onChange={(event) => setTermId(event.target.value || null)} className="mt-1 min-h-[36px] rounded border px-2 py-1 text-sm bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary">
              <option value="">Whole year</option>
              {yearTerms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
            </select>
          </div>
          <label className="flex min-h-[36px] items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={qualifyingOnly} onChange={(event) => setQualifyingOnly(event.target.checked)} />
            Point-earning events only
          </label>
          <button type="button" className={btn} onClick={() => readiness.refetch()} disabled={readiness.isFetching}>
            {readiness.isFetching ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </section>

      {readiness.isLoading ? (
        <p className="px-1 text-xs text-text-muted" role="status">Checking events…</p>
      ) : readiness.isError || !readiness.data ? (
        <p role="alert" className="rounded border p-3 text-sm border-red-300 text-red-700 dark:border-red-800 dark:text-red-300">
          {readiness.error instanceof Error && readiness.error.message === ATTENDANCE_READINESS_UNAVAILABLE
            ? ATTENDANCE_READINESS_UNAVAILABLE
            : 'The status could not be loaded, so nothing is shown rather than a false "all done". Check again.'}
        </p>
      ) : (
        <>
          <div className="rounded border p-3 text-sm border-[var(--color-border)] bg-surface2" role="status">
            <p className="text-text-primary">
              {summary.lastCleanImport
                ? <>Last import with nothing left to review: <strong>{summary.lastCleanImport.eventName}</strong>, finished {laDate(summary.lastCleanImport.completedAt)}.</>
                : 'No import this year has finished with nothing left to review.'}
              {' '}
              {summary.outstanding > 0
                ? `${summary.outstanding} past event${summary.outstanding === 1 ? '' : 's'} may still change the standings.`
                : 'Every past event is accounted for.'}
            </p>
            <p className="mt-1 text-xs text-text-muted">Checked {new Date(readiness.data.checkedAt).toLocaleString()}.{readiness.data.truncated ? ` Showing the latest ${readiness.data.events.length} of ${readiness.data.totalEvents} events.` : ''}</p>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {(['outstanding', 'all', ...STATE_ORDER] as const).map((key) => {
              const count = key === 'all' ? scoped.length : key === 'outstanding' ? summary.outstanding : summary.counts[key];
              if (key !== 'all' && key !== 'outstanding' && count === 0) return null;
              return (
                <button key={key} type="button" aria-pressed={stateFilter === key} onClick={() => setStateFilter(key)} className={cn(btn, stateFilter === key && 'border-[var(--brand)] bg-[var(--color-surface2)]')}>
                  {key === 'all' ? 'All' : key === 'outstanding' ? 'Needs work' : STATE_LABEL[key]} ({count})
                </button>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-text-muted">{stateFilter === 'outstanding' ? 'Nothing needs work.' : 'No events match.'}</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)] bg-surface" aria-label="Events">
              {rows.map(({ event, status }) => (
                <li key={event.id} className="space-y-1.5 p-3 sm:p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0 break-words font-semibold text-text-primary">
                      {event.name}
                      <span className="ml-2 text-xs font-normal text-text-muted">{laDate(event.date)} · {event.term_label ?? 'No term'}{event.is_published ? '' : ' · unpublished'}</span>
                    </p>
                    <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]', STATE_TONE[status.state])}>{STATE_LABEL[status.state]}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{status.reason}</p>
                  {status.state !== 'upcoming' && (
                    <p className="text-xs text-text-muted">
                      {event.credits} credit{event.credits === 1 ? '' : 's'}
                      {event.latest_job ? ` · ${event.jobs} import${event.jobs === 1 ? '' : 's'}, latest ${event.latest_job.status} ${laDate(event.latest_job.completed_at ?? event.latest_job.created_at)}` : ' · no import record'}
                      {event.reconciled_at ? ` · reconciled ${laDate(event.reconciled_at)}` : ''}
                      {event.attestation ? ` · marked "${STATE_LABEL[event.attestation.status]}" ${laDate(event.attestation.attested_at)}${event.attestation.by_current_user ? ' by you' : ' by an admin'}${event.attestation.note ? `: ${event.attestation.note}` : ''}${event.attestation.status === 'no_signin' && event.credits > 0 ? ' (outdated: the event now has credits)' : ''}` : ''}
                      {event.reconciliation_pending_rows > 0 ? ` · ${event.reconciliation_pending_rows} reconciliation row${event.reconciliation_pending_rows === 1 ? '' : 's'} pending` : ''}
                    </p>
                  )}
                  {event.house_credits.length > 0 && (
                    <p className="text-xs text-text-secondary">
                      House credits: {event.house_credits.map((house) => `${house.display_name} ${house.credits}`).join(' · ')}
                    </p>
                  )}
                  {status.state !== 'upcoming' && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['failed', 'needs_review', 'pending_import'].includes(status.state) && (
                        <Link to="/admin/import" className={cn(btn, 'inline-flex items-center')}>Open Import<span className="sr-only"> for {event.name}</span></Link>
                      )}
                      {event.credits === 0 && !event.attestation && (
                        <button type="button" className={btn} onClick={() => { setNote(''); setAttesting({ event, status: 'no_signin' }); }}>Mark: no sign-in<span className="sr-only"> for {event.name}</span></button>
                      )}
                      {(status.state === 'imported' || status.state === 'unknown') && (
                        <button type="button" className={btn} onClick={() => { setNote(''); setAttesting({ event, status: 'verified' }); }}>Mark checked<span className="sr-only"> for {event.name}</span></button>
                      )}
                      {event.attestation && (
                        <button type="button" className={btn} onClick={() => { setNote(''); setAttesting({ event, status: 'cleared' }); }}>Withdraw mark<span className="sr-only"> for {event.name}</span></button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-text-muted">
            Totals that disagree with the standings? <Link to="/admin/houses?tab=points" className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline">Run the Points check</Link>.
          </p>
        </>
      )}

      {attesting && (
        <ConfirmDialog
          open
          danger={false}
          title={attesting.status === 'no_signin' ? 'Mark: no sign-in?' : attesting.status === 'verified' ? 'Mark as checked?' : 'Withdraw this mark?'}
          description={attesting.status === 'no_signin'
            ? <>Record that &ldquo;{attesting.event.name}&rdquo; had no sign-in sheet, so it stops showing as pending. This changes no attendance or points, and can be withdrawn.</>
            : attesting.status === 'verified'
              ? <>Record that you checked &ldquo;{attesting.event.name}&rdquo;&rsquo;s attendance against its sign-in sheet. This changes no attendance or points. A later import puts it back to Imported.</>
              : <>Withdraw the mark on &ldquo;{attesting.event.name}&rdquo;. Its status goes back to what the import records show.</>}
          confirmLabel={attesting.status === 'cleared' ? 'Withdraw' : 'Record'}
          onConfirm={() => attest.mutateAsync(attesting)}
          onClose={() => setAttesting(null)}
        >
          {attesting.status !== 'cleared' && (
            <div className="mt-3">
              <label htmlFor="attest-note" className={labelCls}>Note (optional)</label>
              <textarea id="attest-note" value={note} maxLength={500} rows={2} onChange={(event) => setNote(event.target.value)} className="mt-1 block w-full rounded border px-2 py-1.5 text-sm bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary" />
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
