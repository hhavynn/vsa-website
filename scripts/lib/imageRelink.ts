import { createHash } from 'crypto';
import { CATEGORIES } from './imageMigrationConfig';

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

const SUPABASE_STORAGE_URL = /supabase\.co\/storage\/v1\/object\/public\//;
const ROW_ID = /^[A-Za-z0-9-]{1,64}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/;
const HEX64 = /^[0-9a-f]{64}$/;

function ownCategory(name: string) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, name) ? CATEGORIES[name] : undefined;
}

/**
 * Full validation of a plan, run before any service-role write. `CATEGORIES` is the
 * only authority for where a plan may write: a plan file is data read from disk, so a
 * tampered one must not be able to name another table, another column, or a path
 * outside the category's image directory.
 *
 * Returns the plan with exact duplicates removed; throws listing every problem found.
 */
export function validatePlan(plan: RelinkPlan): RelinkPlan {
  const problems: string[] = [];
  const kept: RelinkEntry[] = [];
  const byTarget = new Map<string, RelinkEntry>();
  const byPath = new Map<string, RelinkEntry>();

  plan.entries.forEach((e, index) => {
    const where = `entry ${index}`;
    const bad = (msg: string) => problems.push(`${where}: ${msg}`);

    for (const key of ['category', 'table', 'rowId', 'field', 'expectedUrl', 'newPath', 'filePath'] as const) {
      if (typeof e[key] !== 'string' || !e[key]) return bad(`missing ${key}`);
    }
    if (typeof e.bytes !== 'number' || !Number.isInteger(e.bytes) || e.bytes <= 0) {
      return bad('bytes must be a positive integer');
    }
    if (typeof e.sha256 !== 'string' || !HEX64.test(e.sha256)) return bad('sha256 must be a 64-character hex digest');

    const category = ownCategory(e.category);
    if (!category) return bad(`unknown category "${e.category}"`);
    if (e.table !== category.table) {
      return bad(`table "${e.table}" is not "${category.table}", the table for category "${e.category}"`);
    }
    const field = category.imageFields.find((f) => f.name === e.field);
    if (!field) return bad(`field "${e.field}" is not an image field of "${category.table}"`);

    if (!ROW_ID.test(e.rowId)) return bad('rowId has unexpected characters');
    if (!SUPABASE_STORAGE_URL.test(e.expectedUrl)) return bad('expectedUrl is not a Supabase Storage public URL');

    const publicDir = `/${category.outputDir.replace(/^public\//, '')}/`;
    if (!e.newPath.startsWith(publicDir)) return bad(`newPath must be inside ${publicDir} (got ${e.newPath})`);
    const fileName = e.newPath.slice(publicDir.length);
    if (!FILE_NAME.test(fileName)) return bad(`newPath file name "${fileName}" is not a plain .webp file name`);
    if (field.suffix && !fileName.endsWith(`${field.suffix}.webp`)) {
      return bad(`newPath for ${e.field} must end with ${field.suffix}.webp`);
    }
    if (e.filePath !== `public${e.newPath}`) {
      return bad(`filePath must be public${e.newPath} (got ${e.filePath}); newPath and filePath must correspond`);
    }

    // One write per row/field, and one set of bytes per public path.
    const target = `${e.table}\u0000${e.rowId}\u0000${e.field}`;
    const earlier = byTarget.get(target);
    if (earlier) {
      if (earlier.newPath === e.newPath && earlier.expectedUrl === e.expectedUrl && earlier.sha256 === e.sha256) return; // exact duplicate
      return bad(`conflicts with an earlier entry for ${e.table}.${e.field} row ${e.rowId}`);
    }
    const sameAsset = byPath.get(e.newPath);
    if (sameAsset && (sameAsset.sha256 !== e.sha256 || sameAsset.bytes !== e.bytes)) {
      return bad(`${e.newPath} appears with different file contents`);
    }

    byTarget.set(target, e);
    if (!sameAsset) byPath.set(e.newPath, e);
    kept.push(e);
  });

  if (problems.length > 0) throw new Error(`Invalid relink plan:\n  ${problems.join('\n  ')}`);
  return { ...plan, entries: kept };
}

