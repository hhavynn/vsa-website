import { SaveStatus, canSave } from '../../../../lib/adminDirty';
import { cn } from '../../../../lib/utils';

const COPY: Record<SaveStatus, string> = {
  clean: 'No changes',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved — your changes are still here. Try again.',
};

/**
 * Save controls for a form or draft editor. Save stays disabled until there is
 * something to save; a failed save keeps the form and says so.
 */
export function SaveBar({
  status,
  onSave,
  onDiscard,
  saveLabel = 'Save',
  className,
}: {
  status: SaveStatus;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  className?: string;
}) {
  const dirty = status === 'dirty' || status === 'error';
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave(status)}
        className="rounded border-0 bg-brand-600 px-4 py-2 font-sans text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-400 dark:text-[#050810]"
      >
        {status === 'saving' ? 'Saving…' : saveLabel}
      </button>
      {onDiscard && dirty && (
        <button type="button" onClick={onDiscard} className="bg-transparent p-0 font-sans text-xs font-semibold text-[var(--color-text2)] underline-offset-2 hover:underline">
          Discard changes
        </button>
      )}
      <span
        role="status"
        aria-live="polite"
        className={cn(
          'font-mono text-[11px] font-bold uppercase tracking-[0.08em]',
          status === 'dirty' && 'text-amber-700 dark:text-amber-400',
          status === 'error' && 'text-red-600 dark:text-red-400',
          status === 'saved' && 'text-green-700 dark:text-green-400',
          (status === 'clean' || status === 'saving') && 'text-[var(--color-text3)]',
        )}
      >
        {COPY[status]}
      </span>
    </div>
  );
}
