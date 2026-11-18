// Protected domain — House membership. Admin → Houses → Payments (#656, #658):
// the private, year- and application-window-scoped payment eligibility
// roster. CRC sets the deadline (Pacific time), marks people Paid / Unpaid /
// Pending / Waived one at a time or in bulk, imports a checklist, and sees who
// is eligible for a provisional or a final sort. Payment status never changes
// members, attendance, points or a revealed House; it only decides who a
// final sort may include (enforced again by the database).
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { PAYMENTS_UNAVAILABLE, housePaymentsRepository } from '../../../data/repos/housePayments';
import { memberIdentityRepository } from '../../../data/repos/memberIdentity';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { newRequestId } from '../../../lib/attendanceRecovery';
import { downloadCsv } from '../../../lib/housePlacementExport';
import type { HouseImportMember } from '../../../lib/houseAssignmentImport';
import { buildPlacementMemberIndex } from '../../../lib/housePlacementImport';
import {
  APPLICATION_KEY_LABEL,
  CutoffState,
  HouseApplicant,
  HouseApplicationKey,
  HousePaymentCycle,
  PAYMENT_EVIDENCE_LABEL,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PaymentChange,
  PaymentEvidence,
  PaymentStatus,
  bulkStatusChanges,
  cutoffReached,
  cutoffState,
  finalSortBlockers,
  formatPacific,
  isoToPacificInput,
  pacificInputToIso,
  paymentChecklistCsv,
  paymentCounts,
  readPaymentStatus,
} from '../../../lib/housePayments';
import { readPreferences } from '../../../lib/houseAssignmentDraft';
import type { Json } from '../../../types/database';
import { HousePageAsset } from '../../../types';
import { cn } from '../../../lib/utils';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { HousePaymentChecklistImport } from './HousePaymentChecklistImport';
import { MemberSearchSelect } from './MemberSearchSelect';

const KEYS: HouseApplicationKey[] = ['house_fall', 'house_winter', 'house_spring'];
const fieldCls = 'w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-xs text-[var(--color-text)] border-[var(--color-border)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:opacity-60';
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted';
const ghostBtn = 'rounded border bg-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50 border-[var(--color-border)] text-text-primary';

const STATUS_TONE: Record<PaymentStatus, string> = {
  unverified: 'border-[var(--color-border)] text-text-muted',
  pending: 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300',
  paid: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
  unpaid: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
  waived: 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300',
};

type StatusFilter = 'all' | 'unresolved' | 'withdrawn' | PaymentStatus;

export interface HousePaymentsPanelProps {
  selectedYear: number | null;
  houseProfiles: HousePageAsset[];
  members: HouseImportMember[];
}

function cutoffText(state: CutoffState) {
  switch (state.kind) {
    case 'no_deadline': return 'No payment deadline set.';
    case 'open': return `Payments due ${formatPacific(state.cutoffIso)} PT. Sorts are provisional until then.`;
    case 'grace': return `Deadline passed; grace period ends ${formatPacific(state.cutoffIso)} PT.`;
    case 'passed': return `Payment cutoff passed ${formatPacific(state.cutoffIso)} PT. Final sorts may include only Paid and Waived applicants.`;
    case 'authorized': return `Cutoff authorized early ${formatPacific(state.atIso)} PT: ${state.reason}`;
  }
}

