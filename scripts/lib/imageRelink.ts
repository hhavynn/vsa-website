import { createHash } from 'crypto';

/**
 * Pure logic for the two-phase image migration (#454).
 *
 *   Phase 1  `--apply`   writes WebP files and a relink plan. Never touches the DB.
 *   Phase 2  `--relink`  runs only after the files are committed and deployed. For each
 *                        plan entry it checks the production asset is really being served
 *                        and only then does a conditional DB update.
 *
 * A failed push or deploy therefore leaves every row on its existing, working
 * Storage URL. Nothing in here imports sharp or Supabase so it is unit-testable.
 */

export interface RelinkEntry {
  category: string;
  table: string;
  rowId: string;
  field: string;
  /** The Storage URL the row held when the file was derived. The update is conditional on it. */
  expectedUrl: string;
  /** Public path the row should point at, e.g. /images/events/foo_2026-01-01.webp */
  newPath: string;
  /** Repo-relative file backing `newPath`. */
  filePath: string;
  /** Size of the file on disk; the deployed asset must match it. */
  bytes: number;
  /** SHA-256 (hex) of the file on disk. The deployed asset must match it exactly, so a
   *  stale file of the same size at a reused path (--overwrite) is never accepted. */
  sha256: string;
}

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface RelinkPlan {
  version: 1;
  generatedAt: string;
  entries: RelinkEntry[];
}

export function createPlan(entries: RelinkEntry[], now: Date = new Date()): RelinkPlan {
  return { version: 1, generatedAt: now.toISOString(), entries };
}

const SAFE_PATH = /^\/images\/[A-Za-z0-9._\-/]+\.webp$/;

/** Validates untrusted JSON (a plan read back from disk) before it can drive DB writes. */
export function parsePlan(input: unknown): RelinkPlan {
  if (!input || typeof input !== 'object') throw new Error('Plan is not an object');
  const plan = input as Partial<RelinkPlan>;
  if (plan.version !== 1) throw new Error(`Unsupported plan version: ${String(plan.version)}`);
  if (!Array.isArray(plan.entries)) throw new Error('Plan has no entries array');

  const entries = plan.entries.map((raw, index): RelinkEntry => {
    const e = raw as Partial<RelinkEntry>;
    const where = `entry ${index}`;
    for (const key of ['category', 'table', 'rowId', 'field', 'expectedUrl', 'newPath', 'filePath'] as const) {
      if (typeof e[key] !== 'string' || !e[key]) throw new Error(`${where}: missing ${key}`);
    }
    if (typeof e.bytes !== 'number' || !Number.isFinite(e.bytes) || e.bytes <= 0) {
      throw new Error(`${where}: bytes must be a positive number`);
    }
    if (typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256)) {
      throw new Error(`${where}: sha256 must be a 64-character hex digest`);
    }
    if (!SAFE_PATH.test(e.newPath as string) || (e.newPath as string).includes('..')) {
      throw new Error(`${where}: newPath must be a /images/... .webp path (got ${String(e.newPath)})`);
    }
    return e as RelinkEntry;
  });

  return { version: 1, generatedAt: String(plan.generatedAt ?? ''), entries };
}

/** Joins a site origin and an absolute path without doubling slashes. */
export function assetUrl(baseUrl: string, newPath: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${newPath}`;
}

// ─── Is the deployed asset really being served? ──────────────────────────────

export interface FetchedAsset {
  status: number;
  contentType: string | null;
  body: Uint8Array;
}

export type FetchAsset = (url: string) => Promise<FetchedAsset>;

export type AssetCheck = { ok: true } | { ok: false; reason: string };

/**
 * The SPA fallback in vercel.json answers *any* missing path with 200 + index.html,
 * so a bare status check would "verify" a file that was never deployed. Require an
 * image content type and the exact bytes of the committed file (length, then SHA-256:
 * with --overwrite a changed image reuses its path, and an old file of the same size
 * must not pass).
 */
export async function checkAssetServed(
  entry: Pick<RelinkEntry, 'newPath' | 'bytes' | 'sha256'>,
  baseUrl: string,
  fetchAsset: FetchAsset,
): Promise<AssetCheck> {
  let res: FetchedAsset;
  try {
    res = await fetchAsset(assetUrl(baseUrl, entry.newPath));
  } catch (err) {
    return { ok: false, reason: `request failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };
  if (!res.contentType || !res.contentType.toLowerCase().startsWith('image/')) {
    return { ok: false, reason: `content-type is ${res.contentType ?? 'missing'}, not an image (SPA fallback?)` };
  }
  if (res.body.byteLength !== entry.bytes) {
    return { ok: false, reason: `served ${res.body.byteLength} bytes, expected ${entry.bytes}` };
  }
  const served = sha256Hex(res.body);
  if (served !== entry.sha256) {
    return { ok: false, reason: `served file differs from the committed one (sha256 ${served.slice(0, 12)}…, expected ${entry.sha256.slice(0, 12)}…); old deployment still live?` };
  }
  return { ok: true };
}

