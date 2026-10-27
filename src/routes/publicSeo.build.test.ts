import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getSharePreviewPages } from './publicSeo';

const root = path.resolve(__dirname, '../..');

describe('generated SEO artifacts (#573)', () => {
  let tempBuild: string;

  beforeEach(() => {
    tempBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'vsa-seo-test-'));
    fs.copyFileSync(path.join(root, 'public/index.html'), path.join(tempBuild, 'index.html'));
  });

  afterEach(() => {
    fs.rmSync(tempBuild, { recursive: true, force: true });
  });

  it('generates sitemap.xml and distinct first-response HTML for public routes', () => {
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/generate-public-seo.ts', tempBuild], {
      cwd: root,
    });

    const xml = fs.readFileSync(path.join(tempBuild, 'sitemap.xml'), 'utf8');
    const fallbackHtml = fs.readFileSync(path.join(tempBuild, 'index.html'), 'utf8');
    const eventsHtml = fs.readFileSync(path.join(tempBuild, 'seo/events.html'), 'utf8');
    const galleryHtml = fs.readFileSync(path.join(tempBuild, 'seo/gallery.html'), 'utf8');

    expect(xml).toContain('https://www.vsaatucsd.com/house/archive');
    expect(xml).not.toContain('/points');
    expect(xml).not.toContain('/feedback');
    expect(fallbackHtml).not.toContain('rel="canonical"');
    expect(eventsHtml).toContain('<title>Events | VSA at UCSD</title>');
    expect(eventsHtml).toContain('property="og:url" content="https://www.vsaatucsd.com/events"');
    expect(galleryHtml).toContain('<title>Gallery | VSA at UCSD</title>');
    expect(galleryHtml).not.toContain('Events | VSA at UCSD');
  });

  it('keeps Vercel first-response rewrites aligned with generated preview routes', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')) as {
      rewrites: { source: string; destination: string }[];
    };
    const expected = getSharePreviewPages()
      .filter((page) => page.path !== '/')
      .map((page) => ({
        source: page.path,
        destination: `/seo${page.path}.html`,
      }));

    expect(config.rewrites.slice(0, expected.length)).toEqual(expected);
    expect(config.rewrites[expected.length]).toEqual({
      source: '/((?!static/).*)',
      destination: '/index.html',
    });
  });

  it('advertises the sitemap and prevents indexing of generated HTML aliases', () => {
    const robots = fs.readFileSync(path.join(root, 'public/robots.txt'), 'utf8');
    expect(robots).toContain('Sitemap: https://www.vsaatucsd.com/sitemap.xml');
    expect(robots).toContain('Disallow: /seo/');
  });
});