function DeadlineEditor({ cycle, onSaved }: { cycle: HousePaymentCycle; onSaved: () => void }) {
  const [deadline, setDeadline] = useState(isoToPacificInput(cycle.payment_deadline));
  const [grace, setGrace] = useState(isoToPacificInput(cycle.grace_until));
  const [note, setNote] = useState(cycle.deadline_note ?? '');
  const [reason, setReason] = useState('');
  const [authReason, setAuthReason] = useState('');
  const [saving, setSaving] = useState(false);
  const state = cutoffState(cycle, Date.now());
  const passed = cutoffReached(state);

  async function save() {
    const parsedDeadline = deadline ? pacificInputToIso(deadline) : null;
    const parsedGrace = grace ? pacificInputToIso(grace) : null;
    if (parsedDeadline && !parsedDeadline.ok) return toast.error(parsedDeadline.error);
    if (parsedGrace && !parsedGrace.ok) return toast.error(parsedGrace.error);
    setSaving(true);
    try {
      await housePaymentsRepository.updateDeadline(cycle.id, {
        paymentDeadline: parsedDeadline?.ok ? parsedDeadline.iso : null,
        graceUntil: parsedGrace?.ok ? parsedGrace.iso : null,
        note,
        reason,
      });
      setReason('');
      toast.success('Payment deadline saved. The change is in the payment history.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to save the deadline.');
    } finally {
      setSaving(false);
    }
  }

  async function authorize(next: string | null) {
    setSaving(true);
    try {
      await housePaymentsRepository.setCutoffAuthorization(cycle.id, next);
      setAuthReason('');
      toast.success(next ? 'Early cutoff recorded.' : 'Early cutoff withdrawn.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to record the cutoff.');
    } finally {
      setSaving(false);
    }
  }

  const frozen = !!cycle.publishing_batch_id;
  return (
    <section className="scrapbook-paper space-y-3 p-5 border-[var(--color-border)] bg-surface" aria-label="Payment deadline">
      <h3 className="font-serif text-lg font-bold text-text-primary">Payment deadline</h3>
      <p className={cn('text-xs', passed ? 'font-semibold text-text-primary' : 'text-text-secondary')} role="status">{cutoffText(state)}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="payment-deadline" className={labelCls}>Deadline (Pacific time)</label>
          <input id="payment-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} disabled={saving || frozen} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="payment-grace" className={labelCls}>Grace period ends (optional)</label>
          <input id="payment-grace" type="datetime-local" value={grace} onChange={(event) => setGrace(event.target.value)} disabled={saving || frozen} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="payment-deadline-note" className={labelCls}>Note (optional)</label>
          <input id="payment-deadline-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} disabled={saving || frozen} className={fieldCls} placeholder="e.g. Announced at GBM 3" />
        </div>
      </div>
      {passed && (
        <div>
          <label htmlFor="payment-deadline-reason" className={labelCls}>Reason for changing a passed deadline (required)</label>
          <input id="payment-deadline-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} disabled={saving || frozen} className={fieldCls} />
        </div>
      )}
      <button type="button" onClick={save} disabled={saving || frozen || (passed && !reason.trim())} className="vsa-btn-primary px-5 py-2 text-xs disabled:opacity-50">
        Save deadline
      </button>
      <div className="border-t pt-3 border-[var(--color-border)]">
        {cycle.cutoff_authorized_at ? (
          <button type="button" onClick={() => authorize(null)} disabled={saving || frozen} className={ghostBtn}>Withdraw the early cutoff</button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="payment-auth-reason" className={labelCls}>Authorize an early cutoff (reason)</label>
              <input id="payment-auth-reason" value={authReason} maxLength={500} onChange={(event) => setAuthReason(event.target.value)} disabled={saving || frozen} className={fieldCls} placeholder="e.g. Every applicant confirmed by CRC chair on 11/4" />
            </div>
            <button type="button" onClick={() => authorize(authReason)} disabled={saving || frozen || !authReason.trim()} className={ghostBtn}>Record early cutoff</button>
          </div>
        )}
      </div>
    </section>
  );
}

