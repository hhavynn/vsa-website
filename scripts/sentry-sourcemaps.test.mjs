import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findSourceMaps, uploadSourceMaps } from './sentry-sourcemaps.mjs';

function fakeBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'vsa-build-'));
  mkdirSync(join(dir, 'static', 'js'), { recursive: true });
  mkdirSync(join(dir, 'static', 'css'), { recursive: true });
  for (const file of ['static/js/main.abc.js', 'static/js/main.abc.js.map', 'static/js/9686.def.chunk.js.map', 'static/css/main.123.css.map', 'index.html']) {
    writeFileSync(join(dir, file), 'x');
  }
  return dir;
}

const quiet = { log: () => {}, warn: () => {} };

test('finds every .map file and tolerates a missing build directory', () => {
  const dir = fakeBuild();
  assert.equal(findSourceMaps(dir).length, 3);
  assert.deepEqual(findSourceMaps(join(dir, 'missing')), []);
});

test('without SENTRY_AUTH_TOKEN it runs nothing and keeps the maps', () => {
  const dir = fakeBuild();
  const calls = [];
  const result = uploadSourceMaps({ env: {}, buildDir: dir, exec: (args) => calls.push(args), ...quiet });
  assert.equal(result, 'skipped');
  assert.deepEqual(calls, []);
  assert.equal(findSourceMaps(dir).length, 3);
});

test('with a token it injects, uploads with the release, then deletes every map', () => {
  const dir = fakeBuild();
  const calls = [];
  const env = { SENTRY_AUTH_TOKEN: 'set', VERCEL_GIT_COMMIT_SHA: 'abc123' };
  const result = uploadSourceMaps({ env, buildDir: dir, exec: (args) => calls.push(args), ...quiet });

  assert.equal(result, 'uploaded');
  const jsDir = join(dir, 'static', 'js');
  assert.deepEqual(calls, [
    ['sourcemaps', 'inject', jsDir],
    ['sourcemaps', 'upload', '--org', 'havyn', '--project', 'vsa-website', '--release', 'abc123', jsDir],
  ]);
  assert.equal(calls.flat().includes('set'), false, 'the token must never be passed on argv');
  assert.deepEqual(findSourceMaps(dir), []);
  assert.equal(existsSync(join(dir, 'static', 'js', 'main.abc.js')), true);
});

test('a failed upload keeps the maps and does not throw', () => {
  const dir = fakeBuild();
  const result = uploadSourceMaps({
    env: { SENTRY_AUTH_TOKEN: 'set' },
    buildDir: dir,
    exec: (args) => {
      if (args[1] === 'upload') throw new Error('network down');
    },
    ...quiet,
  });
  assert.equal(result, 'failed');
  assert.equal(findSourceMaps(dir).length, 3);
});

test('omits --release when no commit SHA is available and honors org/project overrides', () => {
  const dir = fakeBuild();
  const calls = [];
  uploadSourceMaps({
    env: { SENTRY_AUTH_TOKEN: 'set', SENTRY_ORG: 'other-org', SENTRY_PROJECT: 'other-project' },
    buildDir: dir,
    exec: (args) => calls.push(args),
    ...quiet,
  });
  assert.deepEqual(calls[1], ['sourcemaps', 'upload', '--org', 'other-org', '--project', 'other-project', join(dir, 'static', 'js')]);
});

test('the real sentry-cli binary resolves from its optional platform package', () => {
  // The default runner relies on this; npm's postinstall download is only a fallback.
  const require = createRequire(import.meta.url);
  assert.equal(existsSync(require('@sentry/cli').SentryCli.getPath()), true);
});
