/* eslint-disable testing-library/no-node-access -- layout-contract assertions on class lists and the details element */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from './Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';

jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false }),
}));
jest.mock('../hooks/useLeaderboardYears', () => ({
  useLeaderboardYears: () => ({ yearsWithData: [], loading: false }),
}));
jest.mock('../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => new Map(),
}));
jest.mock('../components/ui/AnimatedCounter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value.toLocaleString()}</span>,
}));
jest.mock('../components/features/avatar/PhotoRequestSection', () => ({
  PhotoRequestSection: () => null,
}));
jest.mock('../components/features/house/HouseMemberLeaderboard', () => ({
  HouseMemberLeaderboard: () => null,
}));
jest.mock('../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on() { return this; },
      subscribe: () => ({ unsubscribe: () => undefined }),
    }),
  },
}));

const LONG_NAME = { first: 'Maximiliana-Alexandria', last: 'Wolfeschlegelsteinhausenbergerdorffsmith' };

const member = (id: string, first: string, last: string, points: number, events: number) => ({
  id,
  first_name: first,
  last_name: last,
  college: null,
  year: null,
  points,
  events_attended: events,
});

const MEMBERS = [
  member('long', LONG_NAME.first, LONG_NAME.last, 90, 9),
  member('tie-a', 'Ada', 'Tie', 60, 6),
  member('tie-b', 'Bao', 'Tie', 60, 6),
  member('solo', 'Cam', 'Solo', 40, 4),
  member('mono', 'Mononym', '', 10, 1),
];

