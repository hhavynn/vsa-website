import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import AdminInterns from './Interns';
import { internCohortRepository } from '../../data/repos/internCohort';
import { memberLookupRepository } from '../../data/repos/memberLookup';
import { InternCohortCycle, InternCohortDraft } from '../../lib/internCohort';

jest.mock('../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../data/repos/adminReview', () => ({
  adminReviewRepository: { listReviewed: jest.fn().mockResolvedValue(new Set()), mark: jest.fn().mockResolvedValue(0), unmark: jest.fn() },
}));
jest.mock('../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('react-hot-toast', () => {
  const toast = Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() });
  return { __esModule: true, default: toast };
});
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('../../hooks/useCabinetYears', () => ({
  useCabinetYears: () => ({
    cabinetYears: [{ id: 'cy-2026', label: '2026-2027', start_year: 2026, end_year: 2027 }],
    loading: false,
    error: null,
  }),
}));
jest.mock('../../data/repos/internCohort', () => ({
  internCohortRepository: {
    listCycles: jest.fn(),
    getCycle: jest.fn(),
    getDrafts: jest.fn(),
    listShadowPositionOptions: jest.fn(),
    createCycle: jest.fn(),
    addDrafts: jest.fn(),
    updateDraft: jest.fn(),
    reorder: jest.fn(),
    removeDraft: jest.fn(),
    lockCycle: jest.fn(),
    reopenCycle: jest.fn(),
    publishCycle: jest.fn(),
    deleteCycle: jest.fn(),
  },
}));

jest.mock('../../data/repos/memberLookup', () => ({
  memberLookupRepository: { listMemberDirectory: jest.fn(), searchMembers: jest.fn() },
}));

const repo = internCohortRepository as jest.Mocked<typeof internCohortRepository>;
const lookup = memberLookupRepository as jest.Mocked<typeof memberLookupRepository>;

const cycle = (status: InternCohortCycle['status']): InternCohortCycle => ({
  id: 'c1', academic_year_start: 2026, academic_year_end: 2027, cabinet_year_id: 'cy-2026', status,
  created_by: null, locked_at: null, published_at: null, created_at: '', updated_at: '',
});
const draft = (id: string, overrides: Partial<InternCohortDraft>): InternCohortDraft => ({
  id, cycle_id: 'c1', name: id, member_id: null, shadow_positions: [], role_or_track: null, caption: null,
  internal_notes: null, display_order: 0, published_cabinet_member_id: null, created_at: `2026-10-01T00:00:0${id.length % 9}Z`,
  updated_at: '', ...overrides,
});

async function openCohort(status: InternCohortCycle['status'], drafts: InternCohortDraft[], arrange?: () => void) {
  repo.listCycles.mockResolvedValue([cycle(status)]);
  repo.getDrafts.mockResolvedValue(drafts);
  repo.listShadowPositionOptions.mockResolvedValue(['Co-President', 'Treasurer', 'Events Chair', 'Media Director']);
  arrange?.();
  lookup.searchMembers.mockResolvedValue([]);
  lookup.listMemberDirectory.mockResolvedValue([
    { id: 'm-sarah', fullName: 'Sarah Nguyen', college: 'Muir', year: 'Second Year', displayName: 'Sarah Nguyen · Muir · Second Year' },
  ]);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><AdminInterns /></MemoryRouter>
    </QueryClientProvider>,
  );
  const open = await screen.findByRole('button', { name: 'Open' });
  await userEvent.click(open);
  await screen.findByRole('heading', { name: /Intern Cohort/, level: 2 });
  await settle();
}

