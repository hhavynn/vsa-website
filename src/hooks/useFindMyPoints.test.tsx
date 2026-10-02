import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import type { ReactNode } from 'react';
import { useFindMyPoints } from './useFindMyPoints';
import { leaderboardRepository } from '../data/repos/leaderboard';

jest.mock('../lib/supabase', () => {
  const result = Promise.resolve({ data: [], error: null });
  return {
    supabase: {
      from: () => ({ select: () => Object.assign(result, { order: () => result }) }),
    },
  };
});

const yearlyRow = (member_id: string, last_name: string, total_points: number, events_attended: number) => ({
  member_id,
  first_name: member_id,
  last_name,
  college: null,
  graduation_year: null,
  total_points,
  events_attended,
  academic_year_start: 2026,
  academic_year_end: 2027,
  user_id: null,
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => jest.restoreAllMocks());

it('ranks with the same tie rules as /leaderboard: events tiebreaker, shared ranks, alphabetical within a tie', async () => {
  // Database order is total_points only, so equal-points rows arrive in arbitrary order.
  jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([
    yearlyRow('fewer-events', 'Le', 10, 1),
    yearlyRow('more-events', 'Pham', 10, 3),
    yearlyRow('vu', 'Vu', 5, 1),
    yearlyRow('an', 'An', 5, 1),
    yearlyRow('ho', 'Ho', 5, 1),
    yearlyRow('last', 'Do', 2, 1),
  ]);

  const { result } = renderHook(() => useFindMyPoints(2026), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.map(({ member_id, rank, tiedCount }) => ({ member_id, rank, tiedCount }))).toEqual([
    { member_id: 'more-events', rank: 1, tiedCount: 1 },
    { member_id: 'fewer-events', rank: 2, tiedCount: 1 },
    { member_id: 'an', rank: 3, tiedCount: 3 },
    { member_id: 'ho', rank: 3, tiedCount: 3 },
    { member_id: 'vu', rank: 3, tiedCount: 3 },
    { member_id: 'last', rank: 6, tiedCount: 1 },
  ]);
});
