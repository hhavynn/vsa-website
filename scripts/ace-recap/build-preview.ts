/**
 * Builds the PRIVATE interactive preview as one self-contained HTML file
 * (app + styles + local fonts + snapshot inline). A strict CSP blocks every
 * network request, so nothing in it can reach a third party. Open it straight from disk: no server,
 * no route on the website, no deployment, nothing uploaded.
 *
 *   npx tsx scripts/ace-recap/build-preview.ts \
 *     --snapshot <private>/recap-snapshot.json --out <private>/preview
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { assertPrivateDir, requireArg } from './privateIo';

/**
 * Inline the OFL fonts the video project already installs, so the private
 * preview never fetches anything from a third party. Falls back to system
 * fonts (and says so) if the video project has not been installed.
 */
function localFontFaces(repo: string): string {
  const base = path.join(repo, 'tools/ace-recap-video/node_modules/@fontsource');
  const faces: Array<[string, string, string, string]> = [
    ['DM Sans', 'dm-sans/files/dm-sans-latin-400-normal.woff2', '400', 'normal'],
    ['DM Sans', 'dm-sans/files/dm-sans-latin-500-normal.woff2', '500', 'normal'],
    ['DM Sans', 'dm-sans/files/dm-sans-latin-600-normal.woff2', '600', 'normal'],
    ['DM Sans', 'dm-sans/files/dm-sans-latin-700-normal.woff2', '700', 'normal'],
    ['Instrument Serif', 'instrument-serif/files/instrument-serif-latin-400-normal.woff2', '400', 'normal'],
    ['Instrument Serif', 'instrument-serif/files/instrument-serif-latin-400-italic.woff2', '400', 'italic'],
    ['JetBrains Mono', 'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', '400', 'normal'],
  ];
  const css = faces.filter(([, file]) => existsSync(path.join(base, file))).map(([family, file, weight, style]) =>
    `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};font-display:block;src:url(data:font/woff2;base64,${readFileSync(path.join(base, file)).toString('base64')}) format("woff2")}`);
  if (css.length < faces.length) console.warn('Some local fonts are missing (run npm ci in tools/ace-recap-video); the preview falls back to system fonts.');
  return css.join('');
}

async function main() {
  const out = assertPrivateDir(requireArg('out'));
  const snapshotFile = requireArg('snapshot');
  const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'));
  if (snapshot.version !== 1) throw new Error('Unsupported snapshot version');
  const repo = process.cwd();
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'ace-recap-preview-'));
  try {
    const js = await build({
      entryPoints: [path.join(repo, 'src/components/features/ace/recap/preview/main.tsx')],
      bundle: true, minify: true, format: 'iife', target: 'es2019', write: false,
      jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'warning',
    });
    const cssIn = path.join(tmp, 'in.css');
    writeFileSync(cssIn, readFileSync(path.join(repo, 'src/index.css'), 'utf8') + '\n' + readFileSync(path.join(repo, 'src/styles/ace.css'), 'utf8'));
    const cssOut = path.join(tmp, 'out.css');
    execFileSync(path.join(repo, 'node_modules/.bin/tailwindcss'), [
      '-c', path.join(repo, 'tailwind.config.js'), '-i', cssIn, '-o', cssOut, '--minify',
      '--content', path.join(repo, 'src/components/features/ace/**/*.tsx'),
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
    // "</script" inside JSON would end the data block early.
    const data = JSON.stringify(snapshot).replace(/<\/(script)/gi, '<\\/$1');
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>ACE ${snapshot.cycle.label} · private preview</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; img-src data:">
<style>${localFontFaces(repo)}</style>
<style>${readFileSync(cssOut, 'utf8')}</style>
<style>body{background:var(--color-bg,var(--color-surface));color:var(--color-text);font-family:"DM Sans",system-ui,sans-serif}</style>
</head><body><div id="root"></div>
<script type="application/json" id="ace-recap-snapshot">${data}</script>
<script>${js.outputFiles[0].text}</script>
</body></html>`;
    const file = path.join(out, 'index.html');
    writeFileSync(file, html, { mode: 0o600 });
    console.log(`Private preview: ${file} (${(html.length / 1024).toFixed(0)} KB). Open it directly in a browser.`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
