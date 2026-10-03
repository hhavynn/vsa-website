/**
 * Pure logic behind `scripts/audit-storage-backed-content.ts`, a READ-ONLY audit
 * of which public content still points at Supabase Storage (egress) versus the
 * Vercel-served `/images/...` static files. No I/O and no Supabase client here:
 * the script feeds rows in, this module classifies and summarizes them.
 *
 * Lives under src/ so CRA's Jest discovers its test and `npm run lint` covers
 * it. Nothing in the app imports it, so it is not part of the client bundle.
 */

export type UrlClass = 'local' | 'supabase-storage' | 'external' | 'other';

export const URL_CLASSES: UrlClass[] = ['local', 'supabase-storage', 'external', 'other'];

export type StorageAccess = 'public' | 'render' | 'sign' | 'authenticated';

export interface ClassifiedUrl {
  class: UrlClass;
  /** Storage bucket id, for `supabase-storage`. */
  bucket?: string;
  /** Object path inside the bucket, for `supabase-storage`. */
  objectPath?: string;
  /** `render` is the paid image-transform endpoint; `sign` and `authenticated` are not public URLs. */
  access?: StorageAccess;
  /** Hostname, for `external` and `supabase-storage`. */
  host?: string;
  /** The URL with any query string / fragment removed (signed URLs carry tokens). */
  safeUrl: string;
}

export interface ClassifyOptions {
  /** Hostname of the project's Supabase URL, so custom domains and local stacks classify as Storage. */
  supabaseHost?: string;
}

const STORAGE_PATH_RE = /^\/storage\/v1\/(object|render\/image)\/(public|sign|authenticated)\/([^/]+)\/(.+)$/;

function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * Classify one stored image URL. Returns null for empty / whitespace-only
 * values, which the audit ignores.
 *
 *  - local:            a root-relative path (`/images/...`), served by Vercel from the repo
 *  - supabase-storage: `https://<ref>.supabase.co/storage/v1/(object|render/image)/<access>/<bucket>/<path>`
 *  - external:         any other http(s) host
 *  - other:            data:/blob: URIs, bare relative paths, garbage
 */
export function classifyImageUrl(raw: unknown, options: ClassifyOptions = {}): ClassifiedUrl | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  const safeUrl = stripQuery(value);

  // `//host/path` is protocol-relative, not a local path.
  if (value.charAt(0) === '/' && value.charAt(1) !== '/') {
    return { class: 'local', safeUrl };
  }

  let parsed: URL;
  try {
    parsed = new URL(value.indexOf('//') === 0 ? `https:${value}` : value);
  } catch {
    return { class: 'other', safeUrl };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { class: 'other', safeUrl: `${parsed.protocol}…` };
  }

  const host = parsed.hostname.toLowerCase();
  const supabaseHost = options.supabaseHost ? options.supabaseHost.toLowerCase() : '';
  const isSupabaseHost = host.slice(-12) === '.supabase.co' || (supabaseHost !== '' && host === supabaseHost);
  const storage = isSupabaseHost ? STORAGE_PATH_RE.exec(parsed.pathname) : null;

  if (storage) {
    const kind = storage[1];
    const access = (kind === 'render/image' ? 'render' : storage[2]) as StorageAccess;
    return {
      class: 'supabase-storage',
      bucket: decodeURIComponent(storage[3]),
      objectPath: storage[4],
      access,
      host,
      safeUrl,
    };
  }

  return { class: 'external', host, safeUrl };
}

// ─── What to scan ─────────────────────────────────────────────────────────────

export interface AuditColumn {
  name: string;
  /** text[] column: every element is its own URL. */
  isArray?: boolean;
}

export interface AuditTarget {
  /** Table that owns the column. */
  table: string;
  /**
   * What an anonymous visitor can read: the table itself, a `published_*` view
   * that hides drafts, or null when RLS hides the rows from anon entirely (the
   * audit then needs `--service-role`).
   */
  publicSource: string | null;
  idColumn: string;
  columns: AuditColumn[];
  /** Key into the migrate script's CATEGORIES when the migration pipeline handles this table. */
  migrationCategory?: string;
  note?: string;
}

