/**
 * AuthProvider session lifecycle (#232): what happens to auth state and the
 * react-query cache on sign-out, expiry, token refresh and account changes.
 *
 * supabase-js is replaced by the scriptable auth stubs in supabaseMock, which
 * play events to subscribers the way the real client does.
 */

import { ReactNode, useContext } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import { AuthContext } from './AuthContext';
import { AuthProvider } from './AuthContext';
import { supabaseMock, AuthSession } from '../test-utils/supabaseMock';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const sessionFor = (id: string, extra: Record<string, unknown> = {}): AuthSession => ({
  access_token: `token-${id}`,
  user: { id, email: `${id}@example.test`, ...extra },
});

type Auth = NonNullable<React.ContextType<typeof AuthContext>>;
let auth: Auth;
let activeFetches: jest.Mock;

/** Reads the context, and keeps one query mounted (i.e. on screen). */
function Probe() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthContext missing');
  auth = value;
  useQuery(['on-screen'], () => activeFetches(), { staleTime: Infinity });
  return <div data-testid="user">{value.user?.id ?? 'none'}</div>;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { client, ...render(<Probe />, { wrapper: Wrapper }) };
}

const emit = (event: string, session: AuthSession | null) =>
  act(async () => {
    supabaseMock.emitAuthEvent(event, session);
  });

beforeEach(() => {
  supabaseMock.reset();
  activeFetches = jest.fn().mockResolvedValue('on-screen-data');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function signedInAs(id: string) {
  supabaseMock.setAuthSession(sessionFor(id));
  const view = setup();
  await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(id));
  await waitFor(() => expect(activeFetches).toHaveBeenCalledTimes(1));
  return view;
}

describe('initial session', () => {
  it('renders nothing until the stored session is read, then exposes the user', async () => {
    supabaseMock.setAuthSession(sessionFor('admin-1'));
    setup();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('admin-1'));
    expect(auth.sessionExpired).toBe(false);
  });

  it('starts signed out and not expired with no stored session', async () => {
    setup();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(auth.sessionExpired).toBe(false);
  });
});

