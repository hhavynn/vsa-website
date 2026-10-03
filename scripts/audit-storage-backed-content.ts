#!/usr/bin/env node
/**
 * scripts/audit-storage-backed-content.ts
 *
 * READ-ONLY audit of which public content still points at Supabase Storage
 * (every view of it is Supabase egress) versus Vercel-served `/images/...`.
 * Issues: egress #299 / #303. Never writes to the database, never touches
 * Storage, never downloads an image, never deletes anything.
 *
 * Usage:
 *   npm run audit:storage-content                         # scan every image column
 *   npm run audit:storage-content -- --json audit.json    # also write machine output
 *   npm run audit:storage-content -- --fail-on-remaining  # exit 1 if any Storage URL remains
 *   npm run audit:storage-content -- --service-role       # also read rows RLS hides from anon
 *   npm run audit:storage-content -- --local-assets       # OFFLINE: measure public/images, no network
 *
 * Flags:
 *   --json <file>        Write the full result as JSON (URLs have query strings stripped).
 *   --fail-on-remaining  Exit 1 when Storage-backed URLs remain, 2 when a table could not be read
 *                        (so the audit is incomplete). Default exit code is 0.
 *   --service-role       Use SUPABASE_SERVICE_ROLE_KEY and read the raw tables, which includes
 *                        drafts and admin-only rows. Without it the audit sees exactly what an
 *                        anonymous visitor sees, which is what generates public egress.
 *   --local-assets       Walk public/images and report bytes per category dir, the largest files,
 *                        and full vs `_thumb` totals. Needs no env and makes no network call.
 *   --help               Print this header.
 *
 * Env (reads .env.local, same loader as the migrate script):
 *   REACT_APP_SUPABASE_URL        required for the remote audit
 *   REACT_APP_SUPABASE_ANON_KEY   required for the remote audit
 *   SUPABASE_SERVICE_ROLE_KEY     only with --service-role; never required
 *
 * Pure classify/summarize logic: src/lib/storageContentAudit.ts (Jest-tested).
 * Migration file naming: scripts/lib/imageMigrationConfig.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  AUDIT_TARGETS,
  AuditObservation,
  AuditSummary,
  AuditTarget,
  LocalAssetFile,
  MigratedFileLookup,
  StorageBackedRow,
  extractObservations,
  findMigratedFiles,
  renderAuditSummary,
  renderLocalAssetSummary,
  renderTable,
  summarizeLocalAssets,
  summarizeObservations,
} from '../src/lib/storageContentAudit';
import { CATEGORIES } from './lib/imageMigrationConfig';

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

// ─── Args ────────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const FAIL_ON_REMAINING = rawArgs.includes('--fail-on-remaining');
const USE_SERVICE_ROLE = rawArgs.includes('--service-role');
const LOCAL_ASSETS = rawArgs.includes('--local-assets');
const HELP = rawArgs.includes('--help') || rawArgs.includes('-h');

function getArg(flag: string): string | undefined {
  const idx = rawArgs.indexOf(flag);
  if (idx === -1) return undefined;
  const value = rawArgs[idx + 1];
  if (!value || value.startsWith('--')) {
    log(`ERROR: ${flag} needs a value`, 'error');
    process.exit(1);
  }
  return value;
}

const KNOWN_FLAGS = ['--json', '--fail-on-remaining', '--service-role', '--local-assets', '--help', '-h'];

function log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const prefix = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '';
  const reset = prefix ? '\x1b[0m' : '';
  process.stdout.write(`${prefix}${msg}${reset}\n`);
}

// ─── Local assets (offline) ──────────────────────────────────────────────────

function walkFiles(dir: string, root: string, out: LocalAssetFile[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, root, out);
    } else if (entry.isFile() && entry.name !== 'desktop.ini' && entry.name !== '.DS_Store') {
      out.push({
        path: path.relative(root, full).split(path.sep).join('/'),
        bytes: fs.statSync(full).size,
      });
    }
  }
}

function runLocalAssets(jsonFile: string | undefined): void {
  const root = path.resolve(process.cwd(), 'public', 'images');
  if (!fs.existsSync(root)) {
    log(`ERROR: ${root} does not exist. Run from the repo root.`, 'error');
    process.exit(1);
  }
  const files: LocalAssetFile[] = [];
  walkFiles(root, root, files);
  const summary = summarizeLocalAssets(files, 15);
  log('\nLocal asset measurement (OFFLINE, no network)\n');
  log(renderLocalAssetSummary(summary));
  if (jsonFile) {
    fs.mkdirSync(path.dirname(path.resolve(jsonFile)), { recursive: true });
    fs.writeFileSync(
      path.resolve(jsonFile),
      JSON.stringify({ mode: 'local-assets', timestamp: new Date().toISOString(), summary }, null, 2),
    );
    log(`\nJSON: ${path.resolve(jsonFile)}`);
  }
}

// ─── Remote audit (read-only selects) ────────────────────────────────────────

interface TargetResult {
  table: string;
  source: string | null;
  status: 'ok' | 'skipped' | 'error';
  rowsFetched: number;
  message?: string;
}

interface StorageBackedReport extends Omit<StorageBackedRow, 'context'> {
  /** Present when the migrate script has a category for this column. */
  migrated?: {
    expectedPath: string;
    committed: boolean;
    hashedVariants: string[];
  } | null;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

