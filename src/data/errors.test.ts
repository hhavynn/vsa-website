import {
  withErrorHandling,
  isPostgrestErrorShape,
  normalizeSupabaseError,
  DatabaseError,
  ValidationError,
  NetworkError,
} from './errors';
import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';

/**
 * Regression tests for the "Unknown error occurred" bug.
 *
 * `@supabase/postgrest-js` only constructs a real `PostgrestError` when the
 * caller opts into `.throwOnError()`. On the `{ data, error }` path that every
 * repository here uses, it assigns a plain object literal. That object fails
 * `instanceof Error`, so it used to fall past every branch in
 * `withErrorHandling` and surface as "<context>: Unknown error occurred",
 * discarding the actual cause.
 *
 * These tests throw the plain shape the client really produces. Rewriting
 * `postgrestError()` to return an `Error` would make all of them vacuous.
 */

/** The exact shape PostgREST puts in `{ error }` — a plain object, not an Error. */
function realPostgrestPayload(
  message: string,
  code = '',
  details = '',
  hint = ''
): { message: string; code: string; details: string; hint: string } {
  return { message, code, details, hint };
}

describe('isPostgrestErrorShape', () => {
  it('matches the plain object PostgREST returns', () => {
    expect(isPostgrestErrorShape(realPostgrestPayload('boom', '42501'))).toBe(true);
  });

  it('matches a payload carrying details but no code', () => {
    expect(isPostgrestErrorShape({ message: 'boom', details: 'ctx' })).toBe(true);
  });

  it('does not match a bare Error, which has no code or details', () => {
    // Left to the generic branch, which preserves its message.
    expect(isPostgrestErrorShape(new Error('boom'))).toBe(false);
  });

  it('does not match arbitrary objects that merely have a message', () => {
    expect(isPostgrestErrorShape({ message: 'not from postgrest' })).toBe(false);
  });

  it('does not match null or primitives', () => {
    expect(isPostgrestErrorShape(null)).toBe(false);
    expect(isPostgrestErrorShape('boom')).toBe(false);
    expect(isPostgrestErrorShape(undefined)).toBe(false);
  });
});

