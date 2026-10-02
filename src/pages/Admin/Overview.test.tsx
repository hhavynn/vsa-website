import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminOverview from './Overview';
import { adminOverviewRepository } from '../../data/repos/adminOverview';
import { DEFAULT_OVERVIEW_STATS, OverviewSnapshot } from '../../lib/adminOverviewStats';
import { ADMIN_HEALTH_QUERY_KEYS } from '../../lib/adminHealthQuery';

jest.mock('../../data/repos/adminOverview', () => ({ adminOverviewRepository: { load: jest.fn() } }));
jest.mock('../../components/features/admin/OperationsDashboard', () => ({ OperationsDashboard: () => null }));
jest.mock('../../components/features/admin/RecentActivityCard', () => ({ RecentActivityCard: () => null }));

const load = adminOverviewRepository.load as jest.Mock;

function snapshot(overrides: Partial<OverviewSnapshot['stats']> = {}, unavailable: string[] = []): OverviewSnapshot {
  return { stats: { ...DEFAULT_OVERVIEW_STATS, members: 820, events: 44, eventsPublished: 40, eventsDraft: 4, aiTableExists: true, ...overrides }, unavailable };
}

function renderOverview(client = new QueryClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminOverview />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

beforeEach(() => {
  load.mockResolvedValue(snapshot());
});

describe('Admin Overview health scan', () => {
  it('loads the counts once and shows them', async () => {
    renderOverview();

    expect(await screen.findByText('820')).toBeInTheDocument();
    expect(screen.getByText('Published events')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not re-scan when the admin comes back to the page within a minute', async () => {
    const { client, unmount } = renderOverview();
    await screen.findByText('820');
    unmount();

    renderOverview(client);

    expect(await screen.findByText('820')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never re-scans on its own: no refetch on focus, reconnect, interval or retry', async () => {
    const { client } = renderOverview();
    await screen.findByText('820');

    // `observers` is private API; reading it is the only way to see the options the page actually passed.
    const query = client.getQueryCache().find(ADMIN_HEALTH_QUERY_KEYS.overview) as unknown as { observers: Array<{ options: object }> };
    expect(query.observers[0].options).toMatchObject({
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      retry: false,
    });

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('re-scans when the admin presses Refresh counts', async () => {
    load.mockResolvedValueOnce(snapshot({ members: 820 })).mockResolvedValueOnce(snapshot({ members: 821 }));
    renderOverview();
    await screen.findByText('820');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh counts' }));

    expect(await screen.findByText('821')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('says so when some counts could not be loaded', async () => {
    load.mockResolvedValue(snapshot({}, ['events', 'cabinet']));
    renderOverview();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('events, cabinet');
    expect(notice).toHaveTextContent('may be incomplete');
  });

  it('does not show the notice when everything loaded', async () => {
    renderOverview();
    await screen.findByText('820');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});
