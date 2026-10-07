import fs from 'fs';
import path from 'path';

type Header = { key: string; value: string };
type Config = {
  headers: { source: string; headers: Header[] }[];
  rewrites: { source: string; destination: string }[];
};

const config: Config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'));

// Vercel `source` values are path patterns; the ones used here are plain regex groups.
const matches = (source: string, requestPath: string) => new RegExp(`^${source}$`).test(requestPath);

function headersFor(requestPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  config.headers
    .filter(({ source }) => matches(source, requestPath))
    .forEach(({ headers }) => headers.forEach(({ key, value }) => (result[key.toLowerCase()] = value)));
  return result;
}

const rewriteFor = (requestPath: string) =>
  config.rewrites.find(({ source }) => matches(source, requestPath))?.destination;

describe('vercel.json deploy-safety policy', () => {
  it('caches fingerprinted /static assets as immutable', () => {
    const cacheControl = headersFor('/static/js/main.abc123.js')['cache-control'];
    expect(cacheControl).toContain('immutable');
    expect(cacheControl).toMatch(/max-age=31536000/);
  });

  it.each(['/', '/events', '/admin/members', '/index.html'])('never lets %s go stale across deploys', (requestPath) => {
    const cacheControl = headersFor(requestPath)['cache-control'];
    expect(cacheControl).toBeDefined();
    expect(cacheControl).not.toContain('immutable');
    expect(cacheControl).toMatch(/max-age=0|no-cache|no-store/);
  });

  it('does not rewrite missing /static files to the SPA shell', () => {
    expect(rewriteFor('/static/js/123.deadbeef.chunk.js')).toBeUndefined();
  });

  it.each(['/', '/events', '/house/2025', '/admin/members'])('still serves deep link %s from the SPA shell', (requestPath) => {
    expect(rewriteFor(requestPath)).toBe('/index.html');
  });

  it.each([
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'x-frame-options',
    'strict-transport-security',
  ])('keeps the %s security header on every page and asset', (header) => {
    ['/', '/events', '/static/js/main.abc123.js'].forEach((requestPath) => {
      expect(headersFor(requestPath)[header]).toBeDefined();
    });
  });
});
