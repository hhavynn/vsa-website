import {
  CachedLinkCheck,
  DEFAULT_PLAN_OPTIONS,
  DEFAULT_RUN_OPTIONS,
  LINK_CHECK_TARGETS,
  RunDeps,
  collectLinkUsages,
  isConfirmedLinkFailure,
  isNeverCheckedHost,
  nextCheckState,
  normalizeUrl,
  planLinkChecks,
  planUrlCheck,
  runLinkChecks,
} from './contentLinkCheck';

const NOW = new Date('2026-10-04T12:00:00Z');
const STORAGE = 'https://abc.supabase.co/storage/v1/object/public/event_images/flyer.webp';

function deps(handler: (url: string, method: string) => { status: number; type?: string; location?: string } | Error, files: string[] = []) {
  const calls: Array<{ url: string; method: string; at: number }> = [];
  let clock = 0;
  const sleeps: number[] = [];
  const d: RunDeps = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, at: clock });
      const result = handler(url, init.method);
      if (result instanceof Error) throw result;
      return {
        status: result.status,
        headers: { get: (name: string) => (name === 'content-type' ? result.type ?? null : name === 'location' ? result.location ?? null : null) },
      };
    },
    localFileExists: (path) => files.includes(path),
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  };
  return { d, calls, sleeps };
}

describe('what gets checked', () => {
  it('never contacts social, Drive, Docs, Forms or Photos hosts', () => {
    ['https://www.instagram.com/vsaatucsd', 'https://drive.google.com/file/d/1/view', 'https://docs.google.com/document/d/1', 'https://photos.app.goo.gl/abc', 'https://forms.gle/xyz', 'https://m.facebook.com/x'].forEach((url) => {
      expect(planUrlCheck(url, 'link')).toEqual({ action: 'skip', reason: 'host-not-checked' });
    });
    expect(isNeverCheckedHost('notinstagram.com')).toBe(false);
  });

  it('verifies /images paths against the repo (no network) and ignores route paths on link fields', () => {
    expect(planUrlCheck('/images/events/a.webp?v=2', 'image')).toEqual({ action: 'file', path: '/images/events/a.webp' });
    expect(planUrlCheck('/events', 'link')).toEqual({ action: 'skip', reason: 'internal-route' });
    expect(planUrlCheck('mailto:a@b.co', 'link').action).toBe('skip');
  });

  it('checks Supabase Storage with HEAD only and skips non-public storage', () => {
    expect(planUrlCheck(STORAGE, 'image')).toEqual({ action: 'http', url: STORAGE, storage: true, noGet: true });
    expect(planUrlCheck('https://abc.supabase.co/storage/v1/object/sign/private/x.png?token=t', 'image').action).toBe('skip');
  });

  it('scans only public fields: no planning docs, notes, or rosters are in the target list', () => {
    const columns = LINK_CHECK_TARGETS.flatMap((target) => target.columns.map((c) => `${target.table}.${c.column}`));
    expect(columns).toEqual(expect.arrayContaining(['events.image_url', 'gallery_events.google_photos_url', 'program_content.primary_link_url']));
    expect(columns.join(' ')).not.toMatch(/source_doc|drive_folder|planning_doc|internal_notes|email|phone/);
    // Draft and archived content is excluded by the scan filters.
    expect(LINK_CHECK_TARGETS.find((t) => t.table === 'events')?.where).toEqual({ is_published: true });
    expect(LINK_CHECK_TARGETS.find((t) => t.table === 'resource_links')?.where).toEqual({ is_archived: false });
  });

  it('groups usages by URL with the public label and the admin page that fixes them', () => {
    const usages = collectLinkUsages({
      events: [
        { id: 'e1', name: 'Fall GBM', image_url: STORAGE },
        { id: 'e2', name: 'Mixer', image_url: STORAGE },
        { id: 'e3', name: 'No image', image_url: null },
      ],
      gallery_events: [{ id: 'g1', title: null, name: 'Album', cover_image_url: '/images/gallery/a.webp', google_photos_url: 'https://photos.app.goo.gl/x' }],
    });

    expect(usages.get(STORAGE)).toHaveLength(2);
    expect(usages.get(STORAGE)?.[0]).toMatchObject({ table: 'events', id: 'e1', label: 'Fall GBM', path: '/admin/events', kind: 'image' });
    expect(usages.get('/images/gallery/a.webp')?.[0].label).toBe('Album');
    // Photos hosts are never checked, so the album link is not even tracked.
    expect(usages.has('https://photos.app.goo.gl/x')).toBe(false);
  });
});

