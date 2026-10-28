import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HouseMemberLeaderboard } from './HouseMemberLeaderboard';
import { leaderboardRepository } from '../../../data/repos/leaderboard';
import type { HouseMemberRankEntry } from '../../../types';

jest.mock('../../../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => new Map(),
}));

const names = ['Ada', 'Bao', 'Cam', 'Dee', 'Em', 'Fin'];
const members: HouseMemberRankEntry[] = names.map((first_name, index) => ({
  house: 'Bowser',
  house_profile_id: 'house-1',
  display_name: 'Bowser',
  image_url: null,
  accent_color: '#c0392b',
  member_id: 'member-' + index,
  first_name,
  last_name: 'Nguyen',
  college: null,
  graduation_year: null,
  academic_year_start: 2026,
  academic_year_end: 2027,
  total_points: 12 - index,
  events_attended: 12 - index,
  unique_events: 12 - index,
  latest_activity_at: null,
}));

afterEach(() => jest.restoreAllMocks());

it('exposes expandable House member rankings as labelled rows and columns without changing display order', async () => {
  jest.spyOn(leaderboardRepository, 'getHouseMemberRankings').mockResolvedValue(new Map([['Bowser', members]]));
  render(
    <MemoryRouter>
      <HouseMemberLeaderboard selectedYear={2026} selectedYearLabel="2026-2027" />
    </MemoryRouter>
  );

  const toggle = await screen.findByRole('button', { name: /Bowser/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const table = screen.getByRole('table', { name: 'Bowser member rankings · 2026-2027' });
  expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
    'Rank', 'Member', 'Check-ins',
  ]);
  expect(within(table).getAllByRole('row')).toHaveLength(6); // heading row + 5 initially visible
  const first = within(table).getByRole('row', { name: 'Rank 1: Ada Nguyen, 12 check-ins' });
  expect(within(first).getByRole('rowheader', { name: /Ada Nguyen/ })).toBeInTheDocument();
  expect(within(first).getByRole('cell', { name: 'Rank 1' })).toBeInTheDocument();
  expect(within(first).getByRole('cell', { name: '12 check-ins' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Show 1 more/ }));
  expect(within(table).getAllByRole('row')).toHaveLength(7);
  expect(within(table).getByRole('row', { name: 'Rank 6: Fin Nguyen, 7 check-ins' })).toBeInTheDocument();
});
