import { handler } from '../_shared/server-test-adapter.ts';

Deno.env.set('SUPABASE_URL', 'https://feedback.invalid');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service');
Deno.env.set('SUPABASE_ANON_KEY', 'synthetic-anon');
await import('./index.ts');
const userId = '00000000-0000-4000-8000-000000000001';
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
function request(token?: string) {
  return new Request('https://functions.invalid', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ type: 'bug', title: 'Synthetic feedback', description: 'Details' }),
  });
}
Deno.test('runtime persists only anonymous or verified session identity; invalid JWT never reaches submission', async () => {
  const originalFetch = globalThis.fetch;
  let persisted: string | null | undefined;
  try {
    for (const token of [undefined, 'synthetic-anon', 'valid-user-token', 'invalid-user-token']) {
      persisted = undefined;
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith('/auth/v1/user')) {
          const actual = new Headers(init?.headers).get('authorization');
          assert(actual === `Bearer ${token}`, 'verification used wrong bearer token');
          return token === 'invalid-user-token'
            ? json({ msg: 'Invalid JWT' }, 401)
            : json({ id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
        }
        assert(url.endsWith('/rpc/submit_feedback_guarded'), 'unexpected backend request');
        const payload = JSON.parse(String(init?.body));
        persisted = payload.p_user_id;
        assert(new Headers(init?.headers).get('authorization') === 'Bearer synthetic-service', 'submission did not use service boundary');
        return json(true);
      };
      const response = await handler(request(token));
      if (token === 'invalid-user-token') {
        assert(response.status === 401 && persisted === undefined, 'invalid JWT persisted feedback');
      } else {
        assert(response.status === 200 && persisted === (token === 'valid-user-token' ? userId : null), 'runtime identity attribution wrong');
      }
    }
  } finally { globalThis.fetch = originalFetch; }
});