describe('how often', () => {
  const cached = (url: string, status: CachedLinkCheck['check_status'], checkedAt: string): [string, CachedLinkCheck] => [
    url,
    { url, check_status: status, checked_at: checkedAt, consecutive_failures: status === 'failed' ? 1 : 0, failing_since: null },
  ];

  it('contacts nothing that was checked inside its cache window, so a repeat run is free', () => {
    const map = new Map([
      cached('https://a.test/1', 'ok', '2026-10-01T00:00:00Z'),
      cached('https://a.test/2', 'skipped', '2026-09-20T00:00:00Z'),
      cached('https://a.test/3', 'failed', '2026-10-04T08:00:00Z'),
    ]);
    expect(planLinkChecks(['https://a.test/1', 'https://a.test/2', 'https://a.test/3'], map, NOW)).toEqual([]);
  });

  it('rechecks ok results after a week, failures after a day, and unknown URLs first', () => {
    const map = new Map([
      cached('https://a.test/old-ok', 'ok', '2026-09-20T00:00:00Z'),
      cached('https://a.test/failed', 'failed', '2026-10-03T00:00:00Z'),
    ]);
    expect(planLinkChecks(['https://a.test/old-ok', 'https://a.test/new', 'https://a.test/failed'], map, NOW)).toEqual([
      'https://a.test/new',
      'https://a.test/old-ok',
      'https://a.test/failed',
    ]);
  });

  it('caps one run so it can never hammer a host', () => {
    const urls = Array.from({ length: 500 }, (_, i) => `https://a.test/${i}`);
    expect(planLinkChecks(urls, new Map(), NOW)).toHaveLength(DEFAULT_PLAN_OPTIONS.maxPerRun);
  });
});