export function HousePaymentsPanel({ selectedYear, houseProfiles, members }: HousePaymentsPanelProps) {
  const queryClient = useQueryClient();
  const cyclesQuery = useQuery({
    queryKey: ['admin', 'house-payment-cycles', selectedYear],
    queryFn: () => housePaymentsRepository.listCycles(selectedYear as number),
    enabled: selectedYear !== null,
    retry: false,
  });
  const cycles = useMemo(() => cyclesQuery.data ?? [], [cyclesQuery.data]);
  const [cycleChoice, setCycleChoice] = useState<string | null>(null);
  const cycle = cycles.find((item) => item.id === cycleChoice) ?? cycles[0] ?? null;

  const applicantsQuery = useQuery({
    queryKey: ['admin', 'house-applicants', cycle?.id],
    queryFn: () => housePaymentsRepository.listApplicants(cycle?.id as string),
    enabled: !!cycle,
    retry: false,
    staleTime: 0,
  });
  const auditQuery = useQuery({
    queryKey: ['admin', 'house-payment-audit', cycle?.id],
    queryFn: () => housePaymentsRepository.listAudit(cycle?.id as string),
    enabled: !!cycle,
    retry: false,
  });
  const batchesQuery = useQuery({
    queryKey: ['admin', 'house-batches', selectedYear],
    queryFn: () => houseAssignmentsRepository.listBatches(selectedYear as number),
    enabled: selectedYear !== null,
    retry: false,
  });
  const aliasesQuery = useQuery({
    queryKey: ['admin', 'member-identity-emails'],
    queryFn: () => memberIdentityRepository.loadIdentityEmails(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const applicants = useMemo(() => applicantsQuery.data ?? [], [applicantsQuery.data]);
  const counts = useMemo(() => paymentCounts(applicants), [applicants]);
  const state = cycle ? cutoffState(cycle, Date.now()) : null;
  const finalBlockers = state ? finalSortBlockers(state, counts) : [];
  const revealed = (batchesQuery.data ?? []).find((batch) => batch.payment_cycle_id === cycle?.id && batch.status === 'published') ?? null;
  const frozen = !!cycle?.publishing_batch_id;

  const memberName = useMemo(() => new Map(members.map((member) => [member.id, `${member.first_name} ${member.last_name}`.trim()])), [members]);
  const membersByEmail = useMemo(() => {
    const index = buildPlacementMemberIndex(members, aliasesQuery.data ?? []);
    return new Map(Array.from(index.byEmail, ([email, candidates]) => [email, candidates.map((candidate) => candidate.member.id)]));
  }, [members, aliasesQuery.data]);
  const houseLabel = useMemo(() => new Map(houseProfiles.map((profile) => [profile.id, profile.display_name || profile.house_key])), [houseProfiles]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [houseFilter, setHouseFilter] = useState('');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => applicants.filter((applicant) => {
    const status = readPaymentStatus(applicant);
    if (statusFilter === 'withdrawn' ? !applicant.withdrawn_reason : statusFilter !== 'all' && applicant.withdrawn_reason) return false;
    if (statusFilter === 'unresolved' && status !== 'unverified' && status !== 'pending') return false;
    if (PAYMENT_STATUSES.includes(statusFilter as PaymentStatus) && status !== statusFilter) return false;
    if (houseFilter && readPreferences(applicant.preferences as Json)[0] !== houseFilter) return false;
    const text = search.trim().toLowerCase();
    if (text) {
      const linked = applicant.member_id ? memberName.get(applicant.member_id) ?? '' : '';
      if (!`${applicant.source_name} ${linked} ${applicant.source_row_number}`.toLowerCase().includes(text)) return false;
    }
    return true;
  }), [applicants, statusFilter, houseFilter, search, memberName]);

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PaymentStatus>('unpaid');
  const [bulkEvidence, setBulkEvidence] = useState<PaymentEvidence | ''>('crc_confirmation');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<HouseApplicant | null>(null);
  const [creating, setCreating] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'house-payment-cycles', selectedYear] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'house-applicants', cycle?.id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'house-payment-audit', cycle?.id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'house-payment-cycle', cycle?.id] });
  }

  async function createCycle(key: HouseApplicationKey) {
    if (!selectedYear) return;
    setCreating(true);
    try {
      const created = await housePaymentsRepository.createCycle(selectedYear, key);
      setCycleChoice(created.id);
      toast.success(`${APPLICATION_KEY_LABEL[key]} payment roster created. Set the deadline next.`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to create the payment roster.');
    } finally {
      setCreating(false);
    }
  }

  async function submit(changes: PaymentChange[], source: 'single' | 'bulk', reason: string) {
    if (!cycle) return;
    const result = await housePaymentsRepository.setPayments({
      cycleId: cycle.id,
      changes,
      source,
      reason,
      requestId: newRequestId(),
      expectedVersion: cycle.status_version,
    });
    toast.success(`${result.applied} change${result.applied === 1 ? '' : 's'} saved.${result.postReveal ? ' Houses were already revealed: this is recorded for leadership review and nobody is moved automatically.' : ' Any saved sort for this roster now needs a rerun.'}`);
    refresh();
  }

  const bulk = useMemo(() => bulkStatusChanges(applicants, selected, bulkStatus, bulkEvidence || null), [applicants, selected, bulkStatus, bulkEvidence]);

  if (!selectedYear) return <p className="p-6 text-sm text-text-muted">Choose an academic year.</p>;
  if (cyclesQuery.isError) {
    const unavailable = cyclesQuery.error instanceof Error && cyclesQuery.error.message === PAYMENTS_UNAVAILABLE;
    return <p role="alert" className="m-6 rounded border p-3 text-sm border-[var(--color-border)] text-text-primary">{unavailable ? PAYMENTS_UNAVAILABLE : 'Payment rosters could not be loaded. Nothing is shown rather than a partial list. Refresh to try again.'}</p>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="scrapbook-paper space-y-3 p-5 border-[var(--color-border)] bg-surface" aria-label="Payment rosters">
        <h2 className="font-serif text-xl font-bold text-text-primary">House payment eligibility · {formatAcademicYear(selectedYear)}</h2>
        <p className="text-xs text-text-secondary">
          Private to admins. Payment decides only who a final House sort may include: it never deletes an application, changes a member, attendance or points, or moves anyone after the Reveal. First-come, first-served order always stays the original application time.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Application window">
          {KEYS.map((key) => {
            const existing = cycles.find((item) => item.application_key === key);
            return existing ? (
              <button
                key={key}
                type="button"
                aria-pressed={cycle?.id === existing.id}
                onClick={() => { setCycleChoice(existing.id); setSelected(new Set()); }}
                className={cn(ghostBtn, cycle?.id === existing.id && 'border-[var(--brand)] text-[var(--brand)]')}
              >
                {APPLICATION_KEY_LABEL[key]}
              </button>
            ) : (
              <button key={key} type="button" onClick={() => createCycle(key)} disabled={creating || cyclesQuery.isLoading} className={cn(ghostBtn, 'border-dashed text-text-secondary')}>
                + Create {APPLICATION_KEY_LABEL[key].toLowerCase()} roster
              </button>
            );
          })}
        </div>
        {cycles.length === 0 && !cyclesQuery.isLoading && (
          <p className="text-xs text-text-muted">No payment roster yet. Create one, set its deadline, then import House applications in House Assignments and choose the roster when saving.</p>
        )}
      </section>

      {cycle && (
        <>
          {frozen && (
            <p role="alert" className="rounded border border-amber-400 p-3 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:text-amber-200">
              A Reveal is in progress for this roster. Payment statuses and the deadline are frozen until it finishes or the draft is reopened.
            </p>
          )}
          {revealed && (
            <p role="note" className="rounded border border-sky-300 p-3 text-xs text-sky-900 dark:border-sky-800 dark:text-sky-200">
              Houses for this roster were revealed {revealed.published_at ? formatPacific(revealed.published_at) : ''}. Payment changes from now on (refunds, corrections, late payments) are recorded for leadership review only. Nobody is removed or moved automatically.
            </p>
          )}

          <DeadlineEditor key={`${cycle.id}:${cycle.updated_at}`} cycle={cycle} onSaved={refresh} />

          <section className="scrapbook-paper space-y-3 p-5 border-[var(--color-border)] bg-surface" aria-label="Eligibility summary">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {([
                ['Applicants', counts.total],
                ['Paid', counts.paid],
                ['Waived', counts.waived],
                ['Unpaid', counts.unpaid],
                ['Pending', counts.pending],
                ['Unverified', counts.unverified],
                ['Eligible · provisional', counts.provisionalEligible],
                ['Eligible · final', counts.finalEligible],
              ] as Array<[string, number]>).map(([label, value]) => (
                <div key={label} className="rounded border px-3 py-2 border-[var(--color-border)] bg-surface2">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
                  <dd className="mt-0.5 font-serif text-xl font-bold text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>
            {counts.withdrawn > 0 && <p className="text-xs text-text-muted">{counts.withdrawn} withdrawn (not counted above).</p>}
            {finalBlockers.length > 0 ? (
              <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300" aria-label="Final sort not ready">
                {finalBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            ) : (
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ready for a final, payment-cleared sort of {counts.finalEligible} applicants. Open the draft in House Assignments and choose Rerun sorting.</p>
            )}
            <p className="text-xs text-text-muted">Payment version {cycle.status_version}. Every change increases it, which makes any earlier sort stale.</p>
          </section>

          <HousePaymentChecklistImport cycle={cycle} applicants={applicants} membersByEmail={membersByEmail} frozen={frozen} onApplied={refresh} />

          <section className="scrapbook-paper space-y-4 p-5 border-[var(--color-border)] bg-surface" aria-label="Applicants">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="payment-filter-status" className={labelCls}>Status</label>
                <select id="payment-filter-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={fieldCls}>
                  <option value="all">All included</option>
                  <option value="unresolved">Unverified or pending</option>
                  {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{PAYMENT_STATUS_LABEL[status]}</option>)}
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
              <div>
                <label htmlFor="payment-filter-house" className={labelCls}>First choice</label>
                <select id="payment-filter-house" value={houseFilter} onChange={(event) => setHouseFilter(event.target.value)} className={fieldCls}>
                  <option value="">Any House</option>
                  {Array.from(houseLabel, ([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div className="min-w-[180px] flex-1">
                <label htmlFor="payment-search" className={labelCls}>Search</label>
                <input id="payment-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or application row" className={fieldCls} />
              </div>
              <button
                type="button"
                className={ghostBtn}
                disabled={applicants.length === 0}
                onClick={() => downloadCsv(paymentChecklistCsv(applicants, (id) => memberName.get(id) ?? null), `vsa-house-payments-${selectedYear}-${selectedYear + 1}-${cycle.application_key}.csv`)}
              >
                Export private checklist CSV
              </button>
            </div>

            {selected.size > 0 && (
              <div className="flex flex-col gap-2 rounded border p-3 border-[var(--brand)] bg-surface2 lg:flex-row lg:items-end" role="region" aria-label="Bulk payment change">
                <p className="text-xs font-semibold text-text-primary lg:self-center">{selected.size} selected</p>
                <div>
                  <label htmlFor="bulk-status" className={labelCls}>Mark as</label>
                  <select id="bulk-status" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as PaymentStatus)} className={fieldCls}>
                    {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{PAYMENT_STATUS_LABEL[status]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="bulk-evidence" className={labelCls}>Evidence</label>
                  <select id="bulk-evidence" value={bulkEvidence} onChange={(event) => setBulkEvidence(event.target.value as PaymentEvidence | '')} className={fieldCls}>
                    <option value="">None</option>
                    {(Object.keys(PAYMENT_EVIDENCE_LABEL) as PaymentEvidence[]).map((key) => <option key={key} value={key}>{PAYMENT_EVIDENCE_LABEL[key]}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="bulk-reason" className={labelCls}>Reason (required)</label>
                  <input id="bulk-reason" value={bulkReason} maxLength={300} onChange={(event) => setBulkReason(event.target.value)} className={fieldCls} placeholder="e.g. Missed the 11/6 deadline per CRC checklist" />
                </div>
                <div className="flex gap-2">
                  <button type="button" className={ghostBtn} onClick={() => setSelected(new Set())}>Clear</button>
                  <button type="button" className="vsa-btn-primary px-4 py-2 text-xs disabled:opacity-50" disabled={frozen || !bulkReason.trim() || bulk.changes.length === 0} onClick={() => setBulkConfirmOpen(true)}>
                    Review {bulk.changes.length} change{bulk.changes.length === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            )}
            <ConfirmDialog
              open={bulkConfirmOpen}
              title={`Mark ${bulk.changes.length} applicant${bulk.changes.length === 1 ? '' : 's'} ${PAYMENT_STATUS_LABEL[bulkStatus]}?`}
              description={`${bulk.changes.map((change) => applicants.find((item) => item.id === change.applicant_id)?.source_name).join(', ')}.${bulk.unchanged ? ` ${bulk.unchanged} already have this status and are skipped.` : ''}`}
              consequences={[
                'One transaction: every change is saved, or none is. Each is recorded with you, the time and the reason.',
                'Any saved House sort for this roster becomes stale and must be rerun before Lock or Reveal.',
                'No member, attendance, points or revealed House changes.',
              ]}
              confirmLabel="Save changes"
              onConfirm={async () => {
                await submit(bulk.changes, 'bulk', bulkReason);
                setSelected(new Set());
                setBulkReason('');
              }}
              onClose={() => setBulkConfirmOpen(false)}
            />

            {applicantsQuery.isLoading ? (
              <p className="text-xs text-text-muted" role="status">Loading applicants…</p>
            ) : applicantsQuery.isError ? (
              <p role="alert" className="text-xs text-red-700 dark:text-red-300">The applicant roster could not be read completely, so nothing is shown and final sorting stays blocked. Refresh to try again.</p>
            ) : applicants.length === 0 ? (
              <p className="text-xs text-text-muted">No applicants in this roster yet. Import House Applications in House Assignments and choose this roster when saving the first sort.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && visible.every((item) => selected.has(item.id))}
                    onChange={(event) => setSelected(event.target.checked ? new Set([...Array.from(selected), ...visible.map((item) => item.id)]) : new Set(Array.from(selected).filter((id) => !visible.some((item) => item.id === id))))}
                  />
                  Select all {visible.length} shown
                </label>
                <ul className="space-y-2" aria-label="Applicant payment statuses">
                  {visible.map((applicant) => {
                    const status = readPaymentStatus(applicant);
                    const first = readPreferences(applicant.preferences as Json)[0];
                    return (
                      <li key={applicant.id} className="flex flex-wrap items-start gap-3 rounded border p-3 border-[var(--color-border)] bg-surface2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${applicant.source_name}, application row ${applicant.source_row_number}`}
                          checked={selected.has(applicant.id)}
                          onChange={(event) => setSelected((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) next.add(applicant.id); else next.delete(applicant.id);
                            return next;
                          })}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-primary">
                            {applicant.source_name}
                            <span className="ml-2 font-mono text-[11px] font-normal text-text-muted">row {applicant.source_row_number} · {formatPacific(applicant.submission_timestamp)} PT</span>
                          </p>
                          <p className="text-xs text-text-secondary">
                            1st choice {first ? houseLabel.get(first) ?? 'Unknown' : '—'} · {applicant.member_id ? `linked to ${memberName.get(applicant.member_id) ?? 'a member'}` : 'not linked to a member'}
                            {applicant.payment_note ? ` · ${applicant.payment_note}` : ''}
                            {applicant.withdrawn_reason ? ` · Withdrawn: ${applicant.withdrawn_reason}` : ''}
                          </p>
                          {applicant.payment_updated_at && <p className="text-[11px] text-text-muted">Changed {formatPacific(applicant.payment_updated_at)} PT</p>}
                        </div>
                        <span className={cn('rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]', STATUS_TONE[status])}>{PAYMENT_STATUS_LABEL[status]}</span>
                        <button type="button" className={ghostBtn} disabled={frozen} onClick={() => setEditing(applicant)} aria-label={`Change payment status for ${applicant.source_name}`}>Change</button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          {editing && (
            <SingleEditor
              applicant={editing}
              members={members}
              memberName={(id) => memberName.get(id) ?? null}
              onLink={async (memberId, reason) => {
                await housePaymentsRepository.linkApplicantMember(editing.id, memberId, reason);
                toast.success('Member link saved and recorded. Any saved sort for this roster now needs a rerun.');
                refresh();
                setEditing(null);
              }}
              onClose={() => setEditing(null)}
              onSave={async (change, reason) => {
                await submit([change], 'single', reason);
                setEditing(null);
              }}
            />
          )}

          <details className="scrapbook-paper border-[var(--color-border)] bg-surface">
            <summary className="cursor-pointer px-5 py-4 font-serif text-base font-bold text-text-primary">Payment history</summary>
            <div className="border-t px-5 pb-5 pt-3 border-[var(--color-border)]">
              {auditQuery.isError ? (
                <p role="alert" className="text-xs text-red-700 dark:text-red-300">Payment history could not be loaded.</p>
              ) : (auditQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-text-muted">No changes recorded yet.</p>
              ) : (
                <ol className="space-y-1 text-xs text-text-secondary">
                  {(auditQuery.data ?? []).map((row) => {
                    const who = row.applicant_id ? applicants.find((item) => item.id === row.applicant_id)?.source_name ?? 'An applicant' : 'Roster';
                    const from = isStatus(row.from_value) ? PAYMENT_STATUS_LABEL[row.from_value] : row.from_value;
                    const to = isStatus(row.to_value) ? PAYMENT_STATUS_LABEL[row.to_value] : row.to_value;
                    return (
                      <li key={row.id}>
                        <span className="font-mono text-text-muted">{formatPacific(row.created_at)} PT</span> · {who}: {row.event_type.replace(/_/g, ' ')}
                        {from || to ? ` (${from ?? '—'} → ${to ?? '—'})` : ''} · {row.source.replace(/_/g, ' ')}
                        {row.actor ? ` · by ${row.actor.slice(0, 8)}` : ''}{row.reason ? ` · ${row.reason}` : ''}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function isStatus(value: string | null): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

function SingleEditor({ applicant, members, memberName, onLink, onClose, onSave }: {
  applicant: HouseApplicant;
  members: HouseImportMember[];
  memberName: (memberId: string) => string | null;
  onLink: (memberId: string | null, reason: string) => Promise<void>;
  onClose: () => void;
  onSave: (change: PaymentChange, reason: string) => Promise<void>;
}) {
  const [linkMemberId, setLinkMemberId] = useState<string | null>(applicant.member_id);
  const [linkReason, setLinkReason] = useState('');
  const [linking, setLinking] = useState(false);
  const confirmed = applicant.match_status === 'match' || applicant.match_status === 'manual';
  async function link() {
    setLinking(true);
    try {
      await onLink(linkMemberId, linkReason);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to save the member link. Nothing was changed.');
    } finally {
      setLinking(false);
    }
  }
  const [status, setStatus] = useState<PaymentStatus>(readPaymentStatus(applicant));
  const [evidence, setEvidence] = useState<PaymentEvidence | ''>((applicant.payment_evidence as PaymentEvidence | null) ?? '');
  const [note, setNote] = useState(applicant.payment_note ?? '');
  const [withdrawn, setWithdrawn] = useState(applicant.withdrawn_reason ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const needsReason = status === 'waived' && readPaymentStatus(applicant) !== 'waived';

  async function save() {
    setSaving(true);
    try {
      await onSave({
        applicant_id: applicant.id,
        payment_status: status,
        payment_evidence: evidence || null,
        payment_note: note.trim() || null,
        withdrawn_reason: withdrawn.trim() || null,
      }, reason);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to save. Nothing was changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section role="dialog" aria-modal="false" aria-label={`Payment status for ${applicant.source_name}`} className="scrapbook-paper space-y-3 p-5 border-[var(--brand)] bg-surface">
      <h3 className="font-serif text-lg font-bold text-text-primary">{applicant.source_name} · row {applicant.source_row_number}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="single-status" className={labelCls}>Status</label>
          <select id="single-status" value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)} className={fieldCls}>
            {PAYMENT_STATUSES.map((value) => <option key={value} value={value}>{PAYMENT_STATUS_LABEL[value]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="single-evidence" className={labelCls}>Evidence</label>
          <select id="single-evidence" value={evidence} onChange={(event) => setEvidence(event.target.value as PaymentEvidence | '')} className={fieldCls}>
            <option value="">None</option>
            {(Object.keys(PAYMENT_EVIDENCE_LABEL) as PaymentEvidence[]).map((key) => <option key={key} value={key}>{PAYMENT_EVIDENCE_LABEL[key]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="single-note" className={labelCls}>Internal note (no payment details)</label>
          <input id="single-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="single-withdrawn" className={labelCls}>Withdrawn reason (leave blank if applying)</label>
          <input id="single-withdrawn" value={withdrawn} maxLength={500} onChange={(event) => setWithdrawn(event.target.value)} className={fieldCls} />
        </div>
      </div>
      <div>
        <label htmlFor="single-reason" className={labelCls}>{needsReason ? 'Waiver authorization (required)' : 'Reason (recorded)'}</label>
        <input id="single-reason" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} className={fieldCls} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <button type="button" onClick={save} disabled={saving || (needsReason && !reason.trim())} className="vsa-btn-primary px-4 py-2 text-xs disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <fieldset className="space-y-2 border-t pt-3 border-[var(--color-border)]">
        <legend className={labelCls}>Member this application reveals</legend>
        <p className="text-xs text-text-secondary">
          {applicant.member_id
            ? `${confirmed ? 'Confirmed' : 'Suggested, not confirmed'}: ${memberName(applicant.member_id) ?? 'a member'}.`
            : 'Not linked to a member.'} A placement may only reveal this application&rsquo;s confirmed member. Changing it is recorded and makes saved sorts need a rerun.
        </p>
        <MemberSearchSelect members={members} value={linkMemberId} onChange={setLinkMemberId} label={`${applicant.source_name}'s member`} disabled={linking} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="link-reason" className={labelCls}>Reason (required)</label>
            <input id="link-reason" value={linkReason} maxLength={500} onChange={(event) => setLinkReason(event.target.value)} className={fieldCls} placeholder="e.g. Confirmed by UCSD email with CRC" />
          </div>
          <button type="button" onClick={link} disabled={linking || !linkReason.trim() || (linkMemberId === applicant.member_id && applicant.match_status === 'manual')} className={ghostBtn}>
            {linking ? 'Saving…' : linkMemberId ? 'Confirm member' : 'Remove link'}
          </button>
        </div>
      </fieldset>
    </section>
  );
}
