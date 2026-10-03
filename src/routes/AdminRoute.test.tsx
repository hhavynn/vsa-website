/**
 * AdminRoute (#231, #232): who gets the admin area, and what happens to an
 * admin's unsaved work when their session ends underneath them.
 *
 * Real AuthProvider, real AdminRoute, real react-query; only the Supabase
 * boundary is the scriptable mock. The page under test is a textarea whose
 * contents live in React state -- the stand-in for a long admin form.
 */

import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { AdminRoute } from './AdminRoute';
import { supabaseMock, AuthSession } from '../test-utils/supabaseMock';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const sessionFor = (id: string): AuthSession => ({
  access_token: `token-${id}`,
  user: { id, email: `${id}@example.test` },
});

function EditorPage() {
  const [draft, setDraft] = useState('');
  return (
    <textarea aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
  );
}

/** Stands in for the header's Sign Out button, which calls AuthProvider.signOut. */
function SignOutButton() {
  const { signOut } = useAuth();
  return <button onClick={signOut}>Sign out</button>;
}

function LoginMarker() {
  const location = useLocation();
  const state = location.state as { unauthorized?: boolean } | null;
  return <div data-testid="login">{state?.unauthorized ? 'login:unauthorized' : 'login'}</div>;
}

function renderAdmin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/editor']}>
          <SignOutButton />
          <Routes>
            <Route path="/admin/login" element={<LoginMarker />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/editor" element={<EditorPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { client, ...view };
}

/** Whether an element sits inside an inert / aria-hidden subtree. */
const isInert = (element: HTMLElement) => element.closest('[inert]') !== null; // eslint-disable-line testing-library/no-node-access
const isAriaHidden = (element: HTMLElement) => element.closest('[aria-hidden="true"]') !== null; // eslint-disable-line testing-library/no-node-access

const adminLookups = () => supabaseMock.queriesFor('user_profiles').length;
const emit = (event: string, session: AuthSession | null) =>
  act(async () => {
    supabaseMock.emitAuthEvent(event, session);
  });

function signedInAs(id: string, isAdmin: boolean) {
  const session = sessionFor(id);
  supabaseMock.setAuthSession(session);
  // A default, not a one-shot: signing back in looks the account up again.
  supabaseMock.setDefault('user_profiles', { data: { is_admin: isAdmin }, error: null });
  supabaseMock.setSignInResult({ data: { user: session.user, session }, error: null });
  return session;
}

