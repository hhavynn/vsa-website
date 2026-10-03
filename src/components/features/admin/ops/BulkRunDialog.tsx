import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { BulkPlan } from '../../../../lib/adminBulk';
import { BULK_DELETE_TYPED_THRESHOLD, bulkConfirmPhrase, confirmPhraseMatches } from '../../../../lib/adminConfirm';
import { BulkRunResult, runBulk, summarizeBulkResult } from '../../../../lib/adminBulkRun';
import { cn } from '../../../../lib/utils';
import { DialogFrame, dialogBtnCls, dialogPrimaryCls } from '../../../common/ConfirmDialog';

const PREVIEW_LIMIT = 100;

type Phase = 'review' | 'running' | 'done';

/**
 * Dry-run preview + executor for a bulk admin action. The admin sees exactly
 * which items will change (and what each becomes) and which are skipped and
 * why *before* anything is written; running shows progress; the result lists
 * every failure so a half-succeeded action never reads as success.
 *
 * Destructive plans with several items also require typing the count, so a
 * wrong selection is noticed. Nothing here decides eligibility — build the
 * plan with `planBulk` — and none of it applies to points/attendance/House
 * membership writes, which have their own reviewed flows.
 */
export function BulkRunDialog<T>({
  open,
  title,
  plan,
  noun,
  nounPlural = `${noun}s`,
  verb,
  past,
  itemLabel,
  changeLabel,
  scopeNote,
  extra,
  run,
  onFinished,
  onClose,
  concurrency,
}: {
  open: boolean;
  title: string;
  plan: BulkPlan<T>;
  noun: string;
  nounPlural?: string;
  /** "archive" — used in "Archive 12 resources" and failure copy. */
  verb: string;
  /** "Archived" — used in the result headline. */
  past: string;
  /** One row's name in the preview list. */
  itemLabel: (item: T) => string;
  /** What this row becomes, e.g. "Published → Draft". Shown beside the name. */
  changeLabel?: (item: T) => string;
  /** Scope sentence from useRowSelection().describe(...), shown above the list. */
  scopeNote?: string;
  /** Extra warning copy (cascading effects) shown above the list. */
  extra?: ReactNode;
  /** The write for one item. Throw to mark it failed; throw `BulkPartialError` if the main write committed but a follow-up did not. */
  run: (item: T) => Promise<unknown>;
  /** Called once the run completes (even partially) so the page can refetch. */
  onFinished?: (result: BulkRunResult<T>) => void;
  onClose: () => void;
  concurrency?: number;
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const inputId = `${uid}-phrase`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('review');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BulkRunResult<T> | null>(null);
  const [typed, setTyped] = useState('');
  // The items still to attempt: the plan's eligible rows, then only the failures on retry.
  const [queue, setQueue] = useState<T[]>(plan.eligible);

  useEffect(() => {
    if (open) {
      setPhase('review');
      setResult(null);
      setTyped('');
      setProgress({ done: 0, total: 0 });
      setQueue(plan.eligible);
    }
    // Reset only when (re)opened: the plan is a snapshot of what was previewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const count = queue.length;
  const phrase = bulkConfirmPhrase(count, noun, nounPlural);
  const needsTyped = phase === 'review' && plan.destructive && plan.eligible.length >= BULK_DELETE_TYPED_THRESHOLD;
  const canRun = phase === 'review' && count > 0 && (!needsTyped || confirmPhraseMatches(typed, phrase));

  const start = async (items: T[]) => {
    setPhase('running');
    setProgress({ done: 0, total: items.length });
    const outcome = await runBulk(items, run, {
      concurrency,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    // Retried runs merge with what already succeeded so the summary stays whole.
    const merged: BulkRunResult<T> = result
      ? {
          succeeded: [...result.succeeded, ...outcome.succeeded],
          failed: outcome.failed,
          warnings: [...(result.warnings ?? []), ...(outcome.warnings ?? [])],
        }
      : outcome;
    setResult(merged);
    setQueue(outcome.failed.map((entry) => entry.item));
    setPhase('done');
    onFinished?.(merged);
  };

  const summary = result ? summarizeBulkResult(result, { past, verb, noun, nounPlural }) : null;
  const shown = (phase === 'review' ? plan.eligible : []).slice(0, PREVIEW_LIMIT);

  return (
    <DialogFrame titleId={titleId} descriptionId={descId} onClose={onClose} locked={phase === 'running'} initialFocusRef={needsTyped ? inputRef : cancelRef} wide>
      <h2 id={titleId} className="font-serif text-xl font-bold">
        {title}
      </h2>

      {phase === 'review' && (
        <>
          <p id={descId} className="mt-2 font-sans text-sm text-text-secondary">
            {plan.summary}
          </p>
          {scopeNote && (
            <p className="mt-2 rounded border px-3 py-2 font-sans text-xs border-border-strong bg-surface2 text-text-primary">
              {scopeNote}
            </p>
          )}
          {extra}
          {plan.eligible.length > 0 && (
            <>
              <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
                Will change ({plan.eligible.length})
              </p>
              <ul className="mt-1 max-h-56 divide-y divide-border-strong overflow-y-auto rounded border font-sans text-sm border-border-strong" aria-label="Items that will change">
                {shown.map((item, index) => (
                  <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5">
                    <span className="min-w-0 truncate">{itemLabel(item)}</span>
                    {changeLabel && (
                      <span className="shrink-0 font-mono text-[11px] text-text-secondary">
                        {changeLabel(item)}
                      </span>
                    )}
                  </li>
                ))}
                {plan.eligible.length > shown.length && (
                  <li className="px-3 py-1.5 text-xs text-text-muted">
                    …and {plan.eligible.length - shown.length} more (all will be changed).
                  </li>
                )}
              </ul>
            </>
          )}
          {plan.skipped.length > 0 && (
            <>
              <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
                Skipped ({plan.skipped.length})
              </p>
              <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 font-sans text-xs text-text-secondary">
                {plan.skipped.slice(0, 20).map((entry, index) => (
                  <li key={index}>
                    {itemLabel(entry.row)} — {entry.reason}
                  </li>
                ))}
                {plan.skipped.length > 20 && <li>…and {plan.skipped.length - 20} more.</li>}
              </ul>
            </>
          )}
          {needsTyped && (
            <div className="mt-4">
              <label htmlFor={inputId} className="block font-sans text-xs font-semibold">
                Type <span className="font-mono">{phrase}</span> to confirm
              </label>
              <input
                id={inputId}
                ref={inputRef}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full rounded border bg-transparent px-3 py-2 font-mono text-sm border-border-strong text-text-primary"
              />
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button ref={cancelRef} type="button" onClick={onClose} className={dialogBtnCls}>
              Cancel
            </button>
            <button type="button" disabled={!canRun} onClick={() => void start(queue)} className={dialogPrimaryCls(plan.destructive)}>
              {verb.charAt(0).toUpperCase() + verb.slice(1)} {count}
            </button>
          </div>
        </>
      )}

      {phase === 'running' && (
        <div id={descId} className="mt-3" role="status" aria-live="polite">
          <p className="font-sans text-sm text-text-secondary">
            Working… {progress.done} of {progress.total}
          </p>
          <progress
            value={progress.done}
            max={Math.max(progress.total, 1)}
            aria-label="Bulk action progress"
            className="mt-2 h-2 w-full appearance-none overflow-hidden rounded-full bg-surface2 [&::-moz-progress-bar]:bg-brand-600 [&::-webkit-progress-bar]:bg-surface2 [&::-webkit-progress-value]:bg-brand-600 [&::-webkit-progress-value]:transition-all dark:[&::-moz-progress-bar]:bg-brand-400 dark:[&::-webkit-progress-value]:bg-brand-400"
          />
          <p className="mt-2 font-sans text-xs text-text-muted">
            Keep this window open until it finishes.
          </p>
        </div>
      )}

      {phase === 'done' && result && summary && (
        <div id={descId} className="mt-3">
          <p
            role="status"
            className={cn(
              'font-sans text-sm font-semibold',
              summary.tone === 'success' && 'text-green-700 dark:text-green-400',
              summary.tone === 'partial' && 'text-amber-700 dark:text-amber-400',
              summary.tone === 'failure' && 'text-red-700 dark:text-red-400',
            )}
          >
            {summary.headline}
          </p>
          {(result.warnings?.length ?? 0) > 0 && (
            <>
              <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">Saved, needs attention ({result.warnings?.length})</p>
              <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 font-sans text-xs text-text-secondary" aria-label="Items that need attention">
                {(result.warnings ?? []).map((entry, index) => (
                  <li key={index}>
                    {itemLabel(entry.item)} — {entry.error}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.failed.length > 0 && (
            <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 font-sans text-xs text-text-secondary" aria-label="Items that failed">
              {result.failed.map((entry, index) => (
                <li key={index}>
                  {itemLabel(entry.item)} — {entry.error}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {result.failed.length > 0 && (
              <button type="button" onClick={() => void start(queue)} className={dialogBtnCls}>
                Retry {result.failed.length} failed
              </button>
            )}
            <button type="button" autoFocus onClick={onClose} className={dialogPrimaryCls(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </DialogFrame>
  );
}
