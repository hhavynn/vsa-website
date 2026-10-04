// Pure logic behind `scripts/check-content-links.ts`: which public URLs get
// checked, which hosts are never contacted, how often a URL may be re-checked,
// and how a response becomes "ok / failed / skipped". The script feeds rows and
// a `fetch` in; this module decides. No Supabase client, no filesystem, no clock
// of its own, so politeness (spacing, caps, caching) is pinned by Jest.
//
// Why a scheduled job and not the browser: an external check from an admin's
// tab would fan out one request per URL on every page view, from a client that
// third-party hosts see as a human. The job runs weekly with a user agent that
// says what it is, writes results to `content_health_state`, and the admin
// pages only ever read that cache.
//
// Egress rules (docs/storage-egress-audit.md, vsa-failure-archaeology §1):
//  - `/images/...` is verified against the checked-out repo: no network at all.
//  - Supabase Storage objects get a HEAD only. Never a GET, so a full-resolution
//    original is never downloaded by the checker.
//  - Social, Google Drive/Docs/Forms/Photos hosts are never contacted: they block
//    bots or answer 200 for dead links, so a check there is noise or a ban.
import { LinkKind, LinkUsage } from './contentLinkResult';
import { classifyImageUrl } from './storageContentAudit';

// The tiny, bundle-safe pieces live in contentLinkResult.ts so the admin pages never pull this file in.
export { CONFIRM_AFTER_FAILURES, DEFINITIVE_FAILURE_REASONS, isConfirmedLinkFailure } from './contentLinkResult';
export type { LinkKind, LinkUsage } from './contentLinkResult';

export interface LinkCheckTarget {
  table: string;
  /** Columns the script selects: id, the label column(s), the URL columns, and the filter columns. */
  select: string;
  labelColumns: readonly string[];
  adminPath: string;
  columns: ReadonlyArray<{ column: string; kind: LinkKind }>;
  /** Equality filters that keep the scan to what visitors can actually see. */
  where?: Readonly<Record<string, boolean | string>>;
}

/**
 * Only fields that render publicly (plus the admin-only Resources Index). Internal
 * planning links (`source_doc_url`, `drive_folder_url`) and notes are deliberately
 * absent: this scan must never read, store, or print them.
 */
export const LINK_CHECK_TARGETS: readonly LinkCheckTarget[] = [
  {
    table: 'events',
    select: 'id, name, image_url, is_published',
    labelColumns: ['name'],
    adminPath: '/admin/events',
    columns: [{ column: 'image_url', kind: 'image' }],
    where: { is_published: true },
  },
  {
    table: 'gallery_events',
    select: 'id, name, title, cover_image_url, google_photos_url',
    labelColumns: ['title', 'name'],
    adminPath: '/admin/gallery',
    columns: [
      { column: 'cover_image_url', kind: 'image' },
      { column: 'google_photos_url', kind: 'link' },
    ],
  },
  {
    table: 'cabinet_members',
    select: 'id, name, image_url',
    labelColumns: ['name'],
    adminPath: '/admin/cabinet',
    columns: [{ column: 'image_url', kind: 'image' }],
  },
  {
    table: 'house_page_assets',
    select: 'id, display_name, image_url, house_parent_image_url, is_active',
    labelColumns: ['display_name'],
    adminPath: '/admin/houses',
    columns: [
      { column: 'image_url', kind: 'image' },
      { column: 'house_parent_image_url', kind: 'image' },
    ],
    where: { is_active: true },
  },
  {
    table: 'vcn_archives',
    select: 'id, title, cover_image_url, poster_url, is_published',
    labelColumns: ['title'],
    adminPath: '/admin/vcn',
    columns: [
      { column: 'cover_image_url', kind: 'image' },
      { column: 'poster_url', kind: 'image' },
    ],
    where: { is_published: true },
  },
  {
    table: 'program_content',
    select: 'id, title, section_key, primary_link_url, secondary_link_url, is_published',
    labelColumns: ['title', 'section_key'],
    adminPath: '/admin/content',
    columns: [
      { column: 'primary_link_url', kind: 'link' },
      { column: 'secondary_link_url', kind: 'link' },
    ],
    where: { is_published: true },
  },
  {
    table: 'site_settings',
    select: 'id, logo_alt, logo_url',
    labelColumns: ['logo_alt'],
    adminPath: '/admin/settings',
    columns: [{ column: 'logo_url', kind: 'image' }],
  },
  {
    table: 'resource_links',
    select: 'id, title, url, is_archived',
    labelColumns: ['title'],
    adminPath: '/admin/resources',
    columns: [{ column: 'url', kind: 'link' }],
    where: { is_archived: false },
  },
  {
    table: 'ai_knowledge_base',
    select: 'id, title, source_url, is_public, is_active',
    labelColumns: ['title'],
    adminPath: '/admin/ai-knowledge',
    columns: [{ column: 'source_url', kind: 'link' }],
    where: { is_public: true, is_active: true },
  },
];

