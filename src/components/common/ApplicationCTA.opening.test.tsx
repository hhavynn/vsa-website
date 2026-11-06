import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationCTA, openingWindowsNeedingRefresh } from './ApplicationCTA';
import type { PublicApplicationLink } from '../../types';

const mockRefetch = jest.fn();
let mockPublicLinks: PublicApplicationLink[] = [];

jest.mock('../../hooks/useApplicationLinks', () => ({
  PUBLIC_APPLICATION_LINKS_QUERY_KEY: ['application-links', 'public'],
  usePublicApplicationLinks: () => ({
    links: mockPublicLinks, loading: false, error: null, refetch: mockRefetch,
  }),
}));

const opening = '2026-11-20T18:00:00Z';
const windowRow = (overrides: Partial<PublicApplicationLink> = {}): PublicApplicationLink => ({
  id: 'synthetic-house-window',
  application_key: 'house_fall',
  title: 'House Applications',
  description: null,
  button_label: 'Apply',
  target_url: null,
  status: 'not_open',
  open_at: opening,
  due_at: '2026-11-28T18:00:00Z',
  is_enabled: true,
  before_open_message: null,
  after_close_message: null,
  sort_order: 0,
  updated_at: '2026-11-01T00:00:00Z',
  ...overrides,
});

function mount(queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApplicationCTA applicationKeys="house_fall" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-20T17:59:45Z'));
  mockRefetch.mockReset().mockResolvedValue(undefined);
  mockPublicLinks = [windowRow()];
});
afterEach(() => {
  jest.useRealTimers();
});

describe('application opening transition on an already-open page (#276)', () => {
  it('refreshes the shared public view exactly once after the opening boundary', () => {
    mount();
    expect(mockRefetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Apply' })).not.toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    act(() => { jest.advanceTimersByTime(90_000); });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('does not lose its opening refresh while a pre-opening request remains in flight', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let finish!: (rows: PublicApplicationLink[]) => void;
    const pending = client.fetchQuery<PublicApplicationLink[]>({
      queryKey: ['application-links', 'public'],
      queryFn: () => new Promise<PublicApplicationLink[]>((resolve) => { finish = resolve; }),
    });
    expect(client.isFetching({ queryKey: ['application-links', 'public'] })).toBe(1);
    mount(client);

    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockRefetch).not.toHaveBeenCalled();

    await act(async () => {
      finish([windowRow()]); // A request begun before opening can return a masked row.
      await pending;
    });
    expect(client.isFetching({ queryKey: ['application-links', 'public'] })).toBe(0);
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('never locally unmasks a form URL while waiting for the server response', () => {
    mockPublicLinks = [windowRow({ target_url: 'https://private-form.invalid/not-public' })];
    const view = mount();
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(view.container.innerHTML).not.toContain('private-form.invalid');
  });

  it('does not refresh disabled, invalid or still-future rows', () => {
    const now = Date.parse('2026-11-20T18:00:15Z');
    expect(openingWindowsNeedingRefresh([
      windowRow({ is_enabled: false }),
      windowRow({ id: 'invalid', open_at: 'not-a-date' }),
      windowRow({ id: 'future', open_at: '2026-11-21T18:00:00Z' }),
      windowRow({ id: 'already-open', status: 'open' }),
    ], now)).toEqual([]);
    mockPublicLinks = [windowRow({ is_enabled: false })];
    mount();
    act(() => { jest.advanceTimersByTime(90_000); });
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('refreshes a stale not-open result immediately when the page loads after its start', () => {
    jest.setSystemTime(new Date('2026-11-20T18:02:00Z'));
    mount();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
