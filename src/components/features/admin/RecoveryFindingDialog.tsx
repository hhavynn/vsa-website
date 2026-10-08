import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import { DialogFrame, dialogBtnCls, dialogPrimaryCls } from '../../common/ConfirmDialog';
import { attendanceRecoveryRepository, RecoverResult } from '../../../data/repos/attendanceRecovery';
import { toUserMessage } from '../../../data/errors';
import {
  ACTION_LABELS,
  DISMISS_REASONS,
  DismissReason,
  MemberSnapshot,
  NewMemberInput,
  OUTCOME_LABELS,
  RESOLVE_REASONS,
  RecoveryActionKind,
  RecoveryFinding,
  RecoveryPlan,
  ResolveReason,
  allowedActions,
  describeRecoveryPlan,
  emailConflictMemberId,
  isStaleFinding,
  kindLabel,
  memberName,
  newRequestId,
  RecoveryFindingRecord,
  relatedMemberIds,
  rowsNamingMember,
  splitDisplayName,
  validatePlan,
} from '../../../lib/attendanceRecovery';
import { cn } from '../../../lib/utils';

const inputCls =
  'w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:focus:border-brand-400 dark:focus:ring-brand-400';
const labelCls = 'mb-1 block text-xs font-medium text-[var(--color-text2)]';
const sectionLabel = 'text-[11px] font-semibold uppercase tracking-label text-[var(--color-text3)]';