// ─── What to check ───────────────────────────────────────────────────────────

/** Hosts that are never contacted (the suffix match covers subdomains). */
export const NEVER_CHECK_HOSTS: readonly string[] = [
  'instagram.com',
  'instagr.am',
  'facebook.com',
  'fb.com',
  'fb.me',
  'tiktok.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'discord.gg',
  'discord.com',
  'drive.google.com',
  'docs.google.com',
  'forms.google.com',
  'forms.gle',
  'photos.google.com',
  'photos.app.goo.gl',
  'goo.gl',
  'google.com',
  // Google's image hosts for Drive and Photos, other social and chat hosts, link shorteners
  // and file-sharing hosts: they block bots, answer 200 for dead links, or redirect somewhere unchecked.
  'googleusercontent.com',
  'googleapis.com',
  'cdninstagram.com',
  'fbcdn.net',
  'threads.net',
  'snapchat.com',
  'pinterest.com',
  'reddit.com',
  'whatsapp.com',
  'wa.me',
  't.me',
  'bit.ly',
  't.co',
  'lnkd.in',
  'linktr.ee',
  'ow.ly',
  'tinyurl.com',
  'dropbox.com',
  '1drv.ms',
  'onedrive.live.com',
  'sharepoint.com',
  'notion.so',
  'canva.com',
  'partiful.com',
];

export function isNeverCheckedHost(host: string): boolean {
  const lower = host.toLowerCase();
  return NEVER_CHECK_HOSTS.some((blocked) => lower === blocked || lower.endsWith(`.${blocked}`));
}

export type CheckPlan =
  | { action: 'file'; path: string }
  // `storage`: a Supabase Storage object (short spacing). `noGet`: any Supabase host, where a GET could download an original.
  | { action: 'http'; url: string; storage: boolean; noGet: boolean }
  | { action: 'skip'; reason: string };

export interface PlanUrlOptions {
  /** Hostname of the project's Supabase URL, so a custom domain still counts as Supabase. */
  supabaseHost?: string;
}

export function isSupabaseHost(host: string, configured?: string): boolean {
  const lower = host.toLowerCase();
  return lower.endsWith('.supabase.co') || lower.endsWith('.supabase.in') || (!!configured && lower === configured.toLowerCase());
}

const PRIVATE_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/**
 * Why a URL must never be fetched from the CI runner, or null when it is a normal
 * public web address. URLs come from admin-editable rows, so a mistyped or hostile
 * value must not turn the checker into a probe of localhost or the cloud
 * metadata service. (A hostname that later resolves to a private address is not
 * caught here; the runner never reads response bodies, which limits the harm.)
 */
