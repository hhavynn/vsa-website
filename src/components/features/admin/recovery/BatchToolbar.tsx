import { useId, useState } from 'react';
import { DISMISS_REASONS, DismissReason } from '../../../../lib/attendanceRecovery';
import { BulkEligibility, BulkKind } from '../../../../lib/recoveryTriage';
import { cn } from '../../../../lib/utils';
import { NEEDS_INFO_TEMPLATES } from './RowEditors';
import { errorBox, inputCls, labelCls, primarySmallBtn, smallBtn, warnBox } from './recoveryUi';

const BULK_LABELS: Record<BulkKind, string> = {
  needs_info: 'Hold selected',
  dismiss: 'Dismiss selected',
  create_member: 'New members for selected',
};

/**
 * Always-visible batch controls. Selection (checkboxes) and staging are
 * separate: bulk actions here only stage homogeneous decisions for the
 * selected rows that qualify, and say which ones were skipped and why.
 * Nothing is written until Review & apply.
 */
export function BatchToolbar({
  selectedCount,
  allOnPage,
  pageCount,
  canSelectAllMatching,
  totalMatching,
  onSelectPage,
  onSelectAllMatching,
  onClearSelection,
  stagedCount,
  stagedEventCount,
  issueCount,
  canUndo,
  onUndo,
  onClearStaged,
  onReview,
  eligibility,
  onBulkStage,
}: {
  selectedCount: number;
  allOnPage: boolean;
  pageCount: number;
  canSelectAllMatching: boolean;
  totalMatching: number;
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
  stagedCount: number;
  stagedEventCount: number;
  issueCount: number;
  canUndo: boolean;
  onUndo: () => void;
  onClearStaged: () => void;
  onReview: () => void;
  eligibility: (kind: BulkKind, reason?: DismissReason) => BulkEligibility;
  onBulkStage: (kind: BulkKind, options: { note: string; reason: DismissReason }) => void;
}) {
  const uid = useId();
  const [bulk, setBulk] = useState<BulkKind | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<DismissReason>('intentional_skip');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = bulk ? eligibility(bulk, reason) : null;

  const open = (kind: BulkKind) => { setBulk(kind); setNote(''); setConfirmed(false); setError(null); };
  const stage = () => {
    if (!bulk || !plan) return;
    if (bulk === 'needs_info' && !note.trim()) return setError('Note what information is missing.');
    if (bulk === 'dismiss' && reason === 'not_actionable' && !note.trim()) return setError('Explain why these findings are not actionable.');
    if (bulk === 'create_member' && !confirmed) return setError('Confirm these attendees are new people.');
    onBulkStage(bulk, { note, reason });
    setBulk(null);
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-card md:px-4" role="region" aria-label="Batch actions">
      {bulk && plan && (
        <div className="mb-2.5 space-y-2 rounded border border-[var(--color-border)] p-2.5" onKeyDown={(event) => { if (event.key === 'Escape') setBulk(null); }}>
          <p className="text-sm font-medium text-[var(--color-text)]">
            {BULK_LABELS[bulk]}: {plan.eligible.length} of {selectedCount} selected row{selectedCount === 1 ? '' : 's'} qualify
          </p>
          {bulk === 'dismiss' && (
            <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text)]">
              <legend className="sr-only">Dismiss reason</legend>
              {DISMISS_REASONS.map((option) => (
                <label key={option.value} className="flex items-center gap-1.5" title={option.hint}>
                  <input type="radio" name={`${uid}-reason`} checked={reason === option.value} onChange={() => setReason(option.value)} />
                  {option.label}
                </label>
              ))}
            </fieldset>
          )}
          {(bulk === 'needs_info' || bulk === 'dismiss') && (
            <div>
              <label className={labelCls} htmlFor={`${uid}-note`}>
                {bulk === 'needs_info' ? 'What is missing? (required, shared by every row)' : reason === 'not_actionable' ? 'Why? (required, shared by every row)' : 'Note (optional, shared by every row)'}
              </label>
              <textarea id={`${uid}-note`} className={cn(inputCls, 'min-h-[40px]')} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setError(null); }} />
              {bulk === 'needs_info' && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {NEEDS_INFO_TEMPLATES.map((template) => (
                    <button key={template} type="button" className={cn(smallBtn, 'text-[11px]')} onClick={() => setNote(template)}>{template}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {bulk === 'create_member' && (
            <>
              <p className="text-xs text-[var(--color-text2)]">
                Only rows with an email on the row, no similar or same-name member, and an email no member has qualify. Each new member is created from the row exactly as shown, and the review checks the whole roster for similar names again.
              </p>
              <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                I checked these {plan.eligible.length} attendees and confirm each is a new person who is not already a member.
              </label>
            </>
          )}
          {plan.warnings.map((warning) => <p key={warning} className={warnBox}>{warning}</p>)}
          {plan.skipped.length > 0 && (
            <details className="text-xs text-[var(--color-text2)]">
              <summary className="cursor-pointer">{plan.skipped.length} skipped (left as they are)</summary>
              <ul className="mt-1 max-h-28 list-disc overflow-y-auto pl-4">
                {plan.skipped.slice(0, 50).map(({ insight, reason: why }) => (
                  <li key={insight.finding.record.row_id}>{insight.finding.record.display_name || 'Unnamed row'} (row {insight.finding.sheetRow}): {why}</li>
                ))}
              </ul>
            </details>
          )}
          {error && <p role="alert" className={errorBox}>{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primarySmallBtn} disabled={plan.eligible.length === 0} onClick={stage}>
              Stage for {plan.eligible.length} row{plan.eligible.length === 1 ? '' : 's'}
            </button>
            <button type="button" className={smallBtn} onClick={() => setBulk(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-[var(--color-text)]" aria-live="polite">{selectedCount} selected</span>
          <button type="button" className={smallBtn} onClick={allOnPage ? onClearSelection : onSelectPage} disabled={pageCount === 0}>
            {allOnPage ? 'Clear selection' : `Select visible (${pageCount})`}
          </button>
          {canSelectAllMatching && selectedCount > 0 && selectedCount < totalMatching && (
            <button type="button" className={smallBtn} onClick={onSelectAllMatching}>Select all {totalMatching} matching</button>
          )}
          {selectedCount > 0 && !allOnPage && <button type="button" className={smallBtn} onClick={onClearSelection}>Clear selection</button>}
          {selectedCount > 0 && (
            <>
              <span aria-hidden="true" className="mx-1 h-4 w-px bg-[var(--color-border)]" />
              <button type="button" className={smallBtn} onClick={() => open('needs_info')}>Hold…</button>
              <button type="button" className={smallBtn} onClick={() => open('dismiss')}>Dismiss…</button>
              <button type="button" className={smallBtn} onClick={() => open('create_member')}>New members…</button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-[var(--color-text)]" aria-live="polite">
            {stagedCount} staged{stagedEventCount > 1 ? ` across ${stagedEventCount} events` : ''}
            {issueCount > 0 && <span className="ml-1 text-red-700 dark:text-red-300">· {issueCount} need attention</span>}
          </span>
          <button type="button" className={smallBtn} disabled={!canUndo} onClick={onUndo} aria-keyshortcuts="Shift+U" title="Undo last staging change">Undo last</button>
          <button type="button" className={smallBtn} disabled={stagedCount === 0} onClick={onClearStaged}>Clear staged</button>
          <button type="button" className={primarySmallBtn} disabled={stagedCount === 0} onClick={onReview}>
            Review &amp; apply {stagedCount > 0 ? stagedCount : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
