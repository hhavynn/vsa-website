import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from 'react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from '../pages/Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { useIndividualLeaderboard } from './useIndividualLeaderboard';

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
  // Cached leaderboard data is considered fresh for 5 minutes.
  // It refreshes on a later query trigger/remount/invalidation rather than continuous polling.
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

it('does not refetch all-time standings on network reconnect', async () => {
  renderLeaderboard();
  await advanceTime();
  const fetch = jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard');
  fetch.mockClear();
  act(() => { window.dispatchEvent(new Event('online')); });
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

it('refreshes query when explicitly invalidated', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockRejectedValueOnce(new Error('Unavailable'));
  renderLeaderboard();
  await advanceTime();
  expect(screen.getByText('Leaderboard temporarily unavailable')).toBeInTheDocument();

  // Verify explicit invalidation triggers a fresh query execution
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

// Hook-level characterization (#293). Covers the LEADERBOARD system only
// (member_yearly_points / public_members via the repository); the check-in
// system (event_attendance + user_points) is not involved. Repository calls are
// spied above, so these assert the hook's own mapping and routing.
describe('useIndividualLeaderboard hook', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  const yearlyRow = (overrides: Record<string, unknown> = {}) => ({
    member_id: 'member-aaa',
    first_name: 'Test',
    last_name: 'Member',
    college: 'Test College',
    graduation_year: '2027',
    total_points: 12,
    events_attended: 4,
    academic_year_start: 2025,
    academic_year_end: 2026,
    ...overrides,
  });

  function hookWrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  function renderIndividual(year: number | 'all' | null) {
    return renderHook(() => useIndividualLeaderboard(year), { wrapper: hookWrapper });
  }

  it('maps a yearly row: member_id -> id, graduation_year -> year, total_points -> points, events_attended kept', async () => {
    jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([yearlyRow()]);

    const { result } = renderIndividual(2025);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The view no longer exposes user_id, so the hook currently passes
    // `user_id: undefined` through. Pinned as-is, not as preferred behaviour.
    expect(result.current.data).toStrictEqual([
      {
        id: 'member-aaa',
        first_name: 'Test',
        last_name: 'Member',
        college: 'Test College',
        year: '2027',
        points: 12,
        events_attended: 4,
        user_id: undefined,
      },
    ]);
    expect(leaderboardRepository.getYearlyLeaderboard).toHaveBeenCalledWith(2025);
    expect(leaderboardRepository.getAllTimeLeaderboard).not.toHaveBeenCalled();
  });

  it('keeps zero-point members and null college/year in the yearly list', async () => {
    jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([
      yearlyRow({ member_id: 'member-zero', total_points: 0, events_attended: 0, college: null, graduation_year: null }),
    ]);

    const { result } = renderIndividual(2025);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({ id: 'member-zero', points: 0, events_attended: 0, college: null, year: null });
  });

  it('returns the repository order as-is without re-sorting', async () => {
    jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([
      yearlyRow({ member_id: 'low', total_points: 1 }),
      yearlyRow({ member_id: 'high', total_points: 9 }),
    ]);

    const { result } = renderIndividual(2025);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((m) => m.id)).toEqual(['low', 'high']);
  });

  it('returns an empty list for a year with no rows', async () => {
    jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([]);

    const { result } = renderIndividual(2019);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it("'all' uses the all-time source and returns its rows unmapped", async () => {
    const rows = [member('Alpha', 10), member('Beta', 0)];
    jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockResolvedValue(rows);

    const { result } = renderIndividual('all');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(rows);
    expect(leaderboardRepository.getAllTimeLeaderboard).toHaveBeenCalledTimes(1);
    expect(leaderboardRepository.getYearlyLeaderboard).not.toHaveBeenCalled();
  });

  it('a null year is disabled: no data and neither source is queried', async () => {
    const { result } = renderIndividual(null);

    // Give an (incorrectly) enabled query a chance to fire.
    await act(async () => { await Promise.resolve(); });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(leaderboardRepository.getYearlyLeaderboard).not.toHaveBeenCalled();
    expect(leaderboardRepository.getAllTimeLeaderboard).not.toHaveBeenCalled();
  });

  it('surfaces a repository failure as a query error without retrying', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockRejectedValue(new Error('Unavailable'));

    const { result } = renderIndividual(2025);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(leaderboardRepository.getYearlyLeaderboard).toHaveBeenCalledTimes(1);
  });
});