/** Columns to select: id + the audited columns + whatever the migrate slug needs. */
function selectFor(target: AuditTarget): string {
  const cols: string[] = [target.idColumn];
  target.columns.forEach((c) => cols.push(c.name));
  if (target.migrationCategory) {
    CATEGORIES[target.migrationCategory].select
      .split(',')
      .map((c) => c.trim())
      .forEach((c) => cols.push(c));
  }
  return cols.filter((c, i) => cols.indexOf(c) === i).join(', ');
}

function dirListing(outputDir: string, cache: Record<string, string[]>): string[] {
  if (!cache[outputDir]) {
    const abs = path.resolve(process.cwd(), outputDir);
    cache[outputDir] = fs.existsSync(abs) ? fs.readdirSync(abs) : [];
  }
  return cache[outputDir];
}

function lookupMigrated(
  target: AuditTarget,
  row: Record<string, unknown>,
  columnName: string,
  cache: Record<string, string[]>,
): StorageBackedReport['migrated'] {
  if (!target.migrationCategory) return null;
  const config = CATEGORIES[target.migrationCategory];
  const field = config.imageFields.filter((f) => f.name === columnName)[0];
  if (!field) return null; // e.g. gallery_events.images[] has no migration target
  const found: MigratedFileLookup = findMigratedFiles(
    dirListing(config.outputDir, cache),
    config.getSlug(row),
    field.suffix,
  );
  return {
    expectedPath: `${config.outputDir}/${found.expectedName}`,
    committed: found.exists,
    hashedVariants: found.hashedVariants,
  };
}

