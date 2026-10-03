import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DefaultValues, FieldValues, Path, UseFormReturn, useForm } from 'react-hook-form';
import { z } from 'zod';
import { SaveStatus, saveStatus } from '../lib/adminDirty';
import { ConstraintHint, serverErrorToForm } from '../lib/adminForm';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

export interface UseAdminFormOptions<S extends z.ZodTypeAny> {
  /** Lives in src/schemas/. Client validation is UX; the DB/RLS stay authoritative. */
  schema: S;
  defaultValues: DefaultValues<z.input<S>>;
  /** Throw (a DatabaseError etc.) to report a server failure; return normally on success. */
  onSubmit: (values: z.output<S>) => Promise<unknown>;
  /** Toast on success. Pass null to stay quiet when the caller already confirms. */
  successMessage?: string | null;
  /** Maps database constraint names to the field they belong to. */
  constraints?: Record<string, ConstraintHint>;
  onSuccess?: (values: z.output<S>) => void;
}

export interface AdminFormApi<S extends z.ZodTypeAny> {
  form: UseFormReturn<z.input<S>, unknown, z.output<S>>;
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  status: SaveStatus;
  /** Form-level error from the last failed save (field errors live on `form.formState.errors`). */
  formError: string | null;
  /** Reset to the last saved values and clear errors. */
  discard: () => void;
  /** For in-page transitions (cancel, switch record): true when it is fine to proceed. */
  confirmDiscard: () => boolean;
}

/**
 * Lifecycle for an admin form: zod-validated, a pending/success/error cycle,
 * server errors placed on the right field, and the shared unsaved-changes
 * guard. The guard follows react-hook-form's dirty state, which `reset(values)`
 * clears on success — so saving and then navigating never prompts.
 */
export function useAdminForm<S extends z.ZodTypeAny>(options: UseAdminFormOptions<S>): AdminFormApi<S> {
  type Input = z.input<S>;
  type Output = z.output<S>;
  const { schema, defaultValues, onSubmit, successMessage = 'Saved.', constraints, onSuccess } = options;
  const form = useForm<Input, unknown, Output>({
    // zod's input/output generics do not line up with the resolver's inferred
    // types for transforms; the schema is the single source of truth here.
    resolver: zodResolver(schema as never) as never,
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const { isDirty, isSubmitting } = form.formState;
  const confirmDiscard = useUnsavedChangesGuard(isDirty, isSubmitting);

  // Any edit after a save retires the "Saved" state and a stale server error.
  useEffect(() => {
    const subscription = form.watch(() => {
      setJustSaved(false);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const submit = useCallback(
    (event?: React.BaseSyntheticEvent) =>
      form.handleSubmit(
        async (values: Output) => {
          setFormError(null);
          try {
            await onSubmit(values);
          } catch (error) {
            const mapped = serverErrorToForm(error, { constraints });
            let first = true;
            for (const [name, message] of Object.entries(mapped.fields)) {
              form.setError(name as Path<Input>, { type: 'server', message }, { shouldFocus: first });
              first = false;
            }
            setFormError(mapped.message);
            toast.error(mapped.message);
            return;
          }
          // Reset to what was just saved so the form is clean (guard off) and
          // later edits are measured against it.
          form.reset(values as unknown as Input);
          setJustSaved(true);
          if (successMessage) toast.success(successMessage);
          onSuccess?.(values);
        },
        () => {
          // Client validation failed: RHF already focuses the first invalid field.
          setFormError(null);
        },
      )(event),
    [form, onSubmit, successMessage, constraints, onSuccess],
  );

  const discard = useCallback(() => {
    form.reset();
    setFormError(null);
    setJustSaved(false);
  }, [form]);

  const status = saveStatus({ dirty: isDirty, saving: isSubmitting, failed: formError !== null, justSaved });
  return { form, submit, status, formError, discard, confirmDiscard };
}

export type { FieldValues };
