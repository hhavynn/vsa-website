/**
 * Homepage "closing soon" notice. Pins: only a window that is open right now may
 * carry a clickable Apply link; a scheduled or closed window's URL never reaches
 * the DOM; nothing renders when nothing is closing soon; and it leaves the
 * existing This Week section untouched.
 */
import { QueryClient, QueryClientProvider } from 'react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClosingSoonApplications } from './ClosingSoonApplications';
import { ThisWeekInVSA } from './ThisWeekInVSA';
import { PublicApplicationLink } from '../../../types';

// Thu Oct 1 2026, 9:00 AM PDT.
const NOW = new Date('2026-10-01T16:00:00Z');
const OPEN_URL = 'https://forms.gle/open-form';
const FUTURE_URL = 'https://forms.gle/not-yet-public';
const CLOSED_URL = 'https://forms.gle/already-closed';

let mockLinks: PublicApplicationLink[] = [];
let mockError: unknown = null;
jest.mock('../../../hooks/useApplicationLinks', () => ({
  usePublicApplicationLinks: () => ({ links: mockLinks, loading: false, error: mockError }),
}));

// Plain functions, not jest.fn(): CRA resets mock implementations between tests.
jest.mock('../../../data/repos/events', () => ({ eventsRepository: { getPublicUpcomingPreview: async () => [] } }));
jest.mock('../../../data/repos/houseEvents', () => ({ houseEventsRepository: { getPublicUpcomingPreview: async () => [] } }));
jest.mock('../../../data/repos/leaderboard', () => ({ leaderboardRepository: { getTopYearlyHouseStandings: async () => [] } }));
jest.mock('../../../data/repos/gallery', () => ({ galleryRepository: { getAlbums: async () => [] } }));
jest.mock('../../../hooks/useAcademicTerms', () => ({ useAcademicTerms: () => ({ terms: [], loading: false, error: null }) }));
// The Latest Memory card chains select/eq/not/order/limit and awaits the result: an empty page.
jest.mock('../../../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'not', 'order', 'limit']) chain[method] = () => chain;
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
  return { supabase: { from: () => chain } };
});
// Summer break, as ThisWeekInVSA decides it, without moving the clock under react-query.
jest.mock('../../../utils/seasonalState', () => ({
  ...jest.requireActual('../../../utils/seasonalState'),
  shouldUseSummerEmptyState: (hasActiveItems: boolean) => !hasActiveItems,
}));

function link(overrides: Partial<PublicApplicationLink>): PublicApplicationLink {
  return {
    id: 'w',
    application_key: 'house_fall',
    title: 'House Fall',
    description: null,
    button_label: 'Apply for a House',
    target_url: OPEN_URL,
    status: 'open',
    open_at: '2026-09-25T07:00:00Z',
    due_at: '2026-10-03T06:59:00Z', // Oct 2, 11:59 PM PDT -> tomorrow
    is_enabled: true,
    before_open_message: null,
    after_close_message: null,
    sort_order: 1,
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function renderNotice() {
  return render(
    <MemoryRouter>
      <ClosingSoonApplications />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockLinks = [];
  mockError = null;
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ClosingSoonApplications', () => {
  it('shows an open window that is about to close, with urgency copy, a Pacific deadline, and a working Apply link', () => {
    mockLinks = [link({})];
    renderNotice();

    expect(screen.getByText('House Applications close tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Deadline Oct 2, 11:59 PM PT')).toBeInTheDocument();
    const apply = screen.getByRole('link', { name: /Apply for a House/ });
    expect(apply).toHaveAttribute('href', OPEN_URL);
    expect(apply).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says "today" on the last day', () => {
    mockLinks = [link({ due_at: '2026-10-02T06:59:00Z' })]; // Oct 1, 11:59 PM PDT
    renderNotice();
    expect(screen.getByText('House Applications close today')).toBeInTheDocument();
  });

  it('never exposes a future window\'s URL, even if a row carries one', () => {
    mockLinks = [
      // As the public view serves it: scheduled, URL masked.
      link({ id: 'a', application_key: 'ace_application', status: 'not_open', open_at: '2026-10-05T07:00:00Z', due_at: '2026-10-12T06:59:00Z', target_url: null }),
      // Defense in depth: a stale or tampered row that still carries the URL must not become a link.
      link({ id: 'b', application_key: 'cabinet_application', status: 'open', open_at: '2026-10-05T07:00:00Z', due_at: '2026-10-12T06:59:00Z', target_url: FUTURE_URL }),
    ];
    const { container } = renderNotice();

    expect(container).toBeEmptyDOMElement();
    expect(document.body.innerHTML).not.toContain(FUTURE_URL);
  });

  it('does not show a closed window as actionable', () => {
    mockLinks = [
      link({ status: 'closed', open_at: '2026-09-01T07:00:00Z', due_at: '2026-09-20T06:59:00Z', target_url: null }),
      // Cached as open, but its deadline has passed since: it must drop out rather than linger.
      link({ id: 'stale', application_key: 'ace_application', status: 'open', open_at: '2026-09-01T07:00:00Z', due_at: '2026-09-30T06:59:00Z', target_url: CLOSED_URL }),
    ];
    const { container } = renderNotice();

    expect(container).toBeEmptyDOMElement();
    expect(document.body.innerHTML).not.toContain(CLOSED_URL);
  });

  it('ignores an open window whose deadline is still far away', () => {
    mockLinks = [link({ due_at: '2026-11-15T07:59:00Z' })];
    const { container } = renderNotice();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no application windows or the lookup failed', () => {
    const { container, unmount } = renderNotice();
    expect(container).toBeEmptyDOMElement();
    unmount();

    mockLinks = [link({})];
    mockError = new Error('supabase down');
    expect(renderNotice().container).toBeEmptyDOMElement();
  });

  it('keeps long lists short', () => {
    mockLinks = (['ace_application', 'house_fall', 'intern_application', 'cabinet_application'] as const).map((application_key, index) =>
      link({ id: String(index), application_key, due_at: `2026-10-0${3 + index}T06:59:00Z` }),
    );
    renderNotice();

    expect(screen.getAllByRole('link', { name: /Apply for a House/ })).toHaveLength(3);
    expect(screen.getByText(/1 more closing soon/)).toBeInTheDocument();
  });

  it('only pulses for reduced-motion-safe users, and only when it is urgent', () => {
    mockLinks = [link({ due_at: '2026-10-02T06:59:00Z' })];
    renderNotice();
    const dot = screen.getByTestId('closing-soon-dot');
    expect(dot).toHaveClass('motion-safe:animate-pulse');
    expect(dot).not.toHaveClass('animate-pulse');
  });

  it('does not pulse when the deadline is still days away', () => {
    mockLinks = [link({ due_at: '2026-10-06T06:59:00Z' })];
    renderNotice();
    expect(screen.getByTestId('closing-soon-dot')).not.toHaveClass('motion-safe:animate-pulse');
  });
});

describe('next to This Week in VSA', () => {
  it('leaves the existing summer-break state alone when no deadline is approaching', async () => {
    jest.useRealTimers();
    mockLinks = [];
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ThisWeekInVSA />
          <ClosingSoonApplications />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('VSA is on summer break')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /This Week/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Applications closing soon' })).not.toBeInTheDocument();
  });
});
