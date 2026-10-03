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
  waitForAsset,
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

describe('waitForAsset', () => {
  it('keeps polling until the deploy lands', async () => {
    let t = 0;
    const responses = [404, 404, 200];
    const fetchAsset: FetchAsset = async () => ({
      status: responses.shift() ?? 200,
      contentType: 'image/webp',
      body: new Uint8Array(4),
    });
    const result = await waitForAsset(entry(), {
      baseUrl: 'https://x.com',
      fetchAsset,
      timeoutMs: 600_000,
      intervalMs: 15_000,
      sleep: async (ms) => {
        t += ms;
      },
      now: () => t,
    });
    expect(result).toEqual({ ok: true });
    expect(t).toBe(30_000);
  });

  it('gives up at the deadline and reports the last failure', async () => {
    let t = 0;
    const result = await waitForAsset(entry(), {
      baseUrl: 'https://x.com',
      fetchAsset: served({ status: 404 }),
      timeoutMs: 40_000,
      intervalMs: 15_000,
      sleep: async (ms) => {
        t += ms;
      },
      now: () => t,
    });
    expect(result).toEqual({ ok: false, reason: 'HTTP 404' });
    expect(t).toBeLessThanOrEqual(40_000);
  });

  it('checks once when the timeout is zero', async () => {
    const fetchAsset = served({ status: 404 });
    await waitForAsset(entry(), {
      baseUrl: 'https://x.com',
      fetchAsset,
      timeoutMs: 0,
      intervalMs: 15_000,
      sleep: async () => undefined,
      now: () => 0,
    });
    expect(fetchAsset).toHaveBeenCalledTimes(1);
  });
});

describe('relinkPlan', () => {
  const clientReturning = (result: Awaited<ReturnType<RelinkClient['conditionalUpdate']>>) => {
    const conditionalUpdate = jest.fn(async () => result);
    return { client: { conditionalUpdate } as RelinkClient, conditionalUpdate };
  };

  it('relinks only after the asset is verified', async () => {
    const { client, conditionalUpdate } = clientReturning('updated');
    const results = await relinkPlan(createPlan([entry()]), { verify: async () => ({ ok: true }), client });
    expect(results.map((r) => r.outcome)).toEqual(['relinked']);
    expect(conditionalUpdate).toHaveBeenCalledWith(expect.objectContaining({ expectedUrl: entry().expectedUrl }));
  });

  it('never touches the DB when the deploy failed (acceptance: rows stay on Storage)', async () => {
    const { client, conditionalUpdate } = clientReturning('updated');
    const results = await relinkPlan(createPlan([entry(), entry({ rowId: 'row-2', field: 'thumbnail_url' })]), {
      verify: async () => ({ ok: false, reason: 'HTTP 404' }),
      client,
    });
    expect(conditionalUpdate).not.toHaveBeenCalled();
    expect(results.every((r) => r.outcome === 'not_served')).toBe(true);
  });

  it('relinks the served entries and leaves the unserved ones', async () => {
    const { client, conditionalUpdate } = clientReturning('updated');
    const plan = createPlan([entry(), entry({ rowId: 'row-2', newPath: '/images/events/missing.webp' })]);
    const results = await relinkPlan(plan, {
      verify: async (e) => (e.newPath.includes('missing') ? { ok: false, reason: 'HTTP 404' } : { ok: true }),
      client,
    });
    expect(results.map((r) => r.outcome)).toEqual(['relinked', 'not_served']);
    expect(conditionalUpdate).toHaveBeenCalledTimes(1);
  });

  it('verifies a shared asset once', async () => {
    const { client } = clientReturning('updated');
    const verify = jest.fn(async () => ({ ok: true as const }));
    await relinkPlan(createPlan([entry(), entry({ rowId: 'row-2' })]), { verify, client });
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('reports a row that changed since planning without overwriting it', async () => {
    const { client } = clientReturning('row_changed');
    const [result] = await relinkPlan(createPlan([entry()]), { verify: async () => ({ ok: true }), client });
    expect(result.outcome).toBe('row_changed');
  });

  it('reports DB errors and thrown errors', async () => {
    const [a] = await relinkPlan(createPlan([entry()]), {
      verify: async () => ({ ok: true }),
      client: clientReturning({ error: 'permission denied' }).client,
    });
    expect(a).toMatchObject({ outcome: 'error', detail: 'permission denied' });

    const [b] = await relinkPlan(createPlan([entry()]), {
      verify: async () => ({ ok: true }),
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
      verify: async () => ({ ok: true }),
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
