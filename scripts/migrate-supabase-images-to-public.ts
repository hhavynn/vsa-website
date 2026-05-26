#!/usr/bin/env node
/**
 * scripts/migrate-supabase-images-to-public.ts
 *
 * Migrates Supabase Storage public images → /public/images static assets.
 * All images are compressed to WebP. Database URL fields are updated only
 * when --apply is passed. Dry-run is the default (read-only, zero writes).
 *
 * Usage:
 *   npm run migrate:images:dry -- --category cabinet --limit 5
 *   npm run migrate:images:apply -- --category cabinet --limit 1
 *   npm run migrate:images:dry                         # scan all categories
 *   npm run migrate:images:apply -- --overwrite        # re-download existing
 *
 * Supported categories: cabinet, events, gallery, houses, home
 *
 * Env (reads from .env.local):
 *   REACT_APP_SUPABASE_URL           required
 *   REACT_APP_SUPABASE_ANON_KEY      required (read access)
 *   SUPABASE_SERVICE_ROLE_KEY        recommended for --apply (bypasses RLS)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

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

// ─── Types ────────────────────────────────────────────────────────────────────

type MigrationStatus = 'migrated' | 'skipped' | 'already_local' | 'error';

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
  dbRowsUpdated: number;
  skipped: number;
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
}

// ─── Category definitions ─────────────────────────────────────────────────────

interface ImageField {
  name: string;
  suffix: string;
}

interface CategoryConfig {
  table: string;
  select: string;
  imageFields: ImageField[];
  getSlug: (row: Record<string, unknown>) => string;
  outputDir: string;
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function idSuffix(row: Record<string, unknown>): string {
  return String(row['id'] ?? '').slice(0, 8);
}

const CATEGORIES: Record<string, CategoryConfig> = {
  cabinet: {
    table: 'cabinet_members',
    select: 'id, name, image_url, thumbnail_url',
    imageFields: [
      { name: 'image_url', suffix: '' },
      { name: 'thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => {
      const name = row['name'] ? slugify(String(row['name'])) : '';
      return name ? `${name}_${idSuffix(row)}` : idSuffix(row);
    },
    outputDir: 'public/images/cabinet',
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
  },

  events: {
    table: 'events',
    select: 'id, name, date, image_url, thumbnail_url',
    imageFields: [
      { name: 'image_url', suffix: '' },
      { name: 'thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => {
      const name = row['name'] ? slugify(String(row['name'])) : '';
      const date = row['date'] ? String(row['date']).slice(0, 10) : '';
      if (name && date) return `${name}_${date}`;
      if (name) return `${name}_${idSuffix(row)}`;
      return idSuffix(row);
    },
    outputDir: 'public/images/events',
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },

  gallery: {
    table: 'gallery_events',
    select: 'id, title, date, cover_image_url, cover_thumbnail_url',
    imageFields: [
      { name: 'cover_image_url', suffix: '' },
      { name: 'cover_thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => {
      const title = row['title'] ? slugify(String(row['title'])) : '';
      const date = row['date'] ? String(row['date']).slice(0, 10) : '';
      if (title && date) return `${title}_${date}`;
      if (title) return `${title}_${idSuffix(row)}`;
      return idSuffix(row);
    },
    outputDir: 'public/images/gallery',
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },

  houses: {
    table: 'house_page_assets',
    select: 'id, house, academic_year_start, image_url, image_thumbnail_url, cover_image_url',
    imageFields: [
      { name: 'image_url', suffix: '' },
      { name: 'image_thumbnail_url', suffix: '_thumb' },
      { name: 'cover_image_url', suffix: '_cover' },
    ],
    getSlug: (row) => {
      const year = row['academic_year_start'] ? String(row['academic_year_start']) : 'unknown';
      const house = row['house'] ? slugify(String(row['house'])) : idSuffix(row);
      return `${year}_${house}`;
    },
    outputDir: 'public/images/houses',
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },

  home: {
    table: 'homepage_content',
    select: 'id, presidents_photo_url, presidents_photo_thumbnail_url',
    imageFields: [
      { name: 'presidents_photo_url', suffix: '' },
      { name: 'presidents_photo_thumbnail_url', suffix: '_thumb' },
    ],
    getSlug: (row) => `presidents_${idSuffix(row)}`,
    outputDir: 'public/images/home',
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
  },
};

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
    dbRowsUpdated: 0,
    skipped: 0,
    errors: 0,
  };
  const rows: MigrationRow[] = [];

  log(`\n─── ${categoryName} [${dryRun ? 'DRY RUN' : 'APPLY'}] ───`);
  log(`  Table:  ${config.table}`);
  log(`  Output: ${config.outputDir}`);
  if (limit) log(`  Limit:  ${limit}`);

  // Fetch rows from DB
  let query = supabase.from(config.table).select(config.select);
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
      const outputRelative = `${config.outputDir}/${filename}`;
      const outputAbsolute = path.resolve(process.cwd(), outputRelative);
      // /images/cabinet/name.webp (strips the leading "public")
      const publicPath = '/' + outputRelative.replace(/^public\//, '');

      // ── DRY RUN ──────────────────────────────────────────────────────────
      if (dryRun) {
        const alreadyExists = fs.existsSync(outputAbsolute);
        const wouldSkip = alreadyExists && !OVERWRITE;
        if (wouldSkip) stats.skipped++;
        rows.push({
          rowId,
          fieldName: field.name,
          originalUrl: rawUrl,
          localPath: outputAbsolute,
          publicPath,
          status: wouldSkip ? 'skipped' : 'migrated',
          reason: wouldSkip
            ? 'File exists; pass --overwrite to replace'
            : 'Would download + compress → update DB',
        });
        log(
          `  [DRY] ${rowId.slice(0, 8)} ${field.name}: ${rawUrl.slice(-50)} → ${publicPath}` +
            (wouldSkip ? ' (SKIP: exists)' : ''),
        );
        continue;
      }

      // ── APPLY ────────────────────────────────────────────────────────────

      // Skip if file exists and --overwrite not set
      if (fs.existsSync(outputAbsolute) && !OVERWRITE) {
        stats.skipped++;
        rows.push({
          rowId,
          fieldName: field.name,
          originalUrl: rawUrl,
          localPath: outputAbsolute,
          publicPath,
          status: 'skipped',
          reason: 'File exists; pass --overwrite to replace',
        });
        log(`  SKIP ${rowId.slice(0, 8)} ${field.name}: file exists`);
        continue;
      }

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
      fs.mkdirSync(path.dirname(outputAbsolute), { recursive: true });
      fs.writeFileSync(outputAbsolute, webpBuffer);
      const kb = (webpBuffer.length / 1024).toFixed(1);
      log(`  SAVED ${outputAbsolute} (${kb} KB)`);

      // Update DB
      try {
        const { error: updateError } = await supabase
          .from(config.table)
          .update({ [field.name]: publicPath })
          .eq('id', rowId);

        if (updateError) {
          stats.errors++;
          rows.push({
            rowId,
            fieldName: field.name,
            originalUrl: rawUrl,
            localPath: outputAbsolute,
            publicPath,
            status: 'error',
            error: `DB update failed: ${updateError.message} — local file kept, DB not updated`,
          });
          log(
            `  ERROR db-update ${rowId.slice(0, 8)} ${field.name}: ${updateError.message}`,
            'error',
          );
        } else {
          stats.dbRowsUpdated++;
          rows.push({
            rowId,
            fieldName: field.name,
            originalUrl: rawUrl,
            localPath: outputAbsolute,
            publicPath,
            status: 'migrated',
          });
          log(`  UPDATED DB ${rowId.slice(0, 8)} ${field.name} → ${publicPath}`);
        }
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
          error: `DB update threw: ${msg} — local file kept, DB not updated`,
        });
        log(`  ERROR db-update ${rowId.slice(0, 8)} ${field.name}: ${msg}`, 'error');
      }
    }
  }

  log(`\n  Stats:`);
  log(`    rows scanned:          ${stats.rowsScanned}`);
  log(`    with Supabase URL:     ${stats.rowsWithSupabaseUrl}`);
  log(`    already local:         ${stats.alreadyLocal}`);
  log(`    skipped (file exists): ${stats.skipped}`);
  log(`    images downloaded:     ${stats.imagesDownloaded}`);
  log(`    images compressed:     ${stats.imagesCompressed}`);
  log(`    DB rows updated:       ${stats.dbRowsUpdated}`);
  log(`    errors:                ${stats.errors}`);

  return {
    category: categoryName,
    dryRun,
    overwrite: OVERWRITE,
    limit: limit ?? 'none',
    timestamp: new Date().toISOString(),
    stats,
    rows,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('\nSupabase Storage → /public/images migration');
  log(`Mode: ${APPLY ? 'APPLY — will write files and update database' : 'DRY RUN — read-only, no changes'}`);
  if (!APPLY) log('Pass --apply to execute changes.\n');

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

  if (APPLY && !process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    log(
      'WARN: --apply without SUPABASE_SERVICE_ROLE_KEY. DB updates may fail due to RLS.' +
        ' Add SUPABASE_SERVICE_ROLE_KEY to .env.local for full write access.\n',
      'warn',
    );
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

  for (const cat of toRun) {
    try {
      const report = await migrateCategory(supabase, cat, CATEGORIES[cat]);
      reports.push(report);
    } catch (err) {
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

  // Grand totals
  const totalErrors = reports.reduce((s, r) => s + r.stats.errors, 0);
  const totalMigrated = reports.reduce((s, r) => s + r.stats.dbRowsUpdated, 0);
  log(
    `\nDone. ${totalMigrated} rows updated, ${totalErrors} error(s).${totalErrors > 0 ? ' See report for details.' : ''}`,
  );
  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  log(`Unhandled error: ${err}`, 'error');
  process.exit(1);
});