/**
 * Every table column that can hold a URL for a public image. The first six
 * entries are the migration pipeline's categories; the rest are image-bearing
 * columns the pipeline does not cover. Derived from supabase/migrations and the
 * `storage.from(...)` call sites in src/ (buckets: cabinet_images,
 * event_images, gallery_images, house_images, presidents_images, site_assets,
 * ace_family_images, uvsa_school_assets, avatars; member-photo-requests is
 * private). Add a row here when a migration adds a new image column.
 */
export const AUDIT_TARGETS: AuditTarget[] = [
  {
    table: 'cabinet_members',
    publicSource: 'cabinet_members',
    idColumn: 'id',
    columns: [{ name: 'image_url' }, { name: 'thumbnail_url' }],
    migrationCategory: 'cabinet',
  },
  {
    table: 'events',
    publicSource: 'events',
    idColumn: 'id',
    columns: [{ name: 'image_url' }, { name: 'thumbnail_url' }],
    migrationCategory: 'events',
  },
  {
    table: 'gallery_events',
    publicSource: 'gallery_events',
    idColumn: 'id',
    columns: [{ name: 'cover_image_url' }, { name: 'cover_thumbnail_url' }, { name: 'images', isArray: true }],
    migrationCategory: 'gallery',
    note: 'The migration pipeline only moves the cover pair. images[] is a legacy column the admin now writes as []; it is audited in case old rows still hold Storage URLs, but no public page renders it.',
  },
  {
    table: 'house_page_assets',
    publicSource: 'published_house_page_assets',
    idColumn: 'id',
    columns: [
      { name: 'image_url' },
      { name: 'image_thumbnail_url' },
      { name: 'cover_image_url' },
      { name: 'house_parent_image_url' },
    ],
    migrationCategory: 'houses',
    note: 'Raw table is admin-only; anon reads the active rows through published_house_page_assets.',
  },
  {
    table: 'homepage_content',
    publicSource: 'homepage_content',
    idColumn: 'id',
    columns: [{ name: 'presidents_photo_url' }, { name: 'presidents_photo_thumbnail_url' }],
    migrationCategory: 'home',
  },
  {
    table: 'house_events',
    publicSource: 'house_events',
    idColumn: 'id',
    columns: [{ name: 'image_url' }, { name: 'image_thumbnail_url' }],
    migrationCategory: 'house-events',
  },
  // ── Not handled by the migration pipeline ──────────────────────────────────
  {
    table: 'site_settings',
    publicSource: 'site_settings',
    idColumn: 'id',
    columns: [{ name: 'logo_url' }],
  },
  {
    table: 'ace_families',
    publicSource: 'published_ace_families',
    idColumn: 'id',
    columns: [{ name: 'cover_image_url' }],
  },
  {
    table: 'ace_family_members',
    publicSource: 'published_ace_family_members',
    idColumn: 'id',
    columns: [{ name: 'photo_url' }],
  },
  {
    table: 'uvsa_schools',
    publicSource: 'uvsa_schools',
    idColumn: 'id',
    columns: [{ name: 'logo_url' }, { name: 'image_url' }],
  },
  {
    table: 'external_events',
    publicSource: 'external_events',
    idColumn: 'id',
    columns: [{ name: 'image_url' }],
    note: 'UVSA network flyers. photo_album_url is an outbound link, not an image.',
  },
  {
    table: 'vcn_archives',
    publicSource: 'published_vcn_archives',
    idColumn: 'id',
    columns: [{ name: 'poster_url' }, { name: 'cover_image_url' }, { name: 'cover_thumbnail_url' }],
  },
  {
    table: 'intern_cohort_members',
    publicSource: 'published_intern_cohort_members',
    idColumn: 'id',
    columns: [{ name: 'photo_url' }],
  },
  {
    table: 'public_member_avatars',
    publicSource: 'public_member_avatars',
    idColumn: 'member_id',
    columns: [{ name: 'avatar_url' }],
    note: 'View over approved member_photo_requests.approved_avatar_url; the public avatar source.',
  },
  {
    table: 'user_profiles',
    publicSource: null,
    idColumn: 'id',
    columns: [{ name: 'avatar_url' }],
    note: 'RLS hides profiles from anon. Only readable with --service-role.',
  },
  {
    table: 'member_photo_requests',
    publicSource: null,
    idColumn: 'id',
    columns: [{ name: 'approved_avatar_url' }],
    note: 'Admin-only table. Only readable with --service-role.',
  },
];

