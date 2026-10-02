// Per-tab circuit breaker for Supabase Data API (PostgREST) requests.
//
// Why this exists: on 2026-10-01 a frontend loop sent ~493,000 API-gateway
// requests in ~5 hours (peaking at ~41 requests/second). Normal use of this
// site, including heavy admin work, is a few requests per second at most, so a
// single tab should be physically unable to produce that volume. This wrapper
// sits around the Supabase client's `fetch`, counts Data API requests in
// memory, and fails fast locally once a tab exceeds the limits below.
//
// Scope: only `/rest/v1/*`. Auth, Storage and Edge Function calls pass through
// untouched (and are never counted), so a tripped breaker cannot lock anyone
// out of sign-in or uploads.
//
// Nothing here retries, sends data anywhere, persists anything, or reads
// request headers or bodies (so tokens/keys cannot leak into logs).

/** Every threshold lives here so they can be tuned in one place. */
export const REQUEST_GUARD_CONFIG = {
  /** Burst protection: more than `burstMaxRequests` Data API requests (any method) inside this window trips the breaker. */
  burstWindowMs: 60_000,
  /**
   * 200 is ~3.3 req/s sustained for a full minute. Real usage stays far below it
   * (an Admin Overview load is ~40 requests), but the attendance import writes one
   * profile update per matched member in a loop, so the limit has to clear that.
   * The incident ran at ~41 req/s, i.e. it would trip in about five seconds.
   */
  burstMaxRequests: 200,
  /** Repeat protection: the exact same GET/HEAD URL more than `repeatMaxRequests` times inside this window trips the breaker. */
  repeatWindowMs: 10_000,
  repeatMaxRequests: 10,
  /** How long Data API requests stay blocked after the first trip. */
  cooldownMs: 30_000,
  /** Tripping again soon after recovering doubles the cooldown, up to this cap. */
  maxCooldownMs: 5 * 60_000,
  /** A trip within this long after a cooldown ends counts as a repeat offence. */
  escalationWindowMs: 2 * 60_000,
} as const;

export type RequestGuardConfig = { -readonly [K in keyof typeof REQUEST_GUARD_CONFIG]: number };

export type TripReason = 'burst' | 'repeat';

export interface TripInfo {
  reason: TripReason;
  cooldownMs: number;
  /** Path only (no query string), e.g. `/rest/v1/events`. */
  path: string;
}

export interface GuardedRequest {
  url: string;
  method: string;
}

export interface RequestGuardOptions {
  config?: Partial<RequestGuardConfig>;
  /** Defaults to the global `fetch`, resolved at call time. */
  fetch?: typeof fetch;
  now?: () => number;
  /** Receives the single warning emitted per trip. Defaults to `console.warn`. */
  warn?: (message: string) => void;
  /** Called for every request the wrapper sees, whatever service it targets. */
  onRequest?: (request: GuardedRequest) => void;
  /** Called once per trip, after the warning. */
  onTrip?: (info: TripInfo) => void;
}

export interface RequestGuardState {
  blocked: boolean;
  blockedUntil: number;
  trips: number;
  blockedRequests: number;
  lastReason: TripReason | null;
}

export interface RequestGuard {
  fetch: typeof fetch;
  getState: () => RequestGuardState;
}

const DATA_API_PREFIX = '/rest/v1';
const MAX_TRACKED_URLS = 200;

function describe(input: RequestInfo | URL, init?: RequestInit): GuardedRequest {
  let url: string;
  let inputMethod: string | undefined;
  if (typeof input === 'string') {
    url = input;
  } else if (typeof URL !== 'undefined' && input instanceof URL) {
    url = input.href;
  } else {
    url = (input as Request).url;
    inputMethod = (input as Request).method;
  }
  return { url, method: (init?.method ?? inputMethod ?? 'GET').toUpperCase() };
}

function parse(url: string): { path: string; key: string } | null {
  try {
    const parsed = new URL(url);
    const isDataApi = parsed.pathname === DATA_API_PREFIX || parsed.pathname.indexOf(`${DATA_API_PREFIX}/`) === 0;
    return isDataApi ? { path: parsed.pathname, key: `${parsed.pathname}${parsed.search}` } : null;
  } catch {
    return null;
  }
}

