import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminOverview from './Overview';
import { adminOverviewRepository } from '../../data/repos/adminOverview';
import { DEFAULT_OVERVIEW_STATS, OverviewSnapshot } from '../../lib/adminOverviewStats';
import { EMPTY_ATTENTION_SIGNALS } from '../../lib/adminAttention';
import { ADMIN_HEALTH_QUERY_KEYS } from '../../lib/adminHealthQuery';
import { buildContentHealthReport } from '../../lib/contentHealth';
import { useOperationsSummary } from '../../hooks/useOperationsSummary';
import { AdminSearchContext } from '../../components/features/admin/AdminSearchContext';
import { ADMIN_NAV_ITEMS, ADMIN_QUICK_ACTIONS } from '../../lib/adminNavigation';

jest.mock('../../data/repos/adminOverview', () => ({ adminOverviewRepository: { load: jest.fn() } }));
jest.mock('../../components/features/admin/OperationsDashboard', () => ({
  OperationsDashboard: () => <p>operations details</p>,
  ContinueWorking: () => null,
}));
jest.mock('../../components/features/admin/RecentActivityCard', () => ({ RecentActivityCard: () => null }));
jest.mock('../../hooks/useOperationsSummary', () => ({ useOperationsSummary: jest.fn() }));

const load = adminOverviewRepository.load as jest.Mock;
const operations = useOperationsSummary as jest.Mock;
const OPERATIONS_READY = { summary: null, preflight: [], issues: 0, loading: false, failed: false };

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

// A year with nothing to review in any health area, so "all clear" is reachable.
const HEALTHY: Partial<OverviewSnapshot['stats']> = {
  eventsDraft: 0,
  eventsUpcomingPublished: 3,
  housesCurrentCount: 4,
  housesCurrentYearStart: 2026,
  cabinetActiveYear: { id: 'y1', label: '2026–27' },
  cabinetMembersActiveYear: 19,
  vcnCurrentPublishedExists: true,
  aiLastVerifiedAt: '2026-10-01T00:00:00Z',
};

function renderOverview(client = new QueryClient(), openSearch = jest.fn()) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminSearchContext.Provider value={{ openSearch }}>
          <AdminOverview />
        </AdminSearchContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue(snapshot());
  operations.mockReturnValue(OPERATIONS_READY);
});

describe('Admin Overview health scan', () => {
  it('loads the counts once and shows them', async () => {
    renderOverview();

    expect(await screen.findByText('820')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('Published events')).toBeInTheDocument();
    expect(screen.getByText('operations details')).toBeInTheDocument();
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

  describe('dashboard hierarchy', () => {
    it('leads with search and quick actions that go to real admin pages', async () => {
      const openSearch = jest.fn();
      renderOverview(new QueryClient(), openSearch);
      await screen.findByText('820');

      fireEvent.click(screen.getByRole('button', { name: 'Search admin' }));
      expect(openSearch).toHaveBeenCalledTimes(1);

      const actions = screen.getByRole('region', { name: 'Quick actions' });
      const links = within(actions).getAllByRole('link');
      expect(links).toHaveLength(6);
      const navPaths = new Set(ADMIN_NAV_ITEMS.map((item) => item.to));
      for (const link of links) expect(navPaths.has(link.getAttribute('href') ?? '')).toBe(true);
      expect(links.map((link) => link.getAttribute('href'))).toEqual(ADMIN_QUICK_ACTIONS.map((action) => action.to));
    });

    it('lists every admin tool in the directory, collapsed until opened', async () => {
      renderOverview();
      await screen.findByText('820');

      const directory = screen.getByRole('region', { name: /All admin tools/ });
      expect(within(directory).queryAllByRole('link')).toHaveLength(0);

      fireEvent.click(within(directory).getByRole('button', { name: 'Expand all' }));
      const hrefs = within(directory).getAllByRole('link').map((link) => link.getAttribute('href'));
      expect(hrefs.sort()).toEqual(ADMIN_NAV_ITEMS.map((item) => item.to).filter((to) => to !== '/admin').sort());
    });

    it('says all clear only when everything loaded and nothing needs a look', async () => {
      load.mockResolvedValue(snapshot(HEALTHY));
      renderOverview();
      expect(await screen.findByText('All clear')).toBeInTheDocument();
      expect(screen.getByText(/All systems normal/)).toBeInTheDocument();
    });

    it('never says all clear when the health scan failed', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      load.mockRejectedValue(new Error('down'));
      renderOverview();

      expect(await screen.findByText('Could not check site health')).toBeInTheDocument();
      expect(screen.queryByText('All clear')).not.toBeInTheDocument();
      expect(screen.queryByText(/All systems normal/)).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Health by area' })).not.toBeInTheDocument();
    });

    it('calls a partly loaded scan partial, not clear', async () => {
      load.mockResolvedValue(snapshot(HEALTHY, ['events']));
      renderOverview();

      expect(await screen.findByText('Partly checked')).toBeInTheDocument();
      expect(screen.queryByText('All clear')).not.toBeInTheDocument();
    });

    it('does not read as clear when the operations scan failed', async () => {
      load.mockResolvedValue(snapshot(HEALTHY));
      operations.mockReturnValue({ ...OPERATIONS_READY, failed: true });
      renderOverview();

      expect(await screen.findByText('Partly checked')).toBeInTheDocument();
      expect(screen.getByText(/Operations status could not be loaded/)).toBeInTheDocument();
    });

    it('counts warnings and links each to the page that fixes it', async () => {
      load.mockResolvedValue(snapshot({ ...HEALTHY, eventsMissingTerms: 2, galleryAlbumsMissingCover: 1 }));
      renderOverview();

      const warnings = await screen.findByRole('list', { name: 'Data warnings' });
      expect(within(warnings).getByRole('link', { name: /2 events missing terms/ })).toHaveAttribute('href', '/admin/events');
      expect(within(warnings).getByRole('link', { name: /1 albums missing covers/ })).toHaveAttribute('href', '/admin/gallery');
      expect(screen.queryByText('All clear')).not.toBeInTheDocument();
    });
  });
});

describe('manual attention links without count fan-out (#253)', () => {
  it('exposes merge and launch destinations without inventing unresolved counts', async () => {
    load.mockResolvedValue(snapshot(HEALTHY));
    renderOverview();
    const merge = await screen.findByRole('link', { name: 'Review merge suggestions' });
    const launch = screen.getByRole('link', { name: 'Check launch readiness' });
    expect(merge).toHaveAttribute('href', '/admin/merge-suggestions');
    expect(launch).toHaveAttribute('href', '/admin/launch-checklist');
    expect(screen.getByText('Manual checks (not counted above)')).toBeInTheDocument();
    expect(screen.getByText(/dashboard cannot safely infer how many are unresolved/)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps both manual review actions available during a count-source outage', async () => {
    load.mockRejectedValue(new Error('Dashboard read unavailable'));
    renderOverview();
    expect(await screen.findByRole('link', { name: 'Review merge suggestions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check launch readiness' })).toBeInTheDocument();
  });
});
