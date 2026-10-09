import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DialogFrame, dialogBtnCls, dialogPrimaryCls } from '../../../common/ConfirmDialog';
import { attendanceRecoveryRepository } from '../../../../data/repos/attendanceRecovery';
import { toUserMessage } from '../../../../data/errors';
import {
  MemberSnapshot,
  RecoveryActionRecord,
  RecoveryFindingRecord,
  buildFindings,
  memberName,
} from '../../../../lib/attendanceRecovery';
import { runBulkWrites } from '../../../../lib/bulkWrites';
import {
  ALREADY_RECORDED_ACK,
  ApplyItemResult,
  GROUP_LABELS,
  GROUP_ORDER,
  MAX_BATCH,
  ReviewContext,
  ReviewItem,
  StagedDecision,
  TotalDrift,
  applicableItems,
  applyBatch,
  buildBatchReview,
  committedRowIds,
  creditedMemberId,
  describeItem,
  findTotalDrift,
  resultHeadline,
  summarizeLedger,
  summarizeResults,
  unlockableUnknown,
} from '../../../../lib/recoveryWorkspace';
import { cn } from '../../../../lib/utils';
import { MemberIdentity, PROGRESS_CLS, errorBox, formatTime, sectionLabel, smallBtn, warnBox } from './recoveryUi';

type Phase = 'checking' | 'error' | 'review' | 'running' | 'done';

/** A review older than this must be re-checked before applying. */
export const REVIEW_MAX_AGE_MS = 10 * 60 * 1000;
const APPLY_CONCURRENCY = 2;

const isWrite = (d: StagedDecision) => d.kind === 'restore' || d.kind === 'create_member' || d.kind === 'reassign';

/**
 * One consolidated confirmation for every staged decision. It re-reads the
 * findings, history, members, attendance, event points and email holders,
 * shows exactly what each row will change, lets the admin exclude rows, and
 * then applies through the existing single-row recovery function with bounded
 * concurrency. Every row reports its own result.
 */
