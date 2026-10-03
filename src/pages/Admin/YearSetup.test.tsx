import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminYearSetup from './YearSetup';
import { yearSetupRepository } from '../../data/repos/yearSetup';
import { EMPTY_SNAPSHOT, YearSetupSnapshot } from '../../lib/yearSetup';

jest.mock('react-hot-toast', () => {
  const toast = Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() });
  return { __esModule: true, default: toast, Toaster: () => null };
});
jest.mock('react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('../../hooks/useCabinetYears', () => ({
  useCabinetYears: () => ({
    cabinetYears: [{ id: 'cy-2026', label: '2026-2027 Cabinet', slug: '2026-2027', start_year: 2026, end_year: 2027, is_active: true }],
    loading: false,
    error: null,
    refreshCabinetYears: jest.fn(),
  }),
}));
jest.mock('../../data/repos/yearSetup', () => ({
  yearSetupRepository: { loadSnapshot: jest.fn(), runSetup: jest.fn(), resetApplications: jest.fn() },
}));

const repo = yearSetupRepository as jest.Mocked<typeof yearSetupRepository>;

const base: YearSetupSnapshot = {
  ...EMPTY_SNAPSHOT,
  terms: [{ id: 't-fa26', code: 'FA26', academic_year_start: 2026, quarter: 'fall', is_active: true }],
  cabinetYears: [{ id: 'cy-2026', slug: '2026-2027', label: '2026-2027 Cabinet', start_year: 2026, is_active: true }],
  applications: [
    { id: 'a-ace', application_key: 'ace_application', open_at: '2025-09-01T07:00:00Z', due_at: '2025-10-01T07:00:00Z', is_enabled: true },
    { id: 'a-open', application_key: 'house_fall', open_at: '2020-01-01T08:00:00Z', due_at: '2099-01-01T08:00:00Z', is_enabled: true },
  ],
};

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderWizard(snapshot: YearSetupSnapshot = base) {
  repo.loadSnapshot.mockResolvedValue(snapshot);
  render(<MemoryRouter><AdminYearSetup /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Start 2027–28' });
  await screen.findByRole('region', { name: 'Academic terms' });
  await settle();
}

beforeEach(() => jest.clearAllMocks());

it('previews a new year without writing anything', async () => {
  await renderWizard();

  expect(screen.getByText(/was not found anywhere yet/)).toBeInTheDocument();
  const terms = screen.getByRole('region', { name: 'Academic terms' });
  expect(within(terms).getByText('Fall 2027')).toBeInTheDocument();
  expect(within(terms).getByText('Winter 2028')).toBeInTheDocument();
  expect(within(terms).getByText('Spring 2028')).toBeInTheDocument();
  expect(within(terms).getByLabelText(/Summer 2028/)).not.toBeChecked();
  expect(screen.getByText(/7 records will be created/)).toBeInTheDocument();
  expect(repo.runSetup).not.toHaveBeenCalled();
});

it('detects an existing year and reports it instead of offering to duplicate it', async () => {
  await renderWizard({
    ...base,
    terms: [...base.terms, { id: 't1', code: 'FA27', academic_year_start: 2027, quarter: 'fall', is_active: false }],
    cabinetYears: [...base.cabinetYears, { id: 'cy-2027', slug: '2027-2028', label: '2027-2028 Cabinet', start_year: 2027, is_active: false }],
    aceCycles: [{ id: 'ace', academic_year_start: 2027, status: 'draft' }],
  });

  expect(screen.getByText(/2027–28 already exists in 3 places/)).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'ACE' })).getByText('Already exists')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Cabinet year' })).getByText('Already exists')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'ACE' })).queryByLabelText(/Create ACE assignment cycle/)).not.toBeInTheDocument();
});

it('keeps Houses intentionally unrevealed and offers nothing without House profiles', async () => {
  await renderWizard();
  const houses = screen.getByRole('region', { name: 'Houses' });
  expect(within(houses).getByText(/House reveal intentionally not configured/)).toBeInTheDocument();
  expect(within(houses).queryByLabelText(/empty House assignment batch/)).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '2027–28 Setup' })).toHaveTextContent('House reveal intentionally not configured');
});

it('offers an empty House batch only after House profiles exist', async () => {
  await renderWizard({ ...base, houseProfileCount: 4 });
  const houses = screen.getByRole('region', { name: 'Houses' });
  expect(within(houses).getByLabelText(/Create empty House assignment batch/)).not.toBeChecked();
});

it('creates setup through the repository with the chosen terms and reports what happened', async () => {
  repo.runSetup.mockResolvedValue({
    plan: {} as never,
    report: { steps: [{ key: 'term:FA27', label: 'Fall 2027', outcome: 'created', detail: 'Created inactive.' }], created: 1, existing: 0, failed: 0 },
  });
  await renderWizard();

  await userEvent.click(screen.getByLabelText(/Summer 2028/));
  await userEvent.click(screen.getByRole('button', { name: 'Create Setup' }));
  await settle();

  expect(repo.runSetup).toHaveBeenCalledTimes(1);
  const [year, options, userId] = repo.runSetup.mock.calls[0];
  expect(year).toBe(2027);
  expect(userId).toBe('admin-1');
  expect(options.terms.map((term) => [term.code, term.include])).toEqual([['FA27', true], ['WI28', true], ['SP28', true], ['SU28', true]]);
  expect(options.rosterSourceCabinetYearId).toBe('cy-2026');
  expect(within(screen.getByTestId('setup-report')).getByText(/Fall 2027: Created inactive\./)).toBeInTheDocument();

  // Contextual next step instead of a dead-end toast, plus an activity-log entry.
  expect(screen.getByText('2027–28 prepared')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open Operations Dashboard/ })).toHaveAttribute('href', '/admin');
  const { logAdminActivity } = jest.requireMock('../../data/repos/adminActivity');
  expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'year.setup_created', summary: 'Prepared the 2027–28 academic year' }));
});