function normalizedName(name: string | null | undefined): string {
  return (name ?? '').replace(/[^A-Za-z ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date unknown';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MemberLine({ member, attended }: { member: MemberSnapshot; attended?: boolean }) {
  const details = [member.email, member.college, member.year].filter(Boolean).join(' · ');
  return (
    <span className="min-w-0">
      <span className="font-medium text-[var(--color-text)]">{memberName(member)}</span>
      <span className="block text-xs text-[var(--color-text2)]">{details || 'No email, college or year on file'}</span>
      <span className="block text-xs text-[var(--color-text3)]">
        {member.points} pts · {member.events_attended} events
        {attended !== undefined && (
          <span className={cn('ml-1 font-medium', attended ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--color-text2)]')}>
            · {attended ? 'already has attendance for this event' : 'no attendance for this event'}
          </span>
        )}
      </span>
    </span>
  );
}

function RecentAttendance({ memberId }: { memberId: string }) {
  const recent = useQuery(['attendance-recovery', 'recent', memberId], () => attendanceRecoveryRepository.getRecentAttendance(memberId), { staleTime: 0 });
  if (recent.isLoading) return <p className="text-xs text-[var(--color-text3)]">Loading attendance…</p>;
  if (recent.isError) return <p className="text-xs text-red-700 dark:text-red-300">Could not load attendance.</p>;
  const items = recent.data ?? [];
  if (items.length === 0) return <p className="text-xs text-[var(--color-text3)]">No attendance on record.</p>;
  return (
    <ul className="space-y-0.5 text-xs text-[var(--color-text2)]">
      {items.map((item) => (
        <li key={item.event_id}>
          {item.events?.name ?? 'Event'} · {formatDate(item.events?.date)} · {item.points_earned} pts
        </li>
      ))}
    </ul>
  );
}

/**
 * Pick one member. Candidates from the audit row are listed but never
 * preselected; a search covers everyone else.
 */
function MemberPicker({
  label,
  candidates,
  attendanceOf,
  excludeId,
  selected,
  onSelect,
}: {
  label: string;
  candidates: MemberSnapshot[];
  /** True or false once checked for this event; undefined while unknown. */
  attendanceOf: (memberId: string) => boolean | undefined;
  excludeId?: string | null;
  selected: MemberSnapshot | null;
  onSelect: (member: MemberSnapshot | null) => void;
}) {
  const searchId = useId();
  const [term, setTerm] = useState('');
  const search = useQuery(
    ['attendance-recovery', 'member-search', term.trim().toLowerCase()],
    () => attendanceRecoveryRepository.searchMembers(term),
    { enabled: term.trim().length >= 2, staleTime: 30_000 },
  );
  const options = useMemo(() => {
    const seen = new Set<string>();
    return [...candidates, ...(search.data ?? [])].filter((member) => {
      if (member.id === excludeId || seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    });
  }, [candidates, search.data, excludeId]);

  return (
    <fieldset className="space-y-2">
      <legend className={labelCls}>{label}</legend>
      <label htmlFor={searchId} className="sr-only">Search members by name or email</label>
      <input id={searchId} className={inputCls} value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search by name or email" />
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {options.length === 0 && (
          <p className="text-xs text-[var(--color-text3)]">{term.trim().length >= 2 ? (search.isLoading ? 'Searching…' : 'No members found.') : 'No suggested members. Search above.'}</p>
        )}
        {options.map((member) => (
          <label
            key={member.id}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded border px-2.5 py-2',
              selected?.id === member.id ? 'border-brand-600 bg-brand-600/5 dark:border-brand-400 dark:bg-brand-400/10' : 'border-[var(--color-border)]',
            )}
          >
            <input type="radio" className="mt-1" checked={selected?.id === member.id} onChange={() => onSelect(member)} />
            <MemberLine member={member} attended={attendanceOf(member.id)} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type Step = 'plan' | 'confirm' | 'done';

export function RecoveryFindingDialog({
  finding,
  onClose,
  onRecovered,
  onOpenMemberAttendance,
  allRecords = [],
}: {
  finding: RecoveryFinding;
  /** Every audited row, to show other rows that name the original member. */
  allRecords?: readonly RecoveryFindingRecord[];
  onClose: () => void;
  onRecovered: (result: RecoverResult) => void | Promise<void>;
  /** Opens the Admin Members attendance editor, the only place attendance is removed. */
  onOpenMemberAttendance?: (memberId: string) => void;
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const { record } = finding;
  const eventName = record.event_name ?? 'this event';
  const actions = allowedActions(finding);

  const detail = useQuery(['attendance-recovery', 'row', record.row_id], () => attendanceRecoveryRepository.getRowDetail(record.row_id), { staleTime: 0 });
  const relatedIds = useMemo(() => relatedMemberIds(record, detail.data?.match_details), [record, detail.data]);
  const related = useQuery(
    ['attendance-recovery', 'members', relatedIds.join(',')],
    () => attendanceRecoveryRepository.getMembers(relatedIds),
    { enabled: detail.isSuccess, staleTime: 0 },
  );
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const attendanceIds = useMemo(() => Array.from(new Set([...relatedIds, ...extraIds])), [relatedIds, extraIds]);
  const eventAttendance = useQuery(
    ['attendance-recovery', 'event-attendance', record.event_id, attendanceIds.join(',')],
    () => (record.event_id ? attendanceRecoveryRepository.getEventAttendance(record.event_id, attendanceIds) : Promise.resolve([])),
    { enabled: !!record.event_id && attendanceIds.length > 0, staleTime: 0 },
  );
  const attendedIds = useMemo(() => new Set((eventAttendance.data ?? []).map((row) => row.member_id)), [eventAttendance.data]);
  const attendanceOf = (memberId: string): boolean | undefined =>
    eventAttendance.isSuccess && !eventAttendance.isFetching && attendanceIds.includes(memberId) ? attendedIds.has(memberId) : undefined;
  // Members with exactly this name, even when the audit row recorded no candidates.
  const sameName = useQuery(
    ['attendance-recovery', 'same-name', record.display_name],
    () => attendanceRecoveryRepository.searchMembers(record.display_name ?? '', 25),
    { enabled: record.exact_name_members > 0 && !!record.display_name, staleTime: 0 },
  );
  const creditedMember = related.data?.find((member) => member.id === record.attendance_member_id) ?? null;
  const counterRows = useMemo(
    () => rowsNamingMember(allRecords, record.event_id, record.attendance_member_id, record.row_id),
    [allRecords, record.event_id, record.attendance_member_id, record.row_id],
  );
  const counterEvidence = counterRows.length > 0 && creditedMember && (
    <div className="rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Other import rows for this event also name {memberName(creditedMember)}. They may have attended:</p>
      <ul className="mt-1 list-disc pl-4">
        {counterRows.map((row) => (
          <li key={row.row_id}>
            {row.display_name || 'Unnamed row'}{row.csv_email ? ` · ${row.csv_email}` : ''} · import {formatDate(row.job_created_at)}, sheet row {row.source_row_index + 2} · {row.decision.replace(/_/g, ' ')}
          </li>
        ))}
      </ul>
    </div>
  );
  const candidates = useMemo(() => {
    const target = normalizedName(record.display_name);
    const seen = new Set<string>();
    return [...(related.data ?? []), ...(sameName.data ?? []).filter((member) => normalizedName(memberName(member)) === target)]
      .filter((member) => {
        if (member.id === record.attendance_member_id || seen.has(member.id)) return false;
        seen.add(member.id);
        return true;
      });
  }, [related.data, sameName.data, record.display_name, record.attendance_member_id]);
  useEffect(() => {
    if (candidates.length) setExtraIds((ids) => Array.from(new Set([...ids, ...candidates.map((member) => member.id)])));
  }, [candidates]);
  // Identity decisions wait for every lookup; a missing candidate list must never
  // read as "no similar members".
  const sameNameNeeded = record.exact_name_members > 0 && !!record.display_name;
  const lookupsFailed = detail.isError || related.isError || (sameNameNeeded && sameName.isError) || eventAttendance.isError;
  const lookupsReady = detail.isSuccess && related.isSuccess && (!sameNameNeeded || sameName.isSuccess)
    && (!record.event_id || attendanceIds.length === 0 || eventAttendance.isSuccess);
  const retryLookups = () => {
    void detail.refetch();
    void related.refetch();
    if (sameNameNeeded) void sameName.refetch();
    void eventAttendance.refetch();
  };

  const [action, setAction] = useState<RecoveryActionKind | null>(null);
  const [member, setMember] = useState<MemberSnapshot | null>(null);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [newMember, setNewMember] = useState<NewMemberInput>(() => ({
    ...splitDisplayName(record.display_name),
    email: record.csv_email ?? '',
    college: record.csv_college ?? '',
    year: record.csv_year ?? '',
  }));
  const [reason, setReason] = useState<DismissReason>('intentional_skip');
  const [resolveReason, setResolveReason] = useState<ResolveReason | null>(null);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<Step>('plan');
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [eventPoints, setEventPoints] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [emailHolder, setEmailHolder] = useState<MemberSnapshot | null>(null);
  const [result, setResult] = useState<RecoverResult | null>(null);
  const requestIdRef = useRef<string | null>(null);
  // The history state the admin reviewed. Refreshes while the dialog is open do
  // not move it, so a change by someone else is rejected as stale, never applied blind.
  const expectedPreviousRef = useRef<string | null>(finding.latestAction?.id ?? null);

  useEffect(() => {
    if (member) setExtraIds((ids) => (ids.includes(member.id) ? ids : [...ids, member.id]));
  }, [member]);

  const chooseAction = (next: RecoveryActionKind) => {
    setAction(next);
    setMember(null);
    setIdentityConfirmed(false);
    setError(null);
    setEmailHolder(null);
  };

  const buildPlan = async (): Promise<RecoveryPlan | null> => {
    if (!action) return null;
    switch (action) {
      case 'restore': {
        if (!member) { setError('Choose the member this attendee is.'); return null; }
        const [fresh] = await attendanceRecoveryRepository.getMembers([member.id]);
        if (!fresh) { setError('That member no longer exists. Choose again.'); return null; }
        const existing = await attendanceRecoveryRepository.getEventAttendance(record.event_id as string, [member.id]);
        return { action, member: fresh, memberAttended: existing.length > 0 };
      }
      case 'create_member':
        return { action, newMember };
      case 'reassign': {
        if (!creditedMember || !record.attendance_member_id) { setError('The originally credited member could not be loaded.'); return null; }
        if (!member) { setError('Choose the correct member.'); return null; }
        const fresh = await attendanceRecoveryRepository.getMembers([creditedMember.id, member.id]);
        const from = fresh.find((m) => m.id === creditedMember.id);
        const to = fresh.find((m) => m.id === member.id);
        if (!from || !to) { setError('A member no longer exists. Refresh and review again.'); return null; }
        const existing = await attendanceRecoveryRepository.getEventAttendance(record.event_id as string, [from.id, to.id]);
        if (!existing.some((row) => row.member_id === from.id)) {
          setError('The original member no longer has this attendance, so this is not a wrong match any more. Use Match existing member instead.');
          return null;
        }
        return { action, from, to, toAttended: existing.some((row) => row.member_id === to.id), note };
      }
      case 'resolve_investigation': {
        if (!resolveReason) { setError('Choose what the investigation found.'); return null; }
        const fromId = finding.latestAction?.from_member_id ?? record.attendance_member_id;
        const [from] = fromId ? await attendanceRecoveryRepository.getMembers([fromId]) : [];
        const existing = fromId && record.event_id ? await attendanceRecoveryRepository.getEventAttendance(record.event_id, [fromId]) : [];
        return { action, from: from ?? null, fromAttended: existing.length > 0, reason: resolveReason, note };
      }
      case 'dismiss':
        return { action, reason, note };
      case 'needs_info':
        return { action, note };
      case 'reopen':
        return { action, note };
    }
  };

  const review = async () => {
    setError(null);
    const needsIdentity = action === 'restore' || action === 'create_member' || action === 'reassign' || action === 'resolve_investigation';
    if (needsIdentity && !lookupsReady) {
      setError(lookupsFailed
        ? 'Member details could not be loaded, so identity cannot be checked. Retry before continuing.'
        : 'Still loading member details. Try again in a moment.');
      return;
    }
    if ((action === 'restore' || action === 'reassign') && !identityConfirmed) {
      setError('Confirm that you verified the identity before continuing.');
      return;
    }
    if (action === 'create_member' && candidates.length > 0 && !identityConfirmed) {
      setError('Confirm this attendee is a different person from the suggested members.');
      return;
    }
    setBusy(true);
    try {
      const next = await buildPlan();
      if (!next) return;
      const invalid = validatePlan(next);
      if (invalid) { setError(invalid); return; }
      if (next.action === 'create_member' && next.newMember.email.trim()) {
        const holders = await attendanceRecoveryRepository.searchMembers(next.newMember.email.trim(), 5);
        const holder = holders.find((m) => (m.email ?? '').trim().toLowerCase() === next.newMember.email.trim().toLowerCase());
        if (holder) {
          setEmailHolder(holder);
          setError('A member already has this email. Match that member instead, or create the new member without an email.');
          return;
        }
      }
      const points = record.event_id && next.action !== 'dismiss' && next.action !== 'needs_info' && next.action !== 'reopen'
        ? await attendanceRecoveryRepository.getEventPoints(record.event_id)
        : 0;
      setEventPoints(points);
      setPlan(next);
      setReviewed(false);
      requestIdRef.current = newRequestId();
      setStep('confirm');
    } catch (err) {
      setError(toUserMessage(err, 'Could not prepare the change. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan || !reviewed || busy || !requestIdRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const response = await attendanceRecoveryRepository.recover({
        requestId: requestIdRef.current,
        rowId: record.row_id,
        action: plan.action,
        expectedPreviousActionId: expectedPreviousRef.current,
        memberId: plan.action === 'restore' ? plan.member.id : plan.action === 'reassign' ? plan.to.id : null,
        fromMemberId: plan.action === 'reassign' ? plan.from.id : null,
        newMember: plan.action === 'create_member' ? plan.newMember : null,
        reasonCode: plan.action === 'dismiss' || plan.action === 'resolve_investigation' ? plan.reason : null,
        note: 'note' in plan ? plan.note : null,
      });
      setResult(response);
      setStep('done');
      await onRecovered(response);
    } catch (err) {
      const holderId = emailConflictMemberId(err);
      if (holderId) {
        const [holder] = await attendanceRecoveryRepository.getMembers([holderId]).catch((): MemberSnapshot[] => []);
        setEmailHolder(holder ?? null);
        setStep('plan');
        requestIdRef.current = null;
      }
      if (isStaleFinding(err)) {
        setStale(true);
        requestIdRef.current = null;
      }
      setError(toUserMessage(err, 'The change was not applied. Nothing was written; try again.'));
    } finally {
      setBusy(false);
    }
  };

  const destination = plan?.action === 'restore' ? plan.member : plan?.action === 'reassign' ? plan.to : null;
  const destinationAttended = plan?.action === 'restore' ? plan.memberAttended : plan?.action === 'reassign' ? plan.toAttended : null;

  return (
    <DialogFrame titleId={titleId} onClose={onClose} locked={busy} wide>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="font-sans text-base font-semibold text-[var(--color-text)]">
            {record.display_name || 'Unnamed row'} · {eventName}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text3)]">
            {kindLabel(finding.classification.kind)} · {finding.classification.priority} priority
          </p>
        </div>
      </div>

      <section className="mt-4 grid gap-3 rounded border border-[var(--color-border)] p-3 text-sm sm:grid-cols-2" aria-label="Original import">
        <div>
          <p className={sectionLabel}>Original event and import</p>
          <p className="mt-1 text-[var(--color-text)]">{eventName} · {formatDate(record.event_date)}</p>
          <p className="text-xs text-[var(--color-text2)]">
            Import of {formatDate(record.job_created_at)} · sheet row {finding.sheetRow} · job {record.import_job_id.slice(0, 8)}
          </p>
        </div>
        <div>
          <p className={sectionLabel}>Attendee on the sheet</p>
          <p className="mt-1 text-[var(--color-text)]">{record.display_name || 'No name'}</p>
          <p className="text-xs text-[var(--color-text2)]">{[record.csv_email, record.csv_college, record.csv_year].filter(Boolean).join(' · ') || 'No email, college or year'}</p>
        </div>
        <div className="sm:col-span-2">
          <p className={sectionLabel}>Current status</p>
          {creditedMember ? (
            <div className="mt-1 text-sm">
              <span className="text-[var(--color-text2)]">Credited to </span>
              <MemberLine member={creditedMember} attended={attendanceOf(creditedMember.id)} />
            </div>
          ) : (
            <p className="mt-1 text-[var(--color-text)]">Unresolved: no member was credited for this row.</p>
          )}
          <p className="mt-1 text-xs text-[var(--color-text2)]">{finding.classification.reason}</p>
          {finding.latestAction && (
            <p className="mt-1 text-xs text-[var(--color-text2)]">
              Last action: {OUTCOME_LABELS[finding.latestAction.outcome]} on {formatDate(finding.latestAction.created_at)}
              {finding.latestAction.note ? ` (“${finding.latestAction.note}”)` : ''}
            </p>
          )}
        </div>
        {detail.data && (
          <details className="text-xs text-[var(--color-text2)] sm:col-span-2">
            <summary className="cursor-pointer">Stored source row</summary>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {Object.entries((detail.data.raw_row ?? {}) as Record<string, unknown>).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-[var(--color-text3)]">{key}</dt>
                  <dd className="break-words">{String(value ?? '')}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </section>

      {step === 'plan' && (
        <>
          {actions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-text2)]">
              This finding is recovered. To change that attendance, use Admin Members → History, which confirms removals and lets triggers recalculate points.
            </p>
          ) : (
            <fieldset className="mt-4">
              <legend className={sectionLabel}>Action</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {actions.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => chooseAction(kind)}
                    aria-pressed={action === kind}
                    className={cn(dialogBtnCls, 'px-3 py-1.5 text-xs', action === kind && 'border-brand-600 bg-brand-600/10 dark:border-brand-400 dark:bg-brand-400/10')}
                  >
                    {ACTION_LABELS[kind]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-4 space-y-3">
            {!lookupsReady && !lookupsFailed && <p role="status" className="text-xs text-[var(--color-text3)]">Loading member details…</p>}
            {lookupsFailed && (
              <p role="alert" className="text-xs text-red-700 dark:text-red-300">
                Member details could not be loaded, so identity cannot be checked.
                <button type="button" className={cn(dialogBtnCls, 'ml-2 px-2 py-0.5 text-xs')} onClick={retryLookups}>Retry</button>
              </p>
            )}

            {action === 'restore' && (
              <>
                <MemberPicker label="Which existing member is this attendee?" candidates={candidates} attendanceOf={attendanceOf} selected={member} onSelect={(m) => { setMember(m); setIdentityConfirmed(false); }} />
                {member && (
                  <div className="rounded border border-[var(--color-border)] p-2.5">
                    <p className={sectionLabel}>Recent attendance of {memberName(member)}</p>
                    <div className="mt-1"><RecentAttendance memberId={member.id} /></div>
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                  <input type="checkbox" className="mt-0.5" checked={identityConfirmed} disabled={!member} onChange={(event) => setIdentityConfirmed(event.target.checked)} />
                  I verified this is the same person (email, college, year or the source sheet), not just a similar name.
                </label>
              </>
            )}

            {action === 'create_member' && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['first_name', 'last_name', 'email', 'college', 'year'] as const).map((field) => (
                    <div key={field} className={field === 'email' ? 'sm:col-span-2' : undefined}>
                      <label className={labelCls} htmlFor={`${uid}-${field}`}>
                        {{ first_name: 'First name', last_name: 'Last name', email: 'Email (optional)', college: 'College (optional)', year: 'Year (optional)' }[field]}
                      </label>
                      <input
                        id={`${uid}-${field}`}
                        className={inputCls}
                        value={newMember[field]}
                        onChange={(event) => { setNewMember((prev) => ({ ...prev, [field]: event.target.value })); if (field === 'email') setEmailHolder(null); }}
                      />
                    </div>
                  ))}
                </div>
                {emailHolder && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-medium">This email belongs to an existing member:</p>
                    <div className="mt-1"><MemberLine member={emailHolder} /></div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={cn(dialogBtnCls, 'px-3 py-1 text-xs')} onClick={() => { chooseAction('restore'); setMember(emailHolder); }}>
                        Match this member instead
                      </button>
                      <button type="button" className={cn(dialogBtnCls, 'px-3 py-1 text-xs')} onClick={() => { setNewMember((prev) => ({ ...prev, email: '' })); setEmailHolder(null); setError(null); }}>
                        Create without email
                      </button>
                    </div>
                  </div>
                )}
                {candidates.length > 0 && (
                  <div className="rounded border border-[var(--color-border)] p-2.5">
                    <p className={sectionLabel}>Suggested matches</p>
                    <ul className="mt-1 space-y-1.5 text-sm">
                      {candidates.map((candidate) => (
                        <li key={candidate.id}><MemberLine member={candidate} attended={attendanceOf(candidate.id)} /></li>
                      ))}
                    </ul>
                    <label className="mt-2 flex items-start gap-2 text-sm text-[var(--color-text)]">
                      <input type="checkbox" className="mt-0.5" checked={identityConfirmed} onChange={(event) => setIdentityConfirmed(event.target.checked)} />
                      This attendee is a different person from every suggested member. Nothing will be merged.
                    </label>
                  </div>
                )}
              </>
            )}

            {action === 'reassign' && (
              <>
                <MemberPicker label="Who should have been credited?" candidates={candidates} attendanceOf={attendanceOf} excludeId={record.attendance_member_id} selected={member} onSelect={(m) => { setMember(m); setIdentityConfirmed(false); }} />
                {member && (
                  <div className="rounded border border-[var(--color-border)] p-2.5">
                    <p className={sectionLabel}>Recent attendance of {memberName(member)}</p>
                    <div className="mt-1"><RecentAttendance memberId={member.id} /></div>
                  </div>
                )}
                {counterEvidence}
                <p className="rounded border border-[var(--color-border)] bg-[var(--color-surface2)] p-2.5 text-xs text-[var(--color-text2)]">
                  {creditedMember ? memberName(creditedMember) : 'The original member'} keeps their attendance. The import cannot prove
                  that credit came only from this row, and they may have attended too, so it is flagged for investigation instead
                  of removed. If they did not attend, remove it in Admin Members, then resolve the finding here.
                </p>
                <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                  <input type="checkbox" className="mt-0.5" checked={identityConfirmed} disabled={!member} onChange={(event) => setIdentityConfirmed(event.target.checked)} />
                  I verified the sheet row belongs to the member I selected.
                </label>
              </>
            )}

            {action === 'resolve_investigation' && (
              <div className="space-y-3">
                <div className="rounded border border-[var(--color-border)] p-2.5">
                  <p className={sectionLabel}>Flagged original credit</p>
                  <div className="mt-1 text-sm">
                    {creditedMember ? <MemberLine member={creditedMember} attended={attendanceOf(creditedMember.id)} /> : 'The original member could not be loaded.'}
                  </div>
                  {creditedMember && onOpenMemberAttendance && (
                    <button type="button" className={cn(dialogBtnCls, 'mt-2 px-3 py-1 text-xs')} onClick={() => onOpenMemberAttendance(creditedMember.id)}>
                      Open {memberName(creditedMember)}&apos;s attendance in Admin Members
                    </button>
                  )}
                </div>
                {counterEvidence}
                <fieldset className="space-y-1.5 text-sm text-[var(--color-text)]">
                  <legend className={labelCls}>What did the investigation find?</legend>
                  {RESOLVE_REASONS.map((option) => (
                    <label key={option.value} className="flex items-start gap-2">
                      <input type="radio" className="mt-0.5" checked={resolveReason === option.value} onChange={() => setResolveReason(option.value)} />
                      <span>
                        {option.label}
                        <span className="block text-xs text-[var(--color-text2)]">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            {action === 'dismiss' && (
              <fieldset className="space-y-1.5 text-sm text-[var(--color-text)]">
                <legend className={labelCls}>Why dismiss it?</legend>
                {DISMISS_REASONS.map((option) => (
                  <label key={option.value} className="flex items-start gap-2">
                    <input type="radio" className="mt-0.5" checked={reason === option.value} onChange={() => setReason(option.value)} />
                    <span>
                      {option.label}
                      <span className="block text-xs text-[var(--color-text2)]">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {action && action !== 'restore' && action !== 'create_member' && (
              <div>
                <label className={labelCls} htmlFor={`${uid}-note`}>
                  {action === 'resolve_investigation' ? 'Evidence for this decision (required)'
                    : action === 'needs_info' ? 'What information is missing? (required)'
                    : action === 'dismiss' && reason === 'not_actionable' ? 'Why is this not actionable? (required)'
                    : 'Note (optional)'}
                </label>
                <textarea id={`${uid}-note`} className={cn(inputCls, 'min-h-[64px]')} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
                <p className="mt-0.5 text-[11px] text-[var(--color-text3)]">Admin-only. Do not include emails or phone numbers.</p>
              </div>
            )}
          </div>
        </>
      )}

      {step === 'confirm' && plan && (
        <section className="mt-4 space-y-3" aria-label="Confirm changes">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className={sectionLabel}>Action</p>
              <p className="mt-1 text-[var(--color-text)]">{ACTION_LABELS[plan.action]}</p>
            </div>
            <div>
              <p className={sectionLabel}>Destination member</p>
              <div className="mt-1">
                {destination ? <MemberLine member={destination} attended={destinationAttended ?? undefined} />
                  : plan.action === 'create_member' ? <span className="text-[var(--color-text)]">New member (below)</span>
                  : <span className="text-[var(--color-text2)]">None</span>}
              </div>
            </div>
          </div>
          <div className="rounded border border-[var(--color-border)] p-3">
            <p className={sectionLabel}>Exact database changes</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-[var(--color-text)]">
              {describeRecoveryPlan(plan, eventName, eventPoints).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="mt-0.5" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
            I reviewed these changes and want to apply them.
          </label>
        </section>
      )}

      {step === 'done' && result && (
        <div role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          {OUTCOME_LABELS[result.outcome]}
          {result.points_awarded > 0 ? ` · ${result.points_awarded} points awarded` : ''}
          {result.outcome === 'correct_member_already_credited' ? ' · the correct member already had this attendance, so nothing was added' : ''}
          {result.status === 'investigating' ? ' · the original credit is kept and listed under "Original credit to investigate"' : ''}
          {result.replayed ? ' (already applied earlier; nothing written twice)' : ''}.
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
          {stale && ' Close this dialog to load the latest state.'}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {step === 'confirm' && (
          <button type="button" className={dialogBtnCls} disabled={busy} onClick={() => { setStep('plan'); setError(null); }}>
            Back
          </button>
        )}
        <button type="button" className={dialogBtnCls} disabled={busy} onClick={onClose}>
          {step === 'done' ? 'Close' : 'Cancel'}
        </button>
        {step === 'plan' && actions.length > 0 && (
          <button type="button" className={dialogPrimaryCls(false)} disabled={!action || busy || ((action === 'restore' || action === 'create_member' || action === 'reassign' || action === 'resolve_investigation') && !lookupsReady)} onClick={review}>
            {busy ? 'Checking…' : 'Review changes'}
          </button>
        )}
        {step === 'confirm' && (
          <button
            type="button"
            className={dialogPrimaryCls(false)}
            disabled={!reviewed || busy || stale}
            onClick={apply}
          >
            {busy ? 'Applying…' : 'Apply'}
          </button>
        )}
      </div>
    </DialogFrame>
  );
}
