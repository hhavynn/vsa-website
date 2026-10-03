/**
 * Mid-request expiry (#232): a server-side "JWT expired" on ANY request, through
 * a repository, react-query or a direct `supabase.from(...)` call in an admin
 * page, forces one shared refresh, and a dead refresh token ends the local
 * session so the re-authentication prompt appears.
 *
 * The client under test is a real supabase-js client talking to a scripted
 * network (src/test-utils/fakeSupabaseNetwork.ts), so supabase-js's own session
 * behaviour (including keeping a session whose access token still looks valid
 * after a rejected refresh) is part of what is proven.
 */

import { AuthRetryableFetchError, createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createSessionExpiryFetch,
  isSessionExpiredError,
  looksLikeExpiredJwt,
  refreshOrEndSession,
  SESSION_REFRESH_COOLDOWN_MS,
} from './sessionExpiry';
import { DatabaseError, toUserMessage } from '../data/errors';
import {
  createFakeNetwork,
  EXPIRED_JWT_BODY,
  FAKE_SUPABASE_URL,
  memoryStorage,
  respondJson,
  SESSION_STORAGE_KEY,
  storedSession,
} from '../test-utils/fakeSupabaseNetwork';

// The real client, not setupTests' stub. Hoisted above the imports by babel-plugin-jest-hoist.
jest.unmock('@supabase/supabase-js');

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('looksLikeExpiredJwt', () => {
  it.each([
    ['PostgREST', 401, EXPIRED_JWT_BODY],
    ['PostgREST by code alone', 401, { code: 'PGRST301' }],
    ['Edge Functions', 401, { code: 401, message: 'Invalid JWT' }],
    ['Storage', 400, { statusCode: '400', error: 'InvalidJWT', message: 'jwt expired' }],
    ['Storage by error name', 403, { error: 'InvalidJWT', message: 'rejected' }],
  ])('recognises a %s rejection', (_label, status, body) => {
    expect(looksLikeExpiredJwt(status, body)).toBe(true);
  });

  it.each([
    ['an RLS denial', 403, { code: '42501', message: 'permission denied for table events' }],
    ['a missing row', 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }],
    ['anonymous access disabled (no token was sent)', 401, { code: 'PGRST302', message: 'Anonymous access is disabled' }],
    ['a JWT message on a success status', 200, { message: 'jwt expired' }],
    ['a rate limit', 429, { code: 'over_request_rate_limit' }],
    ['a null body', 401, null],
    ['a string body', 401, 'jwt expired'],
  ])('does not mistake %s for an expired session', (_label, status, body) => {
    expect(looksLikeExpiredJwt(status, body)).toBe(false);
  });
});

describe('isSessionExpiredError / toUserMessage', () => {
  it('recognises PGRST301 on a repository error or a raw PostgREST error', () => {
    expect(isSessionExpiredError(new DatabaseError('JWT expired', 'PGRST301'))).toBe(true);
    expect(isSessionExpiredError(EXPIRED_JWT_BODY)).toBe(true);
    expect(isSessionExpiredError(new DatabaseError('x', '42501'))).toBe(false);
    expect(isSessionExpiredError(null)).toBe(false);
  });

  it.each(['PGRST301', 'PGRST302'])('turns %s into a retry-or-sign-in message', (code) => {
    expect(toUserMessage(new DatabaseError('JWT expired', code), 'Failed to save')).toBe(
      'Your session expired. Try again, and sign in again if it keeps failing.'
    );
  });

  it('leaves other database errors on their existing messages', () => {
    expect(toUserMessage(new DatabaseError('x', '42501'), 'Failed to save')).toBe("You don't have permission to do that.");
    expect(toUserMessage(new DatabaseError('x', 'XX000'), 'Failed to save')).toBe('Failed to save');
  });
});