// ─── Observations and summary ────────────────────────────────────────────────

export interface AuditObservation {
  table: string;
  /** Column name; `images[]` style for array columns. */
  column: string;
  rowId: string;
  url: string;
  /** Opaque caller data, passed through to the matching StorageBackedRow. */
  context?: unknown;
}

/** Pull every non-empty URL out of one fetched row. */
export function extractObservations(target: AuditTarget, row: Record<string, unknown>): AuditObservation[] {
  const rowId = String(row[target.idColumn] ?? 'unknown');
  const out: AuditObservation[] = [];
  target.columns.forEach((column) => {
    const value = row[column.name];
    if (column.isArray) {
      if (!Array.isArray(value)) return;
      value.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          out.push({ table: target.table, column: `${column.name}[]`, rowId, url: item });
        }
      });
      return;
    }
    if (typeof value === 'string' && value.trim()) {
      out.push({ table: target.table, column: column.name, rowId, url: value });
    }
  });
  return out;
}

export interface SummaryRow {
  table: string;
  column: string;
  class: UrlClass;
  count: number;
}

export interface StorageBackedRow {
  table: string;
  column: string;
  rowId: string;
  bucket: string;
  objectPath: string;
  access: StorageAccess;
  /** Query string removed. */
  url: string;
  /** The observation's `context`, unchanged. */
  context?: unknown;
}

export interface AuditSummary {
  totals: { nonEmpty: number; local: number; supabaseStorage: number; external: number; other: number };
  rows: SummaryRow[];
  buckets: { bucket: string; count: number }[];
  externalHosts: { host: string; count: number }[];
  storageBacked: StorageBackedRow[];
}

function classIndex(c: UrlClass): number {
  return URL_CLASSES.indexOf(c);
}

export function summarizeObservations(observations: AuditObservation[], options: ClassifyOptions = {}): AuditSummary {
  const totals = { nonEmpty: 0, local: 0, supabaseStorage: 0, external: 0, other: 0 };
  const rowCounts: Record<string, SummaryRow> = {};
  const bucketCounts: Record<string, number> = {};
  const hostCounts: Record<string, number> = {};
  const storageBacked: StorageBackedRow[] = [];

  observations.forEach((obs) => {
    const classified = classifyImageUrl(obs.url, options);
    if (!classified) return;
    totals.nonEmpty += 1;

    const key = `${obs.table}\u0000${obs.column}\u0000${classified.class}`;
    if (!rowCounts[key]) rowCounts[key] = { table: obs.table, column: obs.column, class: classified.class, count: 0 };
    rowCounts[key].count += 1;

    if (classified.class === 'local') totals.local += 1;
    else if (classified.class === 'external') {
      totals.external += 1;
      const host = classified.host ?? 'unknown';
      hostCounts[host] = (hostCounts[host] ?? 0) + 1;
    } else if (classified.class === 'other') totals.other += 1;
    else {
      totals.supabaseStorage += 1;
      const bucket = classified.bucket ?? 'unknown';
      bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
      storageBacked.push({
        table: obs.table,
        column: obs.column,
        rowId: obs.rowId,
        bucket,
        objectPath: classified.objectPath ?? '',
        access: classified.access ?? 'public',
        url: classified.safeUrl,
        ...(obs.context === undefined ? {} : { context: obs.context }),
      });
    }
  });

  const rows = Object.keys(rowCounts)
    .map((key) => rowCounts[key])
    .sort(
      (a, b) =>
        a.table.localeCompare(b.table) || a.column.localeCompare(b.column) || classIndex(a.class) - classIndex(b.class),
    );

  const byCountThenName = (a: { count: number }, b: { count: number }, an: string, bn: string) =>
    b.count - a.count || an.localeCompare(bn);

  return {
    totals,
    rows,
    buckets: Object.keys(bucketCounts)
      .map((bucket) => ({ bucket, count: bucketCounts[bucket] }))
      .sort((a, b) => byCountThenName(a, b, a.bucket, b.bucket)),
    externalHosts: Object.keys(hostCounts)
      .map((host) => ({ host, count: hostCounts[host] }))
      .sort((a, b) => byCountThenName(a, b, a.host, b.host)),
    storageBacked: storageBacked.sort(
      (a, b) =>
        a.table.localeCompare(b.table) ||
        a.column.localeCompare(b.column) ||
        a.rowId.localeCompare(b.rowId) ||
        a.url.localeCompare(b.url),
    ),
  };
}

