import { ProgressStep, firstUnfinishedStep, stepMark } from '../../../../lib/adminProgress';
import { cn } from '../../../../lib/utils';

const TONE: Record<ProgressStep['status'], string> = {
  done: 'text-green-700 dark:text-green-400',
  partial: 'text-amber-700 dark:text-amber-400',
  warning: 'text-amber-700 dark:text-amber-400',
  todo: 'text-[var(--color-text3)]',
};

/** "Import ✓  Linking ✓  Assignments 42 / 47  Preflight ⚠  Locked —": where the work stopped. */
export function WorkflowProgress({ title, steps }: { title: string; steps: readonly ProgressStep[] }) {
  const stopped = firstUnfinishedStep(steps);
  return (
    <section aria-label={`${title} progress`} className="rounded border border-[var(--color-border)] bg-surface px-4 py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">{title}</p>
      <ol className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {steps.map((step) => (
          <li key={step.key} data-status={step.status} aria-current={stopped?.key === step.key ? 'step' : undefined} className="font-sans text-[13px] text-text-secondary">
            <span className={cn(stopped?.key === step.key && 'font-semibold text-text-primary')}>{step.label}</span>{' '}
            <span className={cn('font-mono text-[13px] font-bold', TONE[step.status])}>{stepMark(step)}</span>
          </li>
        ))}
      </ol>
      {stopped && <p className="mt-2 font-sans text-xs text-text-muted">Next up: {stopped.label}</p>}
    </section>
  );
}