it('disables Create Setup once everything already exists', async () => {
  const done: YearSetupSnapshot = {
    ...base,
    terms: ['FA27:fall', 'WI28:winter', 'SP28:spring'].map((entry) => {
      const [code, quarter] = entry.split(':');
      return { id: code, code, academic_year_start: 2027, quarter, is_active: false };
    }),
    cabinetYears: [...base.cabinetYears, { id: 'cy-2027', slug: '2027-2028', label: '2027-2028 Cabinet', start_year: 2027, is_active: false }],
    rosterCycles: [{ id: 'rc', cabinet_year_id: 'cy-2027', status: 'draft' }],
    aceCycles: [{ id: 'ace', academic_year_start: 2027, status: 'draft' }],
    internCycles: [{ id: 'ic', academic_year_start: 2027, cabinet_year_id: 'cy-2027', status: 'draft' }],
  };
  await renderWizard(done);
  expect(screen.getByRole('button', { name: 'Create Setup' })).toBeDisabled();
  expect(screen.getByText(/Nothing left to create for this year/)).toBeInTheDocument();
});

describe('application reset', () => {
  it('is its own action, lists every window, and leaves an open window unselected', async () => {
    await renderWizard();
    const apps = screen.getByRole('region', { name: 'Applications' });

    expect(within(apps).getByLabelText(/ACE Application/)).toBeChecked();
    expect(within(apps).getByLabelText(/House Application — Fall/)).not.toBeChecked();
    expect(within(apps).getByText(/open now/)).toBeInTheDocument();
    expect(within(apps).getByText(/never opens a window and never touches a link/)).toBeInTheDocument();
    expect(within(apps).getByRole('button', { name: /Reset 1 application window/ })).toBeEnabled();
    expect(repo.resetApplications).not.toHaveBeenCalled();
  });

  it('opens a typed confirmation that lists exactly what will change, and writes nothing yet', async () => {
    await renderWizard();
    const apps = screen.getByRole('region', { name: 'Applications' });

    await userEvent.click(within(apps).getByRole('button', { name: /Reset 1 application window/ }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Reset application windows for 2027–28?')).toBeInTheDocument();
    expect(within(dialog).getByText(/Disables 1 window: the public Apply button stops showing/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Replaces the past open and due dates on 1 window with a disabled placeholder on Sep 1, 2027/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Never enables a window and never changes a link/)).toBeInTheDocument();
    expect(within(within(dialog).getByRole('list', { name: 'Windows that will change' })).getByText('ACE Application')).toBeInTheDocument();
    expect(repo.resetApplications).not.toHaveBeenCalled();
  });

  it('keeps Confirm disabled until the target year is typed', async () => {
    await renderWizard();
    const apps = screen.getByRole('region', { name: 'Applications' });
    await userEvent.click(within(apps).getByRole('button', { name: /Reset 1 application window/ }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reset 1 window' });

    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Type 2027-28 to confirm/), '2026-27');
    expect(confirm).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText(/Type 2027-28 to confirm/));
    await userEvent.type(within(dialog).getByLabelText(/Type 2027-28 to confirm/), '2027-28');
    expect(confirm).toBeEnabled();
    expect(repo.resetApplications).not.toHaveBeenCalled();
  });

  it('resets only the confirmed selection', async () => {
    repo.resetApplications.mockResolvedValue({ updated: 1, failed: [] });
    await renderWizard();
    const apps = screen.getByRole('region', { name: 'Applications' });

    await userEvent.click(within(apps).getByRole('button', { name: /Reset 1 application window/ }));
    const dialog = screen.getByRole('alertdialog');
    await userEvent.type(within(dialog).getByLabelText(/Type 2027-28 to confirm/), '2027-28');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset 1 window' }));
    await settle();

    expect(repo.resetApplications).toHaveBeenCalledTimes(1);
    const [rows, targetYear] = repo.resetApplications.mock.calls[0];
    expect(rows.map((row) => row.id)).toEqual(['a-ace']);
    expect(targetYear).toBe(2027);
    expect(jest.requireMock('react-hot-toast').default.success).toHaveBeenCalledWith(expect.stringContaining('Updated 1 application window'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps the dialog open and names the windows that failed', async () => {
    repo.resetApplications.mockResolvedValue({ updated: 0, failed: [{ key: 'ace_application', message: 'denied' }] });
    await renderWizard();
    const apps = screen.getByRole('region', { name: 'Applications' });

    await userEvent.click(within(apps).getByRole('button', { name: /Reset 1 application window/ }));
    const dialog = screen.getByRole('alertdialog');
    await userEvent.type(within(dialog).getByLabelText(/Type 2027-28 to confirm/), '2027-28');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset 1 window' }));
    await settle();

    expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toHaveTextContent('1 window could not be updated (ACE Application)');
    expect(jest.requireMock('react-hot-toast').default.error).toHaveBeenCalled();
  });
});
