/**
 * Public route metadata: the single implementation behind the sitemap, the
 * prerendered per-route HTML shells, and the client-side tags the router keeps
 * in sync while a visitor moves between routes (#573).
 *
 * Everything here is derived from the public route manifest
 * (src/routes/publicRouteSeo.ts) so the sitemap, the share previews and the
 * live page can never advertise different things.
 *
 * Public-bundle note: this module is safe to import in the browser. The DOM
 * helpers only touch `document` when called, and the build script only uses the
 * pure helpers.
 */

import {
  PUBLIC_ROUTE_SEO,
  type PublicRouteSeo,
  isNonIndexablePublicPath,
} from '../../routes/publicRouteSeo';

export const SITE_ORIGIN = 'https://www.vsaatucsd.com';
export const SITE_NAME = 'VSA at UCSD';
export const SITE_DESCRIPTION =
  'Vietnamese Student Association at UC San Diego - Building community and celebrating Vietnamese culture';
export const DEFAULT_SHARE_IMAGE = `${SITE_ORIGIN}/vsa-share-thumbnail.jpg`;
export const DEFAULT_SHARE_IMAGE_ALT = 'VSA at UC San Diego lantern artwork';

/** A file the build step writes into `build/`. */
export interface SeoAsset {
  /** Path relative to the build output directory. */
  path: string;
  content: string;
}

// ── URLs and titles ──────────────────────────────────────────────────────────

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export function buildDocumentTitle(title: string): string {
  return `${title} | ${SITE_NAME}`;
}

/** Where a route's prerendered HTML lives inside the build output. */
export function routeOutputPath(path: string): string {
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `${trimmed}/index.html` : 'index.html';
}

// ── Escaping ─────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(value: string): string {
  return escapeHtml(value);
}

// ── Sitemap ──────────────────────────────────────────────────────────────────

/**
 * A deterministic sitemap: the same manifest always produces byte-identical XML.
 * No build timestamp is written, so rebuilding does not churn the file.
 */