async function runRemote(jsonFile: string | undefined): Promise<number> {
  const supabaseUrl = process.env['REACT_APP_SUPABASE_URL'];
  const anonKey = process.env['REACT_APP_SUPABASE_ANON_KEY'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !anonKey) {
    log('ERROR: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY must be set in .env.local', 'error');
    log('       (or run with --local-assets for the offline measurement).', 'error');
    return 1;
  }
  if (USE_SERVICE_ROLE && !serviceKey) {
    log('ERROR: --service-role needs SUPABASE_SERVICE_ROLE_KEY in .env.local', 'error');
    return 1;
  }

  const key = USE_SERVICE_ROLE ? (serviceKey as string) : anonKey;
  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let supabaseHost = '';
  try {
    supabaseHost = new URL(supabaseUrl).hostname;
  } catch {
    log('WARN: REACT_APP_SUPABASE_URL is not a valid URL; only *.supabase.co is recognised as Storage.', 'warn');
  }

  log('\nStorage-backed content audit (READ-ONLY: select queries only)');
  log(`Reading as: ${USE_SERVICE_ROLE ? 'service role (raw tables; drafts and admin-only rows included)' : 'anon (what a visitor can see)'}\n`);

  const observations: AuditObservation[] = [];
  const results: TargetResult[] = [];
  const listingCache: Record<string, string[]> = {};

  for (const target of AUDIT_TARGETS) {
    const source = USE_SERVICE_ROLE ? target.table : target.publicSource;
    const label = `${target.table}.${target.columns.map((c) => c.name).join('/')}`;
    if (!source) {
      results.push({ table: target.table, source: null, status: 'skipped', rowsFetched: 0, message: target.note });
      log(`  SKIP  ${label}: not readable as anon (needs --service-role)`);
      continue;
    }

    const rows: Record<string, unknown>[] = [];
    let failure: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase
        .from(source)
        .select(selectFor(target))
        .order(target.idColumn, { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) {
        failure = error.message;
        break;
      }
      const batch = (data ?? []) as unknown as Record<string, unknown>[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      if (page === MAX_PAGES - 1) failure = `stopped after ${MAX_PAGES * PAGE_SIZE} rows`;
    }

    if (failure) {
      results.push({ table: target.table, source, status: 'error', rowsFetched: rows.length, message: failure });
      log(`  ERROR ${label} (${source}): ${failure}`, 'error');
      if (!rows.length) continue;
    } else {
      results.push({ table: target.table, source, status: 'ok', rowsFetched: rows.length });
      log(`  ok    ${label} (${source}): ${rows.length} rows`);
    }

    for (const row of rows) {
      for (const obs of extractObservations(target, row)) {
        const columnName = obs.column.replace(/\[\]$/, '');
        // Only a Storage URL needs the committed-file lookup; null means "no migration target".
        const isStorage = /\/storage\/v1\//.test(obs.url);
        observations.push(
          isStorage ? { ...obs, context: lookupMigrated(target, row, columnName, listingCache) } : obs,
        );
      }
    }
  }

  const summary: AuditSummary = summarizeObservations(observations, { supabaseHost });
  const storageBacked: StorageBackedReport[] = summary.storageBacked.map((item) => {
    const { context, ...rest } = item;
    return { ...rest, migrated: (context ?? null) as StorageBackedReport['migrated'] };
  });

  log('\n' + renderAuditSummary(summary));

  log(`\nStorage-backed rows: ${storageBacked.length}`);
  if (storageBacked.length) {
    log(
      renderTable(
        ['table.column', 'row id', 'bucket', 'committed file at migrated name', 'url'],
        storageBacked.map((r) => [
          `${r.table}.${r.column}`,
          r.rowId,
          r.bucket,
          !r.migrated
            ? 'n/a (no migration category)'
            : r.migrated.committed
              ? `yes: ${r.migrated.expectedPath}`
              : r.migrated.hashedVariants.length
                ? `no (hashed variant exists: ${r.migrated.hashedVariants.join(', ')})`
                : `no: ${r.migrated.expectedPath}`,
          r.url,
        ]),
      ),
    );
    log(
      '\nA "yes" row only needs the relink step; a "no" row needs a migration run first.\n' +
        'Storage originals are never deleted by this audit or the migration.',
    );
  }

  const unreadable = results.filter((r) => r.status === 'error');
  const skipped = results.filter((r) => r.status === 'skipped');
  if (unreadable.length) {
    log(`\nWARN: ${unreadable.length} table(s) could not be read; the audit is incomplete:`, 'warn');
    unreadable.forEach((r) => log(`  ${r.table} (${r.source}): ${r.message}`, 'warn'));
  }
  if (skipped.length) {
    log(`\nNote: ${skipped.length} table(s) skipped because anon cannot read them: ${skipped.map((r) => r.table).join(', ')}.`);
  }

  if (jsonFile) {
    const out = path.resolve(jsonFile);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      JSON.stringify(
        {
          mode: 'remote',
          timestamp: new Date().toISOString(),
          readAs: USE_SERVICE_ROLE ? 'service-role' : 'anon',
          targets: results,
          summary: { ...summary, storageBacked },
        },
        null,
        2,
      ),
    );
    log(`\nJSON: ${out}`);
  }

  if (FAIL_ON_REMAINING) {
    if (storageBacked.length) {
      log(`\n--fail-on-remaining: ${storageBacked.length} Storage-backed URL(s) remain.`, 'error');
      return 1;
    }
    if (unreadable.length) {
      log('\n--fail-on-remaining: no Storage URLs found, but the audit was incomplete.', 'error');
      return 2;
    }
  }
  return 0;
}

// ─── Entry ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (HELP) {
    const header = fs.readFileSync(__filename, 'utf-8').split('*/')[0];
    log(header.replace(/^#!.*\n/, '').replace(/^\/\*\*\n|^ \* ?/gm, ''));
    return;
  }

  const unknown = rawArgs.filter((a) => a.startsWith('-') && KNOWN_FLAGS.indexOf(a) === -1);
  if (unknown.length) {
    log(`ERROR: unknown flag(s): ${unknown.join(', ')}. Try --help.`, 'error');
    process.exit(1);
  }

  const jsonFile = getArg('--json');
  if (LOCAL_ASSETS) {
    runLocalAssets(jsonFile);
    return;
  }
  process.exit(await runRemote(jsonFile));
}

main().catch((err) => {
  log(`Unhandled error: ${err}`, 'error');
  process.exit(1);
});
