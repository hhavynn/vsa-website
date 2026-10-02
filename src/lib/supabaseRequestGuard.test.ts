import { REQUEST_GUARD_CONFIG, createRequestGuard, RequestGuardOptions } from './supabaseRequestGuard';
import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';

const BASE = 'https://test.supabase.co';
const rest = (path: string) => `${BASE}/rest/v1/${path}`;

// `resetMocks: true` strips jest.fn() implementations before every test, so the
// harness is built fresh per test rather than shared.
function setup(overrides: Partial<RequestGuardOptions> = {}) {
  let clock = 1_000_000;
  const calls: Array<{ input: unknown; init?: RequestInit }> = [];
  const warnings: string[] = [];
  const guard = createRequestGuard({
    now: () => clock,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response('[]', { status: 200 });
    }) as typeof fetch,
    warn: (message) => warnings.push(message),
    ...overrides,
  });
  return {
    guard,
    calls,
    warnings,
    advance: (ms: number) => {
      clock += ms;
    },
    get: (url: string) => guard.fetch(url),
    head: (url: string) => guard.fetch(url, { method: 'HEAD' }),
    post: (url: string) => guard.fetch(url, { method: 'POST', body: '{}' }),
    patch: (url: string) => guard.fetch(url, { method: 'PATCH', body: '{}' }),
  };
}

const { burstMaxRequests, repeatMaxRequests, cooldownMs, maxCooldownMs, burstWindowMs, repeatWindowMs } = REQUEST_GUARD_CONFIG;

