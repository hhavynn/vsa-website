import fs from 'fs';
import path from 'path';
import { getSharePreviewPages, makeSitemapXml, renderSharePreviewHtml } from '../src/routes/publicSeo';

const buildDirectory = path.resolve(process.argv[2] ?? 'build');
const htmlPath = path.join(buildDirectory, 'index.html');
const template = fs.readFileSync(htmlPath, 'utf8');
const pages = getSharePreviewPages();

const home = pages.find((page) => page.path === '/');
if (!home) {
  throw new Error('Homepage SEO metadata is missing from the public route inventory');
}

const rendered = pages.map((page) => ({
  path: page.path,
  html: renderSharePreviewHtml(template, page),
}));

fs.writeFileSync(htmlPath, rendered.find((page) => page.path === '/')!.html);
fs.writeFileSync(path.join(buildDirectory, 'sitemap.xml'), makeSitemapXml());

for (const page of rendered) {
  if (page.path === '/') continue;
  const target = path.join(buildDirectory, 'seo', `${page.path.slice(1)}.html`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, page.html);
}

process.stdout.write(`Generated sitemap and ${rendered.length} route-specific HTML previews.\n`);
