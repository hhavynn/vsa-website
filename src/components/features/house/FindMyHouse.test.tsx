import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { FindMyHouse } from './FindMyHouse';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { leaderboardRepository } from '../../../data/repos/leaderboard';

jest.mock('../../../data/repos/memberLookup', () => ({
  memberLookupRepository: { searchMembers: jest.fn() },
}));
jest.mock('../../../data/repos/leaderboard', () => ({
  leaderboardRepository: { getMemberHouseBadge: jest.fn() },
}));
const search = memberLookupRepository.searchMembers as jest.Mock;
const badge = leaderboardRepository.getMemberHouseBadge as jest.Mock;
const member = (id: string, name: string) => ({
  id, fullName: name, displayName: name, year: '2029', college: 'Sixth',
});
function mount(year = 2026) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FindMyHouse academicYearStart={year} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
function searchFor(name: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Member name' }), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Find my House' }));
}
beforeEach(() => { jest.clearAllMocks(); search.mockResolvedValue([member('m1','Ada Example')]); badge.mockResolvedValue({ house: 'twilight', display_name: 'Twilight Sparkle', house_profile_id: 'h1', accent_color: '#777777' }); });

it('does not query on initial render or short/free-text edits', () => {
  mount();
  expect(search).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Member name' }), { target: { value: 'Ad' } });
  expect(screen.getByRole('button', { name: 'Find my House' })).toBeDisabled();
  expect(search).not.toHaveBeenCalled();
  expect(badge).not.toHaveBeenCalled();
});

it('requires explicit member choice before reading a one-member published badge', async () => {
  mount();
  searchFor('Ada Example');
  expect(await screen.findByText('Choose your member record')).toBeInTheDocument();
  expect(search).toHaveBeenCalledWith('Ada Example', 11);
  expect(badge).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Ada Example/ }));
  expect(await screen.findByText('Twilight Sparkle')).toBeInTheDocument();
  expect(badge).toHaveBeenCalledWith('m1', 2026);
  expect(screen.getByRole('link', { name: /Meet your House/ })).toHaveAttribute('href', '/house/year/2026-2027/twilight');
});

it('never auto-chooses ambiguous public names, including same-name canonical records', async () => {
  search.mockResolvedValue([member('m1','Ada Example'), member('m2','Ada Example')]);
  mount();
  searchFor('Ada Example');
  expect(await screen.findAllByRole('button', { name: /Ada Example/ })).toHaveLength(2);
  expect(badge).not.toHaveBeenCalled();
});

it('requires narrower search instead of presenting a truncated list as exhaustive', async () => {
  search.mockResolvedValue(Array.from({ length: 11 }, (_, i) => member('id'+i, 'Ada Example')));
  mount();
  searchFor('Ada');
  expect(await screen.findByText(/More than ten members match/)).toBeInTheDocument();
  expect(screen.queryByText('Choose your member record')).not.toBeInTheDocument();
  expect(badge).not.toHaveBeenCalled();
});

it('distinguishes missing member, missing published assignment and service failures', async () => {
  search.mockResolvedValueOnce([]);
  const ui = mount();
  searchFor('Nobody Found');
  expect(await screen.findByText(/No matching member record found/)).toBeInTheDocument();
  search.mockResolvedValueOnce([member('m2','Bea Example')]);
  badge.mockResolvedValueOnce(null);
  searchFor('Bea Example');
  fireEvent.click(await screen.findByRole('button', { name: /Bea Example/ }));
  expect(await screen.findByText(/No published House affiliation is linked/)).toBeInTheDocument();
  badge.mockRejectedValueOnce(new Error('permission denied'));
  // Remount with another year: no stale House result should transfer.
  ui.unmount();
  search.mockResolvedValueOnce([member('m2','Bea Example')]);
  const next = mount(2025);
  searchFor('Bea Example');
  fireEvent.click(await screen.findByRole('button', { name: /Bea Example/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not be verified/i);
  expect(badge).toHaveBeenLastCalledWith('m2', 2025);
  next.unmount();
});
