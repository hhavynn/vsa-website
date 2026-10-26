/**
 * HouseDraftEditor for a timestamp-priority (automatic) batch: priority and
 * achieved rank are visible, overrides need a reason and respect capacity,
 * unmatched applicants block locking, and the reveal confirmation is unchanged.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { HouseDraftEditor } from './HouseDraftEditor';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { HouseAssignmentBatch, HouseAssignmentDraft, HouseProfileLite } from '../../../lib/houseAssignmentDraft';
import { HouseImportMember } from '../../../lib/houseAssignmentImport';

jest.mock('../../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../../data/repos/adminReview', () => ({
  adminReviewRepository: { listReviewed: jest.fn().mockResolvedValue(new Set()), mark: jest.fn().mockResolvedValue(0), unmark: jest.fn() },
}));
jest.mock('../../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../data/repos/houseAssignments', () => ({
  houseAssignmentsRepository: {
    updateDraft: jest.fn().mockResolvedValue(undefined),
    removeDraft: jest.fn(),
    addDraft: jest.fn(),
    lockBatch: jest.fn().mockResolvedValue(undefined),
    reopenBatch: jest.fn(),
    publishBatch: jest.fn(),
    deleteBatch: jest.fn(),
    getBatch: jest.fn(),
  },
}));

const repo = houseAssignmentsRepository as jest.Mocked<typeof houseAssignmentsRepository>;
const profiles: HouseProfileLite[] = [
  { id: 'p-rarity', house_key: 'rarity', display_name: 'Rarity', is_active: true },
  { id: 'p-pinky', house_key: 'pinky-pie', display_name: 'Pinky Pie', is_active: true },
];
const members: HouseImportMember[] = ['a', 'b', 'c', 'd'].map((id) => ({
  id: `m-${id}`, first_name: `Member${id.toUpperCase()}`, last_name: 'Test', college: null, year: null, house: null, email: null, points: 0, events_attended: 0,
}));

function batch(status: HouseAssignmentBatch['status'] = 'draft'): HouseAssignmentBatch {
  return {
    id: 'b1', academic_year_start: 2026, academic_year_end: 2027, effective_start_date: '2026-11-08', status,
    source_label: 'Fall auto', created_by: null, locked_at: null, published_at: null,
    assignment_method: 'timestamp_ranked', capacity_config: { 'p-rarity': 2, 'p-pinky': 2 }, excluded_applicants: [{ source_row_number: 9, name: 'Left Out', reason: 'Withdrew' }],
    created_at: '2026-10-26T00:00:00Z', updated_at: '2026-10-26T00:00:00Z',
  };
}

function draft(order: number, name: string, houseId: string, prefs: string[], overrides: Partial<HouseAssignmentDraft> = {}): HouseAssignmentDraft {
  return {
    id: `d${order}`, batch_id: 'b1', source_name: name, source_house: null, member_id: `m-${'abcd'[order]}`,
    house_profile_id: houseId, generated_house_profile_id: houseId, override_reason: null,
    match_status: 'match', match_method: 'email', match_score: 100, preferences: prefs, notes: null,
    source_order: order, submission_timestamp: new Date(Date.UTC(2026, 9, 22, 3, order)).toISOString(), source_row_number: order + 2,
    created_at: '', updated_at: '', ...overrides,
  };
}

const R = 'p-rarity';
const P = 'p-pinky';
function placement() {
  return [
    draft(0, 'MemberA Test', R, [R, P]),
    draft(1, 'MemberB Test', R, [R, P]),
    draft(2, 'MemberC Test', P, [R, P]),
    draft(3, 'MemberD Test', P, [P, R]),
  ];
}

function renderEditor(drafts: HouseAssignmentDraft[], status: HouseAssignmentBatch['status'] = 'draft') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <HouseDraftEditor
          batch={batch(status)}
          initialDrafts={drafts}
          profiles={profiles}
          existingMemberships={new Map()}
          members={members}
          userId="admin"
          onBack={jest.fn()}
          onBatchChanged={jest.fn()}
          onPublished={jest.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

beforeEach(() => jest.clearAllMocks());

it('shows priority, submission time, achieved rank and capacities, and hides the balance helper and bulk House edits', () => {
  renderEditor(placement());
  const rows = screen.getAllByTestId('house-draft-row');
  expect(rows[2]).toHaveTextContent('#3');
  expect(rows[2]).toHaveTextContent('Submitted 10/21/2026 20:02:00 · sheet row 4');
  expect(rows[2]).toHaveTextContent('Prefers: Rarity › Pinky Pie');
  expect(rows[2]).toHaveTextContent('2nd choice');
  expect(rows[2]).toHaveTextContent('Automatically assigned');
  const policy = within(screen.getByLabelText('Automatic placement'));
  expect(policy.getByTestId('placement-capacity-Rarity')).toHaveTextContent('2 / 2');
  expect(policy.getByText(/1 not placed \(excluded or repeat submission\)/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Balance helper')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('House for MemberA Test')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Add someone manually')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeEnabled();
});

it('blocks locking while an included applicant is not linked to a member', () => {
  const drafts = placement();
  drafts[3] = { ...drafts[3], member_id: null, match_status: 'unmatched' };
  renderEditor(drafts);
  expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeDisabled();
  expect(screen.getByText(/1 applicant not linked to a confirmed member record/)).toBeInTheDocument();
});

it('rejects a move that would exceed capacity and requires a reason for a swap', async () => {
  renderEditor(placement());
  const row = screen.getAllByTestId('house-draft-row')[2];
  await userEvent.click(within(row).getByRole('button', { name: 'Override…' }));
  const form = within(screen.getByTestId('override-form'));

  await userEvent.selectOptions(form.getByLabelText('Move to'), R);
  expect(form.getByRole('alert')).toHaveTextContent(/Rarity is full \(2\)/);
  await userEvent.type(form.getByLabelText('Reason (required)'), 'Approved by president');
  expect(form.getByRole('button', { name: 'Apply override' })).toBeDisabled();

  await userEvent.selectOptions(form.getByLabelText('Swap with (if full)'), 'd1');
  expect(form.getByText(/MemberC Test: Pinky Pie \(2nd choice\) → Rarity \(1st choice\)/)).toBeInTheDocument();
  expect(form.getByText(/MemberB Test: Rarity \(1st choice\) → Pinky Pie \(2nd choice\)/)).toBeInTheDocument();
  expect(form.getByText(/breaks first-come, first-served/)).toBeInTheDocument();

  await userEvent.clear(form.getByLabelText('Reason (required)'));
  expect(form.getByRole('button', { name: 'Apply override' })).toBeDisabled();
  await userEvent.type(form.getByLabelText('Reason (required)'), 'Approved by president');
  await userEvent.click(form.getByRole('button', { name: 'Apply override' }));

  await waitFor(() => expect(repo.updateDraft).toHaveBeenCalledTimes(2));
  expect(repo.updateDraft).toHaveBeenCalledWith('b1', 'd2', { house_profile_id: R, override_reason: 'Approved by president' });
  expect(repo.updateDraft).toHaveBeenCalledWith('b1', 'd1', { house_profile_id: P, override_reason: 'Approved by president' });
  expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ summary: expect.stringMatching(/Manual override of the automatic placement: Approved by president/) }));
  await settle();

  const rows = screen.getAllByTestId('house-draft-row');
  expect(rows[1]).toHaveTextContent('Manually overridden');
  expect(rows[1]).toHaveTextContent('Automatic: Rarity. Reason: Approved by president');
  expect(screen.getByText(/1 earlier applicant now misses a higher-ranked House/)).toBeInTheDocument();
  // An override with a reason is allowed; the policy warning does not block.
  expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeEnabled();
});

it('blocks locking when a row was moved without a recorded reason', () => {
  const drafts = placement();
  drafts[1] = { ...drafts[1], house_profile_id: P };
  drafts[2] = { ...drafts[2], house_profile_id: R };
  renderEditor(drafts);
  expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeDisabled();
  expect(screen.getByText(/2 House changes from the automatic result without a documented reason/)).toBeInTheDocument();
});

it('cannot be edited once locked, and revealing still needs the explicit confirmation', async () => {
  renderEditor(placement(), 'locked');
  expect(screen.queryByRole('button', { name: 'Override…' })).not.toBeInTheDocument();
  const reveal = screen.getByRole('button', { name: 'Reveal House assignments' });
  expect(reveal).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox', { name: /I confirm: reveal these 4 assignments/ }));
  expect(reveal).toBeEnabled();
  expect(repo.publishBatch).not.toHaveBeenCalled();
});

it('filters to manual overrides', async () => {
  const drafts = placement();
  drafts[1] = { ...drafts[1], house_profile_id: P, override_reason: 'Swap' };
  drafts[2] = { ...drafts[2], house_profile_id: R, override_reason: 'Swap' };
  renderEditor(drafts);
  await userEvent.selectOptions(screen.getByLabelText('Filter by placement'), 'override');
  const rows = screen.getAllByTestId('house-draft-row');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('#2MemberB Test');
  expect(rows[1]).toHaveTextContent('#3MemberC Test');
});