export interface WaitOptions {
  baseUrl: string;
  fetchAsset: FetchAsset;
  timeoutMs: number;
  intervalMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

/** Polls until the asset is served correctly or the deadline passes (deploys take minutes). */
export async function waitForAsset(
  entry: Pick<RelinkEntry, 'newPath' | 'bytes' | 'sha256'>,
  opts: WaitOptions,
): Promise<AssetCheck> {
  const deadline = opts.now() + opts.timeoutMs;
  let last: AssetCheck = { ok: false, reason: 'not checked' };
  for (;;) {
    last = await checkAssetServed(entry, opts.baseUrl, opts.fetchAsset);
    if (last.ok) return last;
    if (opts.now() + opts.intervalMs > deadline) return last;
    await opts.sleep(opts.intervalMs);
  }
}

// ─── Relink ──────────────────────────────────────────────────────────────────

export type UpdateResult = 'updated' | 'row_changed' | { error: string };

export interface RelinkClient {
  /** UPDATE table SET field = newPath WHERE id = rowId AND field = expectedUrl. */
  conditionalUpdate(entry: RelinkEntry): Promise<UpdateResult>;
}

export type RelinkOutcome = 'relinked' | 'would_relink' | 'row_changed' | 'not_served' | 'error';

export interface RelinkResult {
  entry: RelinkEntry;
  outcome: RelinkOutcome;
  detail?: string;
}

export interface RelinkOptions {
  /** Resolves once the entry's asset is verified, or reports why it is not served. */
  verify: (entry: RelinkEntry) => Promise<AssetCheck>;
  client: RelinkClient;
  /** Verify everything but write nothing. */
  verifyOnly?: boolean;
}

/**
 * Verifies each distinct asset once, then relinks only the entries whose asset is
 * served. An unverified entry is left untouched, which keeps its Storage URL live.
 */
export async function relinkPlan(plan: RelinkPlan, opts: RelinkOptions): Promise<RelinkResult[]> {
  const verdicts = new Map<string, AssetCheck>();
  const results: RelinkResult[] = [];

  for (const entry of plan.entries) {
    let verdict = verdicts.get(entry.newPath);
    if (!verdict) {
      verdict = await opts.verify(entry);
      verdicts.set(entry.newPath, verdict);
    }

    if (!verdict.ok) {
      results.push({ entry, outcome: 'not_served', detail: verdict.reason });
      continue;
    }
    if (opts.verifyOnly) {
      results.push({ entry, outcome: 'would_relink' });
      continue;
    }

    try {
      const update = await opts.client.conditionalUpdate(entry);
      if (update === 'updated') results.push({ entry, outcome: 'relinked' });
      else if (update === 'row_changed') {
        results.push({ entry, outcome: 'row_changed', detail: 'row no longer holds the expected URL (newer upload?)' });
      } else results.push({ entry, outcome: 'error', detail: update.error });
    } catch (err) {
      results.push({ entry, outcome: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

export function summarizeRelink(results: RelinkResult[]): Record<RelinkOutcome, number> {
  const summary: Record<RelinkOutcome, number> = {
    relinked: 0,
    would_relink: 0,
    row_changed: 0,
    not_served: 0,
    error: 0,
  };
  for (const r of results) summary[r.outcome] += 1;
  return summary;
}
