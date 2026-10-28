import { PUBLIC_ROUTE_DECISIONS } from './publicRouteInventory';

export const SITE_ORIGIN = 'https://www.vsaatucsd.com';

export interface SharePreviewPage {
  path: string;
  title: string;
  description: string;
}

const NON_CANONICAL = new Set(['alias', 'redirect', 'unlinked']);

export function getSitemapPaths(): string[] {
  return Object.entries(PUBLIC_ROUTE_DECISIONS)
    .filter(([path, decision]) =>
      !path.startsWith('/admin') &&
      !path.includes(':') &&
      !decision.noIndex &&
      !decision.placements.some((placement) => NON_CANONICAL.has(placement))
    )
    .map(([path]) => path)
    .sort((a, b) => a.localeCompare(b));
}

export function getSharePreviewPages(): SharePreviewPage[] {
  const indexable = new Set(getSitemapPaths());
  return Object.entries(PUBLIC_ROUTE_DECISIONS)
    .filter(([path, decision]) => indexable.has(path) && decision.seo !== undefined)
    .map(([path, decision]) => ({ path, ...decision.seo! }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function escapeMarkup(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });
}

export function canonicalUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

export function makeSitemapXml(): string {
  const entries = getSitemapPaths().map((path) =>
    `  <url><loc>${escapeMarkup(canonicalUrl(path))}</loc></url>`
  );
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...entries, '</urlset>', ''].join('\n');
}

export function renderSharePreviewHtml(template: string, page: SharePreviewPage): string {
  const region = /<meta\b[^>]*\bname="vsa-seo-start"[^>]*>[\s\S]*?<meta\b[^>]*\bname="vsa-seo-end"[^>]*>/;
  if (!region.test(template) || !/<title>[^<]*<\/title>/.test(template)) {
    throw new Error('Build HTML is missing the public SEO markers or title');
  }

  const title = escapeMarkup(page.title);
  const description = escapeMarkup(page.description);
  const url = escapeMarkup(canonicalUrl(page.path));
  const image = `${SITE_ORIGIN}/vsa-share-thumbnail.jpg`;
  const tags = [
    '<meta name="vsa-seo-start" content="1" />',
    `<meta name="description" content="${description}" />`,
    ...(page.path === '/' ? [] : [`<link rel="canonical" href="${url}" />`]),
    '<meta property="og:site_name" content="VSA at UCSD" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="909" />',
    '<meta property="og:image:height" content="909" />',
    '<meta property="og:image:alt" content="VSA at UC San Diego lantern artwork" />',
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    '<meta name="twitter:image:alt" content="VSA at UC San Diego lantern artwork" />',
    '<meta name="vsa-seo-end" content="1" />',
  ].join('\n');

  return template.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(region, tags);
}