/** Parses untrusted JSON (a plan read back from disk) and fully validates it. */
export function parsePlan(input: unknown): RelinkPlan {
  if (!input || typeof input !== 'object') throw new Error('Plan is not an object');
  const plan = input as Partial<RelinkPlan>;
  if (plan.version !== 1) throw new Error(`Unsupported plan version: ${String(plan.version)}`);
  if (!Array.isArray(plan.entries)) throw new Error('Plan has no entries array');
  if (plan.entries.some((entry) => !entry || typeof entry !== 'object')) throw new Error('Plan entries must be objects');

  return validatePlan({
    version: 1,
    generatedAt: String(plan.generatedAt ?? ''),
    entries: plan.entries as RelinkEntry[],
  });
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

export type AssetRef = Pick<RelinkEntry, 'newPath' | 'bytes' | 'sha256'>;

export interface WaitOptions {
  baseUrl: string;
  fetchAsset: FetchAsset;
  /** One budget for the whole run, not per asset. */
  timeoutMs: number;
  intervalMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** Max simultaneous requests within a polling round (default 6). */
  concurrency?: number;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Polls every distinct asset together against ONE shared deadline: a round checks all
 * still-unresolved assets (bounded concurrency), sleeps, and repeats until they all pass
 * or the deadline is reached. Elapsed time is bounded by `timeoutMs` however many assets
 * there are. Each asset is judged only on its own status, content-type and digest.
 * Returns the latest verdict per `newPath`.
 */
export async function waitForAssets(assets: AssetRef[], opts: WaitOptions): Promise<Map<string, AssetCheck>> {
  const deadline = opts.now() + opts.timeoutMs;
  const concurrency = opts.concurrency ?? 6;
  const results = new Map<string, AssetCheck>();

  const unique = new Map<string, AssetRef>();
  for (const asset of assets) if (!unique.has(asset.newPath)) unique.set(asset.newPath, asset);
  let pending = Array.from(unique.values());

  while (pending.length > 0) {
    const verdicts = await mapLimit(pending, concurrency, (asset) =>
      checkAssetServed(asset, opts.baseUrl, opts.fetchAsset),
    );
    const stillPending: AssetRef[] = [];
    pending.forEach((asset, i) => {
      results.set(asset.newPath, verdicts[i]);
      if (!verdicts[i].ok) stillPending.push(asset);
    });
    pending = stillPending;

    if (pending.length === 0 || opts.now() + opts.intervalMs > deadline) break;
    await opts.sleep(opts.intervalMs);
  }
  return results;
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
  /** Verifies every distinct asset once (under one shared deadline) and returns a verdict per `newPath`. */
  verifyAll: (assets: AssetRef[]) => Promise<Map<string, AssetCheck>>;
  client: RelinkClient;
  /** Verify everything but write nothing. */
  verifyOnly?: boolean;
}

/**
 * Validates the whole plan first (nothing is verified or written if any entry is out of
 * bounds), verifies all assets, then relinks only the entries whose own asset passed. An
 * unverified entry is left untouched, which keeps its Storage URL live.
 */
export async function relinkPlan(plan: RelinkPlan, opts: RelinkOptions): Promise<RelinkResult[]> {
  const valid = validatePlan(plan);

  const assets = new Map<string, AssetRef>();
  for (const entry of valid.entries) if (!assets.has(entry.newPath)) assets.set(entry.newPath, entry);
  const verdicts = await opts.verifyAll(Array.from(assets.values()));

  const results: RelinkResult[] = [];
  for (const entry of valid.entries) {
    const verdict = verdicts.get(entry.newPath) ?? { ok: false as const, reason: 'not verified' };

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
