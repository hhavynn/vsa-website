import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface EmptyStateProps {
  /** What is missing, in one sentence: "No ACE assignment cycle exists for 2027–28." */
  title: string;
  description?: ReactNode;
  /** The obvious next action. */
  action?: { label: string; to?: string; onClick?: () => void; disabled?: boolean };
}

/** Replaces "No records." with what is missing and the one button that fixes it. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  const btn =
    'mt-3 inline-flex rounded border-0 bg-brand-600 px-4 py-2 font-sans text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-400 dark:text-[#050810]';
  return (
    <div className="rounded border border-dashed border-[var(--color-border)] px-6 py-8 text-center">
      <p className="font-serif text-lg font-bold text-text-primary">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md font-sans text-xs text-text-secondary">{description}</p>}
      {action?.to ? (
        <Link to={action.to} className={btn}>{action.label}</Link>
      ) : action ? (
        <button type="button" onClick={action.onClick} disabled={action.disabled} className={btn}>{action.label}</button>
      ) : null}
    </div>
  );
}
