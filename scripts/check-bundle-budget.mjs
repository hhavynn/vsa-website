#!/usr/bin/env node
// Initial-load bundle budget check (#300).
//
// Fails the build when the entry chunk (`build/static/js/main.*.js`) grows
// beyond the recorded budget in scripts/bundle-budget.json. Route-level
// (`React.lazy`) chunks are not checked: they are fetched on navigation, not
// on first paint. When a legitimate feature grows the entry chunk, raise the
// budget in scripts/bundle-budget.json in the same PR and say why.
//
// Run after `npm run build`. Uses only Node built-ins.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';

const require_ = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

let budgetPath = path.join(here, 'bundle-budget.json');
let budget;
try {
  budget = require_(budgetPath);
} catch (error) {
  console.error(`Cannot read budget file ${budgetPath}: ${error.message}`);
  process.exit(1);
}

let mainFile;
try {
  const listing = execSync(
    `ls ${path.join(path.dirname(here), 'build/static/js/main.*.js')}`,
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n');
  const chunks = listing.filter((f) => !f.endsWith('.LICENSE.txt'));
  if (chunks.length !== 1) {
    console.error(`Expected exactly one main chunk, found: ${chunks.join(', ')}`);
    process.exit(1);
  }
  mainFile = chunks[0];
} catch (error) {
  console.error('No build output found. Run `npm run build` first.', error.message);
  process.exit(1);
}

const bytes = zlib.gzipSync(readFileSync(mainFile)).length;
const limit = budget.mainJsGzipBytes;

console.log(`Entry chunk:      ${path.basename(mainFile)}`);
console.log(`gzip size:        ${bytes} B (${(bytes / 1024).toFixed(1)} kB)`);
console.log(`budget:           ${limit} B (${(limit / 1024).toFixed(1)} kB)`);
console.log(`headroom:         ${limit - bytes} B (${(((limit - bytes) / limit) * 100).toFixed(1)}%)`);

if (bytes > limit) {
  console.error(
    `\nBUNDLE BUDGET EXCEEDED: the entry chunk grew to ${(bytes / 1024).toFixed(1)} kB gzip, ` +
      `above the recorded budget of ${(limit / 1024).toFixed(1)} kB. The entry chunk loads on ` +
      'every anonymous visitor\'s first paint, so growth here needs a named justification. ' +
      'Either move the new code behind a React.lazy boundary (see routes/index.tsx) or, if ' +
      'it genuinely must ship eagerly, raise `mainJsGzipBytes` in scripts/bundle-budget.json ' +
      'and explain the change in the PR (#300).',
  );
  process.exit(1);
}
console.log('OK: entry chunk within budget.');
