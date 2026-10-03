import { isAuthRetryableFetchError, SupabaseClient } from '@supabase/supabase-js';

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
 * - A request is rejected by the server for an expired JWT even though the
 *   client still believes its token is valid (clock skew, a token revoked
 *   server-side): supabase-js would not notice, so `createSessionExpiryFetch`
 *   forces one refresh and, if the refresh token is dead too, ends the local
 *   session so the SIGNED_OUT above fires.
 *
 * supabase-js already refreshes a token it knows has expired before sending any
 * request, for every caller alike (`auth.getSession()` inside its auth fetch),
 * so only that last case needs help. It is handled once, on the client's
 * single `fetch`, which carries the Data API, Storage and Edge Function calls
 * made through repositories, react-query and direct `supabase.from(...)` calls
 * in admin pages alike.
 */

/** Statuses a JWT rejection arrives with (PostgREST 401, Storage 400/403, Functions 401). */
const REJECTION_STATUSES = new Set([400, 401, 403]);

const EXPIRED_JWT_MESSAGE = /jwt expired|invalid jwt|\bexp\b claim|token is expired/i;

/**
 * Whether a failed response says the bearer token itself is no good. PostgREST
 * uses code PGRST301; Storage and Edge Functions use a message. PGRST302
 * (anonymous access disabled) is deliberately excluded: no token was sent, so
 * refreshing would change nothing.
 */
export function looksLikeExpiredJwt(status: number, body: unknown): boolean {
  if (!REJECTION_STATUSES.has(status) || typeof body !== 'object' || body === null) return false;
  const { code, message, error } = body as { code?: unknown; message?: unknown; error?: unknown };
  if (code === 'PGRST301') return true;
  return (
    (typeof message === 'string' && EXPIRED_JWT_MESSAGE.test(message)) ||
    (typeof error === 'string' && /^invalidjwt$/i.test(error))
  );
}

/** PostgREST error codes for a rejected JWT, for callers holding a thrown error. */
export function isSessionExpiredError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === 'PGRST301';
}

export interface SessionExpiryFetchOptions {
  /** The transport to wrap (the request guard's fetch). */
  fetch: typeof fetch;
  /**
   * Forces a token refresh, and ends the local session if the refresh token
   * is rejected. Must resolve (never reject) however it goes.
   */
  refresh: () => Promise<void>;
  /** Minimum gap between refresh attempts, however many requests fail. */
  cooldownMs?: number;
  now?: () => number;
}

export const SESSION_REFRESH_COOLDOWN_MS = 30_000;

/**
 * Wraps `fetch` so that a response saying the JWT is expired triggers one
 * shared, rate-limited refresh. Responses are returned untouched (the body is
 * read from a clone), requests are never retried, and `/auth/v1` traffic is
 * never inspected, so the refresh cannot trigger itself.
 */
export function createSessionExpiryFetch(options: SessionExpiryFetchOptions): typeof fetch {
  const cooldownMs = options.cooldownMs ?? SESSION_REFRESH_COOLDOWN_MS;
  const now = options.now ?? Date.now;
  let inFlight: Promise<void> | null = null;
  let lastAttempt = Number.NEGATIVE_INFINITY;

  function revalidate(): void {
    if (inFlight || now() - lastAttempt < cooldownMs) return;
    lastAttempt = now();
    inFlight = options
      .refresh()
      .catch(() => undefined)
      .then(() => {
        inFlight = null;
      });
  }

  async function inspect(url: string, response: Response): Promise<void> {
    if (response.ok || !REJECTION_STATUSES.has(response.status) || url.indexOf('/auth/v1') !== -1) return;
    try {
      if (looksLikeExpiredJwt(response.status, await response.clone().json())) revalidate();
    } catch {
      // Not JSON, or the body was unreadable: not a JWT rejection we can identify.
    }
  }

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await options.fetch(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // Not awaited: the caller gets its response immediately; inspection and the
    // refresh it may start happen alongside.
    void inspect(url, response);
    return response;
  }) as typeof fetch;
}

/**
 * The `refresh` for `createSessionExpiryFetch`: the server has just rejected
 * this client's token. Force a refresh; if the refresh token is rejected too,
 * end the local session. (supabase-js keeps a session whose access token still
 * looks valid locally even when its refresh is rejected, so without this the
 * app would keep sending a token the server refuses, with no SIGNED_OUT and no
 * prompt.) A network failure is not a verdict and changes nothing, and with no
 * session at all (an anonymous visitor) there is nothing to do.
 */
export async function refreshOrEndSession(client: Pick<SupabaseClient, 'auth'>): Promise<void> {
  const { data } = await client.auth.getSession();
  if (!data.session) return;
  const { error } = await client.auth.refreshSession();
  if (error && !isAuthRetryableFetchError(error)) {
    await client.auth.signOut({ scope: 'local' });
  }
}
