import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminCabinetRollover from './CabinetRollover';
import { cabinetRosterRepository } from '../../data/repos/cabinetRoster';
import { cabinetYearsRepository } from '../../data/repos/cabinetYears';
import { memberLookupRepository } from '../../data/repos/memberLookup';
import { photoRequestsRepository } from '../../data/repos/photoRequests';
import { CabinetRosterCycle, CabinetRosterDraft } from '../../lib/cabinetRoster';

jest.mock('react-hot-toast', () => {
  const toast = Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() });
  return { __esModule: true, default: toast, Toaster: () => null };
});
jest.mock('react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: () => ({ data: undefined }),
  useMutation: () => ({ mutateAsync: jest.fn(), isLoading: false }),
}));
jest.mock('../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
const mockYears = [
  { id: 'cy-2026', label: '2026-2027 Cabinet', slug: '2026-2027', start_year: 2026, end_year: 2027, is_active: true },
  { id: 'cy-2027', label: '2027-2028 Cabinet', slug: '2027-2028', start_year: 2027, end_year: 2028, is_active: false },
];
const mockRefreshYears = jest.fn();
jest.mock('../../hooks/useCabinetYears', () => ({
  useCabinetYears: () => ({ cabinetYears: mockYears, loading: false, error: null, refreshCabinetYears: mockRefreshYears }),
}));
jest.mock('../../data/repos/cabinetRoster', () => ({
  cabinetRosterRepository: {
    listCycles: jest.fn(),
    getCycle: jest.fn(),
    getDrafts: jest.fn(),
    countPublicRows: jest.fn(),
    createCycle: jest.fn(),
    addDrafts: jest.fn(),
    updateDraft: jest.fn(),
    removeDraft: jest.fn(),
    lockCycle: jest.fn(),
    reopenCycle: jest.fn(),
    publishCycle: jest.fn(),
    deleteCycle: jest.fn(),
    listStructureSource: jest.fn(),
  },
}));
jest.mock('../../data/repos/cabinetYears', () => ({
  cabinetYearsRepository: { setActiveYear: jest.fn() },
}));
jest.mock('../../data/repos/memberLookup', () => ({
  memberLookupRepository: { listMemberDirectory: jest.fn(), searchMembers: jest.fn() },
}));
jest.mock('../../data/repos/photoRequests', () => ({
  photoRequestsRepository: { getPublicMemberAvatars: jest.fn() },
}));

const repo = cabinetRosterRepository as jest.Mocked<typeof cabinetRosterRepository>;
const years = cabinetYearsRepository as jest.Mocked<typeof cabinetYearsRepository>;
const lookup = memberLookupRepository as jest.Mocked<typeof memberLookupRepository>;
const photos = photoRequestsRepository as jest.Mocked<typeof photoRequestsRepository>;

const cycle = (status: CabinetRosterCycle['status']): CabinetRosterCycle => ({
  id: 'c1', cabinet_year_id: 'cy-2027', source_cabinet_year_id: 'cy-2026', status,
  created_by: null, locked_at: null, published_at: null, created_at: '', updated_at: '',
});
const draft = (id: string, overrides: Partial<CabinetRosterDraft> = {}): CabinetRosterDraft => ({
  id, cycle_id: 'c1', role: `Role ${id}`, category: 'General Board', display_order: Number(id.replace(/\D/g, '')) || 0,
  name: `Person ${id}`, member_id: null, year: null, college: null, major: null, pronouns: null,
  favorite_snack: null, fun_fact: null, published_cabinet_member_id: null, created_at: `2026-10-02T00:00:0${id.length % 9}Z`,
  updated_at: '', ...overrides,
});

const directory = [
  { id: 'm-havyn', first_name: 'Havyn', last_name: 'Nguyen', college: 'Sixth', year: 'Fourth Year' },
  { id: 'm-april', first_name: 'April', last_name: 'Pham', college: 'Eighth', year: 'Fourth Year' },
];

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openRoster(status: CabinetRosterCycle['status'], drafts: CabinetRosterDraft[]) {
  repo.listCycles.mockResolvedValue([cycle(status)]);
  repo.getCycle.mockResolvedValue(cycle(status));
  repo.getDrafts.mockResolvedValue(drafts);
  repo.countPublicRows.mockResolvedValue(0);
  lookup.listMemberDirectory.mockResolvedValue(
    directory.map((m) => ({ id: m.id, fullName: `${m.first_name} ${m.last_name}`, college: m.college, year: m.year, displayName: `${m.first_name} ${m.last_name} · ${m.college} · ${m.year}` })),
  );
  lookup.searchMembers.mockResolvedValue([]);
  photos.getPublicMemberAvatars.mockResolvedValue(new Map([['m-havyn', 'https://example.test/a.png']]));
  render(<MemoryRouter><AdminCabinetRollover /></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: 'Open' }));
  await screen.findByRole('heading', { name: /2027–28 Cabinet/, level: 2 });
  await settle();
}