describe('supabase request guard', () => {
  describe('normal traffic', () => {
    it('passes requests through untouched and returns the real response', async () => {
      const t = setup();
      const init = { headers: { Authorization: 'Bearer abc' } };
      const response = await t.guard.fetch(rest('events?select=*'), init);

      expect(response.status).toBe(200);
      expect(t.calls).toHaveLength(1);
      expect(t.calls[0]).toEqual({ input: rest('events?select=*'), init });
      expect(t.guard.getState().blocked).toBe(false);
    });

    it('allows a heavy parallel admin burst of distinct requests', async () => {
      const t = setup();
      // Admin Overview + Operations dashboard + activity feed, all at once, then a second page load.
      const tables = ['members', 'events', 'cabinet_members', 'gallery_events', 'academic_terms', 'feedback', 'vcn_archives'];
      const batch = async (round: number) =>
        Promise.all([
          ...tables.map((table) => t.head(rest(`${table}?select=*&round=${round}`))),
          ...tables.map((table) => t.get(rest(`${table}?select=id,name&round=${round}`))),
          ...Array.from({ length: 20 }, (_, i) => t.get(rest(`ace_family_members?family_id=eq.${round}-${i}`))),
        ]);

      const responses = [...(await batch(1)), ...(await batch(2)), ...(await batch(3))];

      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(t.calls).toHaveLength(responses.length);
      expect(t.guard.getState().trips).toBe(0);
      expect(t.warnings).toEqual([]);
    });

    it('allows an import-sized run of sequential profile updates', async () => {
      const t = setup();
      for (let i = 0; i < 150; i += 1) {
        t.advance(100);
        const response = await t.patch(rest(`members?id=eq.${i}`));
        expect(response.status).toBe(200);
      }
      expect(t.guard.getState().trips).toBe(0);
    });

    it('does not trip when requests spread out beyond the burst window', async () => {
      const t = setup();
      // 2 requests/second for ~3 minutes: 120 per window, well under the limit.
      for (let i = 0; i < 360; i += 1) {
        t.advance(500);
        expect((await t.get(rest(`events?page=${i}`))).status).toBe(200);
      }
      expect(t.guard.getState().trips).toBe(0);
    });

    it('does not count or block Auth, Storage and Edge Function requests', async () => {
      const t = setup();
      const others = [`${BASE}/auth/v1/token?grant_type=refresh_token`, `${BASE}/storage/v1/object/avatars/a.png`, `${BASE}/functions/v1/vsa-ai-assistant`];
      for (let i = 0; i < burstMaxRequests * 2; i += 1) {
        await t.get(others[i % others.length]);
      }
      expect(t.calls).toHaveLength(burstMaxRequests * 2);
      expect(t.guard.getState().trips).toBe(0);

      // And a tripped Data API breaker leaves them working.
      for (let i = 0; i <= repeatMaxRequests; i += 1) await t.get(rest('events'));
      expect(t.guard.getState().blocked).toBe(true);
      expect((await t.get(`${BASE}/auth/v1/user`)).status).toBe(200);
      expect((await t.get(`${BASE}/functions/v1/vsa-ai-assistant`)).status).toBe(200);
    });

    it('accepts Request and URL inputs', async () => {
      const t = setup();
      await t.guard.fetch(new URL(rest('events')));
      await t.guard.fetch(new Request(rest('events'), { method: 'HEAD' }));
      expect(t.calls).toHaveLength(2);
    });
  });

  describe('repeated identical reads', () => {
    it('trips on a runaway repeated GET and blocks it locally', async () => {
      const t = setup();
      for (let i = 0; i < repeatMaxRequests; i += 1) {
        expect((await t.get(rest('events?select=*'))).status).toBe(200);
      }
      const blocked = await t.get(rest('events?select=*'));

      expect(blocked.status).toBe(429);
      expect(t.calls).toHaveLength(repeatMaxRequests);
      expect(t.guard.getState()).toMatchObject({ blocked: true, trips: 1, lastReason: 'repeat' });
    });

    it('trips on a runaway repeated HEAD', async () => {
      const t = setup();
      for (let i = 0; i < repeatMaxRequests; i += 1) {
        expect((await t.head(rest('members?select=*'))).status).toBe(200);
      }
      expect((await t.head(rest('members?select=*'))).status).toBe(429);
      expect(t.guard.getState().lastReason).toBe('repeat');
    });

    it('counts different URLs separately', async () => {
      const t = setup();
      // Each URL stays at the limit; none exceeds it, so nothing trips.
      for (let i = 0; i < repeatMaxRequests; i += 1) {
        await t.get(rest('events?select=*'));
        await t.get(rest('events?select=id'));
        await t.get(rest('cabinet_members?select=*'));
        await t.head(rest('events?select=*')); // HEAD and GET of one URL are separate keys
      }
      expect(t.guard.getState().trips).toBe(0);
      expect(t.calls).toHaveLength(repeatMaxRequests * 4);

      // Only the URL that goes over trips it.
      expect((await t.get(rest('events?select=id'))).status).toBe(429);
    });

    it('forgets repeats once the repeat window passes', async () => {
      const t = setup();
      for (let i = 0; i < repeatMaxRequests; i += 1) await t.get(rest('events'));
      t.advance(repeatWindowMs + 1);
      for (let i = 0; i < repeatMaxRequests; i += 1) {
        expect((await t.get(rest('events'))).status).toBe(200);
      }
      expect(t.guard.getState().trips).toBe(0);
    });

    it('does not apply identical-read logic to writes', async () => {
      const t = setup();
      for (let i = 0; i < repeatMaxRequests * 3; i += 1) {
        expect((await t.post(rest('event_interest'))).status).toBe(200);
        expect((await t.patch(rest('members?id=eq.1'))).status).toBe(200);
      }
      expect(t.guard.getState().trips).toBe(0);
      expect(t.calls).toHaveLength(repeatMaxRequests * 6);
    });
  });

  describe('burst protection', () => {
    it('trips when a tab exceeds the burst limit with distinct URLs', async () => {
      const t = setup();
      for (let i = 0; i < burstMaxRequests; i += 1) {
        expect((await t.get(rest(`events?offset=${i}`))).status).toBe(200);
      }
      expect((await t.get(rest(`events?offset=${burstMaxRequests}`))).status).toBe(429);
      expect(t.guard.getState()).toMatchObject({ blocked: true, trips: 1, lastReason: 'burst' });
    });

    it('counts writes toward the burst limit', async () => {
      const t = setup();
      for (let i = 0; i < burstMaxRequests; i += 1) await t.post(rest(`event_interest?n=${i}`));
      expect((await t.post(rest('event_interest'))).status).toBe(429);
      expect(t.guard.getState().lastReason).toBe('burst');
    });

    it('stops an incident-rate loop within a few seconds', async () => {
      const t = setup();
      let sent = 0;
      // ~41 requests/second, as observed on 2026-10-01, for ten minutes.
      for (let ms = 0; ms < 10 * 60_000; ms += 24) {
        t.advance(24);
        const response = await t.get(rest(`leaderboard?cache_bust=${ms}`));
        if (response.status === 200) sent += 1;
      }
      // Ten minutes unguarded would be ~25,000 requests.
      expect(sent).toBeLessThan(1_500);
    });
  });

  describe('cooldown', () => {
    async function trip(t: ReturnType<typeof setup>) {
      for (let i = 0; i <= repeatMaxRequests; i += 1) await t.get(rest('events'));
    }

    it('blocks for the cooldown, then recovers automatically', async () => {
      const t = setup();
      await trip(t);
      expect(t.guard.getState().blocked).toBe(true);

      t.advance(cooldownMs - 1);
      expect((await t.get(rest('events'))).status).toBe(429);

      t.advance(1);
      expect(t.guard.getState().blocked).toBe(false);
      expect((await t.get(rest('events'))).status).toBe(200);
      // The recovered tab starts clean rather than inheriting the old counts.
      expect(t.guard.getState().trips).toBe(1);
    });

    it('doubles the cooldown when it trips again right after recovering, up to the cap', async () => {
      const t = setup();
      let expected: number = cooldownMs;
      for (let round = 0; round < 8; round += 1) {
        await trip(t);
        expect(t.guard.getState().blocked).toBe(true);
        t.advance(expected - 1);
        expect(t.guard.getState().blocked).toBe(true);
        t.advance(1);
        expect(t.guard.getState().blocked).toBe(false);
        expected = Math.min(expected * 2, maxCooldownMs);
      }
      expect(expected).toBe(maxCooldownMs);
    });

    it('goes back to the base cooldown after a quiet period', async () => {
      const t = setup();
      await trip(t);
      t.advance(cooldownMs);
      await trip(t); // second trip straight away: escalated
      t.advance(cooldownMs * 2 + burstWindowMs * 10); // long quiet period
      await trip(t);
      t.advance(cooldownMs - 1);
      expect(t.guard.getState().blocked).toBe(true);
      t.advance(1);
      expect(t.guard.getState().blocked).toBe(false);
    });

    it('does not send blocked requests or retry them', async () => {
      const t = setup();
      await trip(t);
      const sentBefore = t.calls.length;

      const results = await Promise.all(Array.from({ length: 50 }, () => t.get(rest('events'))));

      expect(results.every((response) => response.status === 429)).toBe(true);
      expect(t.calls).toHaveLength(sentBefore);
      expect(t.guard.getState().blockedRequests).toBe(51);
    });

    it('returns a Supabase-style 429 that degraded mode recognises', async () => {
      const t = setup();
      await trip(t);
      const response = await t.get(rest('events'));
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
      expect(body.code).toBe('over_request_rate_limit');
      expect(isSupabaseUnavailable({ ...body })).toBe(true);
    });
  });

  describe('logging', () => {
    it('warns once per cooldown no matter how many requests are blocked', async () => {
      const onTrip = jest.fn();
      const t = setup({ onTrip });
      for (let i = 0; i <= repeatMaxRequests; i += 1) await t.get(rest('events'));
      for (let i = 0; i < 100; i += 1) await t.get(rest('events'));

      expect(t.warnings).toHaveLength(1);
      expect(onTrip).toHaveBeenCalledTimes(1);
      expect(onTrip).toHaveBeenCalledWith(expect.objectContaining({ reason: 'repeat', path: '/rest/v1/events' }));
    });

    it('never logs headers, tokens, bodies or query strings', async () => {
      const onTrip = jest.fn();
      const t = setup({ onTrip });
      const url = rest('members?email=eq.private.person@ucsd.edu&select=*');
      const init: RequestInit = {
        method: 'GET',
        headers: { Authorization: 'Bearer secret-jwt', apikey: 'secret-anon-key' },
      };
      const consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map((level) =>
        jest.spyOn(console, level as 'log').mockImplementation(() => undefined),
      );
      try {
        for (let i = 0; i <= repeatMaxRequests; i += 1) await t.guard.fetch(url, init);
        const logged = JSON.stringify([t.warnings, onTrip.mock.calls, consoleSpies.map((spy) => spy.mock.calls)]);

        expect(t.warnings).toHaveLength(1);
        for (const secret of ['secret-jwt', 'secret-anon-key', 'Bearer', 'private.person', 'ucsd.edu', 'select=*', 'apikey']) {
          expect(logged).not.toContain(secret);
        }
        expect(t.warnings[0]).toContain('/rest/v1/members');
      } finally {
        consoleSpies.forEach((spy) => spy.mockRestore());
      }
    });
  });

  it('reports every request to onRequest, including non-Data-API ones', async () => {
    const seen: string[] = [];
    const t = setup({ onRequest: ({ url, method }) => seen.push(`${method} ${new URL(url).pathname}`) });
    await t.get(rest('events'));
    await t.post(`${BASE}/auth/v1/token`);
    expect(seen).toEqual(['GET /rest/v1/events', 'POST /auth/v1/token']);
  });
});
