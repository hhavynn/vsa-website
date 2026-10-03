import {
  sha256Hex,
  assetUrl,
  checkAssetServed,
  createPlan,
  FetchAsset,
  parsePlan,
  relinkPlan,
  RelinkClient,
  RelinkEntry,
  summarizeRelink,
  waitForAssets,
  validatePlan,
  AssetCheck,
  AssetRef,
} from '../../scripts/lib/imageRelink';

// Four zero bytes: what `served()` returns by default.
const ZERO4 = sha256Hex(new Uint8Array(4));

const entry = (over: Partial<RelinkEntry> = {}): RelinkEntry => ({
  category: 'events',
  table: 'events',
  rowId: 'row-1',
  field: 'image_url',
  expectedUrl: 'https://abc.supabase.co/storage/v1/object/public/event_images/a.jpg',
  newPath: '/images/events/a_2026-01-01.webp',
  filePath: 'public/images/events/a_2026-01-01.webp',
  bytes: 4,
  sha256: ZERO4,
  ...over,
});

const served = (over: Partial<{ status: number; contentType: string | null; size: number }> = {}): FetchAsset =>
  jest.fn(async () => ({
    status: over.status ?? 200,
    contentType: over.contentType === undefined ? 'image/webp' : over.contentType,
    body: new Uint8Array(over.size ?? 4),
  }));

describe('assetUrl', () => {
  it('does not double slashes', () => {
    expect(assetUrl('https://x.com/', '/images/a.webp')).toBe('https://x.com/images/a.webp');
  });
});

