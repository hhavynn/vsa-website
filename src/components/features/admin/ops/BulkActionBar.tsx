import { ReactNode, useEffect, useRef } from 'react';
import { BulkPlan } from '../../../../lib/adminBulk';
import { cn } from '../../../../lib/utils';

export const bulkBtnCls =
  'rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 font-sans text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400';

/** Sticky strip that appears once rows are selected. Actions are passed as children. */
export function BulkActionBar({
  count,
  noun = 'row',
  onClear,
  children,
}: {
  count: number;
  noun?: string;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-2"
    >
      <p className="font-sans text-xs font-semibold text-[var(--color-text)]">
        {count} {count === 1 ? noun : `${noun}s`} selected
      </p>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <button type="button" onClick={onClear} className="bg-transparent p-0 font-sans text-xs font-semibold text-[var(--color-text2)] underline-offset-2 hover:underline">
        Clear selection
      </button>
    </div>
  );
}

/**
 * Confirmation for a bulk action, showing how many records change and which
 * are skipped (and why). Destructive plans must pass through this; Escape cancels.
 */
export function BulkConfirm<T>({
  plan,
  busy,
  onConfirm,
  onCancel,
  skippedLabel,
}: {
  plan: BulkPlan<T>;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  skippedLabel?: (row: T) => string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div role="alertdialog" aria-label="Confirm bulk action" className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 font-sans text-xs">
      <p className="font-semibold text-[var(--color-text)]">{plan.confirmText}</p>
      <p className="mt-0.5 text-[var(--color-text2)]">{plan.summary}</p>
      {plan.skipped.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--color-text3)]">
          {plan.skipped.slice(0, 5).map((skip, index) => (
            <li key={index}>
              {skippedLabel ? `${skippedLabel(skip.row)}: ` : ''}
              {skip.reason}
            </li>
          ))}
          {plan.skipped.length > 5 && <li>…and {plan.skipped.length - 5} more.</li>}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || plan.eligible.length === 0}
          className={cn(
            'rounded border-0 px-3 py-1.5 font-sans text-xs font-semibold text-white disabled:opacity-50',
            plan.destructive ? 'bg-red-700 dark:bg-red-500' : 'bg-brand-600 dark:bg-brand-400 dark:text-[#050810]',
          )}
        >
          {busy ? 'Working…' : `Confirm (${plan.eligible.length})`}
        </button>
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className={bulkBtnCls}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Row checkbox with a real label for screen readers. */
export function RowCheckbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-brand-600 focus:ring-brand-600"
    />
  );
}
