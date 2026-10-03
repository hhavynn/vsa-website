import { FormEventHandler, ReactNode, useId } from 'react';
import { FieldErrors, FieldValues } from 'react-hook-form';
import { SaveStatus } from '../../../../lib/adminDirty';
import { cn } from '../../../../lib/utils';
import { SaveBar } from './SaveBar';

function flattenErrors(errors: FieldErrors<FieldValues>, prefix = ''): Array<{ name: string; message: string }> {
  const out: Array<{ name: string; message: string }> = [];
  for (const [key, value] of Object.entries(errors)) {
    if (!value) continue;
    const name = prefix ? `${prefix}.${key}` : key;
    const entry = value as { message?: unknown; type?: unknown } & FieldErrors<FieldValues>;
    if (typeof entry.message === 'string' && entry.message) out.push({ name, message: entry.message });
    else if (typeof entry.type === 'string') out.push({ name, message: 'Invalid value' });
    else out.push(...flattenErrors(entry, name));
  }
  return out;
}

/**
 * The shared frame for an admin form: a <form> that validates before
 * submitting, an error summary that links to each problem field (announced to
 * screen readers), and the standard save controls with the
 * dirty / saving / saved / failed lifecycle. Pair it with `useAdminForm`.
 */
export function AdminFormShell({
  onSubmit,
  status,
  formError,
  errors,
  onDiscard,
  saveLabel = 'Save',
  actions,
  className,
  children,
  label,
}: {
  onSubmit: FormEventHandler<HTMLFormElement>;
  status: SaveStatus;
  formError?: string | null;
  errors?: FieldErrors<FieldValues>;
  onDiscard?: () => void;
  saveLabel?: string;
  /** Extra footer buttons (Cancel, Delete…), placed after the save controls. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Accessible name for the form. */
  label?: string;
}) {
  const summaryId = useId();
  const problems = errors ? flattenErrors(errors) : [];
  const show = Boolean(formError) || problems.length > 0;
  const busy = status === 'saving';

  return (
    <form onSubmit={onSubmit} noValidate aria-label={label} aria-busy={busy} aria-describedby={show ? summaryId : undefined} className={cn('space-y-4', className)}>
      {show && (
        <div
          id={summaryId}
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 font-sans text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          {formError && <p className="font-semibold">{formError}</p>}
          {problems.length > 0 && (
            <>
              <p className={cn(formError && 'mt-1')}>
                {problems.length === 1 ? 'There is 1 problem to fix:' : `There are ${problems.length} problems to fix:`}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {problems.map((problem) => (
                  <li key={problem.name}>{problem.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <fieldset disabled={busy} className="m-0 min-w-0 space-y-4 border-0 p-0">
        {children}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 border-t pt-4 border-border-strong">
        <SaveBar status={status} submit saveLabel={saveLabel} onDiscard={onDiscard} />
        {actions}
      </div>
    </form>
  );
}

/**
 * One labelled field: the label is tied to the input, the error is announced,
 * and `aria-invalid` / `aria-describedby` are wired for you. Use the render
 * prop to spread `fieldProps` onto the input alongside `register(...)`.
 */
export function AdminField({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (fieldProps: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined; 'aria-required': boolean | undefined }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block font-sans text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && (
        <p id={hintId} className="mt-1 font-sans text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 font-sans text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
