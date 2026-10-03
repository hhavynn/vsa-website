// Server-error handling for admin forms. Client validation (zod) is UX only:
// the database constraints and RLS remain the real validation, and a server
// rejection must land next to the field that caused it when we can tell which.
import { DatabaseError } from '../data/errors';

export interface ServerFormError {
  /** Field name → message, attached beside the input. */
  fields: Record<string, string>;
  /** Form-level message for anything not tied to a field. */
  message: string;
}

export interface ConstraintHint {
  field: string;
  message: string;
}

/**
 * Maps a failed save to field errors. `constraints` keys are substrings of the
 * Postgres constraint/index name or detail ("events_name_key", "(email)") so a
 * unique violation lands on the right input. Anything unrecognized becomes a
 * form-level message — never swallowed.
 */
export function serverErrorToForm(
  error: unknown,
  options: { constraints?: Record<string, ConstraintHint>; fallback?: string } = {},
): ServerFormError {
  const fallback = options.fallback ?? 'Could not save. Your changes are still here — try again.';
  const fields: Record<string, string> = {};
  if (error instanceof DatabaseError) {
    const haystack = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
    for (const [needle, hint] of Object.entries(options.constraints ?? {})) {
      if (haystack.includes(needle.toLowerCase())) fields[hint.field] = hint.message;
    }
    if (Object.keys(fields).length > 0) {
      return { fields, message: 'Fix the highlighted field and save again.' };
    }
    if (error.code === '23505') return { fields, message: 'That already exists. Change it and save again.' };
    if (error.code === '42501') return { fields, message: "You don't have permission to do that." };
    if (error.code === 'P0001' && error.message) return { fields, message: error.message };
  }
  if (error instanceof Error && error.name === 'ValidationError' && error.message) {
    const field = (error as { field?: string }).field;
    if (field) fields[field] = error.message;
    return { fields, message: field ? 'Fix the highlighted field and save again.' : error.message };
  }
  return { fields, message: fallback };
}
