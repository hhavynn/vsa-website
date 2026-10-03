#!/usr/bin/env node
/**
 * scripts/migrate-supabase-images-to-public.ts
 *
 * Migrates Supabase Storage public images → /public/images static assets in two
 * phases, so a failed push or deploy can never leave a row pointing at a file
 * that is not being served (#454):
 *
 *   Phase 1  --apply              Download, compress to WebP, write files, and write a
 *                                 relink plan. NEVER touches the database.
 *   (commit + push the files; wait for the production deploy)
 *   Phase 2  --relink <plan>      For each plan entry, confirm the asset is actually
 *                                 served by production (HTTP 200, image content-type,
 *                                 exact byte length), then run a conditional update
 *                                 (WHERE id = ? AND <field> = <expected Storage URL>).
 *                                 Entries that are not served are left on Storage.
 *
 * Dry-run (no flags) is the default and is read-only. Supabase Storage originals are
 * never deleted.
 *
 * Usage:
 *   npm run migrate:images:dry -- --category cabinet --limit 5
 *   npm run migrate:images:apply -- --category cabinet --limit 1        # files + plan only
 *   npm run migrate:images:relink -- --plan scripts/reports/image-relink-plan.json \
 *       --base-url https://www.vsaatucsd.com --verify-only             # read-only check
 *   npm run migrate:images:relink -- --plan <file> --base-url <origin>  # verify, then relink
 *   npm run migrate:images:dry                         # scan all categories
 *   npm run migrate:images:apply -- --overwrite        # rewrite files even if unchanged
 *   npm run migrate:images:dry -- --category events --event-id <uuid>
 *   npm run migrate:images:dry -- --category house-events --house-event-id <uuid>
 *
 * Supported categories: cabinet, events, gallery, houses, home, house-events
 *
 * Flags:
 *   --apply          Write files + relink plan (default: dry run). No DB writes.
 *   --plan-out       Where --apply writes the plan (default scripts/reports/image-relink-plan.json)
 *   --relink         Phase 2: path to a plan written by --apply (alias: --plan)
 *   --base-url       Production origin used to verify assets before relinking
 *   --wait-seconds   How long to keep polling for the deploy (default 600; 0 = single check)
 *   --verify-only    With --relink: verify assets, write nothing
 *   --overwrite      Rewrite output files even when the derived image is identical
 *   --category       Migrate one category only
 *   --limit          Max rows to process
 *   --event-id       Filter to a single event (events category only)
 *   --house-event-id Filter to a single house event (house-events category only)
 *   --force-apply    With --relink: override the CI main-branch guard (use with care)
 *
 * Env (reads from .env.local):
 *   REACT_APP_SUPABASE_URL           required
 *   REACT_APP_SUPABASE_ANON_KEY      required for phase 1 (read access)
 *   SUPABASE_SERVICE_ROLE_KEY        required for --relink (bypasses RLS)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createHash } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import {
  assetUrl,
  createPlan,
  parsePlan,
  relinkPlan,
  summarizeRelink,
  waitForAssets,
  FetchedAsset,
  RelinkClient,
  RelinkEntry,
} from './lib/imageRelink';
import { CATEGORIES, CategoryConfig } from './lib/imageMigrationConfig';

// ─── Env ─────────────────────────────────────────────────────────────────────

function loadEnvLocal(): void {
  const envFile = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envFile)) return;
  for (const raw of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

// ─── Arg parsing ──────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const APPLY = rawArgs.includes('--apply');
const OVERWRITE = rawArgs.includes('--overwrite');

function getArg(flag: string): string | undefined {
  const idx = rawArgs.indexOf(flag);
  return idx !== -1 ? rawArgs[idx + 1] : undefined;
}

const ARG_CATEGORY = getArg('--category');
const ARG_LIMIT = getArg('--limit') ? parseInt(getArg('--limit')!, 10) : undefined;
const ARG_EVENT_ID = getArg('--event-id');
const ARG_HOUSE_EVENT_ID = getArg('--house-event-id');
const ARG_RELINK = getArg('--relink') ?? getArg('--plan');
const ARG_BASE_URL = getArg('--base-url');
const ARG_WAIT_SECONDS = getArg('--wait-seconds') ? parseInt(getArg('--wait-seconds')!, 10) : 600;
const VERIFY_ONLY = rawArgs.includes('--verify-only');
const DEFAULT_PLAN_PATH = path.resolve(process.cwd(), 'scripts', 'reports', 'image-relink-plan.json');
const ARG_PLAN_OUT = getArg('--plan-out') ? path.resolve(process.cwd(), getArg('--plan-out')!) : DEFAULT_PLAN_PATH;

// ─── Types ────────────────────────────────────────────────────────────────────

type MigrationStatus = 'planned' | 'skipped' | 'already_local' | 'error';

interface MigrationRow {
  rowId: string;
  fieldName: string;
  originalUrl: string;
  localPath: string;
  publicPath: string;
  status: MigrationStatus;
  reason?: string;
  error?: string;
}

interface MigrationStats {
  rowsScanned: number;
  rowsWithSupabaseUrl: number;
  alreadyLocal: number;
  imagesDownloaded: number;
  imagesCompressed: number;
  relinksPlanned: number;
  filesUnchanged: number;
  errors: number;
}

interface MigrationReport {
  category: string;
  dryRun: boolean;
  overwrite: boolean;
  limit: number | 'none';
  timestamp: string;
  stats: MigrationStats;
  rows: MigrationRow[];
  plan: RelinkEntry[];
}

// ─── Category definitions ─────────────────────────────────────────────────────
// Shared with scripts/audit-storage-backed-content.ts so the two cannot drift.

// ─── Utilities ────────────────────────────────────────────────────────────────

const SUPABASE_STORAGE_RE = /supabase\.co\/storage\/v1\/object\/public\//;

function isSupabaseStorageUrl(url: string): boolean {
  return SUPABASE_STORAGE_RE.test(url);
}

function log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const prefix =
    level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '';
  const reset = prefix ? '\x1b[0m' : '';
  process.stdout.write(`${prefix}${msg}${reset}\n`);
}

function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https://') ? https : http;
    const req = mod.get(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        downloadBuffer(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: unknown) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)),
      );
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

function fileMatches(filePath: string, contents: Buffer): boolean {
  return fs.existsSync(filePath) && fs.readFileSync(filePath).equals(contents);
}

async function compressToWebP(
  buffer: Buffer,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<Buffer> {
  return sharp(buffer)
    .rotate()  // auto-correct EXIF orientation before any processing
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

// ─── Migration logic ──────────────────────────────────────────────────────────

async function migrateCategory(
  supabase: SupabaseClient,
  categoryName: string,
  config: CategoryConfig,
): Promise<MigrationReport> {
  const dryRun = !APPLY;
  const limit = ARG_LIMIT;

  const stats: MigrationStats = {
    rowsScanned: 0,
    rowsWithSupabaseUrl: 0,
    alreadyLocal: 0,
    imagesDownloaded: 0,
    imagesCompressed: 0,
    relinksPlanned: 0,
    filesUnchanged: 0,
    errors: 0,
  };
  const rows: MigrationRow[] = [];
  const plan: RelinkEntry[] = [];

  log(`\n─── ${categoryName} [${dryRun ? 'DRY RUN' : 'APPLY'}] ───`);
  log(`  Table:  ${config.table}`);
  log(`  Output: ${config.outputDir}`);
  if (limit) log(`  Limit:  ${limit}`);

  // Fetch rows from DB
  let query = supabase.from(config.table).select(config.select);

  // Apply ID filters
  if (ARG_EVENT_ID && categoryName === 'events') {
    query = (query as ReturnType<typeof supabase.from>).eq('id', ARG_EVENT_ID);
    log(`  Event ID filter: ${ARG_EVENT_ID}`);
  } else if (ARG_HOUSE_EVENT_ID && categoryName === 'house-events') {
    query = (query as ReturnType<typeof supabase.from>).eq('id', ARG_HOUSE_EVENT_ID);
    log(`  House Event ID filter: ${ARG_HOUSE_EVENT_ID}`);
  }

  if (limit) query = (query as ReturnType<typeof supabase.from>).limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`DB fetch failed for ${config.table}: ${error.message}`);

  const dbRows = (data ?? []) as Record<string, unknown>[];
  stats.rowsScanned = dbRows.length;
  log(`  Rows fetched: ${dbRows.length}`);

  // Create output dir (safe side-effect even in dry-run — no DB writes)
  if (!dryRun) {
    fs.mkdirSync(path.resolve(process.cwd(), config.outputDir), { recursive: true });
  }

  for (const row of dbRows) {
    const rowId = String(row['id'] ?? 'unknown');
    const slug = config.getSlug(row);

    for (const field of config.imageFields) {
      const rawUrl = row[field.name];
      if (!rawUrl || typeof rawUrl !== 'string') continue;

      // Already migrated / already a local path
      if (!isSupabaseStorageUrl(rawUrl)) {
        if (rawUrl.startsWith('/')) {
          stats.alreadyLocal++;
          rows.push({
            rowId,
            fieldName: field.name,
            originalUrl: rawUrl,
            localPath: '',
            publicPath: rawUrl,
            status: 'already_local',
            reason: 'Already a local path',
          });
        }
        // Silently skip external non-Supabase URLs (VCN poster, etc.)
        continue;
      }

      stats.rowsWithSupabaseUrl++;

      const filename = `${slug}${field.suffix}.webp`;
      let outputRelative = `${config.outputDir}/${filename}`;
      let outputAbsolute = path.resolve(process.cwd(), outputRelative);
      // /images/cabinet/name.webp (strips the leading "public")
      let publicPath = '/' + outputRelative.replace(/^public\//, '');

      // ── DRY RUN ──────────────────────────────────────────────────────────
      if (dryRun) {
        const alreadyExists = fs.existsSync(outputAbsolute);
        rows.push({
          rowId,
          fieldName: field.name,
          originalUrl: rawUrl,
          localPath: outputAbsolute,
          publicPath,
          status: 'planned',
          reason: alreadyExists
            ? 'File exists: would re-derive; reuse if identical, otherwise save under a content-addressed name. Row is relinked later by --relink.'
            : 'Would download + compress → write file + relink plan entry (DB untouched until --relink)',
        });
        log(
          `  [DRY] ${rowId.slice(0, 8)} ${field.name}: ${rawUrl.slice(-50)} → ${publicPath}` +
            (alreadyExists ? ' (file exists: reuse if identical, else new hashed name)' : ''),
        );
        continue;
      }

      // ── APPLY ────────────────────────────────────────────────────────────

      // A row that still points at Storage is always processed, even when the
      // output file already exists (#436). Skipping it left rows stranded on
      // Storage forever when a stale admin save restored the Storage URL after
      // an earlier run. The file is only rewritten when the image differs, so
      // a re-uploaded picture under the same slug replaces the old one, and
      // an unchanged one produces no git diff.

      // Download
      let imageBuffer: Buffer;
      try {
        imageBuffer = await downloadBuffer(rawUrl);
        stats.imagesDownloaded++;
      } catch (err) {
        stats.errors++;
        const msg = err instanceof Error ? err.message : String(err);
        rows.push({
          rowId,
          fieldName: field.name,
          originalUrl: rawUrl,
          localPath: outputAbsolute,
          publicPath,
          status: 'error',
          error: `Download failed: ${msg}`,
        });
        log(`  ERROR download ${rowId.slice(0, 8)} ${field.name}: ${msg}`, 'error');
        continue;
      }

      // Compress → WebP
      let webpBuffer: Buffer;
      try {
        webpBuffer = await compressToWebP(
          imageBuffer,
          config.maxWidth,
          config.maxHeight,
          config.quality,
        );
        stats.imagesCompressed++;
      } catch (err) {
        stats.errors++;
        const msg = err instanceof Error ? err.message : String(err);
        rows.push({
          rowId,
          fieldName: field.name,
          originalUrl: rawUrl,
          localPath: outputAbsolute,
          publicPath,
          status: 'error',
          error: `Compression failed: ${msg}`,
        });
        log(`  ERROR compress ${rowId.slice(0, 8)} ${field.name}: ${msg}`, 'error');
        continue;
      }

      // Write file — do this before the DB update so we never update DB
      // without a corresponding local file.
      if (!OVERWRITE && fs.existsSync(outputAbsolute) && !fileMatches(outputAbsolute, webpBuffer)) {
        // A different picture already lives at this name: another row with the
        // same name and date, or an earlier upload for this row that may still
        // be deployed and linked. Never overwrite it; give this image a
        // content-addressed name instead.
        const hash = createHash('sha256').update(webpBuffer).digest('hex').slice(0, 8);
        outputRelative = `${config.outputDir}/${slug}_${hash}${field.suffix}.webp`;
        outputAbsolute = path.resolve(process.cwd(), outputRelative);
        publicPath = '/' + outputRelative.replace(/^public\//, '');
        log(`  NAME TAKEN by a different image; using ${outputRelative}`);
      }

      if (!OVERWRITE && fileMatches(outputAbsolute, webpBuffer)) {
        stats.filesUnchanged++;
        log(`  UNCHANGED ${outputAbsolute} (file matches; plan entry only)`);
      } else {
        fs.mkdirSync(path.dirname(outputAbsolute), { recursive: true });
        fs.writeFileSync(outputAbsolute, webpBuffer);
        const kb = (webpBuffer.length / 1024).toFixed(1);
        log(`  SAVED ${outputAbsolute} (${kb} KB)`);
      }

      // Record the relink instead of doing it. The DB keeps its working Storage URL
      // until --relink has confirmed this file is being served by production.
      // Rows already on Storage are always planned, even when the file is
      // unchanged, so a run whose relink failed is retried by the next run (#436).
      plan.push({
        category: categoryName,
        table: config.table,
        rowId,
        field: field.name,
        expectedUrl: rawUrl,
        newPath: publicPath,
        filePath: outputRelative,
        bytes: webpBuffer.length,
        sha256: createHash('sha256').update(webpBuffer).digest('hex'),
      });
      stats.relinksPlanned++;
      rows.push({
        rowId,
        fieldName: field.name,
        originalUrl: rawUrl,
        localPath: outputAbsolute,
        publicPath,
        status: 'planned',
      });
      log(`  PLANNED ${rowId.slice(0, 8)} ${field.name} → ${publicPath} (DB unchanged)`);
    }
  }

  log(`\n  Stats:`);
  log(`    rows scanned:          ${stats.rowsScanned}`);
  log(`    with Supabase URL:     ${stats.rowsWithSupabaseUrl}`);
  log(`    already local:         ${stats.alreadyLocal}`);
  log(`    unchanged files:       ${stats.filesUnchanged}`);
  log(`    images downloaded:     ${stats.imagesDownloaded}`);
  log(`    images compressed:     ${stats.imagesCompressed}`);
  log(`    relinks planned:       ${stats.relinksPlanned} (DB not modified)`);
  log(`    errors:                ${stats.errors}`);

  return {
    category: categoryName,
    dryRun,
    overwrite: OVERWRITE,
    limit: limit ?? 'none',
    timestamp: new Date().toISOString(),
    stats,
    rows,
    plan,
  };
}

// ─── Phase 2: verify deployed assets, then relink ─────────────────────────────

function fetchAsset(url: string): Promise<FetchedAsset> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https://') ? https : http;
    const req = mod.get(url, { headers: { 'cache-control': 'no-cache' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: unknown) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)),
      );
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          contentType: (res.headers['content-type'] as string | undefined) ?? null,
          body: new Uint8Array(Buffer.concat(chunks)),
        }),
      );
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function runRelink(planPath: string): Promise<void> {
  const supabaseUrl = process.env['REACT_APP_SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!ARG_BASE_URL) {
    log('ERROR: --relink needs --base-url <production origin> so assets can be verified first.', 'error');
    process.exit(1);
  }
  if (!VERIFY_ONLY && (!supabaseUrl || !serviceKey)) {
    log('ERROR: --relink needs REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or pass --verify-only).', 'error');
    process.exit(1);
  }

  // Relinking is the step that changes what production serves. In CI only main
  // may do it, because only main's files are what --base-url is serving.
  if (!VERIFY_ONLY && !rawArgs.includes('--force-apply')) {
    const githubRef = process.env['GITHUB_REF'];
    const isCI = Boolean(process.env['CI'] || process.env['GITHUB_ACTIONS']);
    if (isCI && githubRef && githubRef !== 'refs/heads/main') {
      log(
        `ERROR: --relink is only allowed on the main branch in CI (current ref: ${githubRef}).\n` +
          `  Pass --verify-only to check assets without writing, or --force-apply to override.`,
        'error',
      );
      process.exit(1);
    }
  }

  const plan = parsePlan(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), planPath), 'utf-8')));
  log(`\nRelink plan: ${plan.entries.length} entr${plan.entries.length === 1 ? 'y' : 'ies'} (generated ${plan.generatedAt})`);
  log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY — no DB writes' : 'VERIFY, THEN RELINK'}`);
  log(
    `Verifying all assets against ${ARG_BASE_URL}; one shared deadline of ${Math.max(0, ARG_WAIT_SECONDS)}s for the whole run ` +
      `(not per asset). Each asset must pass on its own before its rows are relinked.\n`,
  );

  const client: RelinkClient = (() => {
    if (VERIFY_ONLY) {
      return {
        conditionalUpdate: async () => {
          throw new Error('verify-only mode must not write');
        },
      };
    }
    const supabase = createClient(supabaseUrl!, serviceKey!);
    return {
      async conditionalUpdate(entry) {
        const { data, error } = await supabase
          .from(entry.table)
          .update({ [entry.field]: entry.newPath })
          .eq('id', entry.rowId)
          .eq(entry.field, entry.expectedUrl)
          .select('id');
        if (error) return { error: error.message };
        return (data ?? []).length === 0 ? 'row_changed' : 'updated';
      },
    };
  })();

  const results = await relinkPlan(plan, {
    verifyOnly: VERIFY_ONLY,
    client,
    verifyAll: async (assets) => {
      const checks = await waitForAssets(assets, {
        baseUrl: ARG_BASE_URL,
        fetchAsset,
        timeoutMs: Math.max(0, ARG_WAIT_SECONDS) * 1000,
        intervalMs: 15_000,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: Date.now,
      });
      for (const asset of assets) {
        const check = checks.get(asset.newPath);
        log(
          check?.ok
            ? `  SERVED   ${assetUrl(ARG_BASE_URL, asset.newPath)}`
            : `  MISSING  ${assetUrl(ARG_BASE_URL, asset.newPath)} — ${check && !check.ok ? check.reason : 'not checked'}`,
          check?.ok ? 'info' : 'warn',
        );
      }
      return checks;
    },
  });

  for (const r of results) {
    const tag = `${r.entry.table}.${r.entry.field} ${r.entry.rowId.slice(0, 8)}`;
    if (r.outcome === 'relinked') log(`  RELINKED ${tag} → ${r.entry.newPath}`);
    else if (r.outcome === 'would_relink') log(`  OK       ${tag} → ${r.entry.newPath} (verify-only)`);
    else log(`  NOT RELINKED ${tag}: ${r.outcome}${r.detail ? ` (${r.detail})` : ''}`, 'warn');
  }

  const summary = summarizeRelink(results);
  log(`\nRelink summary: ${JSON.stringify(summary)}`);
  // Anything not relinked keeps its working Storage URL and is picked up by the next
  // run. Only a genuine DB error fails the job; "not served yet" is reported loudly
  // through the exit code too, so a deploy that never landed is not silent.
  if (summary.error > 0 || summary.not_served > 0) process.exit(1);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (ARG_RELINK) {
    log('\nSupabase Storage → /public/images relink (phase 2)');
    await runRelink(ARG_RELINK);
    return;
  }

  log('\nSupabase Storage → /public/images migration (phase 1: files + relink plan)');
  log(`Mode: ${APPLY ? 'APPLY — writes files and a relink plan; the database is NOT modified' : 'DRY RUN — read-only, no changes'}`);
  if (!APPLY) log('Pass --apply to write files and a relink plan.\n');

  const supabaseUrl = process.env['REACT_APP_SUPABASE_URL'];
  const supabaseKey =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
    process.env['REACT_APP_SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    log(
      'ERROR: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY must be set in .env.local',
      'error',
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (ARG_CATEGORY && !(ARG_CATEGORY in CATEGORIES)) {
    log(
      `ERROR: Unknown category "${ARG_CATEGORY}". Valid: ${Object.keys(CATEGORIES).join(', ')}`,
      'error',
    );
    process.exit(1);
  }

  const toRun = ARG_CATEGORY ? [ARG_CATEGORY] : Object.keys(CATEGORIES);
  const reports: MigrationReport[] = [];
  let failedCategories = 0;

  for (const cat of toRun) {
    try {
      const report = await migrateCategory(supabase, cat, CATEGORIES[cat]);
      reports.push(report);
    } catch (err) {
      failedCategories++;
      log(`FATAL error in category "${cat}": ${err}`, 'error');
    }
  }

  // Write JSON report
  const reportDir = path.resolve(process.cwd(), 'scripts', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportFile = path.join(
    reportDir,
    `image-migration-${ARG_CATEGORY ?? 'all'}-${stamp}.json`,
  );
  fs.writeFileSync(reportFile, JSON.stringify(reports, null, 2));
  log(`\nReport: ${reportFile}`);

  // Relink plan: consumed by `--relink` after the files are committed and deployed.
  if (APPLY) {
    const entries = reports.flatMap((r) => r.plan);
    fs.mkdirSync(path.dirname(ARG_PLAN_OUT), { recursive: true });
    fs.writeFileSync(ARG_PLAN_OUT, JSON.stringify(createPlan(entries), null, 2));
    log(`Relink plan (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}): ${ARG_PLAN_OUT}`);
    log('Next: commit + push the files, wait for the deploy, then run --relink with --base-url.');
  }

  // Grand totals
  const totalErrors = reports.reduce((s, r) => s + r.stats.errors, 0) + failedCategories;
  const totalPlanned = reports.reduce((s, r) => s + r.stats.relinksPlanned, 0);
  log(
    `\nDone. ${totalPlanned} relink${totalPlanned === 1 ? '' : 's'} planned, ${totalErrors} error(s). Database not modified.${totalErrors > 0 ? ' See report for details.' : ''}`,
  );
  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  log(`Unhandled error: ${err}`, 'error');
  process.exit(1);
});
