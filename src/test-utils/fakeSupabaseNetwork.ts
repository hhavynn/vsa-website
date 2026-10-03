/**
 * A scripted stand-in for the network under a REAL supabase-js client, for
 * tests that must exercise supabase-js's own session handling (token refresh,
 * SIGNED_OUT) rather than the recording query mock in `supabaseMock.ts`.
 * Nothing leaves the process: every request is answered here.
 */

export const FAKE_SUPABASE_URL = 'https://fake-project.supabase.co';

export const EXPIRED_JWT_BODY = { code: 'PGRST301', message: 'JWT expired', details: null, hint: null };

export interface FakeNetwork {
  fetch: typeof fetch;
  /** Requests received, as "METHOD /path" (query string dropped). */
  requests: string[];
  count: (matcher: string) => number;
}

export type FakeRoute = (request: { method: string; url: URL }) => Response | undefined;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const respondJson = json;

/** Routes are tried in order; an unmatched request is a test bug and returns 599. */
export function createFakeNetwork(routes: FakeRoute[]): FakeNetwork {
  const requests: string[] = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    requests.push(`${method} ${url.pathname}`);
    for (const route of routes) {
      const response = route({ method, url });
      if (response) return response;
    }
    return json(599, { message: `fakeSupabaseNetwork: unexpected ${method} ${url.pathname}` });
  }) as typeof fetch;

  return {
    fetch: fakeFetch,
    requests,
    count: (matcher) => requests.filter((request) => request.includes(matcher)).length,
  };
}

/** An in-memory `Storage` for supabase-js, optionally seeded with a stored session. */
export function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

export const SESSION_STORAGE_KEY = 'fake-auth-token';

/** A stored session whose access token the client believes is valid for an hour. */
export function storedSession(userId: string, email = `${userId}@example.test`) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    access_token: `access-${userId}`,
    refresh_token: `refresh-${userId}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSeconds + 3600,
    user: { id: userId, email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  });
}
