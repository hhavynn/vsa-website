#!/usr/bin/env node
/**
 * scripts/check-csp-inline-hashes.mjs (#222, epic #205)
 *
 * Fails if the inline <script>s in `build/index.html` are not exactly the ones
 * allowlisted in `config/csp-script-hashes.json`, or if the draft `script-src`
 * in docs/security-headers-and-csp.md names different hashes.
 *
 * Why the BUILT file: CRA minifies the inline theme bootstrap, and browsers hash
 * the bytes they are served, so `public/index.html` would give the wrong hash.
 *
 * Usage (run after `npm run build`):
 *   npm run check:csp-hashes
 *   node scripts/check-csp-inline-hashes.mjs [--html build/index.html]
 *
 * To regenerate after an intentional change to the inline script: build, run this
 * check, then copy the "actual hash" it prints into config/csp-script-hashes.json
 * AND the `script-src` line in the doc.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkInlineScripts,
  extractDocScriptSrcHashes,
  sameHashSet,
} from './lib/cspInlineHashes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argIndex = process.argv.indexOf('--html');
const htmlPath = resolve(root, argIndex > -1 ? process.argv[argIndex + 1] : 'build/index.html');
const allowlistPath = resolve(root, 'config/csp-script-hashes.json');
const docPath = resolve(root, 'docs/security-headers-and-csp.md');

const quote = hashes => hashes.map(hash => `'${hash}'`).join(', ') || '(none)';
const failures = [];

let html;
try {
  html = readFileSync(htmlPath, 'utf8');
} catch (error) {
  console.error(`Cannot read ${htmlPath}: ${error.message}\nRun \`npm run build\` first.`);
  process.exit(2);
}

const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')).hashes.map(entry => entry.hash);
const { found, unexpected, stale } = checkInlineScripts(html, allowlist);

for (const script of unexpected) {
  failures.push(
    `Inline script not in the allowlist (an enforced CSP would block it).\n` +
      `  actual hash: '${script.hash}'\n` +
      `  expected one of: ${quote(allowlist)}\n` +
      `  script starts with: ${script.text.trim().slice(0, 100).replace(/\s+/g, ' ')}`
  );
}
for (const hash of stale) {
  failures.push(
    `Stale allowlist entry: '${hash}' matches no inline script in ${htmlPath}.\n` +
      `  Remove it from config/csp-script-hashes.json and the doc, or replace it with the actual hash.`
  );
}

const docHashes = extractDocScriptSrcHashes(readFileSync(docPath, 'utf8'));
if (docHashes === null || !sameHashSet(docHashes, allowlist)) {
  failures.push(
    `docs/security-headers-and-csp.md script-src does not match config/csp-script-hashes.json.\n` +
      `  doc:       ${docHashes === null ? '(no script-src line)' : quote(docHashes)}\n` +
      `  allowlist: ${quote(allowlist)}`
  );
}

if (failures.length > 0) {
  console.error(`CSP inline-script check FAILED (${failures.length}):\n`);
  for (const failure of failures) console.error(`- ${failure}\n`);
  process.exit(1);
}

console.log(
  `CSP inline-script check passed: ${found.length} inline script(s) in ${htmlPath}, ` +
    `all allowlisted (${quote(found.map(script => script.hash))}); doc agrees.`
);