describe('createSessionExpiryFetch', () => {
  function setup(status: number, body: unknown, overrides: { cooldownMs?: number } = {}) {
    let clock = 1_000_000;
    const refresh = jest.fn(async () => undefined);
    const wrapped = createSessionExpiryFetch({
      fetch: (async () => respondJson(status, body)) as typeof fetch,
      refresh,
      now: () => clock,
      ...overrides,
    });
    return { wrapped, refresh, advance: (ms: number) => (clock += ms) };
  }

  it('refreshes once for an expired-JWT response, and hands the response back untouched', async () => {
    const { wrapped, refresh } = setup(401, EXPIRED_JWT_BODY);

    const response = await wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`);
    await settle();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(EXPIRED_JWT_BODY);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never refreshes for ordinary failures or successes', async () => {
    const denied = setup(403, { code: '42501', message: 'permission denied' });
    await denied.wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`);
    const ok = setup(200, []);
    await ok.wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`);
    await settle();

    expect(denied.refresh).not.toHaveBeenCalled();
    expect(ok.refresh).not.toHaveBeenCalled();
  });

  it('never inspects Auth traffic, so a refresh cannot trigger itself', async () => {
    const { wrapped, refresh } = setup(400, { code: 'PGRST301', message: 'jwt expired' });

    await wrapped(`${FAKE_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`);
    await settle();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('shares one refresh between failures that land together', async () => {
    const { wrapped, refresh } = setup(401, EXPIRED_JWT_BODY);

    await Promise.all([1, 2, 3].map(() => wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`)));
    await settle();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('waits out the cooldown before refreshing again, however often requests fail', async () => {
    const { wrapped, refresh, advance } = setup(401, EXPIRED_JWT_BODY);
    await wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`);
    await settle();

    advance(SESSION_REFRESH_COOLDOWN_MS - 1);
    await wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`);
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);

    advance(1);
    await wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`);
    await settle();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('survives a refresh that rejects, and a body that is not JSON', async () => {
    const wrapped = createSessionExpiryFetch({
      fetch: (async () => new Response('<html>bad gateway</html>', { status: 401 })) as typeof fetch,
      refresh: () => Promise.reject(new Error('boom')),
    });
    await expect(wrapped(`${FAKE_SUPABASE_URL}/rest/v1/events`)).resolves.toBeInstanceOf(Response);

    const rejecting = createSessionExpiryFetch({
      fetch: (async () => respondJson(401, EXPIRED_JWT_BODY)) as typeof fetch,
      refresh: () => Promise.reject(new Error('boom')),
    });
    await expect(rejecting(`${FAKE_SUPABASE_URL}/rest/v1/events`)).resolves.toBeInstanceOf(Response);
    await settle();
  });
});

describe('refreshOrEndSession', () => {
  const clientWith = (overrides: {
    session?: unknown;
    refreshError?: unknown;
  }) => {
    const signOut = jest.fn(async () => ({ error: null }));
    const refreshSession = jest.fn(async () => ({ data: {}, error: overrides.refreshError ?? null }));
    const client = {
      auth: { getSession: async () => ({ data: { session: overrides.session ?? null } }), refreshSession, signOut },
    } as unknown as Parameters<typeof refreshOrEndSession>[0];
    return { client, signOut, refreshSession };
  };

  it('does nothing without a session (an anonymous visitor)', async () => {
    const { client, signOut, refreshSession } = clientWith({});

    await refreshOrEndSession(client);

    expect(refreshSession).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('keeps the session when the refresh works', async () => {
    const { client, signOut, refreshSession } = clientWith({ session: {} });

    await refreshOrEndSession(client);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('keeps the session when the refresh failed for network reasons', async () => {
    const { client, signOut } = clientWith({ session: {}, refreshError: new AuthRetryableFetchError('offline', 0) });

    await refreshOrEndSession(client);

    expect(signOut).not.toHaveBeenCalled();
  });

  it('ends the local session when the refresh token is rejected', async () => {
    const { client, signOut } = clientWith({ session: {}, refreshError: new Error('Invalid Refresh Token') });

    await refreshOrEndSession(client);

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('a direct supabase.from(...) call with an expired JWT, through a real client', () => {
  const REFRESH_REJECTED = {
    error: 'invalid_grant',
    error_description: 'Invalid Refresh Token: Refresh Token Not Found',
  };

  function setup(refreshRoute: () => Response) {
    const network = createFakeNetwork([
      ({ url }) => (url.pathname.startsWith('/rest/v1/') ? respondJson(401, EXPIRED_JWT_BODY) : undefined),
      ({ url }) => (url.pathname === '/auth/v1/token' ? refreshRoute() : undefined),
      ({ url }) => (url.pathname === '/auth/v1/logout' ? new Response(null, { status: 204 }) : undefined),
    ]);
    const client: SupabaseClient = createClient(FAKE_SUPABASE_URL, 'anon-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        storage: memoryStorage({ [SESSION_STORAGE_KEY]: storedSession('admin-1') }),
        storageKey: SESSION_STORAGE_KEY,
      },
      db: { retry: false },
      global: {
        fetch: createSessionExpiryFetch({
          fetch: network.fetch,
          refresh: () => refreshOrEndSession(client),
        }),
      },
    });
    const events: string[] = [];
    client.auth.onAuthStateChange((event) => {
      events.push(event);
    });
    return { client, network, events };
  }

  it('raises SIGNED_OUT once when the refresh token is dead, however many direct calls fail', async () => {
    const { client, network, events } = setup(() => respondJson(400, REFRESH_REJECTED));
    expect((await client.auth.getSession()).data.session?.user.id).toBe('admin-1');
    events.length = 0;

    // Three direct admin writes, none through react-query or a repository.
    const results = await Promise.all([
      client.from('events').update({ name: 'a' }).eq('id', 1),
      client.from('events').delete().eq('id', 2),
      client.from('houses').update({ name: 'b' }).eq('id', 3),
    ]);
    await settle();
    await settle();

    // Callers still see the server's own error, unchanged.
    results.forEach((result) => expect(result.error?.code).toBe('PGRST301'));
    expect(network.count('POST /auth/v1/token')).toBe(1);
    expect(events).toEqual(['SIGNED_OUT']);
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  it('does not sign out, and does not loop, when the refresh succeeds', async () => {
    const { client, network, events } = setup(() =>
      respondJson(200, {
        ...JSON.parse(storedSession('admin-1')),
        access_token: 'access-renewed',
        refresh_token: 'refresh-renewed',
      })
    );
    await client.auth.getSession();
    events.length = 0;

    await client.from('events').update({ name: 'a' }).eq('id', 1);
    await settle();
    await settle();

    expect(events).toEqual(['TOKEN_REFRESHED']);
    expect(network.count('POST /auth/v1/token')).toBe(1);
    expect((await client.auth.getSession()).data.session?.access_token).toBe('access-renewed');
    // A later failure inside the cooldown does not start another refresh.
    await client.from('events').update({ name: 'again' }).eq('id', 1);
    await settle();
    expect(network.count('POST /auth/v1/token')).toBe(1);
  });
});
