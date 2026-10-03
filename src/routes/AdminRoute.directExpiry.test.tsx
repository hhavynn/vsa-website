/**
 * End to end (#232): an admin is typing in a form when a plain
 * `supabase.from(...).update(...)` call, made directly from a page and not
 * through react-query or a repository, is rejected by the server for an expired
 * JWT that the browser still believed was valid. The re-authentication prompt
 * must appear over the page and the unsaved text must survive.
 *
 * Real supabase-js client, real AuthProvider and AdminRoute, scripted network.
 */

import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthProvider } from '../context/AuthContext';
import { AdminRoute } from './AdminRoute';
import { createSessionExpiryFetch, refreshOrEndSession } from '../lib/sessionExpiry';
import {
  createFakeNetwork,
  EXPIRED_JWT_BODY,
  FAKE_SUPABASE_URL,
  memoryStorage,
  respondJson,
  SESSION_STORAGE_KEY,
  storedSession,
} from '../test-utils/fakeSupabaseNetwork';

// The real client, not setupTests' stub. Hoisted above the imports by babel-plugin-jest-hoist.
jest.unmock('@supabase/supabase-js');

let mockClient: SupabaseClient;
jest.mock('../lib/supabase', () => ({
  get supabase() {
    return mockClient;
  },
}));

function EditorPage() {
  const [draft, setDraft] = useState('');
  return <textarea aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
}

function buildClient() {
  const network = createFakeNetwork([
    // The admin check at load and sign-in succeeds...
    ({ url }) => (url.pathname === '/rest/v1/user_profiles' ? respondJson(200, { is_admin: true }) : undefined),
    // ...but every other Data API call is refused as expired.
    ({ url }) => (url.pathname.startsWith('/rest/v1/') ? respondJson(401, EXPIRED_JWT_BODY) : undefined),
    // And the refresh token is dead.
    ({ url }) =>
      url.pathname === '/auth/v1/token'
        ? respondJson(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' })
        : undefined,
    ({ url }) => (url.pathname === '/auth/v1/logout' ? new Response(null, { status: 204 }) : undefined),
  ]);
  const client: SupabaseClient = createClient(FAKE_SUPABASE_URL, 'anon-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage: memoryStorage({ [SESSION_STORAGE_KEY]: storedSession('admin-1') }),
      storageKey: SESSION_STORAGE_KEY,
    },
    db: { retry: false },
    global: {
      fetch: createSessionExpiryFetch({ fetch: network.fetch, refresh: () => refreshOrEndSession(client) }),
    },
  });
  return { client, network };
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows the re-authentication prompt, keeping the unsaved draft, after a direct call is rejected as expired', async () => {
  const { client, network } = buildClient();
  mockClient = client;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/editor']}>
          <Routes>
            <Route path="/admin/login" element={<div data-testid="login" />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/editor" element={<EditorPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  await userEvent.type(await screen.findByLabelText('Draft'), 'announcement the admin has not saved yet');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

  // The admin hits Save; the page calls Supabase directly.
  let result: Awaited<ReturnType<ReturnType<typeof client.from>['update']>> | undefined;
  await act(async () => {
    result = await client.from('events').update({ name: 'Welcome Night' }).eq('id', 1);
  });

  // The page's own error handling still sees the server's answer...
  expect(result?.error?.code).toBe('PGRST301');
  // ...and the session is recognised as gone: prompt over the page, work intact.
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(/your session ended/i);
  expect(screen.queryByTestId('login')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Draft')).toHaveValue('announcement the admin has not saved yet');
  await waitFor(() => expect(network.count('POST /auth/v1/token')).toBe(1));
});
