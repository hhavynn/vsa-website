/**
 * Sitemap and head-tag generation (#573).
 *
 * The sitemap is what search engines crawl, so the checks here are about what
 * it must contain, what it must never contain, and that generating it twice
 * produces the same bytes.
 */
import {
  DEFAULT_SHARE_IMAGE,
  SITE_ORIGIN,
  absoluteUrl,
  buildDefaultHeadTags,
  buildDocumentTitle,
  buildRouteHeadTags,
  buildSitemapXml,
  escapeHtml,
  injectHeadTags,
  planSeoAssets,
  routeOutputPath,
  stripRouteHeadTags,
} from './metadata';
import { PUBLIC_ROUTE_SEO } from '../../routes/publicRouteSeo';

const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="old description" />
    <meta property="og:site_name" content="VSA at UCSD" />
    <meta property="og:title" content="old title" />
    <meta property="og:image" content="old image" />
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href="https://example.com/old" />
    <title>old title</title>
    <script src="/static/js/main.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

/** The CRA build minifies index.html onto one line; the generator must cope. */
const MINIFIED_SHELL =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"/>' +
  '<meta name="description" content="old description"/>' +
  '<meta property="og:site_name" content="VSA at UCSD"/>' +
  '<meta property="og:title" content="old title"/>' +
  '<meta property="og:image" content="old image"/>' +
  '<meta name="twitter:card" content="summary"/><title>old title</title>' +
  '<script>!function(){try{var e=localStorage.getItem("theme");document.documentElement.classList.add("dark")}catch(e){}}()</script>' +
  '<script defer="defer" src="/static/js/main.js"></script></head><body><div id="root"></div></body></html>';

const countOf = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe('buildSitemapXml', () => {
  it('lists every indexable public route with its absolute URL', () => {
    const xml = buildSitemapXml();
    PUBLIC_ROUTE_SEO.forEach((route) => {
      expect(xml).toContain(`<loc>${absoluteUrl(route.path)}</loc>`);
    });
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
    expect(xml.match(/<url>/g)).toHaveLength(PUBLIC_ROUTE_SEO.length);
  });

  it('never lists a private, administrative or non-indexable route', () => {
    const xml = buildSitemapXml();
    ['/admin', '/profile', '/points', '/feedback', '/signin'].forEach((path) => {
      expect(xml).not.toContain(`<loc>${SITE_ORIGIN}${path}</loc>`);
      expect(xml).not.toContain(`<loc>${SITE_ORIGIN}${path}<`);
    });
  });

  it('is deterministic', () => {
    expect(buildSitemapXml()).toBe(buildSitemapXml());
    expect(buildSitemapXml()).toBe(buildSitemapXml(PUBLIC_ROUTE_SEO));
  });

  it('is a well-formed sitemap document', () => {
    const xml = buildSitemapXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml).not.toMatch(/<lastmod>/);
  });
});