describe('running checks', () => {
  it('spaces requests to one third-party host and sends a self-identifying HEAD', async () => {
    const { d, calls, sleeps } = deps(() => ({ status: 200, type: 'image/png' }));
    const outcomes = await runLinkChecks(
      [
        { url: 'https://cdn.example.org/a.png', kind: 'image' },
        { url: 'https://cdn.example.org/b.png', kind: 'image' },
        { url: 'https://cdn.example.org/c.png', kind: 'image' },
      ],
      d,
    );

    expect(outcomes.map((o) => o.status)).toEqual(['ok', 'ok', 'ok']);
    expect(calls.every((call) => call.method === 'HEAD')).toBe(true);
    expect(calls.map((c) => c.at)).toEqual([0, DEFAULT_RUN_OPTIONS.externalDelayMs, DEFAULT_RUN_OPTIONS.externalDelayMs * 2]);
    expect(sleeps).toEqual([DEFAULT_RUN_OPTIONS.externalDelayMs, DEFAULT_RUN_OPTIONS.externalDelayMs]);
  });

  it('does not make a network call for local files or never-checked hosts', async () => {
    const { d, calls } = deps(() => ({ status: 200 }), ['/images/a.webp']);
    const outcomes = await runLinkChecks(
      [
        { url: '/images/a.webp', kind: 'image' },
        { url: '/images/missing.webp', kind: 'image' },
        { url: 'https://www.instagram.com/x', kind: 'link' },
      ],
      d,
    );
    expect(calls).toHaveLength(0);
    expect(outcomes.map((o) => [o.status, o.reason])).toEqual([
      ['ok', null],
      ['failed', 'missing_local_file'],
      ['skipped', 'host-not-checked'],
    ]);
  });

  it('never downloads a Storage original: HEAD only, even when HEAD is unsupported', async () => {
    const { d, calls } = deps(() => ({ status: 405 }));
    const [outcome] = await runLinkChecks([{ url: STORAGE, kind: 'image' }], d);
    expect(calls.map((c) => c.method)).toEqual(['HEAD']);
    expect(outcome).toMatchObject({ status: 'skipped', reason: 'head_unsupported' });
  });

  it('falls back to a one-byte ranged GET for third parties that refuse HEAD', async () => {
    const { d, calls } = deps((_, method) => (method === 'HEAD' ? { status: 405 } : { status: 206 }));
    const [outcome] = await runLinkChecks([{ url: 'https://example.org/page', kind: 'link' }], d);
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);
    expect(outcome.status).toBe('ok');
  });

  it('classifies responses without destroying anything: 404 fails, blocked is inconclusive, HTML for an image fails', async () => {
    const { d } = deps((url) => {
      if (url.endsWith('/gone')) return { status: 404 };
      if (url.endsWith('/blocked')) return { status: 403 };
      if (url.endsWith('/html')) return { status: 200, type: 'text/html; charset=utf-8' };
      return { status: 200, type: 'application/octet-stream' };
    });
    const outcomes = await runLinkChecks(
      [
        { url: 'https://a.test/gone', kind: 'link' },
        { url: 'https://b.test/blocked', kind: 'link' },
        { url: 'https://c.test/html', kind: 'image' },
        { url: 'https://d.test/bin', kind: 'image' },
      ],
      d,
    );
    expect(outcomes.map((o) => [o.status, o.reason])).toEqual([
      ['failed', 'http_404'],
      ['skipped', 'blocked'],
      ['failed', 'not_an_image'],
      ['ok', null],
    ]);
  });

  it('retries a transient failure once, and a failure on both tries is reported (as unconfirmed)', async () => {
    let attempts = 0;
    const { d, sleeps } = deps(() => {
      attempts += 1;
      return attempts === 1 ? new Error('socket hang up') : { status: 200 };
    });
    const [recovered] = await runLinkChecks([{ url: 'https://flaky.test/a', kind: 'link' }], d);
    expect(recovered.status).toBe('ok');
    expect(sleeps).toContain(DEFAULT_RUN_OPTIONS.retryDelayMs);

    const down = deps(() => ({ status: 503 }));
    const [still] = await runLinkChecks([{ url: 'https://down.test/a', kind: 'link' }], down.d);
    expect(still).toMatchObject({ status: 'failed', reason: 'http_5xx' });
    expect(down.calls).toHaveLength(2);
    expect(isConfirmedLinkFailure({ check_status: 'failed', failure_reason: still.reason, consecutive_failures: 1 })).toBe(false);
  });

  it('a failed external check is a recorded result, never an exception or a destructive action', async () => {
    const { d } = deps(() => new Error('getaddrinfo ENOTFOUND'));
    const outcomes = await runLinkChecks([{ url: 'https://gone.invalid/x', kind: 'link' }], d);
    expect(outcomes[0]).toMatchObject({ status: 'failed', reason: 'network_error' });
  });
});

describe('confirming a failure', () => {
  it('shows certain failures immediately and uncertain ones only after two runs', () => {
    expect(isConfirmedLinkFailure({ check_status: 'failed', failure_reason: 'http_404', consecutive_failures: 1 })).toBe(true);
    expect(isConfirmedLinkFailure({ check_status: 'failed', failure_reason: 'missing_local_file', consecutive_failures: 1 })).toBe(true);
    expect(isConfirmedLinkFailure({ check_status: 'failed', failure_reason: 'timeout', consecutive_failures: 1 })).toBe(false);
    expect(isConfirmedLinkFailure({ check_status: 'failed', failure_reason: 'timeout', consecutive_failures: 2 })).toBe(true);
    expect(isConfirmedLinkFailure({ check_status: 'ok', consecutive_failures: 9 })).toBe(false);
    expect(isConfirmedLinkFailure({ check_status: 'skipped', consecutive_failures: 9 })).toBe(false);
  });

  it('tracks when the current failure began, and starts over after it recovers', () => {
    const failed = { url: 'u', status: 'failed' as const, httpStatus: 404, reason: 'http_404' };
    const first = nextCheckState(undefined, failed, '2026-10-01T00:00:00Z');
    expect(first).toEqual({ consecutive_failures: 1, failing_since: '2026-10-01T00:00:00Z' });

    const previous: CachedLinkCheck = { url: 'u', check_status: 'failed', checked_at: '2026-10-01T00:00:00Z', ...first };
    expect(nextCheckState(previous, failed, '2026-10-08T00:00:00Z')).toEqual({ consecutive_failures: 2, failing_since: '2026-10-01T00:00:00Z' });

    const recovered = nextCheckState(previous, { url: 'u', status: 'ok', httpStatus: 200, reason: null }, '2026-10-08T00:00:00Z');
    expect(recovered).toEqual({ consecutive_failures: 0, failing_since: null });
    // A later recurrence is a new episode, so an old acknowledgement no longer matches it.
    const back: CachedLinkCheck = { url: 'u', check_status: 'ok', checked_at: '2026-10-08T00:00:00Z', ...recovered };
    expect(nextCheckState(back, failed, '2026-10-15T00:00:00Z').failing_since).toBe('2026-10-15T00:00:00Z');
  });
});