/** Lets the page's mount-time loads (members, positions, interns) finish inside act. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => jest.clearAllMocks());

it('summarizes the cohort and shows a linked intern with member, shadow positions, and track', async () => {
  await openCohort('draft', [
    draft('Sarah Nguyen', { member_id: 'm-sarah', shadow_positions: ['Treasurer', 'Events Chair'], role_or_track: 'Events / Operations', display_order: 0 }),
    draft('Zed Unknown', { display_order: 1 }),
  ]);

  expect(screen.getByText('2 accepted · 1 linked · 1 need review')).toBeInTheDocument();
  const preflight = within(screen.getByLabelText('Preflight'));
  expect(preflight.getByText(/1 member link unresolved/)).toBeInTheDocument();
  expect(preflight.getByText(/Ready to Lock/)).toBeInTheDocument();
  expect(preflight.queryByText(/shadow|optional/i)).not.toBeInTheDocument();
  expect(screen.getByText(/✅ Sarah Nguyen · Member: Sarah Nguyen · Muir · Second Year · Shadowing: Treasurer, Events Chair · Track: Events \/ Operations/)).toBeInTheDocument();
  expect(screen.getByText(/⚠ Zed Unknown · Member: not linked · Shadowing: none/)).toBeInTheDocument();
});

describe('shadow positions', () => {
  const { logAdminActivity } = jest.requireMock('../../data/repos/adminActivity');
  const picker = (slot: number) => screen.getByLabelText(`Shadow position ${slot} for Sarah Nguyen`) as HTMLSelectElement;
  const optionsOf = (select: HTMLSelectElement) => Array.from(select.options).map((option) => option.value);
  const shadowEntries = () => logAdminActivity.mock.calls.map(([call]: [{ action: string }]) => call).filter((call: { action: string }) => call.action === 'intern.shadow_changed');

  it('saves a first position, and only then opens the next picker', async () => {
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah' })]);
    expect(picker(1)).toBeEnabled();
    expect(picker(2)).toBeDisabled();
    expect(picker(3)).toBeDisabled();

    await userEvent.selectOptions(picker(1), 'Treasurer');
    await settle();

    expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'Sarah Nguyen', { shadow_positions: ['Treasurer'] });
    expect(picker(1)).toHaveValue('Treasurer');
    expect(picker(2)).toBeEnabled();
    expect(picker(3)).toBeDisabled();
  });

  it('offers exactly 3 pickers, and no position twice', async () => {
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah', shadow_positions: ['Treasurer', 'Events Chair', 'Media Director'] })]);
    expect(screen.getAllByLabelText(/Shadow position \d for Sarah Nguyen/)).toHaveLength(3);
    expect(optionsOf(picker(1))).toEqual(['', 'Co-President', 'Treasurer']);
    expect(optionsOf(picker(2))).toEqual(['', 'Co-President', 'Events Chair']);
    expect(optionsOf(picker(3))).toEqual(['', 'Co-President', 'Media Director']);
  });

  it('closes the gap when a position is cleared', async () => {
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah', shadow_positions: ['Treasurer', 'Events Chair'] })]);
    await userEvent.selectOptions(picker(1), '');
    await settle();
    expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'Sarah Nguyen', { shadow_positions: ['Events Chair'] });
    expect(picker(1)).toHaveValue('Events Chair');
    expect(picker(2)).toHaveValue('');
  });

  it('keeps a saved title visible after it stops being a Board position', async () => {
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah', shadow_positions: ['Old Title'] })]);
    expect(picker(1)).toHaveValue('Old Title');
    expect(screen.getByText(/Shadowing: Old Title/)).toBeInTheDocument();
  });

  it('logs a change with the positions and no undo', async () => {
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah', shadow_positions: ['Treasurer'] })]);
    await userEvent.selectOptions(picker(2), 'Events Chair');
    await settle();
    expect(shadowEntries()).toHaveLength(1);
    const [entry] = shadowEntries();
    expect(entry).toMatchObject({
      entityType: 'intern_cohort_draft',
      entityId: 'Sarah Nguyen',
      academicYearStart: 2026,
      summary: "Changed Sarah Nguyen's shadow positions: Treasurer → Treasurer, Events Chair",
    });
    expect(entry.metadata).toBeUndefined();
  });

  it('logs nothing and keeps the positions when the save fails', async () => {
    const toast = jest.requireMock('react-hot-toast').default;
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah' })]);
    repo.updateDraft.mockRejectedValueOnce(new Error('network'));
    await userEvent.selectOptions(picker(1), 'Treasurer');
    await settle();
    expect(toast.error).toHaveBeenCalledWith('network');
    expect(shadowEntries()).toHaveLength(0);
    expect(picker(1)).toHaveValue('');
  });

  it.each(['locked', 'published'] as const)('is read-only when the cohort is %s, while the summary still shows it', async (status) => {
    await openCohort(status, [draft('Sarah Nguyen', { member_id: 'm-sarah', shadow_positions: ['Treasurer'] })]);
    [1, 2, 3].forEach((slot) => expect(picker(slot)).toBeDisabled());
    expect(screen.getByText(/Shadowing: Treasurer/)).toBeInTheDocument();
  });

  it('has no bulk shadow action', async () => {
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah' })]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Sarah Nguyen' }));
    const bar = within(screen.getByRole('toolbar', { name: 'Bulk actions' }));
    expect(bar.getAllByRole('button').map((button) => button.textContent)).toEqual(['Set track', 'Mark reviewed', 'Clear selection']);
  });

  it('renders a row from before the migration, which has no shadow_positions yet', async () => {
    const { shadow_positions: _omitted, ...oldRow } = draft('Sarah Nguyen', { member_id: 'm-sarah' });
    await openCohort('draft', [oldRow as InternCohortDraft]);
    expect(picker(1)).toHaveValue('');
    expect(screen.getByText(/Shadowing: none/)).toBeInTheDocument();
  });

  it('says so when the positions fail to load', async () => {
    const toast = jest.requireMock('react-hot-toast').default;
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah' })], () => {
      repo.listShadowPositionOptions.mockRejectedValue(new Error('offline'));
    });
    expect(toast.error).toHaveBeenCalledWith('Failed to load cabinet positions.');
    expect(optionsOf(picker(1))).toEqual(['']);
  });
});

it('offers an exact-name member to link but never links it by itself', async () => {
  await openCohort('draft', [draft('Sarah Nguyen', {})]);

  expect(await screen.findByText('Suggested match')).toBeInTheDocument();
  expect(repo.updateDraft).not.toHaveBeenCalled();
  repo.updateDraft.mockResolvedValue();
  await userEvent.click(screen.getByRole('button', { name: /Link to Sarah Nguyen/ }));
  expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'Sarah Nguyen', { member_id: 'm-sarah' });
});

it('does not guess a near-miss name', async () => {
  await openCohort('draft', [draft('Sara Nguyn', {})]);

  expect(screen.queryByText('Suggested match')).not.toBeInTheDocument();
  expect(screen.getByText(/Not linked/)).toBeInTheDocument();
  expect(repo.updateDraft).not.toHaveBeenCalled();
});

it('blocks locking when one member is linked twice', async () => {
  await openCohort('draft', [
    draft('Sarah Nguyen', { member_id: 'm-sarah', display_order: 0 }),
    draft('Sarah N', { member_id: 'm-sarah', display_order: 1 }),
  ]);

  expect(screen.getByRole('button', { name: 'Lock cohort' })).toBeDisabled();
  expect(screen.getByText(/duplicate canonical member/)).toBeInTheDocument();
});

it('makes a locked cohort read-only and requires confirmation to publish', async () => {
  await openCohort('locked', [draft('Sarah Nguyen', { member_id: 'm-sarah' })]);

  expect(screen.getByLabelText('Name')).toBeDisabled();
  expect(screen.queryByLabelText('Pasted intern names')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publish cohort' })).toBeDisabled();

  await userEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }));
  expect(screen.getByRole('button', { name: 'Publish cohort' })).toBeEnabled();
  expect(repo.publishCycle).not.toHaveBeenCalled();
});

describe('filters, bulk actions, and history', () => {
  const { logAdminActivity } = jest.requireMock('../../data/repos/adminActivity');
  const cohort = () => [
    draft('Sarah Nguyen', { member_id: 'm-sarah', role_or_track: 'Events', caption: 'hi', display_order: 0 }),
    draft('Zed Unknown', { display_order: 1 }),
    draft('Quinn Park', { display_order: 2 }),
  ];

  it('shows chips with counts and filters the cohort', async () => {
    await openCohort('draft', cohort());
    expect(screen.getByRole('button', { name: /^Unlinked\s*2$/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Missing/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /^Unlinked\s*2$/ }));
    expect(screen.getAllByTestId('intern-row')).toHaveLength(2);
  });

  it('sets a track for selected interns, skipping those who already have it', async () => {
    await openCohort('draft', cohort());
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Sarah Nguyen' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Zed Unknown' }));
    await userEvent.type(screen.getByLabelText('Track for selected interns'), 'Events');
    await userEvent.click(screen.getByRole('button', { name: 'Set track' }));
    await settle();
    expect(repo.updateDraft).toHaveBeenCalledTimes(1);
    expect(repo.updateDraft).toHaveBeenCalledWith('c1', 'Zed Unknown', { role_or_track: 'Events' });
    expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'intern.bulk_changed' }));
  });

  it('flags an exact duplicate name as a possible duplicate without merging anything', async () => {
    await openCohort('draft', [draft('Kevin Tran', { display_order: 0 }), draft('kevin tran', { display_order: 1 })]);
    expect(screen.getByRole('region', { name: 'Possible duplicates' })).toHaveTextContent(/appears on 2 interns/);
    expect(repo.updateDraft).not.toHaveBeenCalled();
  });

  it('shows the paste review with a concrete reason for an existing intern', async () => {
    await openCohort('draft', [draft('Sarah Nguyen', { member_id: 'm-sarah' })]);
    await userEvent.type(screen.getByLabelText('Pasted intern names'), 'Sarah Nguyen');
    expect(await screen.findByText(/already in the cohort/)).toBeInTheDocument();
    expect(screen.getByTestId('import-summary')).toHaveTextContent('1 row · 0 ready · 1 need review');
  });

  it('previews the cohort without writing anything', async () => {
    await openCohort('draft', cohort());
    await userEvent.click(screen.getByRole('button', { name: 'Preview cohort' }));
    expect(screen.getByRole('dialog', { name: /Intern cohort/ })).toBeInTheDocument();
    expect(screen.getByText(/ADMIN PREVIEW — NOT PUBLIC/)).toBeInTheDocument();
    expect(repo.updateDraft).not.toHaveBeenCalled();
    expect(repo.publishCycle).not.toHaveBeenCalled();
    expect(repo.lockCycle).not.toHaveBeenCalled();
  });
});

it('shows rows that were saved before a bulk update failed, and says how far it got', async () => {
  const toast = jest.requireMock('react-hot-toast').default;
  await openCohort('draft', [
    draft('Sarah Nguyen', { member_id: 'm-sarah', display_order: 0 }),
    draft('Zed Unknown', { display_order: 1 }),
    draft('Quinn Park', { display_order: 2 }),
  ]);
  repo.updateDraft.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network'));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Sarah Nguyen' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Zed Unknown' }));
  await userEvent.type(screen.getByLabelText('Track for selected interns'), 'Events');
  await userEvent.click(screen.getByRole('button', { name: 'Set track' }));
  await settle();
  expect(toast.error).toHaveBeenCalledWith('Updated 1 of 2 interns before it failed. The rest were not changed.');
  // The first intern's saved track is reflected on screen.
  expect(screen.getByText(/Sarah Nguyen · Member: .* · Track: Events/)).toBeInTheDocument();
});
