/**
 * "Google Forms — Auto Placement" mode of the House assignment workflow.
 * What matters: validation counts are right, invalid rankings block generation
 * until an admin repairs them, Generate writes nothing, Save creates exactly
 * one private draft (no memberships, no email), and the legacy modes remain.
 * All fixtures are synthetic.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { HouseDraftWorkflow } from './HouseDraftWorkflow';
import { houseAssignmentsRepository, HouseBatchSnapshot } from '../../../data/repos/houseAssignments';
import { houseMembershipsWriteRepository } from '../../../data/repos/houseMembershipWrites';
import { houseParentsRepository } from '../../../data/repos/houseParents';
import type { HouseImportMember } from '../../../lib/houseAssignmentImport';
import type { HousePageAsset } from '../../../types';

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
jest.mock('../../../data/repos/houseMembershipWrites', () => ({
  houseMembershipsWriteRepository: { applyMembership: jest.fn(), listMembershipsForYear: jest.fn() },
}));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const repo = houseAssignmentsRepository as jest.Mocked<typeof houseAssignmentsRepository>;
const parentsRepo = houseParentsRepository as jest.Mocked<typeof houseParentsRepository>;
const writer = houseMembershipsWriteRepository as jest.Mocked<typeof houseMembershipsWriteRepository>;

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

function renderWorkflow(props: { houseProfiles?: HousePageAsset[] } = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/houses']}>
        <HouseDraftWorkflow
          selectedYear={2026}
          onYearChange={jest.fn()}
          yearOptions={[{ start: 2026, label: '2026-2027', isActive: true }]}
          effectiveStartDate="2026-11-08"
          onEffectiveStartDateChange={jest.fn()}
          houseProfiles={props.houseProfiles ?? profiles}
          loadingProfiles={false}
          members={members}
          loadingMembers={false}
          onMembershipsPublished={jest.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function uploadAndValidate(csv = CSV) {
  await userEvent.selectOptions(screen.getByLabelText('Sheet Format'), 'auto');
  const file = new File([csv], 'responses.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText('Form responses CSV'), file);
  await screen.findByText('Loaded responses.csv');
  await userEvent.click(screen.getByRole('button', { name: 'Validate Applications' }));
}

function stat(label: string) {
  return within(screen.getByLabelText('Submission counts')).getByText(label).parentElement as HTMLElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.listBatches.mockResolvedValue([]);
  parentsRepo.listForYear.mockResolvedValue([]);
});

it('keeps the legacy wide and long modes usable', async () => {
  renderWorkflow();
  expect(await screen.findByLabelText('CSV or Pasted Sheet')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Sheet Format'), 'long');
  expect(screen.getByRole('button', { name: 'Preview Matches' })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Sheet Format'), 'auto');
  expect(screen.queryByLabelText('CSV or Pasted Sheet')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Form responses CSV')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Sheet Format'), 'wide');
  expect(screen.getByLabelText('CSV or Pasted Sheet')).toBeInTheDocument();
});

it('blocks with a clear message when the year has no active Houses', async () => {
  renderWorkflow({ houseProfiles: [] });
  await userEvent.selectOptions(screen.getByLabelText('Sheet Format'), 'auto');
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
  await userEvent.selectOptions(screen.getByLabelText('Sheet Format'), 'auto');
  await waitFor(() => expect(parentsRepo.listForYear).toHaveBeenCalledWith(2026));
  await uploadAndValidate(csv);
  expect(stat('Need a fix')).toHaveTextContent('0');
  expect(within(screen.getByLabelText('Recognized by House Parents')).getByLabelText('House for option Pinky Pie (Ingyin & Martin)')).toHaveValue('p-pinkie');

  await userEvent.click(screen.getByRole('button', { name: 'Generate Placements' }));
  const rows = await screen.findAllByTestId('placement-result-row');
  expect(rows.map((row) => within(row).getAllByRole('cell')[7].textContent)).toEqual(['Rarity', 'Pinkie Pie', 'Applejack', 'Twilight Sparkle']);
  expect(screen.queryByText(/Pinky Pie \(/, { selector: 'td' })).not.toBeInTheDocument();
});