function setViewport(isPhone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isPhone && query.includes('639'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

let queryClient: QueryClient;

function renderLeaderboard(entry = '/leaderboard') {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Leaderboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function renderLoaded(entry?: string) {
  const view = renderLeaderboard(entry);
  await screen.findAllByRole('button', { name: /Open profile for/ });
  return view;
}

beforeEach(() => {
  setViewport(true);
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue(MEMBERS);
  jest.spyOn(leaderboardRepository, 'getAllTimeHouseLeaderboard').mockResolvedValue([]);
  jest.spyOn(leaderboardRepository, 'getYearlyHouseLeaderboard').mockResolvedValue([]);
  jest.spyOn(leaderboardRepository, 'getRecentHouseActivity').mockResolvedValue([]);
  jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue(null);
  jest.spyOn(leaderboardRepository, 'getMemberEventHistory').mockResolvedValue([
    { event_id: 'e1', event_name: 'GBM #1', event_date: '2025-10-01', event_type: 'gbm', points_earned: 1 },
    { event_id: 'e2', event_name: 'Mixer Night', event_date: '2025-10-08', event_type: 'mixer', points_earned: 2 },
  ] as never);
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
  jest.restoreAllMocks();
});

describe('Leaderboard mobile layout contract', () => {
  it('keeps rank, name and points on every compact podium row', async () => {
    await renderLoaded();
    // Each top-3 member renders once in the phone podium, once in the desktop
    // podium and once in the standings list; the rest only in the list.
    expect(screen.getAllByRole('button', { name: `Open profile for ${LONG_NAME.first} ${LONG_NAME.last}` })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Open profile for Cam Solo' })).toHaveLength(1);

    const compact = document.querySelector('.md\\:hidden') as HTMLElement;
    expect(compact).not.toBeNull();
    const rows = within(compact).getAllByRole('button');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('1')).toBeInTheDocument();
    expect(within(rows[0]).getByText(`${LONG_NAME.first} ${LONG_NAME.last}`)).toBeInTheDocument();
    expect(within(rows[0]).getByText('90')).toBeInTheDocument();
  });

  it('shows a shared T-rank for a tie and a tie caption in the list', async () => {
    await renderLoaded();
    expect(screen.getAllByText('T2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('2-way tie').length).toBeGreaterThan(0);
  });

  it('lets long names wrap instead of overflowing every layout they appear in', async () => {
    await renderLoaded();
    const fullName = `${LONG_NAME.first} ${LONG_NAME.last}`;
    const instances = screen.getAllByText(fullName);
    expect(instances.length).toBeGreaterThanOrEqual(3);
    for (const node of instances) {
      expect(node.className).toMatch(/break-words/);
    }
    // Standings row: name column may shrink below its content, and clamps to two lines.
    const rowName = instances.find((node) => node.className.includes('line-clamp-2') && node.closest('.group'));
    expect(rowName).toBeDefined();
    expect(rowName!.parentElement!.className).toMatch(/min-w-0/);
  });

  it('handles a member with no last name and no photo', async () => {
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Open profile for Mononym' })).toBeInTheDocument();
    // No photo: initials avatar rendered instead of an <img>.
    expect(document.querySelectorAll('main img, img')).toHaveLength(0);
    expect(screen.getAllByText('M').length).toBeGreaterThan(0);
  });

  it('lets the rank-gap caption wrap on phones so it cannot squeeze name and points', async () => {
    await renderLoaded();
    const captions = screen
      .getAllByText(/to 1st|\+\d+ to|tiebreaker/)
      .filter((caption) => caption.closest('.group'));
    expect(captions.length).toBeGreaterThan(0);
    for (const caption of captions) {
      expect(caption.className).not.toMatch(/(^|\s)whitespace-nowrap/);
      expect(caption.className).toMatch(/sm:whitespace-nowrap/);
    }
  });

  it('does not clip the House stats line on narrow viewports', async () => {
    jest.spyOn(leaderboardRepository, 'getAllTimeHouseLeaderboard').mockResolvedValue([
      {
        house: 'Bowser', house_profile_id: 'h1', display_name: 'Bowser', image_url: null,
        accent_color: '#c0392b', academic_year_start: 2025, academic_year_end: 2026,
        total_points: 120, events_attended: 80, unique_events: 10, unique_members: 40,
        average_points_per_member: 3, latest_activity_at: null,
      },
    ] as never);
    renderLeaderboard('/leaderboard?view=houses');
    const stats = await screen.findByText(/40 MEMBERS/);
    expect(stats.parentElement!.className).toMatch(/flex-wrap/);
    // House identity is carried by the name, not only by its colour.
    expect(screen.getByText('Bowser')).toBeInTheDocument();
  });
});

describe('Leaderboard member profile on phones', () => {
  async function openProfile(name: string) {
    await renderLoaded();
    fireEvent.click(screen.getAllByRole('button', { name: `Open profile for ${name}` })[0]);
    return screen.findByRole('dialog', { name: `${name} member profile` });
  }

  it('opens on name and totals with history collapsed behind a tappable header', async () => {
    const dialog = await openProfile('Cam Solo');
    const history = within(dialog).getByRole('button', { name: /Events attended/ });
    expect(history).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).queryByText('GBM #1')).not.toBeInTheDocument();

    fireEvent.click(history);
    expect(history).toHaveAttribute('aria-expanded', 'true');
    expect(await within(dialog).findByText('GBM #1')).toBeInTheDocument();
  });

  it('collapses the event-type breakdown too, and offers a thumb-reachable Close', async () => {
    const dialog = await openProfile('Cam Solo');
    expect(await within(dialog).findByRole('button', { name: /By event type/ })).toHaveAttribute('aria-expanded', 'false');
    // Header close + the phone-only bottom close.
    expect(within(dialog).getAllByRole('button', { name: /^Close/ }).length).toBeGreaterThanOrEqual(2);
  });

  it('starts expanded on larger screens', async () => {
    setViewport(false);
    const dialog = await openProfile('Cam Solo');
    expect(within(dialog).getByRole('button', { name: /Events attended/ })).toHaveAttribute('aria-expanded', 'true');
    expect(await within(dialog).findByText('GBM #1')).toBeInTheDocument();
  });

  it('shows the House as text, and nothing when the member has none', async () => {
    let dialog = await openProfile('Cam Solo');
    expect(within(dialog).queryByText('Bowser')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: /^Close/ })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue({
      house: 'Bowser', display_name: 'Bowser', accent_color: '#c0392b',
    } as never);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open profile for Cam Solo' })[0]);
    dialog = await screen.findByRole('dialog', { name: 'Cam Solo member profile' });
    expect(await within(dialog).findByText('Bowser')).toBeInTheDocument();
  });
});

describe('Leaderboard related links', () => {
  it('offers Find My Points and a How points work jump that keeps the current view', async () => {
    renderLeaderboard('/leaderboard?view=houses');
    expect(await screen.findByRole('link', { name: /Find My Points/ })).toHaveAttribute('href', '/points');
    expect(screen.getByRole('link', { name: /How points work/ })).toHaveAttribute(
      'href',
      '/leaderboard?view=houses#how-points-work',
    );
  });

  it('opens the existing explainer when the page is loaded at #how-points-work', async () => {
    await renderLoaded('/leaderboard#how-points-work');
    const details = document.getElementById('how-points-work') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    await waitFor(() => expect(details.open).toBe(true));
  });

  it('keeps the explainer collapsed by default', async () => {
    await renderLoaded();
    const details = document.getElementById('how-points-work') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await act(async () => undefined);
  });
});