describe('redirects are re-checked hop by hop', () => {
  const redirectTo = (location: string, status = 302) => ({ status, location });

  const redirectingDeps = deps;

  it('never follows a redirect into a host on the never-check list', async () => {
    const { d, calls } = redirectingDeps((url) => (url.startsWith('https://short.example.org') ? redirectTo('https://www.instagram.com/vsaatucsd') : { status: 200 }));
    const [outcome] = await runLinkChecks([{ url: 'https://short.example.org/abc', kind: 'link' }], d);

    expect(outcome).toMatchObject({ status: 'skipped', reason: 'redirects_to_unchecked_host' });
    expect(calls.map((c) => c.url)).toEqual(['https://short.example.org/abc']);
  });

  it('never follows a redirect to a private address, localhost, or a metadata endpoint', async () => {
    for (const target of ['http://169.254.169.254/latest/meta-data/', 'http://localhost:8080/admin', 'https://10.0.0.5/x', 'https://[::1]/x']) {
      const { d, calls } = redirectingDeps(() => redirectTo(target));
      const [outcome] = await runLinkChecks([{ url: 'https://public.example.org/a', kind: 'link' }], d);
      expect(outcome.status).toBe('skipped');
      expect(calls).toHaveLength(1);
    }
  });

  it('never sends a GET to a Supabase host reached by redirect, even when it refuses HEAD', async () => {
    const { d, calls } = redirectingDeps((url, method) => (url.startsWith('https://cdn.example.org') ? redirectTo(STORAGE) : { status: method === 'HEAD' ? 405 : 200 }));
    const [outcome] = await runLinkChecks([{ url: 'https://cdn.example.org/a.png', kind: 'image' }], d);

    expect(calls.every((call) => call.method === 'HEAD')).toBe(true);
    expect(outcome).toMatchObject({ status: 'skipped', reason: 'head_unsupported' });
  });

  it('never sends the GET fallback to a Supabase host reached by a redirect after HEAD was refused', async () => {
    // The origin refuses HEAD, so the check falls back to a ranged GET; that GET then redirects into Storage.
    const { d, calls } = redirectingDeps((url, method) => {
      if (url.startsWith('https://origin.example.org')) return method === 'HEAD' ? { status: 405 } : redirectTo(STORAGE);
      return { status: 200, type: 'image/webp' };
    });
    const [outcome] = await runLinkChecks([{ url: 'https://origin.example.org/a.webp', kind: 'image' }], d);

    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['HEAD', 'https://origin.example.org/a.webp'],
      ['GET', 'https://origin.example.org/a.webp'],
    ]);
    expect(calls.some((c) => c.url === STORAGE)).toBe(false);
    expect(outcome).toMatchObject({ status: 'skipped', reason: 'redirects_to_unchecked_host' });
  });

  it('follows ordinary redirects, spacing each hop, and judges the final answer', async () => {
    const { d, calls } = redirectingDeps((url) => (url.endsWith('/old') ? redirectTo('/new', 301) : { status: 200, type: 'image/webp' }));
    const [outcome] = await runLinkChecks([{ url: 'https://cdn.example.org/old', kind: 'image' }], d);

    expect(outcome.status).toBe('ok');
    expect(calls.map((c) => c.url)).toEqual(['https://cdn.example.org/old', 'https://cdn.example.org/new']);
    expect(calls[1].at - calls[0].at).toBe(DEFAULT_RUN_OPTIONS.externalDelayMs);
  });

  it('gives up on a redirect loop after three hops instead of following it forever', async () => {
    const { d, calls } = redirectingDeps(() => redirectTo('https://loop.example.org/again'));
    const [outcome] = await runLinkChecks([{ url: 'https://loop.example.org/start', kind: 'link' }], d);
    expect(outcome).toMatchObject({ status: 'failed', reason: 'too_many_redirects' });
    // 4 requests per attempt (the start plus three hops), and the one transient retry.
    expect(calls.length).toBeLessThanOrEqual(8);
  });

  it('closes every response body without reading it', async () => {
    const cancel = jest.fn();
    const { d } = deps(() => ({ status: 200, type: 'image/png' }));
    const original = d.fetch;
    d.fetch = async (url, init) => ({ ...(await original(url, init)), body: { cancel } });
    await runLinkChecks([{ url: 'https://cdn.example.org/a.png', kind: 'image' }], d);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('what is never fetched from the runner', () => {
  it('skips private, loopback, metadata, credentialed, non-default-port and single-label hosts', () => {
    const unsafe = [
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost/x',
      'https://app.localhost/x',
      'https://10.0.0.1/x',
      'https://192.168.1.1/x',
      'https://[::1]/x',
      'https://router.local/x',
      'https://db.internal/x',
      'https://intranet/x',
      'https://example.org:8443/x',
      'https://user:pass@example.org/x',
      'ftp://example.org/x',
    ];
    for (const url of unsafe) expect(planUrlCheck(url, 'link').action).toBe('skip');
    expect(planUrlCheck('https://example.org/x', 'link').action).toBe('http');
    expect(planUrlCheck('http://example.org/x', 'link').action).toBe('http');
  });

  it('skips the paid image-transform endpoint and non-public storage', () => {
    expect(planUrlCheck('https://abc.supabase.co/storage/v1/render/image/public/event_images/a.png?width=200', 'image')).toEqual({ action: 'skip', reason: 'not-public-storage' });
  });

  it('treats any Supabase host, including a custom domain, as never-GET', () => {
    expect(planUrlCheck('https://abc.supabase.co/functions/v1/thing', 'link')).toMatchObject({ action: 'http', noGet: true });
    expect(planUrlCheck('https://files.vsa.example/storage/v1/object/public/b/a.png', 'image', { supabaseHost: 'files.vsa.example' })).toMatchObject({ action: 'http', noGet: true });
    expect(planUrlCheck('https://cdn.example.org/a.png', 'image')).toMatchObject({ action: 'http', noGet: false });
  });

  it('knows the shorteners, Drive/Photos image hosts and other social hosts', () => {
    ['https://bit.ly/x', 'https://linktr.ee/vsa', 'https://lh3.googleusercontent.com/a', 'https://scontent.cdninstagram.com/a', 'https://www.dropbox.com/s/x'].forEach((url) =>
      expect(planUrlCheck(url, 'link')).toEqual({ action: 'skip', reason: 'host-not-checked' }),
    );
  });

  it('stores a protocol-relative URL the way it will be requested', () => {
    expect(normalizeUrl('//cdn.example.org/a.png#top')).toBe('https://cdn.example.org/a.png');
    expect(planUrlCheck('//cdn.example.org/a.png', 'image').action).toBe('http');
  });
});

describe('one bad item or a slow run cannot sink the whole run', () => {
  it('records an unexpected error for that item only and carries on', async () => {
    const { d } = deps(() => ({ status: 200 }));
    d.localFileExists = (path) => {
      if (path.includes('boom')) throw new URIError('malformed');
      return true;
    };
    const outcomes = await runLinkChecks(
      [
        { url: '/images/boom.webp', kind: 'image' },
        { url: '/images/fine.webp', kind: 'image' },
      ],
      d,
    );
    expect(outcomes.map((o) => [o.status, o.reason])).toEqual([
      ['skipped', 'check_error'],
      ['ok', null],
    ]);
  });

  it('reports each result as it is known so progress can be saved, and stops starting new URLs after the time budget', async () => {
    const { d } = deps(() => ({ status: 200 }));
    const seen: string[] = [];
    const outcomes = await runLinkChecks(
      Array.from({ length: 10 }, (_, i) => ({ url: `https://slow.example.org/${i}`, kind: 'link' as const })),
      d,
      { ...DEFAULT_RUN_OPTIONS, maxDurationMs: 3000 },
      (outcome) => {
        seen.push(outcome.url);
      },
    );
    // Same-host spacing is 2s, so only the first few start inside a 3s budget.
    expect(outcomes.length).toBeLessThan(10);
    expect(seen).toEqual(outcomes.map((o) => o.url));
  });
});
