/**
 * The CSV-first House assignment workflow ("Import House Applications").
 * What matters: it is the default with no legacy format to pick, validation
 * counts are right, invalid rankings block generation until an admin repairs
 * them, Generate and the Google Sheets exports write nothing, Save creates
 * exactly one private draft (no memberships, no email), the legacy wide/long
 * importers stay reachable under "Historical / Advanced Import", and saved
 * drafts of every kind can still be opened. All fixtures are synthetic.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { HouseDraftWorkflow } from './HouseDraftWorkflow';
import { houseAssignmentsRepository, HouseBatchSnapshot } from '../../../data/repos/houseAssignments';
import { houseMembershipsWriteRepository } from '../../../data/repos/houseMembershipWrites';
import { houseParentsRepository } from '../../../data/repos/houseParents';
import { memberIdentityRepository } from '../../../data/repos/memberIdentity';
import { downloadCsv } from '../../../lib/housePlacementExport';
import type { HouseImportMember } from '../../../lib/houseAssignmentImport';
import type { HousePageAsset } from '../../../types';
import type { HousePaymentCycle } from '../../../lib/housePayments';

import { housePaymentsRepository } from '../../../data/repos/housePayments';
jest.mock('../../../data/repos/housePayments', () => ({
  PAYMENTS_UNAVAILABLE: 'House payment eligibility is not available yet.',
  housePaymentsRepository: {
    listCycles: jest.fn().mockResolvedValue([]),
    getBatchBlockers: jest.fn().mockResolvedValue([]),
    registerApplicants: jest.fn(),
    getCycle: jest.fn(),
  },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
jest.mock('../../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../../data/repos/adminReview', () => ({
  adminReviewRepository: { listReviewed: jest.fn().mockResolvedValue(new Set()), mark: jest.fn(), unmark: jest.fn() },
}));
jest.mock('../../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('../../../data/repos/houseAssignments', () => ({
  houseAssignmentsRepository: { listBatches: jest.fn(), loadSnapshot: jest.fn(), createBatch: jest.fn() },
}));
jest.mock('../../../data/repos/houseParents', () => ({
  houseParentsRepository: { listForYear: jest.fn() },
}));
jest.mock('../../../data/repos/memberIdentity', () => ({
  memberIdentityRepository: { loadIdentityEmails: jest.fn() },
}));
jest.mock('../../../lib/housePlacementExport', () => ({
  ...jest.requireActual('../../../lib/housePlacementExport'),
  downloadCsv: jest.fn(),
}));
jest.mock('../../../data/repos/houseMembershipWrites', () => ({
  houseMembershipsWriteRepository: { applyMembership: jest.fn(), listMembershipsForYear: jest.fn() },
}));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const repo = houseAssignmentsRepository as jest.Mocked<typeof houseAssignmentsRepository>;
const parentsRepo = houseParentsRepository as jest.Mocked<typeof houseParentsRepository>;
const writer = houseMembershipsWriteRepository as jest.Mocked<typeof houseMembershipsWriteRepository>;
const identityRepo = memberIdentityRepository as jest.Mocked<typeof memberIdentityRepository>;
const download = downloadCsv as jest.MockedFunction<typeof downloadCsv>;

function profile(id: string, name: string, order: number): HousePageAsset {
  return { id, house: name, house_key: name.toLowerCase(), display_name: name, display_order: order, is_active: true, academic_year_start: 2026, academic_year_end: 2027 } as HousePageAsset;
}
const profiles = [profile('p-rarity', 'Rarity', 1), profile('p-pinkie', 'Pinkie Pie', 2)];
const members: HouseImportMember[] = [
  { id: 'm-an', first_name: 'An', last_name: 'Example', college: null, year: null, house: null, email: 'an@example.test', points: 0, events_attended: 0 },
  { id: 'm-bao', first_name: 'Bao', last_name: 'Tran', college: null, year: null, house: null, email: 'bao@example.test', points: 0, events_attended: 0 },
];

const HEADER = 'Timestamp,"Name (First, Middle Initial, Last)",Phone Number,Email,House Rank [First Choice ],House Rank [Second Choice ]';
const CSV = [
  HEADER,
  '10/21/2026 21:00:00,Chi Le,555-0100,chi@example.test,Rarity (Parent A),Pinkie Pie (Parent B)',
  '10/21/2026 20:00:00,An Example,555-0101,an@example.test,Rarity (Parent A),Pinkie Pie (Parent B)',
  '10/21/2026 20:30:00,Bao Tran,555-0102,bao@example.test,Pinkie Pie (Parent B),Pinkie Pie (Parent B)',
  '10/21/2026 22:00:00,An Example,555-0103,an@example.test,Pinkie Pie (Parent B),Rarity (Parent A)',
].join('\n');

function renderWorkflow(props: { houseProfiles?: HousePageAsset[]; onYearChange?: (year: number) => void; members?: HouseImportMember[] } = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/houses']}>
        <HouseDraftWorkflow
          selectedYear={2026}
          onYearChange={props.onYearChange ?? jest.fn()}
          yearOptions={[{ start: 2025, label: '2025-2026', isActive: false }, { start: 2026, label: '2026-2027', isActive: true }]}
          effectiveStartDate="2026-11-08"
          onEffectiveStartDateChange={jest.fn()}
          houseProfiles={props.houseProfiles ?? profiles}
          loadingProfiles={false}
          members={props.members ?? members}
          loadingMembers={false}
          onMembershipsPublished={jest.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function uploadAndValidate(csv = CSV) {
  const file = new File([csv], 'responses.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText('Form responses CSV'), file);
  await screen.findByText('Loaded responses.csv');
  await userEvent.click(screen.getByRole('button', { name: 'Validate Applications' }));
}

function stat(label: string) {
  return within(screen.getByLabelText('Submission counts')).getByText(label).parentElement as HTMLElement;
}

beforeEach(() => {
  (housePaymentsRepository.listCycles as jest.Mock).mockResolvedValue([]);
  (housePaymentsRepository.getBatchBlockers as jest.Mock).mockResolvedValue([]);
  jest.clearAllMocks();
  repo.listBatches.mockResolvedValue([]);
  parentsRepo.listForYear.mockResolvedValue([]);
  identityRepo.loadIdentityEmails.mockResolvedValue([]);
});

it('defaults to Import House Applications, with no legacy format or public CSV URL in the primary workflow', async () => {
  renderWorkflow();
  const primary = await screen.findByRole('region', { name: 'Import House Applications' });
  expect(within(primary).getByRole('heading', { name: 'Import House Applications' })).toBeInTheDocument();
  expect(within(primary).getByLabelText('Form responses CSV')).toBeInTheDocument();
  expect(within(primary).getByLabelText('Academic Year')).toBeInTheDocument();
  expect(within(primary).getByLabelText('Effective Start Date')).toBeInTheDocument();
  expect(within(primary).queryByLabelText(/Public CSV URL/)).not.toBeInTheDocument();
  expect(screen.queryByText('Import Sheet')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Sheet Format')).not.toBeInTheDocument();
  // No 2025 Mario names as placeholders anywhere in the default view.
  expect(document.body.innerHTML).not.toMatch(/Bowser|Toad|Donkey Kong|Boo\b/);
});

it('keeps the legacy wide and long importers under a collapsed Historical / Advanced Import, with a warning', async () => {
  renderWorkflow();
  const summary = await screen.findByText('Historical / Advanced Import');
  const details = screen.getByTestId('legacy-import') as HTMLDetailsElement;
  expect(details.open).toBe(false);
  await userEvent.click(summary);
  expect(details.open).toBe(true);
  expect(within(details).getByRole('note')).toHaveTextContent('These formats do not use timestamp-priority placement.');
  const format = within(details).getByLabelText('Historical sheet format');
  expect(within(format).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)).toEqual(['wide', 'long']);
  expect(within(details).getByLabelText('Public CSV URL (historical sheets only)')).toBeInTheDocument();
  expect(within(details).getByLabelText('CSV or Pasted Sheet')).toHaveAttribute('placeholder', expect.stringContaining('House A'));
  await userEvent.selectOptions(format, 'long');
  expect(within(details).getByLabelText('CSV or Pasted Sheet')).toHaveAttribute('placeholder', expect.stringMatching(/^name,email,house/));
  expect(within(details).getByRole('button', { name: 'Preview Matches' })).toBeDisabled();
  // The primary upload is still there alongside it.
  expect(screen.getByLabelText('Form responses CSV')).toBeInTheDocument();
});

it('lists saved drafts of both kinds, opens a manual historical batch, and switches year from the primary card', async () => {
  repo.listBatches.mockResolvedValue([
    { id: 'b-auto', academic_year_start: 2026, status: 'draft', assignment_method: 'timestamp_ranked', source_label: 'Fall placement', effective_start_date: '2026-11-08', created_at: '2026-10-27T00:00:00Z' },
    { id: 'b-manual', academic_year_start: 2026, status: 'published', assignment_method: 'manual', source_label: 'Hand sort', effective_start_date: '2026-11-08', created_at: '2026-10-20T00:00:00Z' },
  ] as unknown as Awaited<ReturnType<typeof repo.listBatches>>);
  repo.loadSnapshot.mockResolvedValue({
    batch: { id: 'b-manual', academic_year_start: 2026, status: 'published', assignment_method: 'manual', effective_start_date: '2026-11-08' },
    drafts: [], profiles: [], existingMemberships: new Map(), preflight: { blockers: [], warnings: [] },
  } as unknown as HouseBatchSnapshot);
  const onYearChange = jest.fn();
  renderWorkflow({ onYearChange });
  const saved = await screen.findByRole('region', { name: 'Saved drafts' });
  expect(await within(saved).findByText(/Automatic placement · Draft/)).toBeInTheDocument();
  expect(within(saved).getByText(/Manual import · Revealed/)).toBeInTheDocument();

  await userEvent.selectOptions(screen.getByLabelText('Academic Year'), '2025');
  expect(onYearChange).toHaveBeenCalledWith(2025);

  await userEvent.click(within(saved).getByRole('button', { name: 'Open Hand sort' }));
  await waitFor(() => expect(repo.loadSnapshot).toHaveBeenCalledWith('b-manual', expect.any(Map)));
  expect(writer.applyMembership).not.toHaveBeenCalled();
});

it('matches an applicant through a confirmed alternate email', async () => {
  identityRepo.loadIdentityEmails.mockResolvedValue([{ id: 'alias-1', member_id: 'm-chi', email: 'chi@example.test' }]);
  const chi: HouseImportMember = { id: 'm-chi', first_name: 'Chi', last_name: 'Le', college: null, year: null, house: null, email: 'chi.main@example.test', points: 0, events_attended: 0 };
  renderWorkflow({ members: [...members, chi] });
  await waitFor(() => expect(identityRepo.loadIdentityEmails).toHaveBeenCalled());
  await uploadAndValidate();
  await userEvent.selectOptions(screen.getByLabelText('2nd choice for row 4'), 'p-rarity');
  await userEvent.click(screen.getByRole('button', { name: 'Generate Placements' }));
  const rows = await screen.findAllByTestId('placement-result-row');
  expect(rows[2]).toHaveTextContent('Chi Le');
  expect(rows[2]).not.toHaveTextContent('Unmatched');
});

it('does not generate until confirmed member emails have loaded', async () => {
  type Aliases = Awaited<ReturnType<typeof identityRepo.loadIdentityEmails>>;
  let resolveAliases: (value: Aliases) => void = () => undefined;
  identityRepo.loadIdentityEmails.mockImplementation(() => new Promise<Aliases>((resolve) => { resolveAliases = resolve; }));
  renderWorkflow();
  await uploadAndValidate();
  await userEvent.selectOptions(screen.getByLabelText('2nd choice for row 4'), 'p-rarity');
  expect(screen.getByRole('button', { name: 'Generate Placements' })).toBeDisabled();
  expect(screen.getByText('Loading confirmed member emails…')).toBeInTheDocument();
  await act(async () => { resolveAliases([]); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Generate Placements' })).toBeEnabled());
});

it('blocks with a clear message when the year has no active Houses', async () => {
  renderWorkflow({ houseProfiles: [] });
  expect(screen.getByRole('alert')).toHaveTextContent(/No active Houses for 2026/);
  expect(screen.getByRole('alert')).toHaveTextContent(/Profiles & Images/);
  expect(screen.queryByRole('button', { name: 'Validate Applications' })).not.toBeInTheDocument();
});

it('shows a visible, actionable error for a malformed upload', async () => {
  renderWorkflow();
  await uploadAndValidate('Name,Email\nAn,an@example.test');
  expect(screen.getByRole('alert')).toHaveTextContent(/No Timestamp column/);
  expect(screen.queryByRole('button', { name: 'Generate Placements' })).not.toBeInTheDocument();
});

it('validates, requires a ranking repair, generates without writing, and saves one private draft', async () => {
  renderWorkflow();
  await uploadAndValidate();

  expect(stat('Submissions')).toHaveTextContent('4');
  expect(stat('Unique applicants')).toHaveTextContent('3');
  expect(stat('Repeat submissions')).toHaveTextContent('1');
  expect(stat('Need a fix')).toHaveTextContent('1');
  expect(screen.getByText(/Row 5 \(An Example, 10\/21\/2026 22:00:00\) ignored — kept row 3 submitted 10\/21\/2026 20:00:00/)).toBeInTheDocument();
  expect(screen.getByText('The later submission ranked Houses differently.')).toBeInTheDocument();

  // Bao picked Pinkie Pie twice: it is not silently repaired.
  expect(screen.getByText('Pinkie Pie is ranked #1 and #2.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generate Placements' })).toBeDisabled();

  await userEvent.selectOptions(screen.getByLabelText('2nd choice for row 4'), 'p-rarity');
  expect(stat('Need a fix')).toHaveTextContent('0');
  expect(stat('Valid')).toHaveTextContent('3');

  // Default split for 3 applicants over 2 Houses: Rarity has more first-choice demand.
  expect(screen.getByLabelText('Capacity for Rarity')).toHaveValue(2);
  expect(screen.getByLabelText('Capacity for Pinkie Pie')).toHaveValue(1);
  await userEvent.clear(screen.getByLabelText('Capacity for Pinkie Pie'));
  await userEvent.type(screen.getByLabelText('Capacity for Pinkie Pie'), '3');
  expect(screen.getByTestId('capacity-total')).toHaveTextContent('5');
  expect(screen.getByText(/2 spots would stay empty/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generate Placements' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Reset to Equal Split' }));
  expect(screen.getByTestId('capacity-total')).toHaveTextContent('3');

  await userEvent.click(screen.getByRole('button', { name: 'Generate Placements' }));
  const rows = await screen.findAllByTestId('placement-result-row');
  expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['#1', '#2', '#3']);
  expect(rows[0]).toHaveTextContent('An Example');
  expect(rows[0]).toHaveTextContent('Assigned to Rarity (1st choice).');
  expect(rows[1]).toHaveTextContent('Bao Tran');
  expect(rows[1]).toHaveTextContent('Assigned to Pinkie Pie (1st choice).');
  expect(rows[2]).toHaveTextContent('Chi Le');
  expect(rows[2]).toHaveTextContent('Assigned to Rarity (1st choice).');
  expect(rows[2]).toHaveTextContent('Unmatched');
  expect(repo.createBatch).not.toHaveBeenCalled();
  expect(writer.applyMembership).not.toHaveBeenCalled();

  // Google Sheets exports of the unsaved preview: download only, nothing written.
  const exportsPanel = screen.getByRole('region', { name: 'Export for Google Sheets' });
  expect(exportsPanel).toHaveTextContent('File → Import');
  await userEvent.click(within(exportsPanel).getByRole('button', { name: 'Full roster (3)' }));
  await userEvent.click(within(exportsPanel).getByRole('button', { name: 'Rarity roster (2)' }));
  await userEvent.click(within(exportsPanel).getByRole('button', { name: 'Pinkie Pie roster (1)' }));
  await userEvent.click(within(exportsPanel).getByRole('button', { name: 'Needs review (2)' }));
  expect(download.mock.calls.map(([, filename]) => filename)).toEqual([
    'vsa-house-placement-2026-2027-preview-full-roster.csv',
    'vsa-house-placement-2026-2027-preview-rarity-roster.csv',
    'vsa-house-placement-2026-2027-preview-pinkie-pie-roster.csv',
    'vsa-house-placement-2026-2027-preview-needs-review.csv',
  ]);
  const [fullCsv] = download.mock.calls[0];
  expect(fullCsv.split('\n').slice(1, 4).map((line) => line.split(',').slice(0, 3).join(','))).toEqual(['1,3,An Example', '2,4,Bao Tran', '3,2,Chi Le']);
  expect(download.mock.calls.map(([csv]) => csv).join('')).not.toMatch(/@example\.test|555-01/);
  expect(download.mock.calls[3][0]).toMatch(/Chi Le.*No linked member/);
  expect(download.mock.calls[3][0]).toMatch(/Bao Tran.*Ranking corrected by an admin/);
  expect(repo.createBatch).not.toHaveBeenCalled();
  expect(writer.applyMembership).not.toHaveBeenCalled();

  type SavedBatch = Awaited<ReturnType<typeof repo.createBatch>>;
  let resolveSave: (value: SavedBatch) => void = () => undefined;
  repo.createBatch.mockImplementation(() => new Promise<SavedBatch>((resolve) => { resolveSave = resolve; }));
  repo.loadSnapshot.mockResolvedValue({ batch: { id: 'new-batch', academic_year_start: 2026, status: 'draft', effective_start_date: '2026-11-08' }, drafts: [], profiles: [], existingMemberships: new Map(), preflight: { blockers: [], warnings: [] } } as unknown as HouseBatchSnapshot);
  const save = screen.getByRole('button', { name: 'Save Private Placement Draft' });
  await userEvent.click(save);
  await userEvent.click(save);
  expect(repo.createBatch).toHaveBeenCalledTimes(1);

  const input = repo.createBatch.mock.calls[0][0];
  expect(input).toMatchObject({
    academicYearStart: 2026,
    effectiveStartDate: '2026-11-08',
    placement: {
      capacityConfig: { 'p-rarity': 2, 'p-pinkie': 1 },
      excludedApplicants: [{ source_row_number: 5, name: 'An Example', reason: 'Repeat submission; kept the earlier row 3 (this one ranked Houses differently).' }],
    },
  });
  expect(input.rows.map((row) => [row.source_order, row.source_name, row.house_profile_id, row.generated_house_profile_id, row.member_id, row.match_status, row.source_row_number])).toEqual([
    [0, 'An Example', 'p-rarity', 'p-rarity', 'm-an', 'match', 3],
    [1, 'Bao Tran', 'p-pinkie', 'p-pinkie', 'm-bao', 'match', 4],
    [2, 'Chi Le', 'p-rarity', 'p-rarity', null, 'unmatched', 2],
  ]);
  expect(input.rows[0]).toMatchObject({ submission_timestamp: '2026-10-22T03:00:00.000Z', preferences: ['p-rarity', 'p-pinkie'] });
  expect(input.rows[1].notes).toMatch(/Ranking corrected by an admin/);
  // No email, phone, or other form answer reaches the draft rows.
  expect(JSON.stringify(input)).not.toMatch(/@example\.test|555-01/);

  await act(async () => { resolveSave({ id: 'new-batch' } as SavedBatch); });
  await waitFor(() => expect(repo.loadSnapshot).toHaveBeenCalledWith('new-batch', expect.any(Map)));
  expect(writer.applyMembership).not.toHaveBeenCalled();
});

it('places the real 2026 form options, recognizing "Pinky Pie (Ingyin & Martin)" as Pinkie Pie through its House Parents', async () => {
  const mlp = [
    profile('p-twilight', 'Twilight Sparkle', 0),
    profile('p-applejack', 'Applejack', 1),
    profile('p-pinkie', 'Pinkie Pie', 2),
    profile('p-rarity', 'Rarity', 3),
  ];
  const parents = [
    ['p-twilight', 'Timothy (Tim) Huynh'], ['p-twilight', 'Kent Nguyen'],
    ['p-applejack', 'Ryan Francisco'], ['p-applejack', 'Nathan Centeno'],
    ['p-pinkie', 'Ingyin Moh'], ['p-pinkie', 'Martin Dang'],
    ['p-rarity', 'Kirsten Ngo'], ['p-rarity', 'Jonas Truong'],
  ].map(([house, name], index) => ({
    id: `hp${index}`, house_profile_id: house, display_name: name, member_id: null, review_note: null, display_order: index % 2,
    created_at: '', updated_at: '', houseLabel: '', houseDisplayOrder: 0,
  }));
  parentsRepo.listForYear.mockResolvedValue(parents);
  const header = 'Timestamp,"Name (First, Middle Initial, Last)",Email,House Rank [First Choice ],House Rank [Second Choice ],House Rank [Third Choice ],House Rank [Forth Choice ]';
  const options = ['Rarity (Kirsten & Jonas)', 'Pinky Pie (Ingyin & Martin)', 'Applejack (Ryan & Nathan)', 'Twilight Sparkle (Kent & Tim)'];
  const csv = [header, ...['An', 'Bao', 'Chi', 'Dung'].map((name, index) => {
    const ranked = [...options.slice(index), ...options.slice(0, index)];
    return `10/21/2026 20:0${index}:00,${name} Example,${name.toLowerCase()}@example.test,${ranked.join(',')}`;
  })].join('\n');

  renderWorkflow({ houseProfiles: mlp });
  await waitFor(() => expect(parentsRepo.listForYear).toHaveBeenCalledWith(2026));
  await uploadAndValidate(csv);
  expect(stat('Need a fix')).toHaveTextContent('0');
  expect(within(screen.getByLabelText('Recognized by House Parents')).getByLabelText('House for option Pinky Pie (Ingyin & Martin)')).toHaveValue('p-pinkie');

  await userEvent.click(screen.getByRole('button', { name: 'Generate Placements' }));
  const rows = await screen.findAllByTestId('placement-result-row');
  expect(rows.map((row) => within(row).getAllByRole('cell')[7].textContent)).toEqual(['Rarity', 'Pinkie Pie', 'Applejack', 'Twilight Sparkle']);
  expect(screen.queryByText(/Pinky Pie \(/, { selector: 'td' })).not.toBeInTheDocument();
});

describe('payment roster (#656, #657)', () => {
  const payments = housePaymentsRepository as jest.Mocked<typeof housePaymentsRepository>;
  const CLEAN = [
    HEADER,
    '10/21/2026 21:00:00,Chi Le,555-0100,chi@example.test,Rarity (Parent A),Pinkie Pie (Parent B)',
    '10/21/2026 20:00:00,An Example,555-0101,an@example.test,Rarity (Parent A),Pinkie Pie (Parent B)',
    '10/21/2026 20:30:00,Bao Tran,555-0102,bao@example.test,Pinkie Pie (Parent B),Rarity (Parent A)',
  ].join('\n');
  const cycle = (id: string, key: string, version = 0) => ({ id, academic_year_start: 2026, application_key: key, status_version: version } as HousePaymentCycle);

  it('saves the first sort to the chosen roster as a provisional draft linked to saved applicants, with no contact data', async () => {
    payments.listCycles.mockResolvedValue([cycle('cycle-fall', 'house_fall')]);
    payments.registerApplicants.mockImplementation(async (_cycleId, applicants) => new Map(applicants.map((item, index) => [item.applicant_key, `app-${index}`])));
    payments.getCycle.mockResolvedValue(cycle('cycle-fall', 'house_fall', 1));
    repo.createBatch.mockResolvedValue({ id: 'new-batch' } as Awaited<ReturnType<typeof repo.createBatch>>);
    repo.loadSnapshot.mockResolvedValue({ batch: { id: 'new-batch', academic_year_start: 2026, status: 'draft', effective_start_date: '2026-11-08' }, drafts: [], profiles: [], existingMemberships: new Map(), preflight: { blockers: [], warnings: [] } } as unknown as HouseBatchSnapshot);
    renderWorkflow();
    await uploadAndValidate(CLEAN);
    await userEvent.click(screen.getByRole('button', { name: 'Generate Placements' }));
    await screen.findAllByTestId('placement-result-row');
    expect(await screen.findByLabelText('Payment roster')).toHaveValue('cycle-fall');
    await userEvent.click(screen.getByRole('button', { name: 'Save Private Placement Draft' }));
    await waitFor(() => expect(repo.createBatch).toHaveBeenCalledTimes(1));

    const [cycleId, registered, source] = payments.registerApplicants.mock.calls[0];
    expect(cycleId).toBe('cycle-fall');
    expect(source).toBe('placement_import');
    expect(registered.map((item) => [item.applicant_key, item.source_name, item.preferences])).toEqual([
      ['2026-10-22T03:00:00.000Z#3', 'An Example', ['p-rarity', 'p-pinkie']],
      ['2026-10-22T03:30:00.000Z#4', 'Bao Tran', ['p-pinkie', 'p-rarity']],
      ['2026-10-22T04:00:00.000Z#2', 'Chi Le', ['p-rarity', 'p-pinkie']],
    ]);
    expect(JSON.stringify(registered)).not.toMatch(/@example\.test|555-01/);

    const input = repo.createBatch.mock.calls[0][0];
    expect(input.placement?.payment).toMatchObject({
      cycleId: 'cycle-fall', eligibilityMode: 'provisional', snapshotVersion: 1, generationReason: 'initial', revisedFromBatchId: null,
    });
    expect(input.rows.map((row) => row.applicant_id)).toEqual(['app-0', 'app-1', 'app-2']);
    expect(writer.applyMembership).not.toHaveBeenCalled();
  });

  it('will not save until a roster is chosen when the year has several', async () => {
    payments.listCycles.mockResolvedValue([cycle('cycle-fall', 'house_fall'), cycle('cycle-winter', 'house_winter')]);
    renderWorkflow();
    await uploadAndValidate(CLEAN);
    await userEvent.click(screen.getByRole('button', { name: 'Generate Placements' }));
    await screen.findAllByTestId('placement-result-row');
    const save = screen.getByRole('button', { name: 'Save Private Placement Draft' });
    await waitFor(() => expect(save).toBeDisabled());
    await userEvent.selectOptions(screen.getByLabelText('Payment roster'), 'cycle-winter');
    expect(save).toBeEnabled();
  });
});
