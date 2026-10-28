// Runs as `postbuild`. On Vercel production builds (SENTRY_AUTH_TOKEN set) it
// injects debug IDs, uploads the source maps to Sentry, then deletes them from
// build/ so they are no longer served publicly. Without the token (local
// builds, GitHub CI, the Docker image) it does nothing and the maps stay, so
// `npm run analyze` keeps working. A failed upload never fails the build: the
// maps are kept, which is the pre-Sentry behavior.
// See docs/observability-instrumentation-plan.md (Phase 2).
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ORG = 'havyn';
const DEFAULT_PROJECT = 'vsa-website';

export function findSourceMaps(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findSourceMaps(full);
    return entry.name.endsWith('.map') ? [full] : [];
  });
}

function runSentryCli(args) {
  const require = createRequire(import.meta.url);
  // The token reaches sentry-cli through the inherited environment, never argv.
  execFileSync(require('@sentry/cli').SentryCli.getPath(), args, { stdio: 'inherit' });
}

export function uploadSourceMaps({
  env = process.env,
  buildDir = 'build',
  exec = runSentryCli,
  remove = (file) => rmSync(file),
  log = console.log,
  warn = console.warn,
} = {}) {
  if (!env.SENTRY_AUTH_TOKEN) {
    log('Sentry source maps: SENTRY_AUTH_TOKEN is not set, so nothing was uploaded and the maps were kept.');
    return 'skipped';
  }

  const maps = findSourceMaps(buildDir);
  if (maps.length === 0) {
    warn(`Sentry source maps: no .map files under ${buildDir}/, nothing to upload.`);
    return 'no-maps';
  }

  const jsDir = join(buildDir, 'static', 'js');
  const release = env.VERCEL_GIT_COMMIT_SHA || env.REACT_APP_VERCEL_GIT_COMMIT_SHA;
  try {
    exec(['sourcemaps', 'inject', jsDir]);
    exec([
      'sourcemaps', 'upload',
      '--org', env.SENTRY_ORG || DEFAULT_ORG,
      '--project', env.SENTRY_PROJECT || DEFAULT_PROJECT,
      ...(release ? ['--release', release] : []),
      jsDir,
    ]);
  } catch (error) {
    warn(`Sentry source maps: upload failed (${error.message}); keeping the maps so this deploy is unaffected.`);
    return 'failed';
  }

  for (const map of maps) remove(map);
  log(`Sentry source maps: uploaded, then removed ${maps.length} .map files from ${buildDir}/.`);
  return 'uploaded';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  uploadSourceMaps();
}
