import { Link } from 'react-router-dom';
import { NextStep, NextStepAction } from '../../../../lib/adminNextSteps';

/**
 * Shown after a common action instead of a dead-end toast: what just happened
 * and the logical next step. Dismissible; links and page-local actions only.
 */
export function NextStepBanner({
  step,
  onFilter,
  onPreview,
  onDismiss,
}: {
  step: NextStep | null;
  onFilter?: (key: string) => void;
  onPreview?: () => void;
  onDismiss: () => void;
}) {
  if (!step) return null;
  const btn =
    'inline-flex rounded border border-[var(--color-border)] bg-surface px-3 py-1.5 font-sans text-xs font-semibold text-brand-700 transition-colors hover:bg-[var(--color-surface2)] dark:text-brand-300';
  const render = (action: NextStepAction) => {
    if (action.to) return <Link key={action.label} to={action.to} className={btn}>{action.label} →</Link>;
    if (action.intent === 'preview' && onPreview) return <button key={action.label} type="button" onClick={onPreview} className={btn}>{action.label} →</button>;
    if (action.filter && onFilter) {
      return <button key={action.label} type="button" onClick={() => onFilter(action.filter as string)} className={btn}>{action.label} →</button>;
    }
    return null;
  };
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded border border-green-600/40 bg-green-600/10 px-4 py-3">
      <p className="font-sans text-sm font-semibold text-text-primary">
        <span aria-hidden className="text-green-700 dark:text-green-400">✓ </span>
        {step.message}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {step.actions.map(render)}
        <button type="button" onClick={onDismiss} className="bg-transparent p-0 font-sans text-xs font-semibold text-text-secondary underline-offset-2 hover:underline">
          Dismiss
        </button>
      </div>
    </div>
  );
}