describe('deliberate sign-out', () => {
  it('clears the user and the cache, and is not treated as expiry', async () => {
    const { client } = await signedInAs('admin-1');
    client.setQueryData(['admin-status', 'admin-1'], true);
    client.setQueryData(['admin-rows'], ['private']);

    await act(async () => {
      await auth.signOut();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(auth.sessionExpired).toBe(false);
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBeUndefined();
    expect(client.getQueryData(['admin-rows'])).toBeUndefined();
    // Not even a mounted query is spared: it starts over (refetches) instead of
    // keeping the signed-out account's rows.
    await waitFor(() => expect(activeFetches).toHaveBeenCalledTimes(2));
  });

  it('still clears local state when the server refuses the sign-out', async () => {
    const { client } = await signedInAs('admin-1');
    supabaseMock.setSignOutError({ message: 'network down' });
    client.setQueryData(['admin-status', 'admin-1'], true);

    await act(async () => {
      await auth.signOut();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBeUndefined();
    expect(auth.sessionExpired).toBe(false);
  });
});

describe('session ends unprompted (refresh rejected, expired, signed out in another tab)', () => {
  it('flags the expiry, signs the user out and keeps only what is still on screen', async () => {
    const { client } = await signedInAs('admin-1');
    client.setQueryData(['not-displayed'], 'orphan');

    await emit('SIGNED_OUT', null);

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(auth.sessionExpired).toBe(true);
    expect(client.getQueryData(['not-displayed'])).toBeUndefined();
    expect(client.getQueryData(['on-screen'])).toBe('on-screen-data');
  });

  it('does not flag expiry when nobody was signed in', async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));

    await emit('SIGNED_OUT', null);

    expect(auth.sessionExpired).toBe(false);
  });

  it('stays expired after a sign-in until it is resolved, then revalidates when it is the same account', async () => {
    await signedInAs('admin-1');
    await emit('SIGNED_OUT', null);

    await emit('SIGNED_IN', sessionFor('admin-1'));

    // Signed in, but not yet verified as an admin: still the expiry prompt.
    expect(screen.getByTestId('user')).toHaveTextContent('admin-1');
    expect(auth.sessionExpired).toBe(true);
    expect(activeFetches).toHaveBeenCalledTimes(1);

    act(() => auth.resolveExpiredSession('admin-1'));

    expect(auth.sessionExpired).toBe(false);
    // Invalidation refetches the query that stayed on screen.
    await waitFor(() => expect(activeFetches).toHaveBeenCalledTimes(2));
  });

  it('clears the whole cache when a different account is resolved instead', async () => {
    const { client } = await signedInAs('admin-1');
    await emit('SIGNED_OUT', null);
    client.setQueryData(['admin-rows'], ['private']);
    await emit('SIGNED_IN', sessionFor('someone-else'));
    expect(client.getQueryData(['admin-rows'])).toEqual(['private']);

    act(() => auth.resolveExpiredSession('someone-else'));

    expect(auth.sessionExpired).toBe(false);
    expect(client.getQueryData(['admin-rows'])).toBeUndefined();
    await waitFor(() => expect(activeFetches).toHaveBeenCalledTimes(2));
  });

  it('stays expired, with the held cache, when an account that signed in at the prompt is signed back out', async () => {
    const { client } = await signedInAs('admin-1');
    await emit('SIGNED_OUT', null);
    client.setQueryData(['admin-status', 'someone-else'], false);
    await emit('SIGNED_IN', sessionFor('someone-else'));

    await act(async () => {
      await auth.signOut();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(auth.sessionExpired).toBe(true);
    expect(client.getQueryData(['admin-status', 'someone-else'])).toBeUndefined();
    expect(client.getQueryData(['on-screen'])).toBe('on-screen-data');
    // And the original account can still resume.
    act(() => auth.resolveExpiredSession('admin-1'));
    expect(auth.sessionExpired).toBe(false);
  });

  it('keeps the original expired account when a second session ends during the prompt', async () => {
    await signedInAs('admin-1');
    await emit('SIGNED_OUT', null);
    await emit('SIGNED_IN', sessionFor('someone-else'));
    await emit('SIGNED_OUT', null);

    act(() => auth.resolveExpiredSession('admin-1'));

    // Resolved as the same account (revalidation, no cache wipe).
    await waitFor(() => expect(activeFetches).toHaveBeenCalledTimes(2));
  });

  it('clears the cache and forgets the expiry when the user gives up', async () => {
    const { client } = await signedInAs('admin-1');
    await emit('SIGNED_OUT', null);
    expect(auth.sessionExpired).toBe(true);

    client.setQueryData(['admin-rows'], ['private']);

    act(() => auth.discardExpiredSession());

    expect(auth.sessionExpired).toBe(false);
    expect(client.getQueryData(['admin-rows'])).toBeUndefined();
  });
});

describe('token refresh and repeated sign-in events', () => {
  it('keeps the cache and does not flag expiry on TOKEN_REFRESHED', async () => {
    const { client } = await signedInAs('admin-1');

    await emit('TOKEN_REFRESHED', sessionFor('admin-1', { updated_at: 'later' }));

    expect(screen.getByTestId('user')).toHaveTextContent('admin-1');
    expect(auth.sessionExpired).toBe(false);
    expect(client.getQueryData(['on-screen'])).toBe('on-screen-data');
    expect(activeFetches).toHaveBeenCalledTimes(1);
  });

  it('keeps the cache when a tab refocus re-emits SIGNED_IN for the same account', async () => {
    const { client } = await signedInAs('admin-1');

    await emit('SIGNED_IN', sessionFor('admin-1'));

    expect(client.getQueryData(['on-screen'])).toBe('on-screen-data');
    expect(auth.sessionExpired).toBe(false);
  });
});

describe('switching accounts without signing out', () => {
  it('does not let the new account read the previous one’s cached data', async () => {
    const { client } = await signedInAs('admin-1');
    client.setQueryData(['admin-status', 'admin-1'], true);

    await emit('SIGNED_IN', sessionFor('member-2'));

    expect(screen.getByTestId('user')).toHaveTextContent('member-2');
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBeUndefined();
  });

  it('signIn() adopts the session and clears the previous account’s cache', async () => {
    const { client } = await signedInAs('admin-1');
    client.setQueryData(['admin-status', 'admin-1'], true);
    const next = sessionFor('member-2');
    supabaseMock.setSignInResult({ data: { user: next.user, session: next }, error: null });

    await act(async () => {
      await auth.signIn('member-2@example.test', 'pw');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('member-2');
    expect(client.getQueryData(['admin-status', 'admin-1'])).toBeUndefined();
  });

  it('signIn() surfaces the Supabase error and leaves state alone', async () => {
    await signedInAs('admin-1');
    supabaseMock.setSignInResult({
      data: { user: null, session: null },
      error: new Error('Invalid login credentials'),
    });

    await expect(auth.signIn('x@example.test', 'bad')).rejects.toThrow('Invalid login credentials');
    expect(screen.getByTestId('user')).toHaveTextContent('admin-1');
  });
});
