#!/usr/bin/env node
/**
 * scripts/check-content-links.ts
 *
 * The weekly image and link check behind Admin > Content Health (#287). It reads
 * the public image/link fields (the target list in src/lib/contentLinkCheck.ts),
 * checks each URL politely, and caches the result in `content_health_state`. The
 * admin pages only ever read that cache; nothing in the browser contacts an
 * external host.
 *
 * It never edits or deletes content, and never deletes a Storage object. The only
 * rows it writes are its own cache rows (`link_check`, one `check_run`).
 *
 * Politeness (all pinned by Jest in src/lib/contentLinkCheck.test.ts):
 *  - `/images/...` paths are looked up in the checkout: no network.
 *  - Supabase hosts get a HEAD request only: an original is never downloaded.
 *  - Instagram and other social hosts, Google Drive/Docs/Forms/Photos, link shorteners and
 *    file-sharing hosts are never contacted, including when a link REDIRECTS to one.
 *  - Only public https/http URLs on default ports: never localhost, private or metadata
 *    addresses, IP literals, or credentialed URLs, on the first hop or any redirect.
 *  - One request at a time, 2s between requests to the same third-party host, redirects
 *    followed by hand (3 hops at most), a self-identifying user agent, one retry for a
 *    transient failure, response bodies cancelled unread.
 *  - A URL checked recently is not checked again (ok 7 days, failing 20 hours,
 *    inconclusive 30 days). One run contacts at most 120 URLs (a few requests each in the
 *    worst case) and stops starting new ones after 15 minutes; results are saved as it goes.
 *  - A DRY RUN does not save, so it re-contacts what an earlier dry run contacted: it
 *    defaults to 25 URLs. Use --limit to change that.
 *
 * Usage:
 *   npm run check:content-links                  # DRY RUN: checks, prints, writes nothing
 *   npm run check:content-links -- --apply       # also writes the cache rows
 *   npm run check:content-links -- --limit 20    # contact at most 20 URLs this run (1-120)
 *   npm run check:content-links -- --help
 *
 * Env (reads .env.local):
 *   REACT_APP_SUPABASE_URL        required
 *   SUPABASE_SERVICE_ROLE_KEY     required (reads the admin-only Resources Index; --apply writes the cache)
 *
 * Needs migration 20261004000000 applied for --apply. A dry run works without it.
 * Scheduled by .github/workflows/content-link-check.yml.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  CachedLinkCheck,
  DEFAULT_PLAN_OPTIONS,
  LINK_CHECK_TARGETS,
  LinkCheckOutcome,
  LinkUsage,
  RunDeps,
  DEFAULT_RUN_OPTIONS,
  collectLinkUsages,
  isConfirmedLinkFailure,
  isSupabaseHost,
  nextCheckState,
  planLinkChecks,
  runLinkChecks,
} from '../src/lib/contentLinkCheck';
import { displayUrl } from '../src/lib/contentHealth';

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

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const HELP = args.includes('--help') || args.includes('-h');
const MAX_PER_RUN = DEFAULT_PLAN_OPTIONS.maxPerRun;
const limitIndex = args.indexOf('--limit');
const requestedLimit = limitIndex === -1 ? null : Number(args[limitIndex + 1]);
if (requestedLimit !== null && !(Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= MAX_PER_RUN)) {
  process.stdout.write(`ERROR: --limit must be a whole number from 1 to ${MAX_PER_RUN}.\n`);
  process.exit(1);
}
// A dry run saves nothing, so a second one would contact the same URLs again: keep it small.
const LIMIT = requestedLimit ?? (APPLY ? MAX_PER_RUN : 25);

const out = (line = '') => process.stdout.write(`${line}\n`);

if (HELP) {
  out(fs.readFileSync(__filename, 'utf-8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\*?\n?/, '').replace(/^ \* ?/gm, ''));
  process.exit(0);
}

const url = process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  out('ERROR: REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// PostgREST caps a response (1000 rows by default), so every read pages explicitly.
const PAGE = 1000;

async function readAllPages(
  label: string,
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>,
): Promise<{ rows: Array<Record<string, unknown>>; complete: boolean; error: { message: string; code?: string } | null }> {
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) {
      out(`  ! ${label}: could not read (${error.message})`);
      return { rows, complete: false, error };
    }
    rows.push(...((data ?? []) as Array<Record<string, unknown>>));
    if ((data ?? []).length < PAGE) return { rows, complete: true, error: null };
  }
}

async function readTargetRows(): Promise<{ rowsByTable: Record<string, Array<Record<string, unknown>>>; complete: boolean }> {
  const rowsByTable: Record<string, Array<Record<string, unknown>>> = {};
  let complete = true;
  for (const target of LINK_CHECK_TARGETS) {
    const result = await readAllPages(target.table, (from, to) => {
      let query = supabase.from(target.table).select(target.select).order('id').range(from, to);
      for (const [column, value] of Object.entries(target.where ?? {})) query = query.eq(column, value);
      return query as unknown as PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
    });
    rowsByTable[target.table] = result.rows;
    if (!result.complete) {
      complete = false;
      out(`    ${target.table} was not fully read; nothing will be treated as unused this run`);
    }
  }
  return { rowsByTable, complete };
}

async function readCache(): Promise<{ cache: Map<string, CachedLinkCheck>; tableExists: boolean }> {
  const result = await readAllPages('content_health_state', (from, to) =>
    supabase
      .from('content_health_state')
      .select('subject_key, check_status, checked_at, consecutive_failures, failing_since')
      .eq('kind', 'link_check')
      .order('subject_key')
      .range(from, to) as unknown as PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>,
  );
  if (!result.complete) {
    const missing = result.error?.code === 'PGRST205' || result.error?.code === '42P01';
    if (missing) out('    (content_health_state does not exist yet: migration 20261004000000 not applied.)');
    return { cache: new Map(), tableExists: false };
  }
  const cache = new Map<string, CachedLinkCheck>();
  for (const row of result.rows) {
    cache.set(row.subject_key as string, {
      url: row.subject_key as string,
      check_status: row.check_status as CachedLinkCheck['check_status'],
      checked_at: row.checked_at as string,
      consecutive_failures: (row.consecutive_failures as number) ?? 0,
      failing_since: (row.failing_since as string | null) ?? null,
    });
  }
  return { cache, tableExists: true };
}

/** `public/<path>` exists, and the path cannot climb out of public/ or throw on a bad escape. */
function localFileExists(urlPath: string): boolean {
  try {
    const publicDir = path.resolve(process.cwd(), 'public');
    const target = path.resolve(publicDir, `.${decodeURIComponent(urlPath)}`);
    return target.startsWith(`${publicDir}${path.sep}`) && fs.existsSync(target);
  } catch {
    return false;
  }
}

