import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from './Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';
import type { PublicMemberRole } from '../lib/memberRoles';

let mockRoleMap = new Map<string, PublicMemberRole[]>();
let mockRolesError = false;
const mockVisibleReads: Array<{ year: number | 'all' | null; ids: string[] }> = [];

jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false }),
}));
jest.mock('../hooks/useLeaderboardYears', () => ({
  useLeaderboardYears: () => ({ yearsWithData: [2026], loading: false }),
}));
jest.mock('../hooks/useMemberAvatars', () => ({
  useMemberAvatars: () => new Map(),
}));
const mockLeaderboardMembers = [
      { id: 'one', first_name: 'Ada', last_name: 'One', college: null, year: null, points: 40, events_attended: 4 },
      { id: 'two', first_name: 'Bao', last_name: 'Two', college: null, year: null, points: 30, events_attended: 3 },
      { id: 'three', first_name: 'Cai', last_name: 'Three', college: null, year: null, points: 20, events_attended: 2 },
      { id: 'four', first_name: 'Cam', last_name: 'Four', college: null, year: null, points: 10, events_attended: 1 },
];
jest.mock('../hooks/useIndividualLeaderboard', () => ({
  useIndividualLeaderboard: () => ({
    data: mockLeaderboardMembers,
    isLoading: false,
    error: null,
  }),
}));
jest.mock('../hooks/usePublishedLeaderboardRoles', () => ({
  usePublishedLeaderboardRoles: (year: number | 'all' | null, ids: string[]) => {
    mockVisibleReads.push({ year, ids });
    return { data: mockRoleMap, isError: mockRolesError };
  },
}));
jest.mock('../components/features/avatar/PhotoRequestSection', () => ({
  PhotoRequestSection: () => null,
}));
jest.mock('../components/ui/AnimatedCounter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

const role = (memberId: string, kind: PublicMemberRole['kind'], label: string): PublicMemberRole => ({
  memberId, kind, label, academicYearStart: 2026, sourceType: 'cabinet_members',
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockRolesError = false;
  mockVisibleReads.length = 0;
  mockRoleMap = new Map([
    ['one', [role('one', 'board', 'Board Member'), role('one', 'cabinet_position', 'President')]],
    ['four', [
      role('four', 'board', 'Board Member'),
      role('four', 'cabinet_position', 'Events Chair'),
      role('four', 'cabinet_position', 'PR Chair'),
      role('four', 'intern', 'Intern'),
    ]],
  ]);
  jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue(null);
  jest.spyOn(leaderboardRepository, 'getMemberEventHistory').mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

describe('leaderboard badges on ALL members, not only Top 3 (#627)', () => {
  it('shows independently verified roles in a lower-ranked full standings row and its existing modal', async () => {
    mount();
    const table = await screen.findByRole('table', { name: /Full member standings/ });
    const row = within(table).getByRole('row', { name: 'Rank #4: Cam Four' });
    for (const label of ['Board Member', 'Events Chair', 'PR Chair', 'Intern']) {
      expect(within(row).getByText(label)).toBeInTheDocument();
    }
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    for (const label of ['Board Member', 'Events Chair', 'PR Chair', 'Intern']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByText('10')).toBeInTheDocument();
  });

  it('renders approved badges on both desktop and phone podium layouts', async () => {
    mount();
    expect(await screen.findByRole('table', { name: /Full member standings/ })).toBeInTheDocument();
    // One row + one phone podium + one desktop podium for the same linked ID.
    expect(screen.getAllByText('President')).toHaveLength(3);
    expect(screen.getAllByText('Board Member').length).toBeGreaterThan(3);
    expect(screen.queryByText('VSA MEMBER')).not.toBeInTheDocument();
  });

  it('omits year-specific roles in All-Time and never asserts old leadership is current', async () => {
    mount();
    expect(await screen.findByRole('table', { name: /Full member standings/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Select academic year' }), {
      target: { value: 'all' },
    });
    const table = screen.getByRole('table', { name: /Full member standings/ });
    expect(within(table).queryByText('Events Chair')).not.toBeInTheDocument();
    const row = within(table).getByRole('row', { name: 'Rank #4: Cam Four' });
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    expect(within(dialog).getByText(/Choose an academic year to see roles/)).toBeInTheDocument();
    expect(within(dialog).queryByText('Events Chair')).not.toBeInTheDocument();
  });

  it('keeps scores and profiles functional even when the optional role read fails', async () => {
    mockRolesError = true;
    mockRoleMap = new Map();
    mount();
    const message = await screen.findByText(/Member roles are temporarily unavailable/);
    expect(message).toBeInTheDocument();
    const row = screen.getByRole('row', { name: 'Rank #4: Cam Four' });
    expect(within(row).getByText('10')).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    expect(within(dialog).getByText(/Verified role information is temporarily unavailable/)).toBeInTheDocument();
  });

  it('batches the 4 visible canonical IDs instead of calling a role hook per member name', async () => {
    mount();
    await waitFor(() => expect(mockVisibleReads.some((read) => read.year === 2026 && read.ids.length === 4)).toBe(true));
    const lastYearlyRead = [...mockVisibleReads].reverse().find((read) => read.year === 2026);
    expect(new Set(lastYearlyRead?.ids)).toEqual(new Set(['one', 'two', 'three', 'four']));
  });
});