// ─── Committed-file lookup (migration target names) ──────────────────────────

export interface MigratedFileLookup {
  /** File name the migration script chooses first: `<slug><suffix>.webp`. */
  expectedName: string;
  exists: boolean;
  /** Content-addressed fallbacks (`<slug>_<8 hex><suffix>.webp`) the script uses when the name is taken. */
  hashedVariants: string[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `listing` is the file names (not paths) in the category's output directory. */
export function findMigratedFiles(listing: string[], slug: string, suffix: string): MigratedFileLookup {
  const expectedName = `${slug}${suffix}.webp`;
  const hashed = new RegExp(`^${escapeRegExp(slug)}_[0-9a-f]{8}${escapeRegExp(suffix)}\\.webp$`);
  return {
    expectedName,
    exists: listing.indexOf(expectedName) !== -1,
    hashedVariants: listing.filter((name) => hashed.test(name)).sort(),
  };
}

// ─── Local (Vercel-served) asset measurement ─────────────────────────────────

export interface LocalAssetFile {
  /** Path relative to public/images, with forward slashes. */
  path: string;
  bytes: number;
}

export interface LocalAssetSummary {
  totalFiles: number;
  totalBytes: number;
  byCategory: { category: string; files: number; bytes: number }[];
  largest: LocalAssetFile[];
  thumbnails: {
    /** `X.webp` files that have an `X_thumb.webp` sibling. */
    pairs: number;
    fullBytes: number;
    thumbBytes: number;
    savedBytes: number;
    savedPercent: number;
    /** Full-size webp files with no `_thumb` sibling (nothing smaller to offer). */
    fullWithoutThumb: { files: number; bytes: number };
    byCategory: { category: string; pairs: number; fullBytes: number; thumbBytes: number }[];
  };
}

export function categoryOf(path: string): string {
  const slash = path.indexOf('/');
  return slash === -1 ? '(root)' : path.slice(0, slash);
}

export function summarizeLocalAssets(files: LocalAssetFile[], topN = 15): LocalAssetSummary {
  const byCat: Record<string, { files: number; bytes: number }> = {};
  let totalBytes = 0;
  files.forEach((file) => {
    const category = categoryOf(file.path);
    if (!byCat[category]) byCat[category] = { files: 0, bytes: 0 };
    byCat[category].files += 1;
    byCat[category].bytes += file.bytes;
    totalBytes += file.bytes;
  });

  const sizeByPath: Record<string, number> = {};
  files.forEach((file) => {
    sizeByPath[file.path] = file.bytes;
  });

  const pairCat: Record<string, { pairs: number; fullBytes: number; thumbBytes: number }> = {};
  let pairs = 0;
  let fullBytes = 0;
  let thumbBytes = 0;
  let loneFiles = 0;
  let loneBytes = 0;

  files.forEach((file) => {
    if (!/\.webp$/i.test(file.path) || /_thumb\.webp$/i.test(file.path)) return;
    const thumbPath = file.path.replace(/\.webp$/i, '_thumb.webp');
    const thumb = sizeByPath[thumbPath];
    if (thumb === undefined) {
      loneFiles += 1;
      loneBytes += file.bytes;
      return;
    }
    pairs += 1;
    fullBytes += file.bytes;
    thumbBytes += thumb;
    const category = categoryOf(file.path);
    if (!pairCat[category]) pairCat[category] = { pairs: 0, fullBytes: 0, thumbBytes: 0 };
    pairCat[category].pairs += 1;
    pairCat[category].fullBytes += file.bytes;
    pairCat[category].thumbBytes += thumb;
  });

  const savedBytes = fullBytes - thumbBytes;

  return {
    totalFiles: files.length,
    totalBytes,
    byCategory: Object.keys(byCat)
      .map((category) => ({ category, ...byCat[category] }))
      .sort((a, b) => b.bytes - a.bytes || a.category.localeCompare(b.category)),
    largest: files
      .slice()
      .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
      .slice(0, topN),
    thumbnails: {
      pairs,
      fullBytes,
      thumbBytes,
      savedBytes,
      savedPercent: fullBytes > 0 ? (savedBytes / fullBytes) * 100 : 0,
      fullWithoutThumb: { files: loneFiles, bytes: loneBytes },
      byCategory: Object.keys(pairCat)
        .map((category) => ({ category, ...pairCat[category] }))
        .sort((a, b) => b.fullBytes - a.fullBytes || a.category.localeCompare(b.category)),
    },
  };
}

// ─── Text rendering ──────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + new Array(width - text.length + 1).join(' ');
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : new Array(width - text.length + 1).join(' ') + text;
}

/** Plain-text table: header, rule, rows. First column left-aligned, the rest right-aligned. */
export function renderTable(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) =>
    cells.map((cell, i) => (i === 0 ? pad(cell, widths[i]) : padLeft(cell, widths[i]))).join('  ');
  return [line(header), widths.map((w) => new Array(w + 1).join('-')).join('  '), ...rows.map(line)].join('\n');
}

