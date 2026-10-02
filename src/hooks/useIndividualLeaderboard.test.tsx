import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from '../pages/Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';

let mockYearsWithData: number[] = [];

jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false }),
}));
jest.mock('../hooks/useLeaderboardYears', () => ({
  useLeaderboardYears: () => ({ yearsWithData: mockYearsWithData, loading: false }),
}));
jest.mock('../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => new Map(),
}));
jest.mock('../components/ui/AnimatedCounter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));
jest.mock('../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on() { return this; },
      subscribe: () => ({ unsubscribe: () => undefined }),
    }),
  },
}));

const member = (firstName: string, points: number) => ({
  id: firstName,
  first_name: firstName,
  last_name: 'Member',
  college: null,
  year: null,
  points,
  events_attended: 2,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

let queryClient: QueryClient;

async function advanceTime(milliseconds = 0) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  });
  await act(async () => { jest.advanceTimersByTime(0); });
}

function renderLeaderboard() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setVisibility(visibility: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibility });
  act(() => { window.dispatchEvent(new Event('visibilitychange')); });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockYearsWithData = [];
  focusManager.setFocused(undefined);
  setVisibility('visible');
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue([
    member('Alpha', 10), member('Beta', 5),
  ]);
  jest.spyOn(leaderboardRepository, 'getAllTimeHouseLeaderboard').mockResolvedValue([]);
  jest.spyOn(leaderboardRepository, 'getYearlyHouseLeaderboard').mockResolvedValue([]);
  jest.spyOn(leaderboardRepository, 'getRecentHouseActivity').mockResolvedValue([]);
  jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([{
    member_id: 'Yearly', first_name: 'Yearly', last_name: 'Member', college: null,
    graduation_year: null, total_points: 17, events_attended: 3,
    academic_year_start: 2025, academic_year_end: 2026, user_id: null,
  }]);
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
  jest.restoreAllMocks();
  focusManager.setFocused(undefined);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  jest.useRealTimers();
});

it('updates all-time standings within 30 seconds without a raw members event', async () => {
  renderLeaderboard();
  await advanceTime();
  expect(screen.getAllByRole('button', { name: /Open profile for/ })[0]).toHaveAccessibleName('Open profile for Alpha Member');

  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue([
    member('Alpha', 10), member('Beta', 20),
  ]);
  await advanceTime(30_000);

  const topRow = screen.getAllByRole('button', { name: /Open profile for/ })[0];
  expect(topRow).toHaveAccessibleName('Open profile for Beta Member');
  expect(within(topRow).getByText('20')).toBeInTheDocument();
  // Equal event counts are a tie on the Events tab: both share T1, listed alphabetically.
  fireEvent.click(screen.getByRole('button', { name: 'EVENTS' }));
  const eventRows = screen.getAllByRole('button', { name: /Open profile for/ });
  expect(eventRows[0]).toHaveAccessibleName('Open profile for Alpha Member');
  for (const row of eventRows) {
    expect(within(row).getByText('T1')).toBeInTheDocument();
    expect(within(row).getByText('2-way tie')).toBeInTheDocument();
  }
});

it('pauses hidden-tab polling and refreshes when the page becomes visible', async () => {
  renderLeaderboard();
  await advanceTime();
  setVisibility('hidden');
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue([member('Updated', 25)]);
  await advanceTime(60_000);
  expect(screen.queryByText('Updated Member')).not.toBeInTheDocument();
  expect(screen.getByText('Alpha Member')).toBeInTheDocument();

  setVisibility('visible');
  await advanceTime();
  expect(screen.getByText('Updated Member')).toBeInTheDocument();
});

it('refreshes all-time standings when the window regains focus', async () => {
  renderLeaderboard();
  await advanceTime();
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue([member('Focused', 25)]);
  act(() => { window.dispatchEvent(new Event('focus')); });
  await advanceTime();
  expect(screen.getByText('Focused Member')).toBeInTheDocument();
});

it('deduplicates polling while a prior refresh is pending', async () => {
  renderLeaderboard();
  await advanceTime();
  const pending = deferred<ReturnType<typeof member>[]>();
  const fetch = jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockReturnValue(pending.promise);
  const initialCalls = fetch.mock.calls.length;
  await advanceTime(90_000);
  expect(fetch.mock.calls.length - initialCalls).toBe(1);
  expect(screen.getByText('Alpha Member')).toBeInTheDocument();

  await act(async () => { pending.resolve([member('Completed', 30)]); });
  await advanceTime();
  expect(screen.getByText('Completed Member')).toBeInTheDocument();
});

it('ignores an old all-time refresh after selecting an academic year', async () => {
  mockYearsWithData = [2025];
  renderLeaderboard();
  await advanceTime();
  const selector = screen.getByRole('combobox', { name: 'Select academic year' });
  fireEvent.change(selector, { target: { value: 'all' } });
  await advanceTime();
  const pending = deferred<ReturnType<typeof member>[]>();
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockReturnValue(pending.promise);
  await advanceTime(30_000);

  fireEvent.change(selector, { target: { value: '2025' } });
  await advanceTime();
  expect(screen.getByText('Yearly Member')).toBeInTheDocument();

  await act(async () => { pending.resolve([member('Obsolete', 99)]); });
  await advanceTime(60_000);
  expect(screen.queryByText('Obsolete Member')).not.toBeInTheDocument();
  expect(screen.getByText('Yearly Member')).toBeInTheDocument();
});

it('does not poll academic-year standings or refetch them on focus', async () => {
  mockYearsWithData = [2025];
  renderLeaderboard();
  await advanceTime();
  jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([]);
  await advanceTime(60_000);
  act(() => { window.dispatchEvent(new Event('focus')); });
  await advanceTime();
  expect(screen.getByText('Yearly Member')).toBeInTheDocument();
});

it('recovers from an initial fetch error on the next all-time refresh', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockRejectedValueOnce(new Error('Unavailable'));
  renderLeaderboard();
  await advanceTime();
  expect(screen.getByText('Leaderboard temporarily unavailable')).toBeInTheDocument();

  await advanceTime(30_000);
  expect(screen.queryByText('Leaderboard temporarily unavailable')).not.toBeInTheDocument();
  expect(screen.getByText('Alpha Member')).toBeInTheDocument();
});
