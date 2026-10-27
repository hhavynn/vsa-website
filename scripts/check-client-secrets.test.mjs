import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectText } from './check-client-secrets.mjs';
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