export function BatchReviewDialog({
  staged,
  onClose,
  onFresh,
  onCommittedFound,
  onUnknownResolved,
  onReconfirm,
  onFinished,
}: {
  staged: readonly StagedDecision[];
  onClose: () => void;
  /** Fresh findings and history, so the table shows what the review saw. */
  onFresh: (records: RecoveryFindingRecord[], actions: RecoveryActionRecord[]) => void;
  /** Rows whose request is already in the history (a lost response): applied earlier. */
  onCommittedFound: (rowIds: ReadonlySet<string>) => void;
  /**
   * Rows whose last attempt got no answer, is not in the fresh history, and is
   * old enough that it can no longer be running: they unlock for editing.
   */
  onUnknownResolved: (rowIds: ReadonlySet<string>) => void;
  onReconfirm: (rowId: string, member: MemberSnapshot) => void;
  onFinished: (results: ApplyItemResult[]) => void | Promise<void>;
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [checkedAt, setCheckedAt] = useState(0);
  const [committedEarlier, setCommittedEarlier] = useState(0);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ApplyItemResult[]>([]);
  const [drift, setDrift] = useState<TotalDrift[] | null>(null);
  const [driftError, setDriftError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  const itemsRef = useRef<Map<string, ReviewItem>>(new Map());

  const check = useCallback(async () => {
    setPhase('checking');
    setError(null);
    try {
      const repo = attendanceRecoveryRepository;
      const [records, actions] = await Promise.all([repo.listFindingRecords(), repo.listActions()]);
      onFresh(records, actions);
      const committed = committedRowIds(stagedRef.current, actions);
      if (committed.size > 0) {
        setCommittedEarlier((count) => count + committed.size);
        onCommittedFound(committed);
      }
      const unknown = unlockableUnknown(stagedRef.current, committed);
      if (unknown.size > 0) onUnknownResolved(unknown);
      const remaining = stagedRef.current
        .filter((d) => !committed.has(d.rowId))
        .map((d) => (unknown.has(d.rowId) ? { ...d, issue: undefined } : d));
      const findings = new Map(buildFindings(records, actions).map((f) => [f.record.row_id, f]));
      const eventOf = (d: StagedDecision) => findings.get(d.rowId)?.record.event_id ?? d.eventId;

      const memberIds = new Set<string>();
      const byEvent = new Map<string, Set<string>>();
      remaining.forEach((d) => {
        const ids = [creditedMemberId(d), d.kind === 'reassign' ? d.fromMemberId : null].filter((id): id is string => !!id);
        ids.forEach((id) => memberIds.add(id));
        const eventId = eventOf(d);
        if (eventId && ids.length) byEvent.set(eventId, new Set([...Array.from(byEvent.get(eventId) ?? []), ...ids]));
      });
      const writeEvents = Array.from(new Set(remaining.filter(isWrite).map(eventOf).filter((id): id is string => !!id)));
      const creates = remaining.filter((d): d is Extract<StagedDecision, { kind: 'create_member' }> => d.kind === 'create_member');
      const createEmails = creates.map((d) => d.newMember.email).filter(Boolean);

      const [members, attendanceEntries, eventPoints, holders, roster] = await Promise.all([
        repo.getMembers(Array.from(memberIds)),
        Promise.all(Array.from(byEvent.entries()).map(async ([eventId, ids]) =>
          [eventId, new Set((await repo.getEventAttendance(eventId, Array.from(ids))).map((row) => row.member_id))] as const)),
        repo.getEventsPoints(writeEvents),
        repo.getMembersByEmails(createEmails),
        creates.length > 0 ? repo.listRoster() : Promise.resolve(undefined),
      ]);
      const ctx: ReviewContext = {
        findings,
        members: new Map(members.map((m) => [m.id, m])),
        attendance: new Map(attendanceEntries),
        eventPoints,
        emailHolders: new Map(holders.map((m) => [(m.email ?? '').trim().toLowerCase(), m])),
        roster,
      };
      const built = buildBatchReview(remaining, ctx);
      itemsRef.current = new Map(built.map((item) => [item.decision.rowId, item]));
      setItems(built);
      setExcluded((current) => new Set(Array.from(current).filter((id) => itemsRef.current.has(id))));
      setAcknowledged((current) => new Set(Array.from(current).filter((id) => itemsRef.current.get(id)?.requiresAck)));
      setReviewed(false);
      setCheckedAt(Date.now());
      setNow(Date.now());
      setPhase('review');
    } catch (err) {
      setError(toUserMessage(err, 'Could not check the staged changes against the database. Nothing was written.'));
      setPhase('error');
    }
  }, [onFresh, onCommittedFound, onUnknownResolved]);

  useEffect(() => {
    void check();
    // Checks once on open; later checks are explicit (Re-check, re-confirm).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check once the parent has applied a re-confirmation to `staged`.
  const [recheck, setRecheck] = useState(false);
  useEffect(() => {
    if (!recheck) return;
    setRecheck(false);
    void check();
  }, [recheck, staged, check]);

  useEffect(() => {
    if (phase !== 'review') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [phase]);

  const ledger = useMemo(() => summarizeLedger(items, excluded, acknowledged), [items, excluded, acknowledged]);
  const sending = useMemo(() => applicableItems(items, excluded, acknowledged), [items, excluded, acknowledged]);
  const unacknowledged = items.filter((item) => item.requiresAck && item.group !== 'blocked' && !excluded.has(item.decision.rowId) && !acknowledged.has(item.decision.rowId)).length;
  const reviewStale = phase === 'review' && now - checkedAt > REVIEW_MAX_AGE_MS;
  const oversized = sending.length > MAX_BATCH;
  /** Keeps the first MAX_BATCH sendable rows (in review order) and excludes the rest; they stay staged. */
  const limitToMax = () => setExcluded((current) => {
    const next = new Set(current);
    sending.slice(MAX_BATCH).forEach((item) => next.add(item.decision.rowId));
    return next;
  });

  const toggle = (setter: typeof setExcluded, rowId: string) => setter((current) => {
    const next = new Set(current);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    return next;
  });

  const apply = async () => {
    if (phase !== 'review' || !reviewed || sending.length === 0 || reviewStale || oversized) return;
    const decisions = sending.map((item) => item.decision);
    setPhase('running');
    setProgress({ done: 0, total: decisions.length });
    const outcome = await runBulkWrites(() => applyBatch(decisions, (request) => attendanceRecoveryRepository.recover(request), {
      concurrency: APPLY_CONCURRENCY,
      onProgress: (done, total) => setProgress({ done, total }),
    }));
    setResults(outcome);
    const affected = Array.from(new Set(outcome.flatMap((r) => (r.result && r.status === 'applied' ? [r.result.member_id, r.result.from_member_id] : []))
      .filter((id): id is string => !!id)));
    try {
      if (affected.length > 0) {
        const [fresh, rows] = await Promise.all([
          attendanceRecoveryRepository.getMembers(affected),
          attendanceRecoveryRepository.getAttendanceForMembers(affected),
        ]);
        setDrift(findTotalDrift(fresh, rows));
      } else {
        setDrift([]);
      }
    } catch {
      setDriftError(true);
    }
    await onFinished(outcome);
    setPhase('done');
  };

  const summary = summarizeResults(results);
  const nameOf = (rowId: string) => {
    const item = itemsRef.current.get(rowId);
    return `${item?.finding?.record.display_name || 'Unnamed row'} (row ${item?.finding?.sheetRow ?? '?'})`;
  };
  const eventName = (item: ReviewItem) => item.finding?.record.event_name ?? 'the event';

  return (
    <DialogFrame titleId={titleId} onClose={onClose} locked={phase === 'running'} wide panelClassName="max-w-4xl">
      <h2 id={titleId} className="font-sans text-base font-semibold text-[var(--color-text)]">
        {phase === 'done' ? 'Batch result' : `Review ${staged.length} staged change${staged.length === 1 ? '' : 's'}`}
      </h2>

      {phase === 'checking' && <p role="status" className="mt-3 text-sm text-[var(--color-text2)]">Checking every staged row against the current database…</p>}
      {phase === 'error' && (
        <div className="mt-3 space-y-2">
          <p role="alert" className={errorBox}>{error}</p>
          <button type="button" className={smallBtn} onClick={() => void check()}>Try again</button>
        </div>
      )}

      {phase === 'review' && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-[var(--color-text3)]">
            Checked against the database at {formatTime(checkedAt)}.{' '}
            <button type="button" className="underline" onClick={() => void check()}>Re-check</button>
          </p>
          {committedEarlier > 0 && (
            <p role="status" className="rounded border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              {committedEarlier} staged decision{committedEarlier === 1 ? ' was' : 's were'} already applied earlier (the response was lost) and {committedEarlier === 1 ? 'was' : 'were'} cleared. Nothing is written twice.
            </p>
          )}
          {reviewStale && <p role="alert" className={warnBox}>This check is more than 10 minutes old. Re-check before applying.</p>}
          {oversized && (
            <div role="alert" className={warnBox}>
              <p>
                {sending.length} changes are selected, but one batch applies at most {MAX_BATCH}. Nothing is cut short silently:
                exclude rows, or apply the first {MAX_BATCH} now and the rest in the next batch (they stay staged).
              </p>
              <button type="button" className={cn(smallBtn, 'mt-1.5')} onClick={limitToMax}>Apply the first {MAX_BATCH} now, keep the rest staged</button>
            </div>
          )}

          <section aria-labelledby={`${uid}-ledger`} className="rounded border border-[var(--color-border)] p-3">
            <h3 id={`${uid}-ledger`} className={sectionLabel}>Exact effects on the attendance ledger</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
              {[
                ['Attendance rows added', ledger.attendanceAdded],
                ['Points added (expected)', ledger.pointsAdded],
                ['New members created', ledger.membersCreated],
                ['Attendance removed', ledger.attendanceRemoved],
                ['Already recorded (no points)', ledger.alreadyRecorded],
                ['Originals flagged, kept', ledger.originalsFlagged],
                ['Dismissed', ledger.dismissed],
                ['Put on hold', ledger.onHold],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-[11px] text-[var(--color-text3)]">{label}</dt>
                  <dd className="font-semibold tabular-nums text-[var(--color-text)]">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-[var(--color-text2)]">
              {ledger.blocked > 0 && `${ledger.blocked} row${ledger.blocked === 1 ? '' : 's'} cannot be safely applied and will not be sent. `}
              {ledger.excluded > 0 && `${ledger.excluded} excluded or awaiting acknowledgement. `}
              Points are expected values: the database uses each event&apos;s points at the moment it applies, and member totals, the leaderboard and House standings recalculate from attendance automatically.
            </p>
            {ledger.memberTotals.length > 0 && (
              <details className="mt-2 text-xs text-[var(--color-text2)]">
                <summary className="cursor-pointer">Member totals that change ({ledger.memberTotals.length})</summary>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                  {ledger.memberTotals.map((t) => (
                    <li key={t.member.id}>{memberName(t.member)}: {t.pointsBefore} → {t.pointsAfter} pts, {t.eventsBefore} → {t.eventsAfter} events</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {GROUP_ORDER.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`${uid}-${group}`}>
                <h3 id={`${uid}-${group}`} className={cn(sectionLabel, group === 'blocked' && 'text-red-700 dark:text-red-300')}>
                  {GROUP_LABELS[group]} ({groupItems.length})
                </h3>
                <ul className="mt-1.5 divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)]">
                  {groupItems.map((item) => {
                    const rowId = item.decision.rowId;
                    const include = group !== 'blocked' && !excluded.has(rowId);
                    return (
                      <li key={rowId} className={cn('px-3 py-2 text-sm', !include && 'opacity-70')}>
                        <div className="flex flex-wrap items-start gap-2">
                          {group !== 'blocked' && (
                            <input
                              type="checkbox"
                              className="mt-1"
                              aria-label={`Include ${nameOf(rowId)}`}
                              checked={include}
                              onChange={() => toggle(setExcluded, rowId)}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--color-text)]">
                              {item.finding?.record.display_name || 'Unnamed row'}
                              <span className="font-normal text-[var(--color-text2)]"> · {eventName(item)} · sheet row {item.finding?.sheetRow ?? '?'}</span>
                            </p>
                            <ul className="mt-0.5 space-y-0.5 text-xs text-[var(--color-text2)]">
                              {describeItem(item, eventName(item)).map((line) => <li key={line}>{line}</li>)}
                            </ul>
                            {item.blockers.map((blocker) => <p key={blocker} className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{blocker}</p>)}
                            {item.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-800 dark:text-amber-300">{warning}</p>)}
                            {item.needsReconfirm && item.member && (
                              <div className="mt-1.5 rounded border border-[var(--color-border)] p-2">
                                <p className="text-[11px] text-[var(--color-text3)]">Current details</p>
                                <MemberIdentity member={item.member} />
                                <button type="button" className={cn(smallBtn, 'mt-1.5')} onClick={() => { onReconfirm(rowId, item.member as MemberSnapshot); setRecheck(true); }}>
                                  I re-verified: same person with these details
                                </button>
                              </div>
                            )}
                            {item.requiresAck && group !== 'blocked' && (
                              <label className="mt-1.5 flex items-start gap-2 text-xs text-[var(--color-text)]">
                                <input type="checkbox" className="mt-0.5" checked={acknowledged.has(rowId)} onChange={() => toggle(setAcknowledged, rowId)} />
                                <span><span className="font-medium">I understand this is permanent for this finding.</span> {ALREADY_RECORDED_ACK}</span>
                              </label>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="mt-0.5" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
            I reviewed these {sending.length} change{sending.length === 1 ? '' : 's'} and want to apply them.
          </label>
          {unacknowledged > 0 && <p className="text-xs text-amber-800 dark:text-amber-300">{unacknowledged} already-recorded row{unacknowledged === 1 ? '' : 's'} will be skipped until acknowledged.</p>}
        </div>
      )}

      {phase === 'running' && (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <p className="text-sm text-[var(--color-text)]">Applying {progress.done} of {progress.total}… At most {APPLY_CONCURRENCY} at a time; keep this tab open.</p>
          <progress
            aria-label="Batch progress"
            value={progress.done}
            max={Math.max(progress.total, 1)}
            className={cn(PROGRESS_CLS, 'h-2 [&::-webkit-progress-value]:bg-brand-600 dark:[&::-webkit-progress-value]:bg-brand-400 [&::-moz-progress-bar]:bg-brand-600 dark:[&::-moz-progress-bar]:bg-brand-400')}
          />
        </div>
      )}

      {phase === 'done' && (
        <div className="mt-3 space-y-3">
          <p role="status" className={cn('rounded border p-3 text-sm',
            summary.conflict + summary.failed + summary.unknown === 0
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
              : warnBox)}>
            {resultHeadline(summary)}
            {summary.pointsAwarded > 0 && ` ${summary.pointsAwarded} points awarded.`}
            {summary.membersCreated > 0 && ` ${summary.membersCreated} member${summary.membersCreated === 1 ? '' : 's'} created.`}
            {summary.replayed > 0 && ` ${summary.replayed} had already been applied, so nothing was written twice.`}
          </p>
          {results.some((r) => r.status === 'conflict' || r.status === 'failed' || r.status === 'unknown') && (
            <ul className="space-y-1 text-xs">
              {results.filter((r) => r.status === 'conflict' || r.status === 'failed' || r.status === 'unknown').map((r) => (
                <li key={r.rowId} className={r.status === 'unknown' ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}>
                  <span className="font-medium">{nameOf(r.rowId)}</span> · {r.status === 'unknown' ? 'no answer' : r.status}: {r.message}
                </li>
              ))}
            </ul>
          )}
          {drift && drift.length === 0 && (
            <p className="text-xs text-[var(--color-text2)]">Read-only check: every affected member&apos;s cached total matches their attendance.</p>
          )}
          {drift && drift.length > 0 && (
            <div className={warnBox} role="note">
              <p className="font-medium">Cached totals that do not match attendance (nothing was changed):</p>
              <ul className="mt-1 list-disc pl-4">
                {drift.map((d) => (
                  <li key={d.member.id}>{memberName(d.member)}: shows {d.member.points} pts / {d.member.events_attended} events; attendance sums to {d.ledgerPoints} / {d.ledgerEvents}.</li>
                ))}
              </ul>
              <p className="mt-1">Another write probably committed at the same moment. The attendance itself is correct; report this so the totals can be recalculated.</p>
            </div>
          )}
          {driftError && <p className="text-xs text-[var(--color-text3)]">The read-only totals check could not run.</p>}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={dialogBtnCls} disabled={phase === 'running'} onClick={onClose}>
          {phase === 'done' ? 'Close' : 'Cancel'}
        </button>
        {phase === 'done' && staged.length > 0 && (
          <button type="button" className={dialogBtnCls} onClick={() => { setResults([]); setDrift(null); void check(); }}>
            Review remaining {staged.length}
          </button>
        )}
        {phase === 'review' && (
          <button type="button" className={dialogPrimaryCls(false)} disabled={!reviewed || sending.length === 0 || reviewStale || oversized} onClick={() => void apply()}>
            Apply {sending.length} change{sending.length === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </DialogFrame>
  );
}
