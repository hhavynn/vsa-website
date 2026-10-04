import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminContentHealth from './ContentHealth';
import { adminOverviewRepository } from '../../data/repos/adminOverview';
import { contentHealthRepository } from '../../data/repos/contentHealth';
import { ContentHealthSources, ContentHealthStateRow, buildContentHealthReport } from '../../lib/contentHealth';
import { ADMIN_HEALTH_QUERY_KEYS } from '../../lib/adminHealthQuery';

jest.mock('../../data/repos/adminOverview', () => ({ adminOverviewRepository: { load: jest.fn() } }));
jest.mock('../../data/repos/contentHealth', () => ({
  contentHealthRepository: { acknowledge: jest.fn(), removeAcknowledgement: jest.fn() },
}));

const load = adminOverviewRepository.load as jest.Mock;
const acknowledge = contentHealthRepository.acknowledge as jest.Mock;
const removeAcknowledgement = contentHealthRepository.removeAcknowledgement as jest.Mock;

const NOW = new Date('2026-10-04T18:00:00Z');

/** The finding card for a title: the list item that has that heading. */
const card = (title: string) => {
  const found = within(screen.getByRole('list', { name: 'Findings' }))
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('heading', { name: title }));
  if (!found) throw new Error(`No finding card for ${title}`);
  return found;
};

function report(overrides: Partial<ContentHealthSources> = {}) {
  return buildContentHealthReport({
    now: NOW,
    currentAcademicYearStart: 2026,
    events: [{ id: 'd1', name: 'Fall Mixer', date: '2026-09-12T02:00:00Z', is_published: false, updated_at: '2026-08-01T00:00:00Z' }],
    gallery: [],
    programContent: [],
    ai: [{ id: 'k1', title: 'GBM 1 location', is_public: true, is_active: true, valid_until: '2026-10-01T00:00:00Z', last_verified_at: '2026-09-01T00:00:00Z' }],
    applications: [],
    state: [
      {
        kind: 'link_check',
        subject_key: 'https://cdn.example.org/flyer.png?token=abc',
        check_status: 'failed',
        http_status: 404,
        failure_reason: 'http_404',
        checked_at: '2026-10-03T19:00:00Z',
        failing_since: '2026-10-03T08:00:00Z',
        consecutive_failures: 1,
        detail: [{ table: 'events', id: 'e9', field: 'image_url', label: 'Welcome Back BBQ', path: '/admin/events', kind: 'image' }],
      },
      { kind: 'check_run', subject_key: 'weekly', checked_at: '2026-10-03T08:05:00Z', detail: { checked: 42, failed: 1, skipped: 6 } },
    ] as ContentHealthStateRow[],
    ...overrides,
  });
}

function renderPage(contentHealth = report(), url = '/admin/content-health') {
  load.mockResolvedValue({ stats: {}, attention: {}, contentHealth, unavailable: [] });
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <AdminContentHealth />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, invalidate };
}

beforeEach(() => {
  jest.resetAllMocks();
  acknowledge.mockResolvedValue(undefined);
  removeAcknowledgement.mockResolvedValue(undefined);
});

