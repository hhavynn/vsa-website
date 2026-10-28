#!/usr/bin/env node
/**
 * scripts/generate-seo-assets.ts (#573)
 *
 * Writes the public SEO assets into the CRA build output:
 *   - sitemap.xml, generated from the public route manifest
 *   - one prerendered HTML shell per public route, carrying that route's title,
 *     description, canonical URL and Open Graph / Twitter tags
 *   - spa.html, the neutral shell that answers deep links with no prerendered
 *     page of their own (so they never inherit the home page's canonical URL)
 *
 * Run automatically after `npm run build` (see the `postbuild` script).
 *
 * Why prerender at all: the app is a client-rendered SPA, and link unfurlers
 * (Discord, iMessage, Slack, Twitter) read the HTML they fetch without running
 * JavaScript. Tags injected after React mounts never reach them. The generated
 * shells keep the same bundle as index.html, so the app still boots normally.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { planSeoAssets } from '../src/lib/seo/metadata';

const buildDir = resolve(process.cwd(), 'build');
const shellPath = join(buildDir, 'index.html');

let shellHtml: string;
try {
  shellHtml = readFileSync(shellPath, 'utf8');
} catch (error) {
  console.error(
    `Cannot read ${shellPath}: ${(error as Error).message}\nRun \`npm run build\` first.`
  );
  process.exit(2);
}

const assets = planSeoAssets(shellHtml);

for (const asset of assets) {
  const target = join(buildDir, asset.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, asset.content, 'utf8');
}

console.log(
  `Generated ${assets.length} SEO assets in build/: ${assets.map((asset) => asset.path).join(', ')}`
);
