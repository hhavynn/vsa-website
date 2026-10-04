import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminOverview from './Overview';
import { adminOverviewRepository } from '../../data/repos/adminOverview';
import { DEFAULT_OVERVIEW_STATS, OverviewSnapshot } from '../../lib/adminOverviewStats';
import { EMPTY_ATTENTION_SIGNALS } from '../../lib/adminAttention';
import { ADMIN_HEALTH_QUERY_KEYS } from '../../lib/adminHealthQuery';
import { buildContentHealthReport } from '../../lib/contentHealth';

jest.mock('../../data/repos/adminOverview', () => ({ adminOverviewRepository: { load: jest.fn() } }));
jest.mock('../../components/features/admin/OperationsDashboard', () => ({ OperationsDashboard: () => null }));
jest.mock('../../components/features/admin/RecentActivityCard', () => ({ RecentActivityCard: () => null }));

const load = adminOverviewRepository.load as jest.Mock;

// Every attention source loaded and nothing is waiting, unless a test says otherwise.
const CLEAR_ATTENTION = { applications: [], draftEventDates: [], photoRequestsPending: 0, dataRightsOpen: 0, aiFeedbackUnresolved: 0, feedbackPending: 0 };

function snapshot(overrides: Partial<OverviewSnapshot['stats']> = {}, unavailable: string[] = [], attention: Partial<OverviewSnapshot['attention']> = {}): OverviewSnapshot {
  return {
    stats: { ...DEFAULT_OVERVIEW_STATS, members: 820, events: 44, eventsPublished: 40, eventsDraft: 4, aiTableExists: true, ...overrides },
    attention: { ...EMPTY_ATTENTION_SIGNALS, ...CLEAR_ATTENTION, ...attention },
    contentHealth: buildContentHealthReport({ now: new Date('2026-10-02T12:00:00Z'), currentAcademicYearStart: 2026, events: [], gallery: [], programContent: [], ai: [], applications: [], state: [] }),
    unavailable,
  };
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

  describe('attention queue', () => {
    it('leads with what needs attention, each count linking to the page that resolves it', async () => {
      load.mockResolvedValue(snapshot({}, [], { photoRequestsPending: 3, aiFeedbackUnresolved: 2, dataRightsOpen: 1, draftEventDates: [new Date(Date.now() + 3 * 86400000).toISOString()] }));
      renderOverview();

      await screen.findByRole('link', { name: /3 photo requests waiting for review/ });
      const queue = screen.getByRole('region', { name: 'Needs attention' });
      expect(within(queue).getByRole('link', { name: /3 photo requests waiting for review/ })).toHaveAttribute('href', '/admin/photo-requests?filter=pending');
      expect(within(queue).getByRole('link', { name: /2 Ask VSA responses need review/ })).toHaveAttribute('href', '/admin/ai-feedback?filter=unresolved');
      expect(within(queue).getByRole('link', { name: /1 open data-rights request/ })).toHaveAttribute('href', '/admin/data-rights?filter=open');
      expect(within(queue).getByRole('link', { name: /1 unpublished event in the next 14 days/ })).toHaveAttribute('href', '/admin/events?filter=draft');
      expect(within(queue).queryByText('You’re all caught up')).not.toBeInTheDocument();
    });

    it('shows one aggregate content health count that links to the Health page, with no details', async () => {
      load.mockResolvedValue(snapshot({}, [], { contentHealth: { issues: 6, urgent: 1 } }));
      renderOverview();

      const link = await screen.findByRole('link', { name: /6 content health issues/ });
      expect(link).toHaveAttribute('href', '/admin/content-health');
      expect(link).toHaveAttribute('data-attention-id', 'content-health');
    });

    it('says the admin is all caught up when nothing is waiting', async () => {
      renderOverview();
      expect(await screen.findByText('You’re all caught up')).toBeInTheDocument();
    });

    it('does not say caught up when a count could not be loaded', async () => {
      load.mockResolvedValue(snapshot({}, ['photo requests'], { photoRequestsPending: null }));
      renderOverview();

      await screen.findByText('820');
      expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument();
      expect(screen.getByText(/Could not check: photo requests/)).toBeInTheDocument();
    });
  });
});
