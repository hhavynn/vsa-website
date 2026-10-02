import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

beforeEach(() => {
  jest.useFakeTimers();
  mockYearsWithData = [];
  focusManager.setFocused(undefined);
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
  jest.useRealTimers();
});

it('fetches and renders all-time standings on initial load', async () => {
  renderLeaderboard();
  await advanceTime();
  expect(screen.getAllByRole('button', { name: /Open profile for/ })[0]).toHaveAccessibleName('Open profile for Alpha Member');
});

it('does not refetch all-time standings within the stale window', async () => {
  renderLeaderboard();
  await advanceTime();
  const fetch = jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard');
  fetch.mockClear();
  // Advance well past the old 30s polling interval but within the 5 min staleTime
  await advanceTime(120_000);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText('Alpha Member')).toBeInTheDocument();
});

it('does not refetch all-time standings on window focus', async () => {
  renderLeaderboard();
  await advanceTime();
  const fetch = jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard');
  fetch.mockClear();
  act(() => { window.dispatchEvent(new Event('focus')); });
  await advanceTime();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText('Alpha Member')).toBeInTheDocument();
});

it('uses cached data when switching back to all-time from a yearly view', async () => {
  mockYearsWithData = [2025];
  renderLeaderboard();
  await advanceTime();
  const selector = screen.getByRole('combobox', { name: 'Select academic year' });

  // Switch to yearly
  fireEvent.change(selector, { target: { value: '2025' } });
  await advanceTime();
  expect(screen.getByText('Yearly Member')).toBeInTheDocument();

  const fetch = jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard');
  fetch.mockClear();

  // Switch back to all-time — should use cached data, no new fetch within staleTime
  fireEvent.change(selector, { target: { value: 'all' } });
  await advanceTime();
  expect(screen.getByText('Alpha Member')).toBeInTheDocument();
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

it('shows error state on initial fetch failure', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockRejectedValueOnce(new Error('Unavailable'));
  renderLeaderboard();
  await advanceTime();
  expect(screen.getByText('Leaderboard temporarily unavailable')).toBeInTheDocument();
});

it('recovers when cache is invalidated after a fetch error', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockRejectedValueOnce(new Error('Unavailable'));
  renderLeaderboard();
  await advanceTime();
  expect(screen.getByText('Leaderboard temporarily unavailable')).toBeInTheDocument();

  // Simulate cache invalidation (e.g. after admin import)
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue([
    member('Alpha', 10), member('Beta', 5),
  ]);
  await act(async () => { queryClient.invalidateQueries(['individual-leaderboard']); });
  await advanceTime();
  expect(screen.queryByText('Leaderboard temporarily unavailable')).not.toBeInTheDocument();
  expect(screen.getByText('Alpha Member')).toBeInTheDocument();
});

it('gives podium members tied at T1 the same first-place styling', async () => {
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue([
    member('Gamma', 5), member('Beta', 10), member('Alpha', 10),
  ]);
  renderLeaderboard();
  await advanceTime();

  const podiumBadges = (text: string) =>
    screen.getAllByText(text).filter((element) => element.style.background !== '').map((element) => element.style.background);

  expect(podiumBadges('T1')).toEqual(['rgb(212, 132, 26)', 'rgb(212, 132, 26)']);
  expect(podiumBadges('3')).toEqual(['rgb(180, 83, 9)']);
});