export function buildSitemapXml(routes: PublicRouteSeo[] = PUBLIC_ROUTE_SEO): string {
  const entries = routes.map((route) => {
    const lines = [`    <loc>${escapeXml(absoluteUrl(route.path))}</loc>`];
    if (route.changeFrequency) {
      lines.push(`    <changefreq>${route.changeFrequency}</changefreq>`);
    }
    if (typeof route.priority === 'number') {
      lines.push(`    <priority>${route.priority.toFixed(1)}</priority>`);
    }
    return `  <url>\n${lines.join('\n')}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

// ── Head tags ────────────────────────────────────────────────────────────────

/** The tags a route owns: everything the generator replaces per route. */
const MANAGED_META_KEYS: Array<{ attribute: 'name' | 'property'; key: string }> = [
  { attribute: 'name', key: 'description' },
  { attribute: 'property', key: 'og:title' },
  { attribute: 'property', key: 'og:description' },
  { attribute: 'property', key: 'og:url' },
  { attribute: 'property', key: 'og:type' },
  { attribute: 'property', key: 'og:image' },
  { attribute: 'property', key: 'og:image:alt' },
  { attribute: 'name', key: 'twitter:card' },
  { attribute: 'name', key: 'twitter:title' },
  { attribute: 'name', key: 'twitter:description' },
  { attribute: 'name', key: 'twitter:image' },
  { attribute: 'name', key: 'twitter:image:alt' },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasAttributeValue(tag: string, attribute: string, value: string): boolean {
  return new RegExp(`${attribute}\\s*=\\s*["']${escapeRegExp(value)}["']`, 'i').test(tag);
}

/** The head tags for one route. */
export function buildRouteHeadTags(route: PublicRouteSeo): string {
  const documentTitle = route.documentTitle ?? buildDocumentTitle(route.title);
  const canonical = absoluteUrl(route.path);
  const image = route.image ?? DEFAULT_SHARE_IMAGE;
  const imageAlt = route.imageAlt ?? DEFAULT_SHARE_IMAGE_ALT;

  return [
    `<title>${escapeHtml(documentTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(documentTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${escapeHtml(documentTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`,
  ].join('\n');
}

/**
 * The neutral shell's tags. No canonical and no og:url on purpose: this shell
 * also answers deep links that have no prerendered page of their own, and a
 * canonical pointing at the home page would tell crawlers to drop them.
 */
export function buildDefaultHeadTags(): string {
  return [
    `<title>${escapeHtml(SITE_NAME)}</title>`,
    `<meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />`,
    `<meta property="og:title" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:description" content="${escapeHtml(SITE_DESCRIPTION)}" />`,
    '<meta property="og:type" content="website" />',
  ].join('\n');
}

/**
 * Removes the route-owned tags (and the title) from an HTML document.
 *
 * The CRA build minifies index.html onto a single line, so the tags are matched
 * anywhere in the document rather than line by line; the whitespace the removals
 * leave behind is normalised away so the result is stable no matter how often
 * the generator runs.
 */
export function stripRouteHeadTags(html: string): string {
  let output = html.replace(/<title>[\s\S]*?<\/title>/gi, '');
  output = output.replace(/<meta\b[^>]*>/gi, (tag) =>
    MANAGED_META_KEYS.some(({ attribute, key }) => hasAttributeValue(tag, attribute, key))
      ? ''
      : tag
  );
  output = output.replace(/<link\b[^>]*>/gi, (tag) =>
    hasAttributeValue(tag, 'rel', 'canonical') ? '' : tag
  );

  return output
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

/** Inserts a block of head tags just before `</head>`. */
export function injectHeadTags(html: string, tags: string): string {
  const block = tags
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  if (html.includes('</head>')) {
    // The whitespace in front of </head> is consumed, so repeated runs produce
    // byte-identical output instead of accumulating blank lines.
    return html.replace(/\s*<\/head>/, `\n${block}\n  </head>`);
  }
  return `${html}\n${block}\n`;
}

/**
 * Every file the build step writes: the sitemap, the neutral SPA shell, and one
 * prerendered shell per public route. All contents are derived from the same
 * CRA output, so the plan is independent of write order and repeatable.
 */
export function planSeoAssets(shellHtml: string): SeoAsset[] {
  const assets: SeoAsset[] = [
    { path: 'sitemap.xml', content: buildSitemapXml(PUBLIC_ROUTE_SEO) },
    {
      path: 'spa.html',
      content: injectHeadTags(stripRouteHeadTags(shellHtml), buildDefaultHeadTags()),
    },
  ];

  PUBLIC_ROUTE_SEO.forEach((route) => {
    assets.push({
      path: routeOutputPath(route.path),
      content: injectHeadTags(stripRouteHeadTags(shellHtml), buildRouteHeadTags(route)),
    });
  });

  return assets;
}

// ── Browser metadata ─────────────────────────────────────────────────────────

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function removeMeta(attribute: 'name' | 'property', key: string): void {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function removeCanonical(): void {
  document.head.querySelector('link[rel="canonical"]')?.remove();
}

/** Applies a route's metadata to the live document. */
export function applyRouteMetadata(route: PublicRouteSeo, titleOverride?: string): void {
  const documentTitle = route.documentTitle ?? buildDocumentTitle(titleOverride ?? route.title);
  const canonical = absoluteUrl(route.path);
  const image = route.image ?? DEFAULT_SHARE_IMAGE;
  const imageAlt = route.imageAlt ?? DEFAULT_SHARE_IMAGE_ALT;

  document.title = documentTitle;

  upsertMeta('name', 'description', route.description);
  upsertMeta('property', 'og:title', documentTitle);
  upsertMeta('property', 'og:description', route.description);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:image:alt', imageAlt);
  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', documentTitle);
  upsertMeta('name', 'twitter:description', route.description);
  upsertMeta('name', 'twitter:image', image);
  upsertMeta('name', 'twitter:image:alt', imageAlt);

  upsertCanonical(canonical);
  removeMeta('name', 'robots');
}

/**
 * Applies metadata for a route the manifest does not own (admin pages, retired
 * URLs, parameterized House pages). Those get an accurate title and description
 * but no canonical URL, and the explicitly non-indexable paths get `noindex`.
 */
export function applyNonIndexableMetadata(pathname: string, title?: string): void {
  const documentTitle = title ? buildDocumentTitle(title) : SITE_NAME;

  document.title = documentTitle;

  upsertMeta('name', 'description', SITE_DESCRIPTION);
  upsertMeta('property', 'og:title', documentTitle);
  upsertMeta('property', 'og:description', SITE_DESCRIPTION);
  upsertMeta('property', 'og:url', absoluteUrl(pathname));

  removeCanonical();

  if (isNonIndexablePublicPath(pathname)) {
    upsertMeta('name', 'robots', 'noindex, nofollow');
  } else {
    removeMeta('name', 'robots');
  }
}
