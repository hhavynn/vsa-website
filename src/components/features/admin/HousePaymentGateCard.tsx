// Protected domain — House membership. Payment eligibility status of one
// automatic placement draft (#660): provisional vs final, lineage, the
// server's own Lock/Reveal blockers, and the entry point to a post-payment
// rerun (#657). The blockers come from house_batch_payment_blockers(); the
// database enforces them again on Lock and Reveal, so this card only explains.
import { useState } from 'react';
import type { HouseAssignmentBatch, HouseAssignmentDraft, HouseProfileLite } from '../../../lib/houseAssignmentDraft';
import { batchLineageLabel, readEligibilitySummary } from '../../../lib/housePayments';
import { HouseRerunPanel } from './HouseRerunPanel';

export interface HousePaymentGateCardProps {
  batch: HouseAssignmentBatch;
  drafts: HouseAssignmentDraft[];
  profiles: HouseProfileLite[];
  userId: string | null;
  /** Null when the payment migration is not applied; undefined while loading. */
  blockers: string[] | null | undefined;
  blockersFailed: boolean;
  onOpenBatch?: (batchId: string) => void;
}

const STALE_PREFIX = 'Payments changed since this sort';

export function HousePaymentGateCard({ batch, drafts, profiles, userId, blockers, blockersFailed, onOpenBatch }: HousePaymentGateCardProps) {
  const [rerunOpen, setRerunOpen] = useState(false);
  const linked = !!batch.payment_cycle_id;
  // An unlinked draft only needs this card when the year has a payment roster
  // (the server then reports it as blocked) or the check itself failed.
  if (!linked && !blockersFailed && !(blockers && blockers.length > 0)) return null;

  const lineage = batchLineageLabel(batch);
  const summary = readEligibilitySummary(batch.eligibility_summary);
  const stale = (blockers ?? []).some((message) => message.startsWith(STALE_PREFIX));
  const canRerun = linked && (batch.status === 'draft' || batch.status === 'locked');

  return (
    <section className="scrapbook-paper space-y-3 p-5 border-[var(--color-border)] bg-surface" aria-label="Payment eligibility">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-text-primary">Payment eligibility</h3>
          <p className="mt-1 text-xs text-text-secondary">
            {linked
              ? `${lineage ?? 'Linked to the payment roster'} · payment version ${batch.payment_snapshot_version ?? '—'}${summary.included !== undefined ? ` · ${summary.included} included, ${summary.excluded ?? 0} excluded` : ''}`
              : 'This draft is not linked to the payment roster for its year.'}
          </p>
          {batch.revised_from_batch_id && (
            <button type="button" onClick={() => onOpenBatch?.(batch.revised_from_batch_id as string)} className="mt-1 bg-transparent p-0 text-xs font-semibold text-[var(--brand)] underline-offset-2 hover:underline">
              Open the original draft (unchanged)
            </button>
          )}
        </div>
        {canRerun && !rerunOpen && (
          <button type="button" onClick={() => setRerunOpen(true)} className="vsa-btn-primary px-5 py-2 text-xs">
            Rerun sorting with eligible applicants
          </button>
        )}
      </div>

      {stale && (
        <div role="alert" className="rounded border border-amber-400 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          Payments changed since this sort — rerun required. This draft can no longer be locked or revealed.
        </div>
      )}
      {blockersFailed ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          Payment eligibility could not be checked. Lock and Reveal stay blocked by the database until it can.
        </p>
      ) : blockers === undefined ? (
        <p className="text-xs text-text-muted" role="status">Checking payment eligibility…</p>
      ) : blockers && blockers.length > 0 ? (
        <ul className="space-y-1 text-xs text-red-700 dark:text-red-300" aria-label="Payment blockers">
          {blockers.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : (
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Payment-cleared: every included applicant is Paid or Waived at the current payment version, and nobody eligible is missing.
        </p>
      )}
      {!linked && (
        <p className="text-xs text-text-secondary">
          Re-upload the original House applications CSV in House Assignments and choose this year&rsquo;s payment roster when saving. A rerun needs the saved application snapshot; it is never reconstructed.
        </p>
      )}
      {batch.status === 'published' && linked && (
        <p className="text-xs text-text-secondary">
          Revealed. Later payment changes are recorded for leadership review only; nobody is moved or removed automatically.
        </p>
      )}

      {rerunOpen && (
        <HouseRerunPanel
          batch={batch}
          drafts={drafts}
          profiles={profiles}
          userId={userId}
          onClose={() => setRerunOpen(false)}
          onSaved={(batchId) => {
            setRerunOpen(false);
            onOpenBatch?.(batchId);
          }}
        />
      )}
    </section>
  );
}