function blockedResponse(retryAfterMs: number): Response {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  // `over_request_rate_limit` is Supabase's own rate-limit code, so
  // `isSupabaseUnavailable()` treats this like any other throttled response and
  // public pages fall back to their static content.
  const body = {
    code: 'over_request_rate_limit',
    message: `Too many Supabase Data API requests from this tab. Requests are paused for about ${seconds}s.`,
    details: null,
    hint: null,
  };
  return new Response(JSON.stringify(body), {
    status: 429,
    statusText: 'Too Many Requests',
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(seconds) },
  });
}

export function createRequestGuard(options: RequestGuardOptions = {}): RequestGuard {
  const config: RequestGuardConfig = { ...REQUEST_GUARD_CONFIG, ...options.config };
  const now = options.now ?? Date.now;
  const warn = options.warn ?? ((message: string) => console.warn(message));

  let recent: number[] = [];
  const repeats = new Map<string, number[]>();
  let blockedUntil = 0;
  let lastCooldownMs = 0;
  let lastTripAt = 0;
  let consecutiveTrips = 0;
  let trips = 0;
  let blockedRequests = 0;
  let lastReason: TripReason | null = null;

  function trim(timestamps: number[], windowMs: number, at: number) {
    while (timestamps.length > 0 && timestamps[0] <= at - windowMs) timestamps.shift();
  }

  function sweepRepeats(at: number) {
    repeats.forEach((timestamps, key) => {
      trim(timestamps, config.repeatWindowMs, at);
      if (timestamps.length === 0) repeats.delete(key);
    });
  }

  function trip(reason: TripReason, path: string, at: number) {
    const stillEscalating = consecutiveTrips > 0 && at - (lastTripAt + lastCooldownMs) < config.escalationWindowMs;
    consecutiveTrips = stillEscalating ? consecutiveTrips + 1 : 1;
    const cooldownMs = Math.min(config.cooldownMs * Math.pow(2, consecutiveTrips - 1), config.maxCooldownMs);

    blockedUntil = at + cooldownMs;
    lastCooldownMs = cooldownMs;
    lastTripAt = at;
    lastReason = reason;
    trips += 1;
    recent = [];
    repeats.clear();

    const why =
      reason === 'burst'
        ? `more than ${config.burstMaxRequests} requests in ${config.burstWindowMs / 1000}s`
        : `the same read repeated more than ${config.repeatMaxRequests} times in ${config.repeatWindowMs / 1000}s`;
    // One warning per trip, and a trip cannot happen again until the cooldown ends.
    // Only the path is logged: never headers, tokens, or query-string filters.
    warn(
      `[supabase-guard] Paused Supabase Data API requests for ${Math.round(cooldownMs / 1000)}s (${why}; latest ${path}). ` +
        'This usually means a render or refetch loop. Auth, Storage and Edge Functions are unaffected.',
    );
    options.onTrip?.({ reason, cooldownMs, path });
  }

  async function guardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = describe(input, init);
    options.onRequest?.(request);
    const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

    const target = parse(request.url);
    if (!target) return send(input, init);

    const at = now();
    if (at < blockedUntil) {
      blockedRequests += 1;
      return blockedResponse(blockedUntil - at);
    }
    if (blockedUntil !== 0) blockedUntil = 0; // cooldown over: start from a clean slate

    trim(recent, config.burstWindowMs, at);
    recent.push(at);
    if (recent.length > config.burstMaxRequests) {
      trip('burst', target.path, at);
      blockedRequests += 1;
      return blockedResponse(blockedUntil - at);
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const repeatKey = `${request.method} ${target.key}`;
      const seen = repeats.get(repeatKey) ?? [];
      trim(seen, config.repeatWindowMs, at);
      seen.push(at);
      repeats.set(repeatKey, seen);
      if (repeats.size > MAX_TRACKED_URLS) sweepRepeats(at);
      if (seen.length > config.repeatMaxRequests) {
        trip('repeat', target.path, at);
        blockedRequests += 1;
        return blockedResponse(blockedUntil - at);
      }
    }

    return send(input, init);
  }

  return {
    fetch: guardedFetch as typeof fetch,
    getState: () => ({ blocked: now() < blockedUntil, blockedUntil, trips, blockedRequests, lastReason }),
  };
}
