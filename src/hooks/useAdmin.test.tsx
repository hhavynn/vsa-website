/**
 * useAdmin (#231): one shared, per-user admin lookup instead of one query per
 * mount, failing closed, never leaking one account's answer to another.
 *
 * The user comes from a mocked useAuth so each test controls identity
 * precisely; the Supabase boundary is the recording mock.
 */

import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAdmin } from './useAdmin';
import { supabaseMock, postgrestError } from '../test-utils/supabaseMock';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

let mockUser: { id: string } | null = null;
jest.mock('./useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const adminLookups = () => supabaseMock.queriesFor('user_profiles').length;

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  supabaseMock.reset();
  mockUser = null;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useAdmin', () => {
  it('is not admin and never loading when nobody is signed in, without querying', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAdmin(), { wrapper });

    expect(result.current).toEqual({ isAdmin: false, loading: false });
    expect(adminLookups()).toBe(0);
  });

  it('reports loading, then admin, for a signed-in admin', async () => {
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAdmin(), { wrapper });

    // Never `isAdmin` while the answer is still in flight.
    expect(result.current).toEqual({ isAdmin: false, loading: true });
    await waitFor(() => expect(result.current).toEqual({ isAdmin: true, loading: false }));
  });

  it('is not admin for a signed-in non-admin', async () => {
    mockUser = { id: 'member-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: false }, error: null });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAdmin(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('shares one lookup between consumers mounted together', async () => {
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { wrapper } = makeWrapper();

    const { result: firstConsumer } = renderHook(() => useAdmin(), { wrapper });
    const { result: secondConsumer } = renderHook(() => useAdmin(), { wrapper });

    await waitFor(() => expect(firstConsumer.current.isAdmin).toBe(true));
    await waitFor(() => expect(secondConsumer.current.isAdmin).toBe(true));
    expect(adminLookups()).toBe(1);
  });

  it('does not look up again when a consumer remounts', async () => {
    // The old hook queried on every mount; navigating between admin pages
    // remounts consumers constantly.
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { wrapper } = makeWrapper();

    const { result: before, unmount } = renderHook(() => useAdmin(), { wrapper });
    await waitFor(() => expect(before.current.isAdmin).toBe(true));
    unmount();

    const { result: after } = renderHook(() => useAdmin(), { wrapper });

    expect(after.current).toEqual({ isAdmin: true, loading: false });
    expect(adminLookups()).toBe(1);
  });

  it('keeps the answer, with no loading flash or new lookup, when the user object is replaced by an equal one', async () => {
    // supabase-js re-emits SIGNED_IN with a fresh user object whenever the tab
    // regains focus. Keying on that object made the admin shell show its
    // loader and remount, discarding unsaved form state each time.
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => useAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    mockUser = { id: 'admin-1' };
    rerender();

    expect(result.current).toEqual({ isAdmin: true, loading: false });
    expect(adminLookups()).toBe(1);
  });

  it('never shows one account the answer cached for another', async () => {
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => useAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    mockUser = { id: 'member-2' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: false }, error: null });
    rerender();

    // Straight to loading with isAdmin false -- not admin-1's `true`.
    expect(result.current).toEqual({ isAdmin: false, loading: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(adminLookups()).toBe(2);
  });

  it('is not admin the moment the user signs out, even though the answer is still cached', async () => {
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => useAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    mockUser = null;
    rerender();

    expect(result.current).toEqual({ isAdmin: false, loading: false });
  });

  it('is not admin once the cache is cleared, as sign-out does, and a fresh sign-in looks it up again', async () => {
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { client, wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => useAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    mockUser = null;
    rerender();
    act(() => client.clear());
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', { data: { is_admin: false }, error: null });
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(adminLookups()).toBe(2);
  });

  it('fails closed, and logs, when the lookup errors', async () => {
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', {
      data: null,
      error: postgrestError('permission denied for table user_profiles', '42501'),
    });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAdmin(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Error checking admin status:', expect.anything());
  });

  it('tries again on the next mount after a failed lookup instead of caching the failure', async () => {
    mockUser = { id: 'admin-1' };
    supabaseMock.queueResult('user_profiles', {
      data: null,
      error: postgrestError('upstream timeout', '57014'),
    });
    supabaseMock.queueResult('user_profiles', { data: { is_admin: true }, error: null });
    const { wrapper } = makeWrapper();
    const { result: failed, unmount } = renderHook(() => useAdmin(), { wrapper });
    await waitFor(() => expect(failed.current.loading).toBe(false));
    expect(failed.current.isAdmin).toBe(false);
    unmount();

    const { result: retried } = renderHook(() => useAdmin(), { wrapper });

    await waitFor(() => expect(retried.current.isAdmin).toBe(true));
    expect(adminLookups()).toBe(2);
  });

  it('treats a missing profile row as not admin', async () => {
    mockUser = { id: 'new-user' };
    supabaseMock.queueResult('user_profiles', { data: null, error: null });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAdmin(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });
});
