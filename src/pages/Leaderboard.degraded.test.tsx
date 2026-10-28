/**
 * Degraded-mode contract for the public House standings fallback (#272).
 *
 * Simulates an unavailable backend (HTTP 503) and asserts the page still renders
 * the published House totals for a completed House year, labelled with that year,
 * instead of an empty panel or an unqualified "these are the current standings".
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from './Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { getFallbackHouseStandingsLabel } from '../config/publicFallbackContent';

jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({
    terms: [{ academic_year_start: 2025, academic_year_end: 2026, is_active: true }],
    loading: false,
  }),
}));
jest.mock('../hooks/useLeaderboardYears', () => ({
  useLeaderboardYears: () => ({ yearsWithData: [2025], loading: false }),
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

const OUTAGE = Object.assign(new Error('Service unavailable'), { status: 503 });

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } });
  // The outage is deliberate here, so the app's error logging is expected noise.
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(leaderboardRepository, 'getAllTimeLeaderboard').mockRejectedValue(OUTAGE);
  jest.spyOn(leaderboardRepository, 'getAllTimeHouseLeaderboard').mockRejectedValue(OUTAGE);
  jest.spyOn(leaderboardRepository, 'getYearlyHouseLeaderboard').mockRejectedValue(OUTAGE);
  jest.spyOn(leaderboardRepository, 'getRecentHouseActivity').mockRejectedValue(OUTAGE);
  jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockRejectedValue(OUTAGE);
  jest.spyOn(leaderboardRepository, 'getMemberEventHistory').mockRejectedValue(OUTAGE);
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
  jest.restoreAllMocks();
});

function renderHousesView() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/leaderboard?view=houses']}>
        <Leaderboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Leaderboard degraded mode', () => {
  it('shows the published House totals for the selected year when the backend is unavailable', async () => {
    renderHousesView();

    await waitFor(() => {
      expect(screen.getByText(/Showing the published totals/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Showing the published totals/i)).toHaveTextContent(
      getFallbackHouseStandingsLabel()
    );
    expect(screen.getByText(/Bowser/)).toBeInTheDocument();
    expect(screen.getByText(/Donkey Kong/)).toBeInTheDocument();
  });

  it('does not present the published totals as live standings', async () => {
    renderHousesView();

    await waitFor(() => {
      expect(screen.getByText(/Showing the published totals/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Live House standings are temporarily unavailable/i)).toBeInTheDocument();
  });
});
