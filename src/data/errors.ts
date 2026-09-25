export interface ApiError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export class DatabaseError extends Error {
  public readonly code?: string;
  public readonly details?: string;
  public readonly hint?: string;

  constructor(message: string, code?: string, details?: string, hint?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

export class ValidationError extends Error {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class NotFoundError extends Error {
  public readonly resource?: string;
  public readonly id?: string;

  constructor(message: string = 'Resource not found', resource?: string, id?: string) {
    super(message);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}

/**
 * Normalizes Supabase errors into standardized error types
 *
 * The message is deliberately NOT prefixed with the caller's context.
 * `isSupabaseUnavailable()` classifies outages by substring-matching the message,
 * and several contexts in this codebase read "Failed to fetch <thing>" — which
 * contains its `'failed to fetch'` outage signal. Prefixing would make every
 * error from those call sites look like a Supabase outage and render fallback
 * content over a real bug.
 */
export function normalizeSupabaseError(error: ApiError): DatabaseError {
  const { message, code, details, hint } = error;

  // Map common PostgreSQL error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    '23505': 'This record already exists',
    '23503': 'Referenced record does not exist',
    '23502': 'Required field is missing',
    '42501': 'Insufficient permissions',
    '42P01': 'Table does not exist',
    'PGRST116': 'No rows found',
    'PGRST301': 'JWT expired',
    'PGRST302': 'JWT invalid',
  };

  const friendlyMessage =
    (code ? errorMessages[code] : undefined) || message || 'Database error occurred';

  return new DatabaseError(friendlyMessage, code, details, hint);
}

/**
 * Detects the object PostgREST puts in `{ error }`.
 *
 * This is deliberately a structural check, and `ApiError` is deliberately the
 * return type rather than `PostgrestError`.
 * `@supabase/postgrest-js` only constructs a real `PostgrestError` when the caller
 * opts into `.throwOnError()`; on the `{ data, error }` path it assigns a **plain
 * object literal** (`PostgrestBuilder.js`, the `error: { message, details, hint,
 * code }` branch). Every repository in `src/data/repos/` checks `{ error }` and
 * rethrows it, so what reaches `withErrorHandling` is a plain object that fails
 * `instanceof Error` — and, because `PostgrestError` is a class, is not
 * assignable to it either. One PostgREST branch emits `{ message }` alone, so
 * every field but `message` is optional.
 *
 * `message` alone is not enough to match on — plenty of things carry a message.
 * Requiring `code` or `details` alongside it is what distinguishes a PostgREST
 * payload from an arbitrary object.
 */
export function isPostgrestErrorShape(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.message === 'string' &&
    ('code' in candidate || 'details' in candidate)
  );
}

/** Matches the network-failure heuristic this module has always used. */
function looksLikeNetworkFailure(message: string): boolean {
  return message.includes('fetch') || message.includes('network');
}

/**
 * Wraps async operations with standardized error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DatabaseError || error instanceof ValidationError) {
      throw error;
    }

    // Checked BEFORE `instanceof Error`, because the PostgREST payload is a plain
    // object and would otherwise fall all the way through to the generic
    // "Unknown error occurred" branch — discarding the real cause (an RLS denial,
    // a constraint violation, a trigger's RAISE) before anyone can read it.
    //
    // This also mattered for degraded mode: `isSupabaseUnavailable()` matches on
    // message and code fragments, so a quota or outage error rewritten as
    // "<context>: Unknown error occurred" matched none of its signals and public
    // pages rendered an error instead of fallback content.
    if (isPostgrestErrorShape(error)) {
      if (looksLikeNetworkFailure(error.message)) {
        throw new NetworkError(error.message);
      }
      throw normalizeSupabaseError(error);
    }

    if (error instanceof Error) {
      // Network errors
      if (looksLikeNetworkFailure(error.message)) {
        throw new NetworkError(error.message);
      }

      // Generic error wrapping
      throw new Error(context ? `${context}: ${error.message}` : error.message);
    }

    throw new Error(context ? `${context}: Unknown error occurred` : 'Unknown error occurred');
  }
}

/**
 * Type guard to check if an error is a known error type
 */
export function isKnownError(error: unknown): error is DatabaseError | ValidationError | AuthenticationError | AuthorizationError | NetworkError | NotFoundError {
  return error instanceof DatabaseError ||
         error instanceof ValidationError ||
         error instanceof AuthenticationError ||
         error instanceof AuthorizationError ||
         error instanceof NetworkError ||
         error instanceof NotFoundError;
}