describe('withErrorHandling with the real PostgREST payload', () => {
  const run = (thrown: unknown, context?: string) =>
    withErrorHandling(() => Promise.reject(thrown), context);

  it('no longer degrades an RLS denial to "Unknown error occurred"', async () => {
    const promise = run(
      realPostgrestPayload('new row violates row-level security policy', '42501'),
      'Failed to submit photo request'
    );

    // The bug this file exists for.
    await expect(promise).rejects.not.toThrow(/Unknown error occurred/);
  });

  it('maps a known Postgres code to its friendly message', async () => {
    await expect(
      run(realPostgrestPayload('permission denied for table x', '42501'), 'Failed to submit photo request')
    ).rejects.toThrow('Insufficient permissions');
  });

  it('produces a typed DatabaseError that retains code, details and hint', async () => {
    const thrown = realPostgrestPayload('dupe', '23505', 'Key exists', 'Use another value');

    await expect(run(thrown, 'Failed to save')).rejects.toBeInstanceOf(DatabaseError);

    // details/hint stay on the object for logging rather than in the user-facing
    // message, so #351 (no leaking Supabase internals) still holds.
    const error = await run(thrown).catch((e) => e as DatabaseError);
    expect(error.code).toBe('23505');
    expect(error.details).toBe('Key exists');
    expect(error.hint).toBe('Use another value');
    expect(error.message).toBe('This record already exists');
  });

  it('does not prefix the context onto a database error message', async () => {
    // Load-bearing, not cosmetic. isSupabaseUnavailable() substring-matches the
    // message, and contexts like "Failed to fetch events" contain its
    // 'failed to fetch' outage signal — prefixing would make every error from
    // those call sites masquerade as an outage.
    const error = await run(
      realPostgrestPayload('permission denied', '42501'),
      'Failed to fetch events'
    ).catch((e) => e as Error);

    expect(error.message).toBe('Insufficient permissions');
    expect(error.message).not.toContain('Failed to fetch');
  });

  it('passes through a trigger RAISE message, which is written for the user', async () => {
    // Rate-limit guards on member_photo_requests raise P0001 with prose meant to
    // be read. There is no friendly mapping for P0001, so the raw message is the
    // correct thing to surface.
    await expect(
      run(
        realPostgrestPayload('Too many photo requests. Try again tomorrow.', 'P0001'),
        'Failed to submit photo request'
      )
    ).rejects.toThrow('Too many photo requests. Try again tomorrow.');
  });

  it('still classifies a fetch failure as NetworkError, not a database error', async () => {
    // postgrest-js wraps fetch failures into the same plain shape, so this has to
    // be distinguished by message rather than by type.
    await expect(
      run(realPostgrestPayload('TypeError: fetch failed', '', 'stack'), 'Failed to fetch events')
    ).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('degraded-mode detection survives the wrapping', () => {
  // isSupabaseUnavailable() matches on message/code fragments. Rewriting an
  // outage as "<context>: Unknown error occurred" matched none of them, so public
  // pages rendered an error instead of fallback content.
  const outage = (payload: unknown, context: string) =>
    withErrorHandling(() => Promise.reject(payload), context).catch((e) => e as Error);

  it.each([
    ['fetch failed', 'TypeError: fetch failed', ''],
    ['egress quota', 'egress quota exceeded for project', ''],
    ['bandwidth', 'bandwidth limit exceeded', ''],
    ['rate limit code', 'too many requests', 'over_request_rate_limit'],
  ])('still reads as an outage: %s', async (_label, message, code) => {
    const wrapped = await outage(realPostgrestPayload(message, code), 'Failed to fetch events');
    expect(isSupabaseUnavailable(wrapped)).toBe(true);
  });

  it('does not misreport an ordinary permission error as an outage', async () => {
    const wrapped = await outage(
      realPostgrestPayload('permission denied', '42501'),
      'Failed to fetch events'
    );
    expect(isSupabaseUnavailable(wrapped)).toBe(false);
  });
});

describe('withErrorHandling behaviour that must not regress', () => {
  const run = (thrown: unknown, context?: string) =>
    withErrorHandling(() => Promise.reject(thrown), context);

  it('rethrows ValidationError untouched, without adding context', async () => {
    await expect(run(new ValidationError('Consent is required.'), 'Failed to submit')).rejects.toThrow(
      'Consent is required.'
    );
  });

  it('rethrows an existing DatabaseError untouched', async () => {
    const original = new DatabaseError('already normalized', '42501');
    await expect(run(original, 'Failed to submit')).rejects.toBe(original);
  });

  it('preserves the message of a plain Error, such as a Storage failure', async () => {
    // StorageApiError extends Error but carries no code/details, so it takes the
    // generic branch.
    await expect(run(new Error('Object exceeds maximum size'), 'Failed to submit')).rejects.toThrow(
      'Failed to submit: Object exceeds maximum size'
    );
  });

  it('keeps the generic fallback for a genuinely unidentifiable throw', async () => {
    await expect(run('a bare string', 'Failed to submit')).rejects.toThrow(
      'Failed to submit: Unknown error occurred'
    );
  });

  it('resolves normally when the operation succeeds', async () => {
    await expect(withErrorHandling(() => Promise.resolve('ok'), 'ctx')).resolves.toBe('ok');
  });
});

describe('normalizeSupabaseError', () => {
  it('omits the prefix when no context is supplied', () => {
    expect(normalizeSupabaseError(realPostgrestPayload('boom', '42501')).message).toBe(
      'Insufficient permissions'
    );
  });

  it('falls back to the raw message for an unmapped code', () => {
    expect(normalizeSupabaseError(realPostgrestPayload('something specific', 'XX999')).message).toBe(
      'something specific'
    );
  });

  it('falls back to a generic message when there is nothing to report', () => {
    expect(normalizeSupabaseError(realPostgrestPayload('', '')).message).toBe(
      'Database error occurred'
    );
  });
});