/** Tables whose rows are admin-only or private: their labels and URLs are never printed to the (possibly public) CI log. */
const QUIET_TABLES = new Set(['resource_links', 'ai_knowledge_base']);

async function main() {
  out(`Content link check (${APPLY ? 'APPLY: writes cache rows' : 'DRY RUN: writes nothing'})`);
  const now = new Date();
  const nowIso = now.toISOString();

  const supabaseHost = new URL(url as string).hostname;
  const { rowsByTable, complete: readComplete } = await readTargetRows();
  // An applied run that could not read every source would record a fresh "last checked" over a scan
  // that skipped something, and exit green. Stop before contacting any host; a dry run may continue.
  if (APPLY && !readComplete) {
    out('ERROR: not every table could be read in full, so this run would record an incomplete scan as fresh. Nothing was contacted or written.');
    process.exit(1);
  }
  const usages = collectLinkUsages(rowsByTable, { supabaseHost });
  const { cache, tableExists } = await readCache();
  if (APPLY && !tableExists) {
    out('Cannot --apply without the content_health_state table. Apply the migration first.');
    process.exit(1);
  }

  const kindFor = (list: LinkUsage[]) => (list.some((usage) => usage.kind === 'image') ? 'image' : 'link');
  const planned = planLinkChecks(Array.from(usages.keys()), cache, now, { ...DEFAULT_PLAN_OPTIONS, maxPerRun: LIMIT });
  out(`Tracking ${usages.size} checkable URLs; ${planned.length} are due (${usages.size - planned.length} cached within their window).`);

  const deps: RunDeps = {
    fetch: (target, init) => fetch(target, init),
    localFileExists,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
  };

  // Results are saved in small batches as they arrive, so a timeout or crash keeps what was learned.
  const merged = new Map<string, { outcome: LinkCheckOutcome; previous: CachedLinkCheck | undefined; state: ReturnType<typeof nextCheckState> }>();
  const pending: Array<Record<string, unknown>> = [];
  let written = 0;
  const toRow = (outcome: LinkCheckOutcome) => {
    const { state } = merged.get(outcome.url)!;
    return {
      kind: 'link_check',
      subject_key: outcome.url,
      check_status: outcome.status,
      http_status: outcome.httpStatus,
      failure_reason: outcome.reason,
      checked_at: nowIso,
      failing_since: state.failing_since,
      consecutive_failures: state.consecutive_failures,
      detail: (usages.get(outcome.url) ?? []).slice(0, 10),
    };
  };
  async function flush(force = false) {
    if (!APPLY || pending.length === 0 || (!force && pending.length < 20)) return;
    const batch = pending.splice(0, pending.length);
    const { error } = await supabase.from('content_health_state').upsert(batch, { onConflict: 'kind,subject_key' });
    if (error) throw new Error(`Writing link checks failed: ${error.message}`);
    written += batch.length;
  }

  const outcomes = await runLinkChecks(
    planned.map((target) => ({ url: target, kind: kindFor(usages.get(target) ?? []) as 'image' | 'link' })),
    deps,
    { ...DEFAULT_RUN_OPTIONS, supabaseHost },
    async (outcome) => {
      const previous = cache.get(outcome.url);
      merged.set(outcome.url, { outcome, previous, state: nextCheckState(previous, outcome, nowIso) });
      pending.push(toRow(outcome));
      await flush();
    },
  );
  await flush(true);

  const failingNow = Array.from(usages.keys()).filter((target) => {
    const fresh = merged.get(target);
    if (fresh) return isConfirmedLinkFailure({ check_status: fresh.outcome.status, failure_reason: fresh.outcome.reason, consecutive_failures: fresh.state.consecutive_failures });
    const old = cache.get(target);
    return !!old && old.check_status === 'failed' && old.consecutive_failures >= 2;
  });

  const tally = outcomes.reduce<Record<string, number>>((acc, outcome) => ({ ...acc, [outcome.status]: (acc[outcome.status] ?? 0) + 1 }), {});
  out(`Checked ${outcomes.length}: ${tally.ok ?? 0} ok, ${tally.failed ?? 0} failed, ${tally.skipped ?? 0} inconclusive.`);
  for (const outcome of outcomes.filter((o) => o.status === 'failed')) {
    const list = usages.get(outcome.url) ?? [];
    if (list.some((usage) => QUIET_TABLES.has(usage.table))) {
      // Admin-only content: say where to look, not what it is.
      out(`  FAILED ${outcome.reason}  (an admin-only link in ${Array.from(new Set(list.map((usage) => usage.table))).join(', ')}; see /admin/content-health)`);
      continue;
    }
    const where = list.map((usage) => `${usage.table}.${usage.field} "${usage.label}"`).slice(0, 3).join('; ');
    out(`  FAILED ${outcome.reason}  ${displayUrl(outcome.url)}  <- ${where}`);
  }
  if (outcomes.length < planned.length) out(`  Stopped early at the time budget: ${planned.length - outcomes.length} URLs are left for the next run.`);

  // Only forget a cached URL when every source was read in full: a table that failed to load, or was
  // cut off, would otherwise make its URLs look unused and reset their failure history.
  const stale = readComplete ? Array.from(cache.keys()).filter((target) => !usages.has(target)) : [];
  out(readComplete ? `${stale.length} cached URLs are no longer used anywhere${APPLY ? ' and will be removed from the cache' : ''}.` : 'Skipping cache cleanup: not every table could be read in full.');

  if (APPLY) {
    for (let start = 0; start < stale.length; start += 100) {
      const { error } = await supabase.from('content_health_state').delete().eq('kind', 'link_check').in('subject_key', stale.slice(start, start + 100));
      if (error) throw new Error(`Clearing stale link checks failed: ${error.message}`);
    }
    const { error } = await supabase.from('content_health_state').upsert(
      { kind: 'check_run', subject_key: 'weekly', checked_at: nowIso, detail: { checked: outcomes.length, failed: failingNow.length, skipped: tally.skipped ?? 0 } },
      { onConflict: 'kind,subject_key' },
    );
    if (error) throw new Error(`Recording the run failed: ${error.message}`);
    out(`Wrote ${written} link results and the run summary.`);
  } else {
    out('Dry run: nothing was written. Re-run with --apply to update the cache.');
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Content link check (${APPLY ? 'applied' : 'dry run'})\n\n- Tracked URLs: ${usages.size}\n- Contacted this run: ${outcomes.length}\n- Failing now: ${failingNow.length}\n- Inconclusive: ${tally.skipped ?? 0}\n`,
    );
  }
}

main().catch((error) => {
  out(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
