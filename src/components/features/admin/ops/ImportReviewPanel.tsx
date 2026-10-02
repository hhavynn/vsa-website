import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ImportReviewRow,
  ImportRowCategory,
  formatImportSummary,
  importStage,
  problemRows,
  problemRowsToCsv,
  problemRowsToText,
  stageStates,
  summarizeImport,
} from '../../../../lib/adminImportReview';
import { cn } from '../../../../lib/utils';

const CATEGORY_TONE: Record<ImportRowCategory, string> = {
  ready: 'text-green-700 dark:text-green-400',
  needs_review: 'text-amber-700 dark:text-amber-400',
  unmatched: 'text-text-secondary',
  invalid: 'text-red-600 dark:text-red-400',
};
const CATEGORY_LABEL: Record<ImportRowCategory, string> = {
  ready: 'Ready',
  needs_review: 'Needs review',
  unmatched: 'Unmatched',
  invalid: 'Invalid',
};

const STAGE_TONE = {
  done: 'text-green-700 dark:text-green-400',
  current: 'font-bold text-text-primary',
  todo: 'text-text-muted',
} as const;

/**
 * The one import review every importer shows: Input → Parsed → Matched → Needs
 * Review → Ready, a summary before anything is written ("82 rows · 71 ready…"),
 * a concrete reason on each problem row, and Show only problems / Download /
 * Copy so an admin never re-reads the whole spreadsheet. Presentation only.
 */
export function ImportReviewPanel({
  rows,
  hasInput,
  filename = 'import-problem-rows',
}: {
  rows: readonly ImportReviewRow[];
  hasInput: boolean;
  filename?: string;
}) {
  const [onlyProblems, setOnlyProblems] = useState(true);
  const summary = useMemo(() => (rows.length > 0 || hasInput ? summarizeImport(rows) : null), [rows, hasInput]);
  const stage = importStage({ hasInput, summary });
  const stages = stageStates(stage, summary);
  const problems = useMemo(() => problemRows(rows), [rows]);
  const visible = onlyProblems ? problems : rows;

  if (!hasInput) return null;

  const download = () => {
    const blob = new Blob([problemRowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(problemRowsToText(rows));
      toast.success('Problem rows copied.');
    } catch {
      toast.error('Could not copy. Use Download instead.');
    }
  };
  const btn = 'rounded border border-[var(--color-border)] bg-transparent px-2.5 py-1 font-sans text-[11px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)] disabled:opacity-50';

  return (
    <section aria-label="Import review" className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-sans text-xs">
      <ol className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Import stages">
        {stages.map((item) => (
          <li key={item.key} data-state={item.state} aria-current={item.state === 'current' ? 'step' : undefined} className={STAGE_TONE[item.state]}>
            {item.state === 'done' ? '✓ ' : ''}
            {item.label}
          </li>
        ))}
      </ol>

      {summary && summary.total > 0 && (
        <>
          <p className="mt-2 font-mono text-[12px] font-bold text-text-primary" data-testid="import-summary">
            {formatImportSummary(summary).join(' · ')}
          </p>
          {summary.problems > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-text-secondary">
                <input type="checkbox" checked={onlyProblems} onChange={(event) => setOnlyProblems(event.target.checked)} className="rounded border-[var(--color-border)]" />
                Show only problems
              </label>
              <button type="button" onClick={download} className={btn}>Download problem rows</button>
              <button type="button" onClick={copy} className={btn}>Copy problem rows</button>
            </div>
          )}
          <ul className="mt-2 max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto rounded border border-[var(--color-border)]">
            {visible.length === 0 ? (
              <li className="px-3 py-2 text-text-muted">Every row is ready.</li>
            ) : (
              visible.map((row, index) => (
                <li key={`${row.index}-${index}`} data-category={row.category} className="px-3 py-2">
                  <p className="font-semibold text-text-primary">
                    <span className="mr-1.5 font-mono text-[10px] text-text-muted">{row.index > 0 ? `Row ${row.index}` : 'Row'}</span>
                    {row.label}{' '}
                    <span className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.08em]', CATEGORY_TONE[row.category])}>{CATEGORY_LABEL[row.category]}</span>
                  </p>
                  {row.reason && <p className="mt-0.5 text-text-secondary">{row.reason}</p>}
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </section>
  );
}