beforeEach(() => jest.clearAllMocks());

it('starts a draft that copies the previous year position structure', async () => {
  repo.listCycles.mockResolvedValue([]);
  repo.createCycle.mockResolvedValue({ cycle: cycle('draft'), created: true, positionsCopied: 19 });
  repo.getCycle.mockResolvedValue(cycle('draft'));
  repo.getDrafts.mockResolvedValue([]);
  lookup.listMemberDirectory.mockResolvedValue([]);
  photos.getPublicMemberAvatars.mockResolvedValue(new Map());
  render(<MemoryRouter><AdminCabinetRollover /></MemoryRouter>);

  await userEvent.selectOptions(await screen.findByLabelText('Cabinet year'), 'cy-2027');
  expect(screen.getByRole('option', { name: 'Previous year (2026-2027 Cabinet)' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Create 2027–28 Cabinet Draft' }));

  expect(repo.createCycle).toHaveBeenCalledWith({ cabinetYearId: 'cy-2027', sourceCabinetYearId: 'cy-2026', userId: 'admin-1' });
});

it('summarizes positions, member links, review count, and available photos', async () => {
  await openRoster('draft', [
    draft('a1', { name: 'Havyn Nguyen', member_id: 'm-havyn' }),
    draft('a2', { name: 'April Pham', member_id: 'm-april' }),
    draft('a3', { name: 'Zed Unknown' }),
  ]);

  expect(screen.getByTestId('roster-counts')).toHaveTextContent('3 positions · 2 member links · 1 need review · 1 photos available');
  const preflight = within(screen.getByLabelText('Cabinet preflight'));
  expect(preflight.getByText(/1 unresolved link/)).toBeInTheDocument();
  expect(preflight.getByText(/1 missing approved photo/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lock roster' })).toBeEnabled();
});

it('blocks locking while a position is empty or a member is linked twice', async () => {
  await openRoster('draft', [
    draft('a1', { name: 'Havyn Nguyen', member_id: 'm-havyn' }),
    draft('a2', { name: 'Havyn N', member_id: 'm-havyn' }),
    draft('a3', { name: null, role: 'Treasurer' }),
  ]);

  expect(screen.getByRole('button', { name: 'Lock roster' })).toBeDisabled();
  const preflight = within(screen.getByLabelText('Cabinet preflight'));
  expect(preflight.getByText(/Treasurer/)).toBeInTheDocument();
  expect(preflight.getByText(/duplicate canonical member/)).toBeInTheDocument();
});

it('places a pasted roster into the empty slots and links exact names', async () => {
  repo.updateDraft.mockResolvedValue();
  await openRoster('draft', [
    draft('a1', { role: 'Co-President', category: 'Executive Board', name: null }),
    draft('a2', { role: 'Co-President', category: 'Executive Board', name: null }),
  ]);
  repo.getDrafts.mockResolvedValue([
    draft('a1', { role: 'Co-President', category: 'Executive Board', name: 'Havyn Nguyen', member_id: 'm-havyn' }),
    draft('a2', { role: 'Co-President', category: 'Executive Board', name: 'April Pham', member_id: 'm-april' }),
  ]);

  await userEvent.type(screen.getByLabelText('Pasted roster'), 'Havyn Nguyen, Co-President{enter}April Pham, Co-President');
  await userEvent.click(screen.getByRole('button', { name: 'Place into roster' }));
  await settle();

  expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'a1', { name: 'Havyn Nguyen', member_id: 'm-havyn' });
  expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'a2', { name: 'April Pham', member_id: 'm-april' });
  expect(repo.addDrafts).not.toHaveBeenCalled();
  expect(screen.getByTestId('roster-counts')).toHaveTextContent('2 positions · 2 member links · 0 need review');
});

it('offers a suggested member but never links without a click', async () => {
  await openRoster('draft', [draft('a1', { name: 'Havyn Nguyen' })]);

  expect(screen.getByText('Suggested match')).toBeInTheDocument();
  expect(repo.updateDraft).not.toHaveBeenCalled();
  repo.updateDraft.mockResolvedValue();
  await userEvent.click(screen.getByRole('button', { name: /Link to Havyn Nguyen/ }));
  expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'a1', { member_id: 'm-havyn' });
});

it('makes a locked roster read-only and requires confirmation to publish, without activating the year', async () => {
  repo.publishCycle.mockResolvedValue({ alreadyPublished: false, created: 1, updated: 0 });
  await openRoster('locked', [draft('a1', { member_id: 'm-havyn' })]);

  expect(screen.getByLabelText('Name')).toBeDisabled();
  expect(screen.queryByLabelText('Pasted roster')).not.toBeInTheDocument();
  expect(screen.getByText(/does not make 2027–28 the current Cabinet/)).toBeInTheDocument();
  const publish = screen.getByRole('button', { name: 'Publish roster' });
  expect(publish).toBeDisabled();

  await userEvent.click(screen.getByLabelText(/make this roster public/));
  await userEvent.click(publish);
  await settle();

  expect(repo.publishCycle).toHaveBeenCalledWith('c1');
  expect(years.setActiveYear).not.toHaveBeenCalled();
});

it('keeps activation a separate, explicit step after publishing', async () => {
  years.setActiveYear.mockResolvedValue();
  await openRoster('published', [draft('a1', { member_id: 'm-havyn' })]);

  expect(screen.getByText(/Activating makes 2027–28 the current Cabinet/)).toBeInTheDocument();
  expect(years.setActiveYear).not.toHaveBeenCalled();
  const activate = screen.getByRole('button', { name: /Make 2027–28 the active Cabinet/ });
  expect(activate).toBeDisabled();

  await userEvent.click(screen.getByLabelText(/make 2027–28 the active Cabinet/));
  await userEvent.click(activate);
  await settle();

  expect(years.setActiveYear).toHaveBeenCalledWith('cy-2027');
  expect(repo.publishCycle).not.toHaveBeenCalled();
});

it('does not offer activation before the roster is published', async () => {
  await openRoster('draft', [draft('a1', { member_id: 'm-havyn' })]);
  expect(screen.queryByRole('button', { name: /active Cabinet/ })).not.toBeInTheDocument();
});

it('clears a member link when a position is renamed so a photo cannot follow the wrong person', async () => {
  repo.updateDraft.mockResolvedValue();
  await openRoster('draft', [draft('a1', { name: 'Havyn Nguyen', member_id: 'm-havyn' })]);

  const name = screen.getByLabelText('Name');
  await userEvent.clear(name);
  await userEvent.type(name, 'Someone Else');
  await userEvent.tab();

  expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'a1', { name: 'Someone Else', member_id: null });
});

describe('switching rosters while a load is in flight', () => {
  const cycleFor = (id: string, yearId: string): CabinetRosterCycle => ({ ...cycle('draft'), id, cabinet_year_id: yearId });

  it('never shows a slow response for the roster you already left', async () => {
    const yearsForTwo = [
      { id: 'cy-2027', label: '2027-2028 Cabinet', slug: '2027-2028', start_year: 2027, end_year: 2028, is_active: false },
      { id: 'cy-2026', label: '2026-2027 Cabinet', slug: '2026-2027', start_year: 2026, end_year: 2027, is_active: true },
    ];
    mockYears.splice(0, mockYears.length, ...yearsForTwo);

    let resolveA: (rows: CabinetRosterDraft[]) => void = () => undefined;
    repo.listCycles.mockResolvedValue([cycleFor('A', 'cy-2027'), cycleFor('B', 'cy-2026')]);
    repo.getDrafts.mockImplementation((id: string) =>
      id === 'A'
        ? new Promise<CabinetRosterDraft[]>((resolve) => { resolveA = resolve; })
        : Promise.resolve([draft('b1', { cycle_id: 'B', name: 'From Roster B' })]),
    );
    repo.countPublicRows.mockResolvedValue(0);
    lookup.listMemberDirectory.mockResolvedValue([]);
    photos.getPublicMemberAvatars.mockResolvedValue(new Map());
    render(<MemoryRouter><AdminCabinetRollover /></MemoryRouter>);

    const open = await screen.findAllByRole('button', { name: 'Open' });
    await userEvent.click(open[0]); // roster A: its drafts are still loading
    await screen.findByRole('heading', { name: /2027–28 Cabinet/, level: 2 });
    await userEvent.click(screen.getByRole('button', { name: '← All rosters' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Open' }))[1]); // roster B
    await screen.findByDisplayValue('From Roster B');

    await act(async () => {
      resolveA([draft('a1', { cycle_id: 'A', name: 'Stale From Roster A' })]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByDisplayValue('From Roster B')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Stale From Roster A')).not.toBeInTheDocument();
    mockYears.splice(0, mockYears.length,
      { id: 'cy-2026', label: '2026-2027 Cabinet', slug: '2026-2027', start_year: 2026, end_year: 2027, is_active: true },
      { id: 'cy-2027', label: '2027-2028 Cabinet', slug: '2027-2028', start_year: 2027, end_year: 2028, is_active: false });
  });

  it('will not leave a roster while a change is saving', async () => {
    let finishSave: () => void = () => undefined;
    repo.updateDraft.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    await openRoster('draft', [draft('a1', { name: 'Havyn Nguyen' })]);

    await userEvent.click(screen.getByRole('button', { name: /Link to Havyn Nguyen/ }));
    expect(screen.getByRole('button', { name: '← All rosters' })).toBeDisabled();

    await act(async () => {
      finishSave();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('button', { name: '← All rosters' })).toBeEnabled();
  });
});

describe('filters, bulk actions, structure copy, and preview', () => {
  const { logAdminActivity } = jest.requireMock('../../data/repos/adminActivity');
  const roster = () => [
    draft('a1', { name: 'Havyn Nguyen', member_id: 'm-havyn', category: 'Executive Board', role: 'President' }),
    draft('a2', { name: 'Zed Unknown', role: 'Webmaster' }),
    draft('a3', { name: null, role: 'Historian' }),
  ];

  it('shows chips with counts and filters positions', async () => {
    await openRoster('draft', roster());
    expect(screen.getByRole('button', { name: /Unfilled position\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Unlinked\s*1$/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Unlinked\s*1$/ }));
    expect(screen.getAllByTestId('roster-row')).toHaveLength(1);
  });

  it('moves selected positions between boards and records it', async () => {
    await openRoster('draft', roster());
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Webmaster' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select President' }));
    await userEvent.selectOptions(screen.getByLabelText('Board for selected positions'), 'Executive Board');
    await userEvent.click(screen.getByRole('button', { name: 'Set board' }));
    await settle();
    expect(repo.updateDraft).toHaveBeenCalledTimes(1);
    expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'a2', { category: 'Executive Board' });
    expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'cabinet.bulk_changed' }));
  });

  it('copies only missing position structure from last year, never people', async () => {
    await openRoster('draft', roster());
    repo.listStructureSource.mockResolvedValue([
      { role: 'President', category: 'Executive Board', display_order: 0 },
      { role: 'Treasurer', category: 'Executive Board', display_order: 1 },
    ]);
    repo.addDrafts.mockResolvedValue([draft('n1', { role: 'Treasurer', name: null })]);
    await userEvent.click(screen.getByRole('button', { name: /Copy missing positions from 2026–27/ }));
    await settle();
    expect(repo.addDrafts).toHaveBeenCalledWith('c1', [{ role: 'Treasurer', category: 'Executive Board', display_order: 4 }]);
  });

  it('previews the roster without writing, and publishing stays a separate button', async () => {
    await openRoster('draft', roster());
    await userEvent.click(screen.getByRole('button', { name: 'Preview Cabinet' }));
    expect(screen.getByRole('dialog', { name: /Cabinet roster/ })).toBeInTheDocument();
    expect(screen.getByText(/ADMIN PREVIEW — NOT PUBLIC/)).toBeInTheDocument();
    for (const method of ['updateDraft', 'addDrafts', 'lockCycle', 'publishCycle'] as const) {
      expect(repo[method]).not.toHaveBeenCalled();
    }
  });

  it('flags the same person in the same role twice as a possible duplicate', async () => {
    await openRoster('draft', [
      draft('a1', { name: 'Ada Lovelace', role: 'Treasurer', member_id: 'm-havyn' }),
      draft('a2', { name: 'Ada Lovelace', role: 'Treasurer', member_id: 'm-havyn' }),
    ]);
    expect(screen.getByRole('region', { name: 'Possible duplicates' })).toHaveTextContent(/listed 2 times/);
  });

  it('shows progress and the year context', async () => {
    await openRoster('draft', roster());
    expect(screen.getByRole('region', { name: '2027–28 Cabinet progress' })).toHaveTextContent('People 2 / 3');
    expect(screen.getByText('Upcoming year · 2027–28')).toBeInTheDocument();
  });
});