export function unsafeUrlReason(parsed: URL): string | null {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'unsupported-scheme';
  if (parsed.username || parsed.password) return 'credentials-in-url';
  if (parsed.port) return 'non-default-port';
  const host = parsed.hostname.toLowerCase();
  if (host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'ip-literal';
  if (host === 'localhost' || !host.includes('.') || PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return 'private-host';
  return null;
}

/**
 * How one stored URL is verified. Local `/images/...` paths are looked up in the
 * repo; route-like local paths on link fields (`/events`) are skipped because
 * whether a route exists is not something a URL check can know.
 */
export function planUrlCheck(rawUrl: string, kind: LinkKind, options: PlanUrlOptions = {}): CheckPlan {
  const url = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
  const classified = classifyImageUrl(url, { supabaseHost: options.supabaseHost });
  if (!classified) return { action: 'skip', reason: 'empty' };
  if (classified.class === 'local') {
    return kind === 'image' ? { action: 'file', path: classified.safeUrl } : { action: 'skip', reason: 'internal-route' };
  }
  if (classified.class === 'other') return { action: 'skip', reason: 'unsupported-scheme' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { action: 'skip', reason: 'invalid-url' };
  }
  const unsafe = unsafeUrlReason(parsed);
  if (unsafe) return { action: 'skip', reason: unsafe };

  if (classified.class === 'supabase-storage') {
    // The paid image-transform endpoint can do work per request; only plain public objects are checked.
    return classified.access === 'public' ? { action: 'http', url, storage: true, noGet: true } : { action: 'skip', reason: 'not-public-storage' };
  }
  if (classified.host && isNeverCheckedHost(classified.host)) return { action: 'skip', reason: 'host-not-checked' };
  return { action: 'http', url, storage: false, noGet: isSupabaseHost(parsed.hostname, options.supabaseHost) };
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Drops the fragment; the rest of the URL is what gets requested, so it is kept. */
export function normalizeUrl(value: string): string {
  const hash = value.indexOf('#');
  const trimmed = (hash === -1 ? value : value.slice(0, hash)).trim();
  // A protocol-relative URL is served over https; store it the way it is requested.
  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
}

/** Every checkable URL across the targets, with where it is used. */
export function collectLinkUsages(
  rowsByTable: Readonly<Record<string, ReadonlyArray<Record<string, unknown>>>>,
  options: PlanUrlOptions = {},
): Map<string, LinkUsage[]> {
  const usages = new Map<string, LinkUsage[]>();
  for (const target of LINK_CHECK_TARGETS) {
    for (const row of rowsByTable[target.table] ?? []) {
      const id = clean(row.id);
      if (!id) continue;
      const label = target.labelColumns.map((column) => clean(row[column])).find(Boolean) ?? target.table;
      for (const { column, kind } of target.columns) {
        const url = normalizeUrl(clean(row[column]));
        if (!url || planUrlCheck(url, kind, options).action === 'skip') continue;
        const list = usages.get(url) ?? [];
        list.push({ table: target.table, id, field: column, label: label.slice(0, 120), path: target.adminPath, kind });
        usages.set(url, list);
      }
    }
  }
  return usages;
}

// ─── What a result means ─────────────────────────────────────────────────────

export type LinkCheckStatus = 'ok' | 'failed' | 'skipped';

export interface LinkCheckOutcome {
  url: string;
  status: LinkCheckStatus;
  httpStatus: number | null;
  /** Short code: http_404, missing_local_file, not_an_image, timeout, network_error, blocked, ... */
  reason: string | null;
}

export interface CachedLinkCheck {
  url: string;
  check_status: LinkCheckStatus;
  checked_at: string;
  consecutive_failures: number;
  failing_since: string | null;
}

/** The state to store after a run: counts consecutive failing runs and when the current failure began. */
export function nextCheckState(previous: CachedLinkCheck | undefined, outcome: LinkCheckOutcome, nowIso: string) {
  if (outcome.status !== 'failed') return { consecutive_failures: 0, failing_since: null as string | null };
  const wasFailing = previous?.check_status === 'failed';
  return {
    consecutive_failures: (wasFailing ? previous?.consecutive_failures ?? 0 : 0) + 1,
    failing_since: wasFailing && previous?.failing_since ? previous.failing_since : nowIso,
  };
}

// ─── How often ───────────────────────────────────────────────────────────────

export interface PlanOptions {
  okTtlDays: number;
  failedTtlHours: number;
  skippedTtlDays: number;
  /** Hard cap on URLs contacted in one run. */
  maxPerRun: number;
}

export const DEFAULT_PLAN_OPTIONS: PlanOptions = { okTtlDays: 7, failedTtlHours: 20, skippedTtlDays: 30, maxPerRun: 120 };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Which URLs to contact this run: never-checked first, then the longest since
 * checked, skipping anything whose last result is still inside its cache window.
 * A re-run right after a run therefore contacts nothing.
 */
export function planLinkChecks(
  urls: readonly string[],
  cached: ReadonlyMap<string, CachedLinkCheck>,
  now: Date,
  options: PlanOptions = DEFAULT_PLAN_OPTIONS,
): string[] {
  const nowMs = now.getTime();
  const due: Array<{ url: string; checkedMs: number }> = [];
  for (const url of urls) {
    const previous = cached.get(url);
    const checkedMs = previous ? Date.parse(previous.checked_at) : NaN;
    if (!previous || Number.isNaN(checkedMs)) {
      due.push({ url, checkedMs: 0 });
      continue;
    }
    const ttl =
      previous.check_status === 'ok' ? options.okTtlDays * DAY_MS : previous.check_status === 'failed' ? options.failedTtlHours * HOUR_MS : options.skippedTtlDays * DAY_MS;
    if (nowMs - checkedMs >= ttl) due.push({ url, checkedMs });
  }
  return due
    .sort((a, b) => a.checkedMs - b.checkedMs || a.url.localeCompare(b.url))
    .slice(0, options.maxPerRun)
    .map((entry) => entry.url);
}

// ─── Running a check politely ────────────────────────────────────────────────

export interface RunDeps {
  fetch: (
    url: string,
    init: { method: string; redirect: 'manual'; headers: Record<string, string>; signal?: AbortSignal },
  ) => Promise<{ status: number; headers: { get(name: string): string | null }; body?: { cancel?: () => unknown } | null }>;
  /** True when `public/<path>` exists in the checkout. */
  localFileExists: (path: string) => boolean;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export interface RunOptions {
  /** Minimum gap between two requests to the same third-party host. */
  externalDelayMs: number;
  /** Minimum gap between two requests to Supabase Storage. */
  storageDelayMs: number;
  timeoutMs: number;
  retryDelayMs: number;
  /** Redirects followed by hand, each hop re-checked against the host policy. */
  maxRedirects: number;
  /** Stop contacting hosts after this long; unchecked URLs are simply picked up next run. */
  maxDurationMs: number;
  supabaseHost?: string;
  userAgent: string;
}

export const DEFAULT_RUN_OPTIONS: RunOptions = {
  externalDelayMs: 2000,
  storageDelayMs: 300,
  timeoutMs: 10_000,
  retryDelayMs: 3000,
  maxRedirects: 3,
  maxDurationMs: 15 * 60 * 1000,
  userAgent: 'VSA-ContentHealthCheck/1.0 (weekly link check for vsaatucsd.com; HEAD requests, a one-byte ranged GET only where HEAD is refused)',
};

const BLOCKED_STATUSES = [401, 403, 429, 999];
const TRANSIENT_REASONS = ['http_5xx', 'timeout', 'network_error', 'too_many_redirects'];

function classifyResponse(url: string, kind: LinkKind, status: number, contentType: string | null): LinkCheckOutcome {
  const base = { url, httpStatus: status };
  if (status >= 200 && status < 400) {
    const type = contentType?.toLowerCase() ?? '';
    // A dead image host often answers 200 with an HTML page; octet-stream is a normal CDN answer.
    if (kind === 'image' && type && !type.startsWith('image/') && !type.includes('octet-stream') && !type.includes('binary')) {
      return { ...base, status: 'failed', reason: 'not_an_image' };
    }
    return { ...base, status: 'ok', reason: null };
  }
  if (status === 404 || status === 410) return { ...base, status: 'failed', reason: `http_${status}` };
  if (BLOCKED_STATUSES.includes(status)) return { ...base, status: 'skipped', reason: 'blocked' };
  if (status >= 500) return { ...base, status: 'failed', reason: 'http_5xx' };
  return { ...base, status: 'failed', reason: 'http_4xx' };
}

/**
 * Checks `items` one at a time and returns one outcome per URL it reached.
 *
 *  - Requests to the same host are spaced; nothing runs in parallel.
 *  - Redirects are followed by hand, at most `maxRedirects`, and EVERY hop goes
 *    back through the host policy: a link that redirects to Instagram, Drive, a
 *    private address, or a Supabase host (where a GET could download an original)
 *    ends the check as inconclusive instead of contacting it.
 *  - A transient failure is retried once after a pause, so one flaky response
 *    never reaches an admin.
 *  - One bad URL cannot stop the run: any unexpected error for an item becomes an
 *    inconclusive result for that item only.
 *  - `onOutcome` is called as each result is known, so the caller can save
 *    progress and a timeout never loses a whole run. The run also stops starting
 *    new URLs after `maxDurationMs`.
 */
export async function runLinkChecks(
  items: ReadonlyArray<{ url: string; kind: LinkKind }>,
  deps: RunDeps,
  options: RunOptions = DEFAULT_RUN_OPTIONS,
  onOutcome?: (outcome: LinkCheckOutcome) => void | Promise<void>,
): Promise<LinkCheckOutcome[]> {
  const lastRequestAt = new Map<string, number>();
  const outcomes: LinkCheckOutcome[] = [];
  const startedAt = deps.now();
  const planOptions: PlanUrlOptions = { supabaseHost: options.supabaseHost };

  async function waitForHost(host: string, gapMs: number) {
    const last = lastRequestAt.get(host);
    if (last !== undefined) {
      const wait = last + gapMs - deps.now();
      if (wait > 0) await deps.sleep(wait);
    }
    lastRequestAt.set(host, deps.now());
  }

  async function checkHttp(startUrl: string, kind: LinkKind): Promise<LinkCheckOutcome> {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
    try {
      let current = startUrl;
      let method = 'HEAD';
      let hops = 0;
      const headers: Record<string, string> = { 'user-agent': options.userAgent, accept: '*/*' };
      for (;;) {
        const plan = planUrlCheck(current, kind, planOptions);
        if (plan.action !== 'http') {
          // The first URL was vetted by the caller; a later hop that fails the policy is not contacted.
          return { url: startUrl, status: 'skipped', httpStatus: null, reason: 'redirects_to_unchecked_host' };
        }
        // A GET is only ever sent where a one-byte range is harmless. Once the method has fallen back to GET,
        // a redirect onto a Supabase host must stop here: a server that ignores Range could send an original.
        if (method === 'GET' && plan.noGet) return { url: startUrl, status: 'skipped', httpStatus: null, reason: 'redirects_to_unchecked_host' };
        await waitForHost(new URL(current).hostname.toLowerCase(), plan.storage ? options.storageDelayMs : options.externalDelayMs);
        const response = await deps.fetch(current, {
          method,
          redirect: 'manual',
          headers: method === 'GET' ? { ...headers, range: 'bytes=0-0' } : headers,
          signal: controller?.signal,
        });
        // Only the status line and headers are ever used; never read or keep a body.
        try {
          void response.body?.cancel?.();
        } catch {
          // A body that cannot be cancelled is dropped with the response.
        }
        const location = response.headers.get('location');
        if (response.status >= 300 && response.status < 400 && location) {
          hops += 1;
          if (hops > options.maxRedirects) return { url: startUrl, status: 'failed', httpStatus: response.status, reason: 'too_many_redirects' };
          current = new URL(location, current).toString();
          continue;
        }
        if ((response.status === 405 || response.status === 501) && method === 'HEAD') {
          // A one-byte ranged GET answers the same question for third parties. It is never sent to a
          // Supabase host, so a Storage original is never downloaded.
          if (plan.noGet) return { url: startUrl, status: 'skipped', httpStatus: response.status, reason: 'head_unsupported' };
          method = 'GET';
          continue;
        }
        return classifyResponse(startUrl, kind, response.status, response.headers.get('content-type'));
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return { url: startUrl, status: 'failed', httpStatus: null, reason: aborted ? 'timeout' : 'network_error' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function checkOne(url: string, kind: LinkKind): Promise<LinkCheckOutcome> {
    const plan = planUrlCheck(url, kind, planOptions);
    if (plan.action === 'skip') return { url, status: 'skipped', httpStatus: null, reason: plan.reason };
    if (plan.action === 'file') {
      const exists = deps.localFileExists(plan.path);
      return { url, status: exists ? 'ok' : 'failed', httpStatus: null, reason: exists ? null : 'missing_local_file' };
    }
    let outcome = await checkHttp(url, kind);
    if (outcome.status === 'failed' && TRANSIENT_REASONS.includes(outcome.reason ?? '')) {
      await deps.sleep(options.retryDelayMs);
      outcome = await checkHttp(url, kind);
    }
    return outcome;
  }

  for (const { url, kind } of items) {
    if (deps.now() - startedAt > options.maxDurationMs) break;
    let outcome: LinkCheckOutcome;
    try {
      outcome = await checkOne(url, kind);
    } catch {
      outcome = { url, status: 'skipped', httpStatus: null, reason: 'check_error' };
    }
    outcomes.push(outcome);
    await onOutcome?.(outcome);
  }
  return outcomes;
}
