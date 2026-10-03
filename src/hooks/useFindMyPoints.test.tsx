import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import type { ReactNode } from 'react';
import { useFindMyPoints } from './useFindMyPoints';
import { leaderboardRepository } from '../data/repos/leaderboard';
import { supabaseMock, postgrestError } from '../test-utils/supabaseMock';

// Delegates to the shared recording mock (src/test-utils/supabaseMock.ts). An
// unconfigured table resolves { data: [], error: null }, which is what the
// previous inline stub returned, so the existing test is unaffected.
jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

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

beforeEach(() => supabaseMock.reset());

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

// Characterization (#293). LEADERBOARD system only: member_yearly_points via the
// repository, plus public_members for House and all-time points. The check-in
// system (event_attendance + user_points) is not read here. See
// docs/leaderboard-system.md.
describe('useFindMyPoints characterization', () => {
  const ids = (data: Array<{ member_id: string }> | undefined) => data?.map((e) => e.member_id);

  describe('selectedYear === null', () => {
    it('is disabled: no data and no query of either source', async () => {
      const yearly = jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard');

      const { result } = renderHook(() => useFindMyPoints(null), { wrapper });
      await act(async () => { await Promise.resolve(); });

      expect(result.current.isIdle).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(yearly).not.toHaveBeenCalled();
      expect(supabaseMock.queries()).toHaveLength(0);
    });
  });

  describe("selectedYear === 'all'", () => {
    const publicRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'member-aaa',
      first_name: 'Test',
      last_name: 'Member',
      college: 'Test College',
      year: '2027',
      house: 'Bowser',
      points: 30,
      events_attended: 6,
      ...overrides,
    });

    it('reads public_members with an explicit public column list, ordered by points desc, no year filter', async () => {
      supabaseMock.queueResult('public_members', { data: [publicRow()], error: null });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(supabaseMock.queries().map((q) => q.table)).toEqual(['public_members']);
      const calls = supabaseMock.queriesFor('public_members')[0].calls;
      const columns = String(calls.find((c) => c.method === 'select')?.args[0]).split(',').map((c) => c.trim());
      expect(columns).toEqual(['id', 'first_name', 'last_name', 'college', 'year', 'house', 'points', 'events_attended']);
      expect(columns).not.toContain('user_id');
      expect(columns).not.toContain('email');
      expect(calls).toContainEqual({ method: 'order', args: ['points', { ascending: false }] });
      expect(supabaseMock.filtersFor('public_members')).toEqual([]);
    });

    it('maps rows: all-time points equal total points, house and names carried through', async () => {
      supabaseMock.queueResult('public_members', { data: [publicRow()], error: null });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        {
          member_id: 'member-aaa',
          first_name: 'Test',
          last_name: 'Member',
          full_name: 'Test Member',
          college: 'Test College',
          graduation_year: '2027',
          house: 'Bowser',
          total_points: 30,
          events_attended: 6,
          all_time_points: 30,
          rank: 1,
          tiedCount: 1,
        },
      ]);
    });

    it('defaults null fields: a member in no House (house null), zero points, blank names', async () => {
      supabaseMock.queueResult('public_members', {
        data: [
          publicRow({ id: 'member-nohouse', house: null, first_name: null, last_name: null, college: null, year: null, points: null, events_attended: null }),
        ],
        error: null,
      });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0]).toMatchObject({
        member_id: 'member-nohouse',
        first_name: '',
        last_name: '',
        full_name: '',
        college: null,
        graduation_year: null,
        house: null,
        total_points: 0,
        events_attended: 0,
        all_time_points: 0,
        rank: 1,
        tiedCount: 1,
      });
    });

    it('keeps zero-point members listed and ranks them below members with points', async () => {
      supabaseMock.queueResult('public_members', {
        data: [
          publicRow({ id: 'member-zero', last_name: 'Aaa', points: 0, events_attended: 0 }),
          publicRow({ id: 'member-top', last_name: 'Zzz', points: 5, events_attended: 1 }),
        ],
        error: null,
      });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.map(({ member_id, rank }) => ({ member_id, rank }))).toEqual([
        { member_id: 'member-top', rank: 1 },
        { member_id: 'member-zero', rank: 2 },
      ]);
    });

    it('shares ranks using the /leaderboard tie rules (events tiebreaker, alphabetical within a tie)', async () => {
      supabaseMock.queueResult('public_members', {
        data: [
          publicRow({ id: 'tie-b', last_name: 'Bee', points: 10, events_attended: 2 }),
          publicRow({ id: 'tie-a', last_name: 'Aye', points: 10, events_attended: 2 }),
          publicRow({ id: 'more-events', last_name: 'Zed', points: 10, events_attended: 5 }),
          publicRow({ id: 'low', last_name: 'Low', points: 1, events_attended: 1 }),
        ],
        error: null,
      });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.map(({ member_id, rank, tiedCount }) => ({ member_id, rank, tiedCount }))).toEqual([
        { member_id: 'more-events', rank: 1, tiedCount: 1 },
        { member_id: 'tie-a', rank: 2, tiedCount: 2 },
        { member_id: 'tie-b', rank: 2, tiedCount: 2 },
        { member_id: 'low', rank: 4, tiedCount: 1 },
      ]);
    });

    it('returns an empty list for empty data', async () => {
      supabaseMock.queueResult('public_members', { data: [], error: null });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('returns an empty list for null data', async () => {
      supabaseMock.queueResult('public_members', { data: null, error: null });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('surfaces a database error as a query error', async () => {
      supabaseMock.queueResult('public_members', { data: null, error: postgrestError('permission denied', '42501') });

      const { result } = renderHook(() => useFindMyPoints('all'), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('a past academic year', () => {
    it('ranks on the yearly total and carries all-time points and House from public_members', async () => {
      const yearly = jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([
        yearlyRow('member-aaa', 'Aye', 8, 3),
      ]);
      supabaseMock.queueResult('public_members', {
        data: [{ id: 'member-aaa', house: 'Bowser', points: 40 }],
        error: null,
      });

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(yearly).toHaveBeenCalledWith(2024);
      expect(result.current.data?.[0]).toMatchObject({
        member_id: 'member-aaa',
        total_points: 8,
        events_attended: 3,
        all_time_points: 40,
        house: 'Bowser',
        rank: 1,
      });
    });

    it('enriches from public_members with an unfiltered id/house/points select', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([yearlyRow('member-aaa', 'Aye', 8, 3)]);

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const calls = supabaseMock.queriesFor('public_members')[0].calls;
      expect(calls.find((c) => c.method === 'select')?.args[0]).toBe('id, house, points');
      expect(supabaseMock.filtersFor('public_members')).toEqual([]);
    });

    it('as currently coded, a member missing from public_members shows house null and the yearly total as all-time points', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([yearlyRow('member-gone', 'Gone', 8, 3)]);
      supabaseMock.queueResult('public_members', { data: [{ id: 'someone-else', house: 'Toad', points: 99 }], error: null });

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0]).toMatchObject({ house: null, total_points: 8, all_time_points: 8 });
    });

    it('a member in no House (house null in public_members) keeps house null; null points enrich as 0', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([yearlyRow('member-aaa', 'Aye', 8, 3)]);
      supabaseMock.queueResult('public_members', { data: [{ id: 'member-aaa', house: null, points: null }], error: null });

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0]).toMatchObject({ house: null, all_time_points: 0, total_points: 8 });
    });

    it('keeps a zero-point member and ties them with other zero-point/zero-event members', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([
        yearlyRow('zero-b', 'Bee', 0, 0),
        yearlyRow('zero-a', 'Aye', 0, 0),
        yearlyRow('lead', 'Lead', 3, 1),
      ]);

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.map(({ member_id, rank, tiedCount }) => ({ member_id, rank, tiedCount }))).toEqual([
        { member_id: 'lead', rank: 1, tiedCount: 1 },
        { member_id: 'zero-a', rank: 2, tiedCount: 2 },
        { member_id: 'zero-b', rank: 2, tiedCount: 2 },
      ]);
    });

    it('defaults null names and college to blanks / null', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([
        { ...yearlyRow('member-aaa', 'x', 1, 1), first_name: null, last_name: null } as unknown as Awaited<
          ReturnType<typeof leaderboardRepository.getYearlyLeaderboard>
        >[number],
      ]);

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0]).toMatchObject({ first_name: '', last_name: '', full_name: '', college: null, graduation_year: null });
    });

    it('an empty yearly result returns [] without querying public_members', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([]);

      const { result } = renderHook(() => useFindMyPoints(2019), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(supabaseMock.queriesFor('public_members')).toHaveLength(0);
    });

    it('surfaces an enrichment error as a query error', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockResolvedValue([yearlyRow('member-aaa', 'Aye', 8, 3)]);
      supabaseMock.queueResult('public_members', { data: null, error: postgrestError('permission denied', '42501') });

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('surfaces a yearly repository failure as a query error', async () => {
      jest.spyOn(leaderboardRepository, 'getYearlyLeaderboard').mockRejectedValue(new Error('Unavailable'));

      const { result } = renderHook(() => useFindMyPoints(2024), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(ids(result.current.data)).toBeUndefined();
    });
  });
});
