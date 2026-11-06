import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from './Leaderboard';
import { leaderboardRepository } from '../data/repos/leaderboard';
import type { PublicMemberRole } from '../lib/memberRoles';

let mockRoleMap = new Map<string, PublicMemberRole[]>();
let mockRolesError = false;
let mockVisibleHouses = new Map<string, {
  houseProfileId: string; houseKey: string | null; label: string;
  accentColor: string | null; academicYearStart: number;
}>();
let mockHouseReadError = false;
const mockHouseReads: Array<{ year: number | 'all' | null; ids: string[] }> = [];

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
// Existing role-chip assertions use the explicitly labelled unsplit fallback.
jest.mock('../hooks/usePublishedBoardRoster', () => ({ usePublishedBoardRoster: () => ({ data: undefined, isLoading: false, isError: true }) }));
jest.mock('../hooks/usePublishedLeaderboardRoles', () => ({
  usePublishedLeaderboardRoles: (year: number | 'all' | null, ids: string[]) => {
    mockVisibleReads.push({ year, ids });
    return { data: mockRoleMap, isError: mockRolesError };
  },
}));
jest.mock('../hooks/usePublishedMemberHouses', () => ({
  usePublishedMemberHouses: (year: number | 'all' | null, ids: string[]) => {
    mockHouseReads.push({ year, ids });
    return {
      data: typeof year === 'number' && !mockHouseReadError ? mockVisibleHouses : undefined,
      isError: mockHouseReadError,
    };
  },
}));
jest.mock('../components/features/avatar/PhotoRequestSection', () => ({
  PhotoRequestSection: () => null,
}));
jest.mock('../components/ui/AnimatedCounter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

const role = (memberId: string, kind: PublicMemberRole['kind'], label: string): PublicMemberRole => ({
  memberId, kind, label, academicYearStart: 2026, sourceType: 'cabinet_members', relatedKey: null,
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
  mockVisibleHouses = new Map();
  mockHouseReadError = false;
  mockHouseReads.length = 0;
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


describe('revealed House affiliation on visible individual standings (#627/#692)', () => {
  it('shows a House on rank 4 and phone/desktop podium without inferring a House Parent title', async () => {
    mockVisibleHouses.set('four', {
      houseProfileId: 'fictional-hp', houseKey:'fictional', label:'Fictional House',
      accentColor:'#334455', academicYearStart:2026,
    });
    mockVisibleHouses.set('one', {
      houseProfileId: 'other-hp', houseKey:'other', label:'Another House',
      accentColor:'#334455', academicYearStart:2026,
    });
    mount();
    const table = await screen.findByRole('table', { name:/Full member standings/ });
    const row = within(table).getByRole('row', { name:'Rank #4: Cam Four' });
    expect(within(row).getByText('House · Fictional House')).toBeInTheDocument();
    expect(within(row).getByText('Events Chair')).toBeInTheDocument();
    expect(within(row).queryByText(/House Parent/)).not.toBeInTheDocument();
    expect(screen.getAllByText('House · Another House').length).toBeGreaterThanOrEqual(2);
    expect(mockHouseReads.some(read => read.year === 2026 &&
      read.ids.includes('four') && read.ids.includes('one'))).toBe(true);
    expect(mockHouseReads.length).toBeLessThanOrEqual(4);
  });

  it('leaves all roles/points visible when optional House source is unavailable', async () => {
    mockHouseReadError = true;
    mount();
    expect(await screen.findByText(/Revealed House badges are temporarily unavailable/)).toBeInTheDocument();
    const table = await screen.findByRole('table', { name:/Full member standings/ });
    const row = within(table).getByRole('row', { name:'Rank #4: Cam Four' });
    expect(within(row).getByText('Board Member')).toBeInTheDocument();
    expect(within(row).queryByText(/House ·/)).not.toBeInTheDocument();
    expect(within(row).getByText('10')).toBeInTheDocument();
  });
});


describe('rank 4+ modal House and role navigation (#627)', () => {
  const badge = {
    academic_year_start: 2026, house: 'fictional', house_profile_id: 'fictional-profile',
    display_name: 'Fictional House', accent_color: null,
  };

  it('has one year-correct House link in the modal but no nested link in a row', async () => {
    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue(badge);
    mockVisibleHouses.set('four', {
      houseProfileId: badge.house_profile_id, houseKey: badge.house,
      label: badge.display_name, accentColor: null, academicYearStart: 2026,
    });
    mount();
    const row = within(await screen.findByRole('table', { name: /Full member standings/ }))
      .getByRole('row', { name: 'Rank #4: Cam Four' });
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const modal = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    const houseLink = await within(modal).findByRole('link', { name: /Open Fictional House House page/ });
    expect(houseLink).toHaveAttribute('href', '/house/year/2026-2027/fictional');
    expect(within(modal).getByText('House · Fictional House')).toBeInTheDocument();
    expect(within(modal).getByText('10')).toBeInTheDocument();
  });

  it('dates the All-Time House label and never pretends archived leadership is current', async () => {
    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue(badge);
    mount();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Select academic year' }),
      { target: { value: 'all' } });
    const table = await screen.findByRole('table', { name: /Full member standings/ });
    const row = within(table).getByRole('row', { name: 'Rank #4: Cam Four' });
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const modal = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    const houseLink = await within(modal).findByRole('link', { name: /Open Fictional House House page for 2026-2027/ });
    expect(houseLink).toHaveAttribute('href', '/house/year/2026-2027/fictional');
    expect(within(modal).getByText('House · Fictional House · 2026-2027')).toBeInTheDocument();
    expect(within(modal).queryByText('Board Member')).not.toBeInTheDocument();
    expect(within(modal).getByText(/Choose an academic year/)).toBeInTheDocument();
  });

  it('deduplicates a House Parent role destination and the House affiliation link', async () => {
    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue(badge);
    mockRoleMap.set('four', [
      { memberId:'four', kind:'house_parent', label:'House Parent · Fictional House',
        academicYearStart:2026, sourceType:'house_parents', relatedKey:'fictional' },
    ]);
    mount();
    const row = screen.getByRole('row', { name: 'Rank #4: Cam Four' });
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const modal = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    await within(modal).findByRole('link', { name: /Open Fictional House House page/ });
    expect(within(modal).getAllByRole('link')).toHaveLength(1);
    expect(within(modal).getByText('House Parent · Fictional House')).toBeInTheDocument();
  });

  it('keeps ranking, roles and the profile visible on House RPC failure', async () => {
    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockRejectedValue(
      new Error('synthetic denied House read'));
    mount();
    const row = screen.getByRole('row', { name: 'Rank #4: Cam Four' });
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const modal = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    expect(within(modal).getByText('Events Chair')).toBeInTheDocument();
    expect(within(modal).getByText('10')).toBeInTheDocument();
    expect(within(modal).queryByRole('link', { name: /House page/ })).not.toBeInTheDocument();
  });


  it('does not label a prior House as this selected academic year', async () => {
    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge').mockResolvedValue({
      ...badge, academic_year_start: 2025,
    });
    mount();
    const row = screen.getByRole('row', { name: 'Rank #4: Cam Four' });
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const modal = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    expect(within(modal).getByText('Events Chair')).toBeInTheDocument();
    expect(within(modal).queryByRole('link', { name: /House page/ })).not.toBeInTheDocument();
    expect(within(modal).queryByText(/House ·/)).not.toBeInTheDocument();
  });

  it('never links when the House RPC omits a verified academic year', async () => {
    jest.spyOn(leaderboardRepository, 'getMemberHouseBadge')
      .mockResolvedValue({ ...badge, academic_year_start: NaN });
    mount();
    const row = screen.getByRole('row', { name: 'Rank #4: Cam Four' });
    fireEvent.click(within(row).getByRole('button', { name: 'Open profile for Cam Four' }));
    const modal = await screen.findByRole('dialog', { name: 'Cam Four member profile' });
    expect(within(modal).getByText('Board Member')).toBeInTheDocument();
    expect(within(modal).queryByRole('link', { name: /House page/ })).not.toBeInTheDocument();
  });
});
