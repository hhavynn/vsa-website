import { supabase } from './supabase';

/**
 * Session lifecycle, as the app defines it (see docs/auth-model.md):
 *
 * - Refresh succeeds (idle expiry, tab refocus, hourly rotation): supabase-js
 *   swaps the token and emits TOKEN_REFRESHED / SIGNED_IN. Nothing visible
 *   changes and no state is reset.
 * - Refresh is rejected (refresh token expired or revoked, signed out in
 *   another tab): supabase-js emits SIGNED_OUT. AuthContext records that the
 *   session ended unprompted, and the admin shell asks the user to sign in
 *   again in place instead of redirecting away from unsaved work.
 * - Refresh fails for network reasons: supabase-js keeps the session and
 *   retries, so nothing is reset; requests fail with ordinary network errors.
 * - A request is rejected mid-flight with an expired JWT (the access token
 *   lapsed between supabase-js's checks): the request fails with PGRST301, and
 *   the app forces one refresh so a dead session surfaces as SIGNED_OUT.
 */

/** PostgREST codes for a JWT that has expired or is no longer valid. */
const SESSION_ERROR_CODES = new Set(['PGRST301', 'PGRST302']);

/**
 * Structural on purpose: a repository wraps the failure as a DatabaseError, but
 * pages that still call Supabase directly surface PostgREST's plain
 * `{ message, code }` object.
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' && SESSION_ERROR_CODES.has(code);
}

let inFlight: Promise<void> | null = null;

/**
 * Forces a token refresh after a request reported an expired JWT. A live
 * refresh token yields TOKEN_REFRESHED (the user retries the action); a dead
 * one yields SIGNED_OUT, which opens the re-authentication prompt. Concurrent
 * failures share one refresh, and errors are swallowed because the auth
 * listener is the single place that reacts to the outcome.
 */
export function revalidateSession(): Promise<void> {
  if (!inFlight) {
    inFlight = supabase.auth
      .refreshSession()
      .then(() => undefined)
      .catch(() => undefined)
      .then(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function handleRequestError(error: unknown): void {
  if (isSessionExpiredError(error)) {
    void revalidateSession();
  }
}