export function renderAuditSummary(summary: AuditSummary): string {
  const out: string[] = [];
  const t = summary.totals;
  out.push(
    `Non-empty image URLs: ${t.nonEmpty}  (local ${t.local}, supabase-storage ${t.supabaseStorage}, external ${t.external}, other ${t.other})`,
  );
  out.push('');
  out.push(
    renderTable(
      ['table.column', 'class', 'count'],
      summary.rows.map((r) => [`${r.table}.${r.column}`, r.class, String(r.count)]),
    ),
  );
  out.push('');
  out.push('Supabase Storage URLs by bucket');
  out.push(
    summary.buckets.length
      ? renderTable(
          ['bucket', 'count'],
          summary.buckets.map((b) => [b.bucket, String(b.count)]),
        )
      : '  none',
  );
  if (summary.externalHosts.length) {
    out.push('');
    out.push('External hosts');
    out.push(
      renderTable(
        ['host', 'count'],
        summary.externalHosts.map((h) => [h.host, String(h.count)]),
      ),
    );
  }
  return out.join('\n');
}

export function renderLocalAssetSummary(summary: LocalAssetSummary): string {
  const out: string[] = [];
  out.push(`public/images: ${summary.totalFiles} files, ${formatBytes(summary.totalBytes)} (${summary.totalBytes} bytes)`);
  out.push('');
  out.push(
    renderTable(
      ['category dir', 'files', 'bytes', 'size'],
      summary.byCategory.map((c) => [c.category, String(c.files), String(c.bytes), formatBytes(c.bytes)]),
    ),
  );
  out.push('');
  out.push(`${summary.largest.length} largest files`);
  out.push(
    renderTable(
      ['path', 'bytes', 'size'],
      summary.largest.map((f) => [f.path, String(f.bytes), formatBytes(f.bytes)]),
    ),
  );
  const th = summary.thumbnails;
  out.push('');
  out.push('Full vs _thumb (X.webp with a sibling X_thumb.webp)');
  out.push(`  pairs:               ${th.pairs}`);
  out.push(`  full total:          ${formatBytes(th.fullBytes)} (${th.fullBytes} bytes)`);
  out.push(`  thumb total:         ${formatBytes(th.thumbBytes)} (${th.thumbBytes} bytes)`);
  out.push(`  saved if thumb-first: ${formatBytes(th.savedBytes)} (${th.savedPercent.toFixed(1)}%)`);
  out.push(
    `  full webp with no thumb: ${th.fullWithoutThumb.files} files, ${formatBytes(th.fullWithoutThumb.bytes)}`,
  );
  if (th.byCategory.length) {
    out.push('');
    out.push(
      renderTable(
        ['category dir', 'pairs', 'full bytes', 'thumb bytes'],
        th.byCategory.map((c) => [c.category, String(c.pairs), String(c.fullBytes), String(c.thumbBytes)]),
      ),
    );
  }
  return out.join('\n');
}
