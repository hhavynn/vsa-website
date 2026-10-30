import { cn } from '../../../../lib/utils';

export type ImportStep = 'configure' | 'preview' | 'done';

const STEPS: ReadonlyArray<{ key: ImportStep; label: string; hint: string }> = [
  { key: 'configure', label: 'Event & sheet', hint: 'Choose the event, upload the sheet, map columns' },
  { key: 'preview', label: 'Review matches', hint: 'Preview only. Nothing is saved yet' },
  { key: 'done', label: 'Imported', hint: 'Attendance and points are written' },
];

const ORDER: Record<ImportStep, number> = { configure: 0, preview: 1, done: 2 };

/**
 * Where an attendance import stands, and whether anything has been written yet.
 * It mirrors the importer's real three-step state machine; the write happens
 * once, when the admin presses Import on the review step, so that is the only
 * place the banner says records will change. Presentation only.
 */
export function ImportStepper({ step, unresolved = 0 }: { step: ImportStep; /** Rows still waiting on an admin decision, on the review step. */ unresolved?: number }) {
  const current = ORDER[step];
  return (
    <div className="mb-8 space-y-3">
      <ol aria-label="Import progress" className="flex flex-wrap items-start gap-x-2 gap-y-3">
        {STEPS.map((entry, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return (
            <li key={entry.key} aria-current={state === 'current' ? 'step' : undefined} data-state={state} className="flex items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  state === 'current' && 'bg-brand-600 text-white dark:bg-brand-400 dark:text-brand-950',
                  state === 'done' && 'bg-emerald-500 text-white',
                  state === 'todo' && 'bg-surface2 text-[var(--color-text3)] ring-1 ring-[var(--color-border)]',
                )}
              >
                {state === 'done' ? '✓' : index + 1}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-sm font-medium', state === 'current' ? 'text-brand-700 dark:text-brand-300' : 'text-[var(--color-text3)]')}>
                  {entry.label}
                  <span className="sr-only">{state === 'done' ? ' (completed)' : state === 'current' ? ' (current step)' : ' (not started)'}</span>
                </span>
                <span className="hidden text-xs text-[var(--color-text3)] sm:block">{entry.hint}</span>
              </span>
              {index < STEPS.length - 1 && <span aria-hidden className="mx-1 mt-3.5 hidden h-px w-8 bg-[var(--color-border)] sm:block" />}
            </li>
          );
        })}
      </ol>

      <p
        role="status"
        data-step={step}
        className={cn(
          'rounded-md border px-3 py-2 font-sans text-[13px]',
          step === 'preview' && 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200',
          step === 'done' && 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200',
          step === 'configure' && 'border-[var(--color-border)] bg-surface2 text-text-secondary',
        )}
      >
        {step === 'configure' && 'Nothing has been written. Choose the event and sheet, then preview the matches before anything is saved.'}
        {step === 'preview' && (
          <>
            <strong>Preview only. Nothing has been saved yet.</strong> Attendance and points are written only when you press Import below.
            {unresolved > 0 && ` ${unresolved} ${unresolved === 1 ? 'row needs' : 'rows need'} your decision; unresolved rows are skipped.`}
          </>
        )}
        {step === 'done' && <><strong>Import finished.</strong> The records below were written to attendance and points.</>}
      </p>
    </div>
  );
}
