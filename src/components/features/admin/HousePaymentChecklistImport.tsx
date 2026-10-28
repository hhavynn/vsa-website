// Protected domain — House membership. Review-first payment checklist import
// (#658): parse a CRC checklist CSV, match conservatively, preview every
// change, let an admin confirm name-only matches, then apply in one
// versioned, idempotent request. Absence never means Unpaid unless chosen.
import { ChangeEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { housePaymentsRepository } from '../../../data/repos/housePayments';
import { newRequestId } from '../../../lib/attendanceRecovery';
import {
  AbsentPolicy,
  ChecklistMode,
  ChecklistOutcome,
  ChecklistParse,
  HouseApplicant,
  HousePaymentCycle,
  PAYMENT_STATUS_LABEL,
  parseChecklistCsv,
  planChecklistImport,
} from '../../../lib/housePayments';
import { cn } from '../../../lib/utils';

const OUTCOME_LABEL: Record<ChecklistOutcome, string> = {
  change: 'Will change',
  unchanged: 'Already set',
  suggested: 'Confirm match',
  ambiguous: 'Choose applicant',
  unmatched: 'No match',
  duplicate: 'Repeat (once)',
  conflict: 'Conflict',
  kept_waiver: 'Waiver kept',
  bad_status: 'Bad status',
};
const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted';

export interface HousePaymentChecklistImportProps {
  cycle: HousePaymentCycle;
  applicants: HouseApplicant[];
  membersByEmail: ReadonlyMap<string, readonly string[]>;
  frozen: boolean;
  onApplied: () => void;
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function HousePaymentChecklistImport({ cycle, applicants, membersByEmail, frozen, onApplied }: HousePaymentChecklistImportProps) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ChecklistParse | null>(null);
  const [mode, setMode] = useState<ChecklistMode>('paid_roster');
  const [absentPolicy, setAbsentPolicy] = useState<AbsentPolicy>('unknown');
  const [confirmed, setConfirmed] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);
  const [applying, setApplying] = useState(false);
  const nameOf = useMemo(() => new Map(applicants.map((applicant) => [applicant.id, `${applicant.source_name} (row ${applicant.source_row_number})`])), [applicants]);

  const plan = useMemo(() => (parsed?.ok
    ? planChecklistImport(parsed.rows, { applicants, membersByEmail, mode, absentPolicy, confirmedSuggestions: confirmed })
    : null), [parsed, applicants, membersByEmail, mode, absentPolicy, confirmed]);
  const stale = previewVersion !== null && previewVersion !== cycle.status_version;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = parseChecklistCsv(await readFileText(file));
      setFileName(file.name);
      setParsed(result);
      setConfirmed({});
      setPreviewVersion(cycle.status_version);
      setRequestId(newRequestId());
      if (!result.ok) toast.error(result.error);
    } catch (err) {
      console.error(err);
      toast.error('Could not read that file.');
    }
  }

  async function apply() {
    if (!plan || plan.blocked || plan.changes.length === 0 || applying || stale || !reason.trim()) return;
    setApplying(true);
    try {
      const result = await housePaymentsRepository.setPayments({
        cycleId: cycle.id,
        changes: plan.changes,
        source: 'checklist_import',
        reason: `${reason.trim()}${fileName ? ` (${fileName})` : ''}`,
        requestId,
        expectedVersion: previewVersion,
      });
      toast.success(`${result.replayed ? 'Already applied: ' : ''}${result.applied} status${result.applied === 1 ? '' : 'es'} changed${result.keptWaivers ? `, ${result.keptWaivers} waiver${result.keptWaivers === 1 ? '' : 's'} kept` : ''}. Any saved sort is now stale until rerun.`);
      setParsed(null);
      setFileName('');
      setReason('');
      onApplied();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : 'The checklist could not be applied. Nothing was changed.');
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  return (
    <details className="scrapbook-paper border-[var(--color-border)] bg-surface">
      <summary className="cursor-pointer px-5 py-4 font-serif text-base font-bold text-text-primary">Import a payment checklist (.csv)</summary>
      <div className="space-y-4 border-t px-5 pb-5 pt-4 border-[var(--color-border)]">
        <p className="text-xs text-text-secondary">
          Columns are detected from headers: Application row (best), Email, Name, Status, Notes. An application row or a known email matches; a name alone is only suggested for you to confirm. Never include amounts, account numbers or receipts.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="payment-checklist-file" className={labelCls}>Checklist CSV</label>
            <input id="payment-checklist-file" type="file" accept=".csv,text/csv" onChange={handleFile} disabled={frozen || applying} className="block text-xs text-text-secondary" />
            {fileName && <p className="mt-1 text-xs text-text-muted">Loaded {fileName}</p>}
          </div>
          <fieldset>
            <legend className={labelCls}>This file is</legend>
            <div className="flex flex-wrap gap-3 text-xs text-text-primary">
              <label className="flex items-center gap-1"><input type="radio" name="checklist-mode" checked={mode === 'paid_roster'} onChange={() => setMode('paid_roster')} /> A list of people who paid</label>
              <label className="flex items-center gap-1"><input type="radio" name="checklist-mode" checked={mode === 'unpaid_list'} onChange={() => setMode('unpaid_list')} /> A list of people who did not pay</label>
            </div>
          </fieldset>
          {mode === 'paid_roster' && (
            <fieldset>
              <legend className={labelCls}>Applicants not on the list</legend>
              <div className="flex flex-wrap gap-3 text-xs text-text-primary">
                <label className="flex items-center gap-1"><input type="radio" name="checklist-absent" checked={absentPolicy === 'unknown'} onChange={() => setAbsentPolicy('unknown')} /> Leave unchanged (Unknown)</label>
                <label className="flex items-center gap-1"><input type="radio" name="checklist-absent" checked={absentPolicy === 'unpaid'} onChange={() => setAbsentPolicy('unpaid')} /> Mark Unverified/Pending as Unpaid</label>
              </div>
            </fieldset>
          )}
        </div>
        {mode === 'paid_roster' && absentPolicy === 'unpaid' && (
          <p role="note" className="rounded border border-amber-300 p-2 text-xs text-amber-900 dark:border-amber-800 dark:text-amber-200">
            Only choose this if the file is the complete, authoritative paid roster. People already marked Paid are never downgraded; they are listed for review instead.
          </p>
        )}

        {plan && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Checklist preview counts">
              {(Object.keys(OUTCOME_LABEL) as ChecklistOutcome[]).filter((key) => plan.counts[key] > 0).map((key) => (
                <div key={key} className="rounded border px-3 py-2 border-[var(--color-border)] bg-surface2">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{OUTCOME_LABEL[key]}</dt>
                  <dd className="font-serif text-lg font-bold text-text-primary">{plan.counts[key]}</dd>
                </div>
              ))}
            </dl>
            {plan.absentToUnpaid.length > 0 && <p className="text-xs text-text-primary">{plan.absentToUnpaid.length} applicant{plan.absentToUnpaid.length === 1 ? '' : 's'} not on the list will be marked Unpaid.</p>}
            {plan.paidButAbsent.length > 0 && (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Marked Paid but not on this list (unchanged; review): {plan.paidButAbsent.map((id) => nameOf.get(id)).join(', ')}.
              </p>
            )}
            <ol className="max-h-96 space-y-1.5 overflow-y-auto" aria-label="Checklist rows">
              {plan.items.map((item) => (
                <li key={item.row.row} className={cn('rounded border p-2 text-xs border-[var(--color-border)]', item.outcome === 'conflict' || item.outcome === 'bad_status' ? 'border-red-300 dark:border-red-800' : '')}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-text-primary">
                      Checklist row {item.row.row}: {item.row.name || item.row.email || `application row ${item.row.sheetRow}`}
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                      {OUTCOME_LABEL[item.outcome]}{item.targetStatus ? ` · ${PAYMENT_STATUS_LABEL[item.targetStatus]}` : ''}
                    </span>
                  </div>
                  <p className="mt-0.5 text-text-secondary">{item.applicantId ? `${nameOf.get(item.applicantId)}. ` : ''}{item.message}</p>
                  {(item.outcome === 'suggested' || item.outcome === 'ambiguous' || (item.outcome === 'change' && confirmed[item.row.row])) && item.candidateIds.length > 0 && (
                    <label className="mt-1 flex flex-wrap items-center gap-2 text-text-primary">
                      <span>Apply to</span>
                      <select
                        value={confirmed[item.row.row] ?? ''}
                        onChange={(event) => setConfirmed((prev) => {
                          const next = { ...prev };
                          if (event.target.value) next[item.row.row] = event.target.value;
                          else delete next[item.row.row];
                          return next;
                        })}
                        className="rounded border bg-[var(--color-surface2)] px-2 py-1 text-xs border-[var(--color-border)]"
                      >
                        <option value="">Nobody (skip)</option>
                        {item.candidateIds.map((id) => <option key={id} value={id}>{nameOf.get(id)}</option>)}
                      </select>
                    </label>
                  )}
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="checklist-reason" className={labelCls}>Reason (recorded with every change)</label>
                <input
                  id="checklist-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={300}
                  placeholder="e.g. CRC Venmo checklist after the 11/6 deadline"
                  className="w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-xs text-[var(--color-text)] border-[var(--color-border)]"
                />
              </div>
              <button
                type="button"
                onClick={apply}
                disabled={frozen || applying || plan.blocked || plan.changes.length === 0 || stale || !reason.trim()}
                className="vsa-btn-primary px-5 py-2.5 text-xs disabled:opacity-50"
              >
                {applying ? 'Applying…' : `Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'}`}
              </button>
            </div>
            {plan.blocked && <p role="alert" className="text-xs text-red-700 dark:text-red-300">Fix the conflicting or unreadable rows in the file and upload it again. Nothing is applied while any remain.</p>}
            {stale && <p role="alert" className="text-xs text-amber-800 dark:text-amber-300">Payments changed since this preview. Upload the file again to review against current statuses.</p>}
          </div>
        )}
      </div>
    </details>
  );
}
