import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { createQueryClient, listenForWindowFocus } from './queryClient';

function deferredFetches() {
  const pending: Array<(value: number) => void> = [];
  const queryFn = jest.fn(() => new Promise<number>((resolve) => pending.push(resolve)));
  return { pending, queryFn };
}

function observe(client: QueryClient, options: { queryFn: () => Promise<number>; refetchOnWindowFocus?: boolean }) {
  return new QueryObserver(client, { queryKey: ['thing'], staleTime: 0, ...options }).subscribe(() => undefined);
}

describe('createQueryClient', () => {
  it('keeps the cache timings and request behavior the app was built on', () => {
    const queries = createQueryClient().getDefaultOptions().queries;
    expect(queries).toMatchObject({
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      networkMode: 'always',
      notifyOnChangeProps: 'all',
    });
    expect(queries).not.toHaveProperty('retry');
  });

  it('joins a running fetch when invalidating, so repeats send no extra request', async () => {
    const client = createQueryClient();
    const { pending, queryFn } = deferredFetches();
    const unsubscribe = observe(client, { queryFn });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    pending[0](1);
    await waitFor(() => expect(client.getQueryData(['thing'])).toBe(1));

    void client.invalidateQueries({ queryKey: ['thing'] });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    void client.invalidateQueries({ queryKey: ['thing'] });
    void client.invalidateQueries({ queryKey: ['thing'] });
    await Promise.resolve();
    expect(queryFn).toHaveBeenCalledTimes(2);

    pending[1](2);
    await waitFor(() => expect(client.getQueryData(['thing'])).toBe(2));
    unsubscribe();
  });

  it('still lets a caller ask for a cancelled, restarted fetch', async () => {
    const client = createQueryClient();
    const { pending, queryFn } = deferredFetches();
    const unsubscribe = observe(client, { queryFn });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    pending[0](1);
    await waitFor(() => expect(client.getQueryData(['thing'])).toBe(1));

    void client.invalidateQueries({ queryKey: ['thing'] });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    void client.invalidateQueries({ queryKey: ['thing'] }, { cancelRefetch: true });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3));
    unsubscribe();
  });

  describe('while the browser reports offline', () => {
    beforeEach(() => onlineManager.setOnline(false));
    afterEach(() => onlineManager.setOnline(true));

    it('still fetches', async () => {
      const client = createQueryClient();
      await expect(client.fetchQuery({ queryKey: ['offline'], queryFn: async () => 'loaded' })).resolves.toBe('loaded');
    });

    it('ends in an error instead of a paused query pages would read as empty', async () => {
      const client = createQueryClient();
      const queryFn = jest.fn(() => Promise.reject(new Error('no network')));
      const observer = new QueryObserver(client, { queryKey: ['offline'], queryFn, retry: 1, retryDelay: 1 });
      const unsubscribe = observer.subscribe(() => undefined);

      await waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(observer.getCurrentResult().isPaused).toBe(false);
      unsubscribe();
    });
  });
});

describe('failed requests', () => {
  it('log failed queries and mutations to the console', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = createQueryClient();
    const queryError = new Error('query failed');
    const mutationError = new Error('mutation failed');

    await expect(client.fetchQuery({ queryKey: ['fails'], queryFn: () => Promise.reject(queryError) })).rejects.toBe(queryError);
    await expect(
      client.getMutationCache().build(client, { mutationFn: () => Promise.reject(mutationError) }).execute(undefined),
    ).rejects.toBe(mutationError);

    expect(consoleError).toHaveBeenCalledWith(queryError);
    expect(consoleError).toHaveBeenCalledWith(mutationError);
    consoleError.mockRestore();
  });
});

describe('listenForWindowFocus', () => {
  it('refetches on the window focus event as well as visibilitychange', async () => {
    listenForWindowFocus();
    const client = createQueryClient();
    client.mount(); // QueryClientProvider does this in the app.
    const queryFn = jest.fn(async () => 1);
    const unsubscribe = observe(client, { queryFn, refetchOnWindowFocus: true });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.getQueryState(['thing'])?.fetchStatus).toBe('idle'));

    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(client.getQueryState(['thing'])?.fetchStatus).toBe('idle'));

    window.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(client.getQueryState(['thing'])?.fetchStatus).toBe('idle'));

    onlineManager.setOnline(false);
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(queryFn).toHaveBeenCalledTimes(3);
    onlineManager.setOnline(true);
    unsubscribe();
    client.unmount();
  });
});
