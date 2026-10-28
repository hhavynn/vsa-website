import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { inspectText, inspectEnvironment, inspectEnvFile } from './check-client-secrets.mjs';
const jwt = (role) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
test('allows documented public variables and an anon JWT', () => {
  assert.deepEqual(inspectText('.env.example', 'REACT_APP_SUPABASE_URL=https://example.invalid\nREACT_APP_SUPABASE_ANON_KEY=' + jwt('anon') + '\nREACT_APP_GA4_MEASUREMENT_ID=G-XXXXXXXXXX'), []);
});
test('rejects unknown public environment variable assignment and reference', () => {
  assert.equal(inspectText('.env.local', 'REACT_APP_PAYMENT_PRIVATE_KEY=dummy')[0].includes('unreviewed'), true);
  assert.equal(inspectText('src/config.ts', 'process.env.REACT_APP_NEW_TOKEN')[0].includes('unreviewed'), true);
});
test('rejects high confidence token signatures without printing their contents', () => {
  const token = 'sk-' + 'A'.repeat(30);
  const violations = inspectText('src/secret.ts', 'const key = ' + token + ';');
  assert.equal(violations.length,1);
  assert.equal(violations.join('').includes(token), false);
});
test('rejects an apparently sensitive public config value', () => {
  assert.ok(inspectText('.env', 'REACT_APP_SUPABASE_URL=private_service_role_token_not_public').length);
});
test('rejects privileged JWTs disguised as public anon keys', () => {
  assert.ok(inspectText('.env', 'REACT_APP_SUPABASE_ANON_KEY=' + jwt('service_role')).length);
});
test('does not flag placeholders or ordinary app strings', () => {
  assert.deepEqual(inspectText('src/home.tsx','const label = "welcome back";'), []);
  assert.deepEqual(inspectText('.env.example','REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here'), []);
});
test('detects other credentials and privileged JWTs in client source without printing them', () => {
  for (const token of ['AIza' + 'A'.repeat(35), 'sb_secret_' + 'x'.repeat(40), jwt('service_role')]) {
    const problems = inspectText('public/config.js', 'const value = "' + token + '";');
    assert.ok(problems.length);
    assert.equal(problems.join('').includes(token), false);
  }
});
test('inspects the actual public build environment and allows an anon JWT', () => {
  assert.deepEqual(inspectEnvironment({ REACT_APP_SUPABASE_ANON_KEY: jwt('anon') }), []);
  assert.ok(inspectEnvironment({ REACT_APP_SUPABASE_ANON_KEY: jwt('service_role') }).length);
  assert.ok(inspectEnvironment({ REACT_APP_NEW_SECRET: 'sk-' + 'A'.repeat(30) }).length);
  assert.ok(inspectEnvironment({ react_app_new_secret: 'not-public' }).length);
  assert.ok(inspectEnvironment({ REACT_APP_SUPABASE_URL: '$PRIVATE_URL' }).length);
});
test('rejects env-file interpolation in public values before CRA can expand secrets', () => {
  for (const value of ['$PRIVATE_KEY', '${PRIVATE_URL}', '$1', '"https://example.org/#$PRIVATE_KEY"']) {
    assert.ok(inspectEnvFile('.env.production', `REACT_APP_SUPABASE_URL=${value}`).length);
  }
});
test('npm build rejects a privileged environment value without printing it', () => {
  const token = jwt('service_role');
  const result = spawnSync('npm', ['run', 'build'], {
    env: { ...process.env, REACT_APP_SUPABASE_ANON_KEY: token }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.equal((result.stdout + result.stderr).includes(token), false);
});