describe('parsePlan', () => {
  it('round-trips a created plan', () => {
    const plan = createPlan([entry()], new Date('2026-01-01T00:00:00Z'));
    expect(parsePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

  it.each([
    ['wrong version', { version: 2, entries: [] }],
    ['no entries', { version: 1 }],
    ['missing field', { version: 1, entries: [{ ...entry(), rowId: '' }] }],
    ['non-image path', { version: 1, entries: [entry({ newPath: '/admin/secret.webp' })] }],
    ['path traversal', { version: 1, entries: [entry({ newPath: '/images/../index.webp' })] }],
    ['empty file', { version: 1, entries: [entry({ bytes: 0 })] }],
    ['missing digest', { version: 1, entries: [entry({ sha256: '' })] }],
    ['malformed digest', { version: 1, entries: [entry({ sha256: 'abc' })] }],
  ])('rejects %s', (_name, input) => {
    expect(() => parsePlan(input)).toThrow();
  });
});

describe('checkAssetServed', () => {
  it('accepts a correct image response', async () => {
    expect(await checkAssetServed(entry(), 'https://x.com', served())).toEqual({ ok: true });
  });

  it('rejects the SPA fallback: HTTP 200 with index.html', async () => {
    const result = await checkAssetServed(entry(), 'https://x.com', served({ contentType: 'text/html; charset=utf-8', size: 4 }));
    expect(result.ok).toBe(false);
  });

  it('rejects a stale file of the same size at a reused path (--overwrite)', async () => {
    const stale: FetchAsset = async () => ({
      status: 200,
      contentType: 'image/webp',
      body: new Uint8Array([1, 2, 3, 4]), // same length as the new file, different bytes
    });
    const result = await checkAssetServed(entry(), 'https://x.com', stale);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/differs from the committed one/);
  });

  it('rejects 404s, wrong sizes and network errors', async () => {
    expect((await checkAssetServed(entry(), 'https://x.com', served({ status: 404 }))).ok).toBe(false);
    expect((await checkAssetServed(entry(), 'https://x.com', served({ size: 9 }))).ok).toBe(false);
    const boom: FetchAsset = async () => {
      throw new Error('ECONNRESET');
    };
    expect(await checkAssetServed(entry(), 'https://x.com', boom)).toEqual({
      ok: false,
      reason: 'request failed: ECONNRESET',
    });
  });
});

describe('waitForAssets', () => {
  const clock = () => {
    let t = 0;
    return {
      get elapsed() {
        return t;
      },
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
    };
  };
  const asset = (n: number): AssetRef => ({ newPath: `/images/events/a${n}_2026-01-01.webp`, bytes: 4, sha256: ZERO4 });

  it('keeps polling until the deploy lands', async () => {
    const c = clock();
    const responses = [404, 404, 200];
    const fetchAsset: FetchAsset = async () => ({
      status: responses.shift() ?? 200,
      contentType: 'image/webp',
      body: new Uint8Array(4),
    });
    const results = await waitForAssets([asset(1)], {
      baseUrl: 'https://x.com', fetchAsset, timeoutMs: 600_000, intervalMs: 15_000, sleep: c.sleep, now: c.now,
    });
    expect(results.get(asset(1).newPath)).toEqual({ ok: true });
    expect(c.elapsed).toBe(30_000);
  });

  it('uses one deadline for the whole run: elapsed time does not scale with asset count', async () => {
    const run = async (count: number) => {
      const c = clock();
      const fetchAsset = served({ status: 404 });
      const results = await waitForAssets(Array.from({ length: count }, (_, i) => asset(i)), {
        baseUrl: 'https://x.com', fetchAsset, timeoutMs: 900_000, intervalMs: 15_000, sleep: c.sleep, now: c.now,
      });
      return { elapsed: c.elapsed, calls: (fetchAsset as jest.Mock).mock.calls.length, results };
    };
    const one = await run(1);
    const many = await run(20);

    // 20 unavailable assets take the same logical time as 1, never 20 × 900s.
    expect(many.elapsed).toBe(one.elapsed);
    expect(many.elapsed).toBeLessThanOrEqual(900_000);
    // Every round still checks every unresolved asset.
    expect(many.calls).toBe(one.calls * 20);
    expect(Array.from(many.results.values()).every((r) => !r.ok)).toBe(true);
  });

  it('gives up at the shared deadline and reports each last failure', async () => {
    const c = clock();
    const results = await waitForAssets([asset(1), asset(2)], {
      baseUrl: 'https://x.com', fetchAsset: served({ status: 404 }), timeoutMs: 40_000, intervalMs: 15_000, sleep: c.sleep, now: c.now,
    });
    expect(results.get(asset(1).newPath)).toEqual({ ok: false, reason: 'HTTP 404' });
    expect(results.get(asset(2).newPath)).toEqual({ ok: false, reason: 'HTTP 404' });
    expect(c.elapsed).toBeLessThanOrEqual(40_000);
  });

  it('judges each asset on its own: a passing asset does not vouch for a failing one', async () => {
    const c = clock();
    const fetchAsset: FetchAsset = async (url) => ({
      status: url.includes('a1_') ? 200 : 404,
      contentType: 'image/webp',
      body: new Uint8Array(4),
    });
    const results = await waitForAssets([asset(1), asset(2)], {
      baseUrl: 'https://x.com', fetchAsset, timeoutMs: 30_000, intervalMs: 15_000, sleep: c.sleep, now: c.now,
    });
    expect(results.get(asset(1).newPath)).toEqual({ ok: true });
    expect(results.get(asset(2).newPath)?.ok).toBe(false);
  });

  it('stops re-checking an asset once it has passed', async () => {
    const c = clock();
    const calls: string[] = [];
    const fetchAsset: FetchAsset = async (url) => {
      calls.push(url);
      return { status: url.includes('a1_') || calls.length > 4 ? 200 : 404, contentType: 'image/webp', body: new Uint8Array(4) };
    };
    await waitForAssets([asset(1), asset(2)], {
      baseUrl: 'https://x.com', fetchAsset, timeoutMs: 600_000, intervalMs: 15_000, sleep: c.sleep, now: c.now,
    });
    expect(calls.filter((u) => u.includes('a1_'))).toHaveLength(1);
  });

  it('respects the concurrency bound', async () => {
    const c = clock();
    let inFlight = 0;
    let peak = 0;
    const fetchAsset: FetchAsset = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { status: 200, contentType: 'image/webp', body: new Uint8Array(4) };
    };
    await waitForAssets(Array.from({ length: 12 }, (_, i) => asset(i)), {
      baseUrl: 'https://x.com', fetchAsset, timeoutMs: 0, intervalMs: 15_000, sleep: c.sleep, now: c.now, concurrency: 3,
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('checks once when the timeout is zero', async () => {
    const c = clock();
    const fetchAsset = served({ status: 404 });
    await waitForAssets([asset(1)], {
      baseUrl: 'https://x.com', fetchAsset, timeoutMs: 0, intervalMs: 15_000, sleep: c.sleep, now: c.now,
    });
    expect(fetchAsset).toHaveBeenCalledTimes(1);
  });
});

const allOk = async (assets: AssetRef[]) => new Map<string, AssetCheck>(assets.map((a) => [a.newPath, { ok: true }]));

describe('relinkPlan', () => {
  const clientReturning = (result: Awaited<ReturnType<RelinkClient['conditionalUpdate']>>) => {
    const conditionalUpdate = jest.fn(async () => result);
    return { client: { conditionalUpdate } as RelinkClient, conditionalUpdate };
  };

  it('relinks only after the asset is verified', async () => {
    const { client, conditionalUpdate } = clientReturning('updated');
    const results = await relinkPlan(createPlan([entry()]), { verifyAll: allOk, client });
    expect(results.map((r) => r.outcome)).toEqual(['relinked']);
    expect(conditionalUpdate).toHaveBeenCalledWith(expect.objectContaining({ expectedUrl: entry().expectedUrl }));
  });

  it('never touches the DB when the deploy failed (acceptance: rows stay on Storage)', async () => {
    const { client, conditionalUpdate } = clientReturning('updated');
    const results = await relinkPlan(createPlan([entry(), entry({ rowId: 'row-2', field: 'thumbnail_url', newPath: '/images/events/a_2026-01-01_thumb.webp', filePath: 'public/images/events/a_2026-01-01_thumb.webp' })]), {
      verifyAll: async (assets) => new Map(assets.map((a) => [a.newPath, { ok: false, reason: 'HTTP 404' } as AssetCheck])),
      client,
    });
    expect(conditionalUpdate).not.toHaveBeenCalled();
    expect(results.every((r) => r.outcome === 'not_served')).toBe(true);
  });

  it('relinks the served entries and leaves the unserved ones', async () => {
    const { client, conditionalUpdate } = clientReturning('updated');
    const plan = createPlan([entry(), entry({ rowId: 'row-2', newPath: '/images/events/missing_2026-01-01.webp', filePath: 'public/images/events/missing_2026-01-01.webp' })]);
    const results = await relinkPlan(plan, {
      verifyAll: async (assets) =>
        new Map(assets.map((a) => [a.newPath, a.newPath.includes('missing') ? ({ ok: false, reason: 'HTTP 404' } as AssetCheck) : ({ ok: true } as AssetCheck)])),
      client,
    });
    expect(results.map((r) => r.outcome)).toEqual(['relinked', 'not_served']);
    expect(conditionalUpdate).toHaveBeenCalledTimes(1);
  });

  it('verifies a shared asset once', async () => {
    const { client } = clientReturning('updated');
    const verifyAll = jest.fn(allOk);
    await relinkPlan(createPlan([entry(), entry({ rowId: 'row-2' })]), { verifyAll, client });
    expect(verifyAll).toHaveBeenCalledTimes(1);
    expect(verifyAll.mock.calls[0][0]).toHaveLength(1);
  });

  it('reports a row that changed since planning without overwriting it', async () => {
    const { client } = clientReturning('row_changed');
    const [result] = await relinkPlan(createPlan([entry()]), { verifyAll: allOk, client });
    expect(result.outcome).toBe('row_changed');
  });

  it('reports DB errors and thrown errors', async () => {
    const [a] = await relinkPlan(createPlan([entry()]), {
      verifyAll: allOk,
      client: clientReturning({ error: 'permission denied' }).client,
    });
    expect(a).toMatchObject({ outcome: 'error', detail: 'permission denied' });

    const [b] = await relinkPlan(createPlan([entry()]), {
      verifyAll: allOk,
      client: {
        conditionalUpdate: async () => {
          throw new Error('network');
        },
      },
    });
    expect(b).toMatchObject({ outcome: 'error', detail: 'network' });
  });

  it('verify-only checks assets but writes nothing', async () => {
    const { client, conditionalUpdate } = clientReturning('updated');
    const results = await relinkPlan(createPlan([entry()]), {
      verifyAll: allOk,
      client,
      verifyOnly: true,
    });
    expect(results[0].outcome).toBe('would_relink');
    expect(conditionalUpdate).not.toHaveBeenCalled();
  });

  it('summarizes outcomes', () => {
    expect(
      summarizeRelink([
        { entry: entry(), outcome: 'relinked' },
        { entry: entry(), outcome: 'not_served' },
        { entry: entry(), outcome: 'not_served' },
      ]),
    ).toEqual({ relinked: 1, would_relink: 0, row_changed: 0, not_served: 2, error: 0 });
  });
});

describe('plan allowlist (tampered plans never reach the service-role client)', () => {
  const cabinet = (over: Partial<RelinkEntry> = {}) =>
    entry({
      category: 'cabinet',
      table: 'cabinet_members',
      field: 'image_url',
      newPath: '/images/cabinet/jane_1234abcd.webp',
      filePath: 'public/images/cabinet/jane_1234abcd.webp',
      ...over,
    });

  const tampered: [string, RelinkEntry[], RegExp][] = [
    ['another table', [entry({ table: 'user_profiles' })], /table "user_profiles" is not "events"/],
    ['another field', [entry({ field: 'is_admin' })], /field "is_admin" is not an image field/],
    ['a field from a different category', [entry({ field: 'cover_image_url' })], /not an image field of "events"/],
    ['mismatched category/table', [entry({ category: 'cabinet' })], /table "events" is not "cabinet_members"/],
    ['an unknown category', [entry({ category: 'admins' })], /unknown category/],
    ['a prototype-chain category', [entry({ category: 'constructor' })], /unknown category/],
    [
      'a path outside the category directory',
      [entry({ newPath: '/images/cabinet/a.webp', filePath: 'public/images/cabinet/a.webp' })],
      /newPath must be inside \/images\/events\//,
    ],
    [
      'a nested path inside the category directory',
      [entry({ newPath: '/images/events/sub/a.webp', filePath: 'public/images/events/sub/a.webp' })],
      /not a plain \.webp file name/,
    ],
    [
      'a traversal path',
      [entry({ newPath: '/images/events/../a.webp', filePath: 'public/images/events/../a.webp' })],
      /not a plain \.webp file name/,
    ],
    [
      'a filePath that does not correspond to newPath',
      [entry({ filePath: 'public/images/events/other.webp' })],
      /newPath and filePath must correspond/,
    ],
    [
      'a filePath outside the repo output directory',
      [entry({ filePath: 'src/index.tsx' })],
      /newPath and filePath must correspond/,
    ],
    ['a thumbnail path on a full-size field', [entry({ field: 'thumbnail_url', newPath: '/images/events/a.webp', filePath: 'public/images/events/a.webp' })], /must end with _thumb\.webp/],
    ['an expectedUrl that is not Supabase Storage', [entry({ expectedUrl: 'https://evil.example/a.png' })], /not a Supabase Storage public URL/],
    ['a hostile row id', [entry({ rowId: "x' or '1'='1" })], /rowId has unexpected characters/],
    [
      'conflicting duplicate writes to the same row/field',
      [entry(), entry({ newPath: '/images/events/b_2026-01-01.webp', filePath: 'public/images/events/b_2026-01-01.webp' })],
      /conflicts with an earlier entry/,
    ],
    [
      'the same path with different file contents',
      [entry(), entry({ rowId: 'row-2', sha256: sha256Hex(new Uint8Array([9])) })],
      /appears with different file contents/,
    ],
  ];

  it.each(tampered)('rejects %s', (_name, entries, message) => {
    expect(() => validatePlan(createPlan(entries))).toThrow(message);
    expect(() => parsePlan(JSON.parse(JSON.stringify(createPlan(entries))))).toThrow(message);
  });

  it.each(tampered)('fails before verification or conditionalUpdate() for %s', async (_name, entries) => {
    const conditionalUpdate = jest.fn(async () => 'updated' as const);
    const verifyAll = jest.fn(allOk);
    await expect(
      relinkPlan(createPlan(entries), { verifyAll, client: { conditionalUpdate } }),
    ).rejects.toThrow(/Invalid relink plan/);
    expect(conditionalUpdate).not.toHaveBeenCalled();
    expect(verifyAll).not.toHaveBeenCalled();
  });

  it('one bad entry blocks the whole plan, including the valid ones', async () => {
    const conditionalUpdate = jest.fn(async () => 'updated' as const);
    await expect(
      relinkPlan(createPlan([entry(), entry({ rowId: 'row-2', table: 'user_profiles' })]), {
        verifyAll: allOk,
        client: { conditionalUpdate },
      }),
    ).rejects.toThrow();
    expect(conditionalUpdate).not.toHaveBeenCalled();
  });

  it('accepts a legitimate plan across categories and collapses exact duplicates', () => {
    const plan = validatePlan(createPlan([entry(), entry(), cabinet(), cabinet({ rowId: 'row-9', newPath: '/images/cabinet/jane_1234abcd.webp' })]));
    expect(plan.entries).toHaveLength(3);
  });

  it('accepts every configured category and image field', () => {
    // Guards against the allowlist and the migrate config drifting apart.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CATEGORIES } = require('../../scripts/lib/imageMigrationConfig');
    for (const [name, cfg] of Object.entries(CATEGORIES) as [string, { table: string; outputDir: string; imageFields: { name: string; suffix: string }[] }][]) {
      for (const field of cfg.imageFields) {
        const file = `row${field.suffix}.webp`;
        const newPath = `/${cfg.outputDir.replace(/^public\//, '')}/${file}`;
        expect(() =>
          validatePlan(createPlan([entry({ category: name, table: cfg.table, field: field.name, newPath, filePath: `public${newPath}` })])),
        ).not.toThrow();
      }
    }
  });
});
