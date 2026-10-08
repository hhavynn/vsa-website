/**
 * The same refocus, driven through the real supabase-js auth client instead of
 * the scriptable mock: an access token that expired while the tab was hidden is
 * refreshed on return (supabase-js emits TOKEN_REFRESHED), the stale admin-status
 * entry is re-checked, and the editor underneath keeps its unsaved text.
 * Only the network (global fetch) is faked.
 */

import { useEffect, useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../context/AuthContext';
import { AdminRoute } from './AdminRoute';
import AdminLayout from '../components/features/admin/AdminLayout';
import { supabase } from '../lib/supabase';

// setupTests replaces supabase-js with a stub; this test wants the real client.
jest.mock('@supabase/supabase-js', () => jest.requireActual('@supabase/supabase-js'));
jest.mock('../components/features/admin/AdminNav', () => ({ AdminNav: () => null }));

const STORAGE_KEY = 'sb-test-auth-token';
const user = { id: 'admin-1', email: 'admin@example.test', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' };
const sessionExpiringAt = (expiresAt: number, token: string) => ({
  access_token: token,
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: expiresAt,
  user,
});
const jsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
  }) as unknown as Response;

const lifecycle: string[] = [];
function EditorPage() {
  const [draft, setDraft] = useState('');
  useEffect(() => {
    lifecycle.push('mount');
    return () => {
      lifecycle.push('unmount');
    };
  }, []);
  return <textarea aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
}

const setVisibility = (state: 'hidden' | 'visible') =>
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

afterEach(() => {
  setVisibility('visible');
  localStorage.clear();
  lifecycle.length = 0;
});

it('keeps unsaved text when an expired token is refreshed on refocus and admin status is re-checked', async () => {
  const now = Math.floor(Date.now() / 1000);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionExpiringAt(now + 3000, 'token-1')));
  const requests: string[] = [];
  const events: string[] = [];
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    requests.push(new URL(url).pathname);
    if (url.includes('/auth/v1/token')) return jsonResponse(sessionExpiringAt(now + 7200, 'token-2'));
    return jsonResponse({ is_admin: true });
  }) as typeof fetch;
  const { data } = supabase.auth.onAuthStateChange((event) => {
    events.push(event);
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/editor']}>
          <Routes>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/editor" element={<EditorPage />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  const draft = await screen.findByLabelText('Draft');
  await userEvent.type(draft, 'unsaved announcement');
  const lookupsBefore = requests.filter((path) => path.endsWith('/user_profiles')).length;

  // While the tab is hidden the access token runs out, and the admin-status answer goes stale.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionExpiringAt(now - 10, 'token-1')));
  client.setQueryData(['admin-status', 'admin-1'], true, { updatedAt: Date.now() - 11 * 60_000 });
  await act(async () => {
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await act(async () => {
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });

  await waitFor(() => expect(events).toContain('TOKEN_REFRESHED'));
  await waitFor(() =>
    expect(requests.filter((path) => path.endsWith('/user_profiles')).length).toBe(lookupsBefore + 1)
  );
  expect(requests).toContain('/auth/v1/token');

  expect(screen.getByLabelText('Draft')).toBe(draft);
  expect(draft).toHaveValue('unsaved announcement');
  expect(lifecycle).toEqual(['mount']);
  expect(screen.queryByText(/verifying admin access/i)).not.toBeInTheDocument();
  data.subscription.unsubscribe();
});
