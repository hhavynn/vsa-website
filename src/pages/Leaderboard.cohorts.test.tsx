import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Leaderboard } from './Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';

let mockBoardIds = new Set(['one', 'four']);
let mockRosterError = false;
const mockMembers = [
  { id: 'one', first_name: 'Ada', last_name: 'One', college: null, year: null, points: 40, events_attended: 4 },
  { id: 'two', first_name: 'Bao', last_name: 'Two', college: null, year: null, points: 30, events_attended: 3 },
  { id: 'three', first_name: 'Cai', last_name: 'Three', college: null, year: null, points: 20, events_attended: 2 },
  { id: 'four', first_name: 'Cam', last_name: 'Four', college: null, year: null, points: 10, events_attended: 1 },
];
jest.mock('../hooks/useAcademicTerms', () => ({ useAcademicTerms: () => ({ terms: [], loading: false }) }));
jest.mock('../hooks/useLeaderboardYears', () => ({ useLeaderboardYears: () => ({ yearsWithData: [2026], loading: false }) }));
jest.mock('../hooks/useMemberAvatars', () => ({ useMemberAvatars: () => new Map() }));
jest.mock('../hooks/useIndividualLeaderboard', () => ({
  useIndividualLeaderboard: () => ({ data: mockMembers, isLoading: false, error: null }),
}));
jest.mock('../hooks/usePublishedBoardRoster', () => ({
  usePublishedBoardRoster: () => ({ data: mockRosterError ? undefined : mockBoardIds, isLoading: false, isError: mockRosterError }),
}));
jest.mock('../hooks/usePublishedLeaderboardRoles', () => ({
  usePublishedLeaderboardRoles: () => ({ data: new Map(), isError: false }),
}));
jest.mock('../components/features/avatar/PhotoRequestSection', () => ({ PhotoRequestSection: () => null }));
jest.mock('../components/ui/AnimatedCounter', () => ({ AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span> }));

function UrlState() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}
function mount(path = '/leaderboard') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}><Leaderboard /><UrlState /></MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mockBoardIds = new Set(['one', 'four']);
  mockRosterError = false;
  jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue(null);
  jest.spyOn(leaderboardRepository, 'getMemberEventHistory').mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

describe('Board vs Members segmented leaderboard (#628)', () => {
  it('splits only canonical-linked published Board IDs and recalculates ranks within each cohort', async () => {
    mount();
    const membersTable = await screen.findByRole('table', { name: 'Members standings for 2026-2027' });
    expect(within(membersTable).getByRole('row', { name: 'Rank #1: Bao Two' })).toBeInTheDocument();
    expect(within(membersTable).getByRole('row', { name: 'Rank #2: Cai Three' })).toBeInTheDocument();
    expect(within(membersTable).queryByText('Ada One')).not.toBeInTheDocument();
    expect(within(membersTable).queryByText('Cam Four')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BOARD' }));
    const boardTable = screen.getByRole('table', { name: 'Board standings for 2026-2027' });
    expect(within(boardTable).getByRole('row', { name: 'Rank #1: Ada One' })).toBeInTheDocument();
    expect(within(boardTable).getByRole('row', { name: 'Rank #2: Cam Four' })).toBeInTheDocument();
    expect(within(boardTable).queryByText('Bao Two')).not.toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('cohort=board');
    expect(screen.getByTestId('url')).toHaveTextContent('year=2026');
    expect(within(boardTable).getByText('40')).toBeInTheDocument();
  });

  it('keeps selected cohort/year/metric in shareable URLs and respects deep links', async () => {
    mount('/leaderboard?year=2026&cohort=board&metric=events');
    expect(await screen.findByRole('table', { name: 'Board standings for 2026-2027' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BOARD' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'EVENTS' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'MEMBERS' }));
    expect(screen.getByTestId('url').textContent).not.toMatch(/cohort=board/);
    fireEvent.change(screen.getByRole('combobox', { name: 'Select academic year' }), { target: { value: 'all' } });
    expect(screen.getByTestId('url')).toHaveTextContent('year=all');
    expect(screen.queryByRole('button', { name: 'BOARD' })).not.toBeInTheDocument();
    expect(screen.getByText(/All-Time combines everyone/)).toBeInTheDocument();
  });

  it('does not falsely exclude officers when the Board read fails', async () => {
    mockRosterError = true;
    mount();
    expect(await screen.findByText(/Showing unsegmented standings/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Full member standings for 2026-2027' });
    expect(within(table).getByRole('row', { name: 'Rank #1: Ada One' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Rank #4: Cam Four' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'BOARD' }));
    expect(screen.getByText(/Board rankings cannot be verified right now/)).toBeInTheDocument();
    expect(screen.getByText(/Board rankings are unavailable until a verified published roster/)).toBeInTheDocument();
  });
});