describe('Content Health page', () => {
  it('lists each finding with priority, reason, content type, last checked time and the page that fixes it', async () => {
    renderPage();

    expect(await screen.findByText('3 content health issues')).toBeInTheDocument();
    expect(screen.getByText('1 high · 2 medium · 0 low')).toBeInTheDocument();

    const image = card('Welcome Back BBQ');
    expect(within(image).getByText('High')).toBeInTheDocument();
    expect(within(image).getByText('Event image')).toBeInTheDocument();
    expect(within(image).getByText('The image returns 404 (not found).')).toBeInTheDocument();
    expect(within(image).getByText('https://cdn.example.org/flyer.png')).toBeInTheDocument();
    expect(within(image).getByText(/Last checked Oct 3/)).toBeInTheDocument();
    expect(within(image).getByRole('link', { name: /Fix it/ })).toHaveAttribute('href', '/admin/events');

    const draft = card('Fall Mixer');
    expect(within(draft).getByText(/Still a draft, but it was scheduled for/)).toBeInTheDocument();
    expect(within(draft).getByRole('link', { name: /Fix it/ })).toHaveAttribute('href', '/admin/events?filter=draft');
  });

  it('puts the most urgent first and omits healthy content entirely', async () => {
    renderPage();
    await screen.findByRole('list', { name: 'Findings' });
    const titles = within(screen.getByRole('list', { name: 'Findings' })).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles[0]).toBe('Welcome Back BBQ');
    expect(titles).not.toContain('Evergreen');
  });

  it('shows a clean bill of health only when everything was actually checked', async () => {
    renderPage(report({ events: [], ai: [], state: [] }));
    expect(await screen.findByText('No content health issues')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs fixing')).toBeInTheDocument();
  });

  it('does not claim it is clean when a source could not be read', async () => {
    renderPage(report({ events: null, ai: [], state: [] }));
    expect(await screen.findByText(/Could not check: events/)).toBeInTheDocument();
    expect(screen.queryByText('Nothing needs fixing')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing found in what could be checked')).toBeInTheDocument();
  });

  it('filters by priority', async () => {
    renderPage();
    await screen.findByText('3 content health issues');
    fireEvent.click(screen.getByRole('button', { name: /^High 1$/ }));
    const list = screen.getByRole('list', { name: 'Findings' });
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(within(list).getByRole('heading', { name: 'Welcome Back BBQ' })).toBeInTheDocument();
  });

  it('acknowledges a finding, then refreshes the shared health data so the Overview count follows', async () => {
    const { invalidate } = renderPage();
    await screen.findByRole('list', { name: 'Findings' });
    const draft = card('Fall Mixer');

    fireEvent.click(within(draft).getByRole('button', { name: 'Acknowledge' }));

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({ key: 'draft-event-past:d1', check: 'draft-event-past' })));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(ADMIN_HEALTH_QUERY_KEYS.all));
  });

  it('cannot acknowledge Ask VSA findings: it links to the snippet to review instead', async () => {
    renderPage();
    await screen.findByRole('list', { name: 'Findings' });
    const ai = card('GBM 1 location');
    expect(within(ai).queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    expect(within(ai).getByRole('link', { name: /Review snippet/ })).toHaveAttribute('href', '/admin/ai-knowledge?filter=review');
  });

  it('offers no destructive action on any finding', async () => {
    renderPage();
    await screen.findByRole('list', { name: 'Findings' });
    expect(screen.queryByRole('button', { name: /delete|remove|unpublish|fix automatically/i })).not.toBeInTheDocument();
  });

  it('keeps accepted findings out of the count, lists them separately, and can stop ignoring one', async () => {
    renderPage(
      report({
        state: [
          { kind: 'acknowledgement', subject_key: 'draft-event-past:d1', fingerprint: '2026-08-01T00:00:00Z', acknowledged_at: '2026-10-01T19:00:00Z', expires_at: '2026-11-30T19:00:00Z' },
        ],
      }),
    );

    // Only the Ask VSA finding is left counting.
    expect(await screen.findByText('1 content health issue')).toBeInTheDocument();
    expect(screen.getByText('Acknowledged (1)')).toBeInTheDocument();
    const details = screen.getByRole('list', { name: 'Acknowledged findings' });
    expect(within(details).getByText('Fall Mixer')).toBeInTheDocument();
    expect(within(details).getByText(/Acknowledged Oct 1, 2026, until Nov 30, 2026/)).toBeInTheDocument();

    fireEvent.click(within(details).getByRole('button', { name: 'Stop ignoring' }));
    await waitFor(() => expect(removeAcknowledgement).toHaveBeenCalledWith('draft-event-past:d1'));
  });

  it('says when external checks are not set up, never run, or overdue', async () => {
    renderPage(report({ state: null }));
    expect(await screen.findByText(/Image and link checks are not set up yet/)).toBeInTheDocument();
  });

  it('shows the last weekly run and flags it when overdue', async () => {
    renderPage(report({ state: [{ kind: 'check_run', subject_key: 'weekly', checked_at: '2026-09-01T08:00:00Z', detail: { checked: 10, failed: 0, skipped: 1 } }] }));
    expect(await screen.findByText(/10 checked, 0 failing, 1 not checkable/)).toBeInTheDocument();
    expect(screen.getByText(/That is overdue/)).toBeInTheDocument();
  });

  it('reports a failed scan instead of an empty page', async () => {
    load.mockRejectedValue(new Error('boom'));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AdminContentHealth />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not run the content health scan/);
  });
});