describe('head tags', () => {
  it('gives a route a title, description, canonical URL and share tags', () => {
    const route = PUBLIC_ROUTE_SEO.find((entry) => entry.path === '/events')!;
    const tags = buildRouteHeadTags(route);

    expect(tags).toContain(`<title>${escapeHtml(buildDocumentTitle(route.title))}</title>`);
    expect(tags).toContain(`<meta name="description" content="${escapeHtml(route.description)}" />`);
    expect(tags).toContain(`<link rel="canonical" href="${absoluteUrl('/events')}" />`);
    expect(tags).toContain(`<meta property="og:title"`);
    expect(tags).toContain(`<meta property="og:description"`);
    expect(tags).toContain(`<meta property="og:url" content="${absoluteUrl('/events')}" />`);
    expect(tags).toContain(`<meta property="og:image" content="${DEFAULT_SHARE_IMAGE}" />`);
    expect(tags).toContain('<meta name="twitter:card" content="summary" />');
    expect(tags).toContain('<meta name="twitter:title"');
    expect(tags).toContain('<meta name="twitter:description"');
    expect(tags).toContain('<meta name="twitter:image"');
  });

  it('gives every route a unique title and description', () => {
    const titles = PUBLIC_ROUTE_SEO.map((route) => buildRouteHeadTags(route));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('escapes markup in copy', () => {
    const tags = buildRouteHeadTags({
      path: '/x',
      title: 'A & B',
      description: '<script>"x"</script>',
    });
    expect(tags).not.toContain('<script>');
    expect(tags).toContain('&lt;script&gt;');
  });

  it('strips the route-owned tags it replaces, and does so idempotently', () => {
    const once = stripRouteHeadTags(SHELL);
    expect(once).not.toContain('<title>');
    expect(once).not.toContain('name="description"');
    expect(once).not.toContain('property="og:title"');
    expect(once).not.toContain('rel="canonical"');
    expect(once).toContain('property="og:site_name"');
    expect(once).toContain('<script src="/static/js/main.js"></script>');
    expect(stripRouteHeadTags(once)).toBe(once);
  });

  it('keeps the neutral shell free of a canonical URL', () => {
    const defaultTags = buildDefaultHeadTags();
    expect(defaultTags).not.toContain('rel="canonical"');
    expect(defaultTags).toContain('<title>VSA at UCSD</title>');
  });

  it('injects tags into the head', () => {
    const html = injectHeadTags(SHELL, '<title>New</title>');
    expect(html).toContain('<title>New</title>');
    expect(html.indexOf('<title>New</title>')).toBeLessThan(html.indexOf('</head>'));
  });
});

describe('planSeoAssets', () => {
  const assets = planSeoAssets(SHELL);
  const paths = assets.map((asset) => asset.path);

  it('writes the sitemap, the neutral shell and one shell per public route', () => {
    expect(paths).toContain('sitemap.xml');
    expect(paths).toContain('spa.html');
    expect(paths).toContain('index.html');
    PUBLIC_ROUTE_SEO.forEach((route) => {
      expect(paths).toContain(routeOutputPath(route.path));
    });
  });

  it('writes no file for a private or non-indexable route', () => {
    ['admin', 'profile', 'points', 'feedback', 'signin'].forEach((path) => {
      expect(paths).not.toContain(`${path}/index.html`);
    });
  });

  it('gives the home page its own metadata and deep links the neutral shell', () => {
    const home = assets.find((asset) => asset.path === 'index.html')!.content;
    const neutral = assets.find((asset) => asset.path === 'spa.html')!.content;

    expect(home).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/" />`);
    expect(home).toContain('<title>VSA at UCSD — Vietnamese Student Association at UC San Diego</title>');
    expect(neutral).not.toContain('rel="canonical"');
  });

  it('is repeatable', () => {
    const first = planSeoAssets(SHELL);
    const second = planSeoAssets(first.find((asset) => asset.path === 'index.html')!.content);
    first.forEach((asset, index) => {
      expect(second[index].path).toBe(asset.path);
      expect(second[index].content).toBe(asset.content);
    });
  });

  it('is repeatable from the minified shell the CRA build produces', () => {
    const first = planSeoAssets(MINIFIED_SHELL);
    const second = planSeoAssets(
      first.find((asset) => asset.path === 'index.html')!.content
    );
    first.forEach((asset, index) => {
      expect(second[index].path).toBe(asset.path);
      expect(second[index].content).toBe(asset.content);
    });
  });

  it('replaces the shell tags instead of adding a second copy', () => {
    const home = planSeoAssets(MINIFIED_SHELL).find(
      (asset) => asset.path === 'index.html'
    )!.content;

    expect(countOf(home, /<title>/g)).toBe(1);
    expect(countOf(home, /name="description"/g)).toBe(1);
    expect(countOf(home, /rel="canonical"/g)).toBe(1);
    expect(countOf(home, /property="og:title"/g)).toBe(1);
    expect(countOf(home, /name="twitter:title"/g)).toBe(1);
    expect(home).not.toContain('old description');
    expect(home).not.toContain('old title');
  });

  it('leaves the inline theme script byte-for-byte intact', () => {
    // The inline script is hashed by the CSP allowlist (config/csp-script-hashes.json),
    // so the generated shells must not touch a single byte of it.
    const inlineScript = (html: string) => /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? null;

    planSeoAssets(MINIFIED_SHELL).forEach((asset) => {
      if (!asset.path.endsWith('.html')) return;
      expect(inlineScript(asset.content)).toBe(inlineScript(MINIFIED_SHELL));
    });
  });
});

describe('routeOutputPath', () => {
  it('maps a route to a directory index inside the build output', () => {
    expect(routeOutputPath('/')).toBe('index.html');
    expect(routeOutputPath('/events')).toBe('events/index.html');
    expect(routeOutputPath('/house/archive')).toBe('house/archive/index.html');
    expect(routeOutputPath('/vcn/current')).toBe('vcn/current/index.html');
  });
});
