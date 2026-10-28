/**
 * SignInForm sign-in flow (#231): the admin check now goes through the
 * repository and seeds the shared admin-status cache. (The error-message
 * mapping is covered in SignInForm.test.ts.)
 */

import { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../../../context/AuthContext';
import { SignInForm } from './SignInForm';
import { supabaseMock, AuthSession, postgrestError } from '../../../test-utils/supabaseMock';

// setupTests replaces @supabase/supabase-js with a stub; signInErrorMessage
// needs the real type guards. Hoisted above the imports by babel-plugin-jest-hoist.
jest.unmock('@supabase/supabase-js');
jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const session: AuthSession = { access_token: 't', user: { id: 'admin-1', email: 'admin-1@example.test' } };

function renderForm(props: { onSignedIn?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/login']}>
          <Routes>
            <Route path="/admin/login" element={children} />
            <Route path="/admin" element={<div data-testid="admin-home" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { client, ...render(<SignInForm {...props} />, { wrapper: Wrapper }) };
}

async function submit() {
  await userEvent.type(await screen.findByLabelText(/email/i), 'admin-1@example.test');
  await userEvent.type(screen.getByLabelText(/password/i), 'a password');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setSignInResult({ data: { user: session.user, session }, error: null });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SignInForm', () => {
  it('sends an admin to the admin area and leaves the verdict cached for the shell', async () => {
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { client } = renderForm();

    await submit();

    expect(await screen.findByTestId('admin-home')).toBeInTheDocument();
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBe(true);
    // One lookup at sign-in; the shell reuses it.
    expect(supabaseMock.queriesFor('user_profiles')).toHaveLength(1);
  });

  it('calls onSignedIn instead of navigating when given one', async () => {
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const onSignedIn = jest.fn();
    renderForm({ onSignedIn });

    await submit();

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('admin-home')).not.toBeInTheDocument();
  });

  it('signs a non-admin back out and says the account is not authorized', async () => {
    supabaseMock.queueResult('user_profiles', { data: { is_admin: false }, error: null });
    const { client } = renderForm();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/admins only/i);
    expect(screen.queryByTestId('admin-home')).not.toBeInTheDocument();
    await waitFor(() => expect(client.getQueryData(['admin-status', 'admin-1'])).toBeUndefined());
  });

  it('signs out and reports it when admin access cannot be verified', async () => {
    supabaseMock.queueResult('user_profiles', {
      data: null,
      error: postgrestError('upstream timeout', '57014'),
    });
    renderForm();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to verify admin access.');
    expect(screen.queryByTestId('admin-home')).not.toBeInTheDocument();
  });

  it('announces validation errors and focuses the first invalid required field', async () => {
    renderForm();
    const email = await screen.findByRole('textbox', { name: /email \(required\)/i });
    const password = screen.getByLabelText(/password \(required\)/i);
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(email).toBeRequired();
    expect(password).toBeRequired();

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    const errorId = email.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveAttribute('role', 'alert');
  });

  it('moves focus to the non-enumerating auth alert after an async access failure', async () => {
    supabaseMock.queueResult('user_profiles', { data: { is_admin: false }, error: null });
    renderForm();
    await submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/admins only/i);
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
    expect(alert.parentElement).toHaveAttribute('tabindex', '-1');
  });

  it('prefills the email when one is supplied', async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter>
            <SignInForm defaultEmail="prefilled@example.test" />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByLabelText(/email/i)).toHaveValue('prefilled@example.test');
  });
});