beforeEach(() => {
  supabaseMock.reset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('access', () => {
  it('sends a signed-out visitor to the login page', async () => {
    renderAdmin();

    expect(await screen.findByTestId('login')).toHaveTextContent('login');
    expect(adminLookups()).toBe(0);
  });

  it('sends a signed-in non-admin to the login page, flagged unauthorized', async () => {
    signedInAs('member-1', false);
    renderAdmin();

    expect(await screen.findByTestId('login')).toHaveTextContent('login:unauthorized');
  });

  it('sends a signed-in user to the login page when the admin lookup fails (fails closed)', async () => {
    supabaseMock.setAuthSession(sessionFor('admin-1'));
    supabaseMock.queueResult('user_profiles', { data: null, error: { message: 'boom', code: '57014' } });
    renderAdmin();

    expect(await screen.findByTestId('login')).toHaveTextContent('login:unauthorized');
  });

  it('shows the admin page to an admin after one lookup', async () => {
    signedInAs('admin-1', true);
    renderAdmin();

    expect(await screen.findByLabelText('Draft')).toBeInTheDocument();
    expect(adminLookups()).toBe(1);
  });

  it('shows a loader, never the page, while access is still being verified', async () => {
    signedInAs('admin-1', true);
    renderAdmin();

    expect(await screen.findByText(/verifying admin access/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
    await screen.findByLabelText('Draft');
  });
});

describe('a refocused tab', () => {
  it('keeps the page, its unsaved edits and the single lookup when supabase-js re-emits SIGNED_IN', async () => {
    signedInAs('admin-1', true);
    renderAdmin();
    const draft = await screen.findByLabelText('Draft');
    await userEvent.type(draft, 'half-written announcement');

    await emit('SIGNED_IN', sessionFor('admin-1'));
    await emit('TOKEN_REFRESHED', sessionFor('admin-1'));

    expect(screen.queryByText(/verifying admin access/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Draft')).toHaveValue('half-written announcement');
    expect(adminLookups()).toBe(1);
  });
});

describe('the session ends while the admin is editing', () => {
  it('asks them to sign in again, over the page, instead of redirecting away', async () => {
    signedInAs('admin-1', true);
    renderAdmin();
    await userEvent.type(await screen.findByLabelText('Draft'), 'unsaved work');

    await emit('SIGNED_OUT', null);

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/your session ended/i);
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
    // The page is still mounted underneath, edits intact.
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved work');
  });

  it('makes the held page unreachable while the prompt is open, and takes focus into it', async () => {
    signedInAs('admin-1', true);
    renderAdmin();
    const draft = await screen.findByLabelText('Draft');
    expect(isInert(draft)).toBe(false);
    draft.focus();

    await emit('SIGNED_OUT', null);

    await screen.findByRole('alertdialog');
    expect(isInert(draft)).toBe(true);
    expect(isAriaHidden(draft)).toBe(true);
    // The email is prefilled, so focus lands on the password field, not the
    // textarea that was mid-keystroke when the session ended.
    expect(screen.getByLabelText(/password/i)).toHaveFocus();
  });

  it('forgets the old admin verdict, so signing back in is verified afresh', async () => {
    signedInAs('admin-1', true);
    const { client } = renderAdmin();
    await screen.findByLabelText('Draft');
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBe(true);

    await emit('SIGNED_OUT', null);

    expect(client.getQueryData(['admin-status', 'admin-1'])).toBeUndefined();
  });

  it('prefills the email of the account that was signed in', async () => {
    signedInAs('admin-1', true);
    renderAdmin();
    await screen.findByLabelText('Draft');

    await emit('SIGNED_OUT', null);

    expect(await screen.findByLabelText(/email/i)).toHaveValue('admin-1@example.test');
  });

  it('returns to the very same page, with unsaved edits, once the same admin signs back in', async () => {
    signedInAs('admin-1', true);
    renderAdmin();
    await userEvent.type(await screen.findByLabelText('Draft'), 'unsaved work');
    await emit('SIGNED_OUT', null);

    await userEvent.type(await screen.findByLabelText(/password/i), 'correct horse');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved work');
    expect(isInert(screen.getByLabelText('Draft'))).toBe(false);
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
  });

  it('does not restore the page for a different account that signs in at the prompt', async () => {
    signedInAs('admin-1', true);
    renderAdmin();
    await userEvent.type(await screen.findByLabelText('Draft'), 'unsaved work');
    await emit('SIGNED_OUT', null);

    // Another admin signs in on the same prompt.
    const other = sessionFor('admin-2');
    supabaseMock.setDefault('user_profiles', { data: { is_admin: true }, error: null });
    supabaseMock.setSignInResult({ data: { user: other.user, session: other }, error: null });
    await userEvent.clear(await screen.findByLabelText(/email/i));
    await userEvent.type(screen.getByLabelText(/email/i), 'admin-2@example.test');
    await userEvent.type(screen.getByLabelText(/password/i), 'another password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    // A fresh page for the new account, not admin-1's draft.
    expect(await screen.findByLabelText('Draft')).toHaveValue('');
  });

  it('lets them leave, discarding the page and its cached data, after confirming', async () => {
    signedInAs('admin-1', true);
    const { client } = renderAdmin();
    await screen.findByLabelText('Draft');
    await emit('SIGNED_OUT', null);
    client.setQueryData(['admin-rows'], ['private']);

    await userEvent.click(await screen.findByRole('button', { name: /leave admin/i }));

    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
    expect(client.getQueryData(['admin-rows'])).toBeUndefined();
  });
});

describe('abandoning an expired session', () => {
  it('drops the held page’s cached data when the admin area is left without signing back in', async () => {
    signedInAs('admin-1', true);
    const { client, unmount } = renderAdmin();
    await screen.findByLabelText('Draft');
    await emit('SIGNED_OUT', null);
    client.setQueryData(['admin-rows'], ['private']);

    unmount();

    expect(client.getQueryData(['admin-rows'])).toBeUndefined();
  });
});

describe('sign-out', () => {
  it('a deliberate sign-out goes to the login page with no re-authentication prompt, and nothing cached', async () => {
    signedInAs('admin-1', true);
    const { client } = renderAdmin();
    await screen.findByLabelText('Draft');
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBeUndefined();
  });

  it('a sign-out the user did not ask for in this tab (another tab signed out) does prompt', async () => {
    signedInAs('admin-1', true);
    renderAdmin();
    await screen.findByLabelText('Draft');

    await emit('SIGNED_OUT', null);

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
});
