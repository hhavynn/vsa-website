/* eslint-disable testing-library/no-node-access -- layout-contract assertions on class lists and the details element */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from './Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';

jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false }),
}));
jest.mock('../hooks/useLeaderboardYears', () => ({
  useLeaderboardYears: () => ({ yearsWithData: [], loading: false }),
}));
jest.mock('../hooks/usePublishedLeaderboardRoles', () => ({
  usePublishedLeaderboardRoles: () => ({ data: new Map(), isError: false }),
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
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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
  it('has one page h1 and sibling h2s for Top Performers and Full Standings', async () => {
    await renderLoaded();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Top Performers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Full Standings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: /Top Performers|Full Standings/ })).not.toBeInTheDocument();
  });

  it('keeps rank, name and points on every compact podium row', async () => {
    await renderLoaded();
    // Each top-3 member renders once in the phone podium, once in the desktop
    // podium and once in the standings list; the rest only in the list.
    expect(screen.getAllByRole('button', { name: `Open profile for ${LONG_NAME.first} ${LONG_NAME.last}` })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Open profile for Cam Solo' })).toHaveLength(1);

    const compact = document.querySelector('.md\\:hidden') as HTMLElement;
    expect(compact).not.toBeNull();
    // The member's name is the button (its ::after stretches over the whole row),
    // so the row is the button's card.
    const openers = within(compact).getAllByRole('button');
    expect(openers).toHaveLength(3);
    const firstRow = openers[0].closest('.scrapbook-paper') as HTMLElement;
    expect(firstRow).not.toBeNull();
    expect(openers[0].className).toMatch(/after:absolute/);
    expect(openers[0].className).toMatch(/after:inset-0/);
    expect(within(firstRow).getByText('1')).toBeInTheDocument();
    expect(within(firstRow).getByText(`${LONG_NAME.first} ${LONG_NAME.last}`)).toBeInTheDocument();
    expect(within(firstRow).getByText('90')).toBeInTheDocument();
  });

  it('exposes one navigable ARIA table with column headers, rank labels and profile buttons', async () => {
    await renderLoaded();
    const table = screen.getByRole('table', { name: /Full member standings for/ });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((heading) => heading.textContent?.trim())).toEqual([
      'Rank', 'Member', 'Points', 'Events attended',
    ]);
    expect(headers[2]).toHaveAttribute('aria-sort', 'descending');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(MEMBERS.length);
    const firstRow = within(table).getByRole('row', {
      name: `Rank #1: ${LONG_NAME.first} ${LONG_NAME.last}`,
    });
    expect(within(firstRow).getByRole('button', {
      name: `Open profile for ${LONG_NAME.first} ${LONG_NAME.last}`,
    })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Rank T2: Ada Tie' })).toBeInTheDocument();
  });

  it('announces the active events ranking through its table header', async () => {
    await renderLoaded();
    // The metric tab is the existing keyboard-operable sort control.
    const eventsTab = screen.getByRole('button', { name: 'EVENTS' });
    fireEvent.click(eventsTab);
    const table = screen.getByRole('table', { name: /Full member standings for/ });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[2]).toHaveTextContent('Events attended');
    expect(headers[2]).toHaveAttribute('aria-sort', 'descending');
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

  it('does not load or reveal live House totals even for a direct House tab link', async () => {
    const read = jest.spyOn(leaderboardRepository, 'getAllTimeHouseLeaderboard');
    const yearlyRead = jest.spyOn(leaderboardRepository, 'getYearlyHouseLeaderboard');
    renderLeaderboard('/leaderboard?view=houses');
    expect(await screen.findByText(/House standings are announced at GBMs/i)).toBeInTheDocument();
    expect(screen.queryByText(/40 MEMBERS/)).not.toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
    expect(yearlyRead).not.toHaveBeenCalled();
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
    expect(within(dialog).queryByText(/Bowser/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: /^Close/ })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue({
      academic_year_start: 2025, house: 'Bowser', house_profile_id: 'hp-bowser',
      display_name: 'Bowser', accent_color: '#c0392b',
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open profile for Cam Solo' })[0]);
    dialog = await screen.findByRole('dialog', { name: 'Cam Solo member profile' });
    expect(await within(dialog).findByText(/^House · Bowser/)).toBeInTheDocument();
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

  it('reopens and scrolls to the explainer when the link is clicked again after collapsing it', async () => {
    const scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    await renderLoaded('/leaderboard#how-points-work');
    const details = document.getElementById('how-points-work') as HTMLDetailsElement;
    await waitFor(() => expect(details.open).toBe(true));

    // Collapse it; the URL hash stays #how-points-work.
    details.open = false;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(details.open).toBe(false));

    // Same hash again: no location change, so the click itself must reopen it.
    fireEvent.click(screen.getByRole('link', { name: /How points work/ }));
    await waitFor(() => expect(details.open).toBe(true));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('keeps the explainer collapsed by default', async () => {
    await renderLoaded();
    const details = document.getElementById('how-points-work') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await act(async () => undefined);
  });
});
