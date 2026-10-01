import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseDraftEditor } from './HouseDraftEditor';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { HouseAssignmentBatch, HouseAssignmentDraft, HouseProfileLite } from '../../../lib/houseAssignmentDraft';
import { HouseImportMember } from '../../../lib/houseAssignmentImport';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../data/repos/houseAssignments', () => ({
  houseAssignmentsRepository: {
    updateDraft: jest.fn().mockResolvedValue(undefined),
    removeDraft: jest.fn().mockResolvedValue(undefined),
    addDraft: jest.fn(),
    lockBatch: jest.fn().mockResolvedValue(undefined),
    reopenBatch: jest.fn().mockResolvedValue(undefined),
    publishBatch: jest.fn(),
    deleteBatch: jest.fn(),
    getBatch: jest.fn(),
  },
}));

const repo = houseAssignmentsRepository as jest.Mocked<typeof houseAssignmentsRepository>;

const profiles: HouseProfileLite[] = [
  { id: 'p-boo', house_key: 'Boo', display_name: 'Boo', is_active: true },
  { id: 'p-toad', house_key: 'Toad', display_name: 'Toad', is_active: true },
];
const members: HouseImportMember[] = [
  { id: 'm-kevin', first_name: 'Kevin', last_name: 'Tran', college: 'Muir', year: 'Second Year', house: null, email: null, points: 0, events_attended: 0 },
  { id: 'm-sara', first_name: 'Sara', last_name: 'Nguyen', college: null, year: null, house: null, email: null, points: 0, events_attended: 0 },
];

function batch(status: HouseAssignmentBatch['status'] = 'draft'): HouseAssignmentBatch {
  return {
    id: 'b1', academic_year_start: 2026, academic_year_end: 2027, effective_start_date: '2026-11-08', status,
    source_label: 'Fall sort', created_by: null, locked_at: null, published_at: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  };
}
function draft(id: string, overrides: Partial<HouseAssignmentDraft>): HouseAssignmentDraft {
  return {
    id, batch_id: 'b1', source_name: id, source_house: null, member_id: null, house_profile_id: null,
    match_status: 'unmatched', match_method: null, match_score: null, preferences: null, notes: null,
    source_order: 0, created_at: '', updated_at: '', ...overrides,
  };
}

function renderEditor(drafts: HouseAssignmentDraft[], status: HouseAssignmentBatch['status'] = 'draft') {
  return render(
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
    />,
  );
}

beforeEach(() => jest.clearAllMocks());

/** Lets an in-flight save finish inside act so its state updates are accounted for. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

it('shows live counts and a preflight summary', () => {
  renderEditor([
    draft('Kevin Tran', { member_id: 'm-kevin', house_profile_id: 'p-toad', match_status: 'match', source_order: 0 }),
    draft('Sara Nguyen', { member_id: 'm-sara', house_profile_id: 'p-boo', match_status: 'review', source_order: 1 }),
    draft('Nobody', { source_order: 2 }),
  ]);

  const counts = within(screen.getByLabelText('House counts'));
  expect(counts.getByTestId('house-count-Toad')).toHaveTextContent('Toad1');
  expect(counts.getByTestId('house-count-Boo')).toHaveTextContent('Boo0');
  expect(counts.getByTestId('house-count-Unassigned')).toHaveTextContent('Unassigned1');

  const preflight = within(screen.getByLabelText('Preflight'));
  expect(preflight.getByText('✓ 3 applicants')).toBeInTheDocument();
  expect(preflight.getByText('✓ 1 assigned')).toBeInTheDocument();
  expect(preflight.getByText(/1 ambiguous member match/)).toBeInTheDocument();
});

it('disables locking while a blocker remains', () => {
  renderEditor([
    draft('a', { member_id: 'm-kevin', house_profile_id: 'p-toad', match_status: 'match' }),
    draft('b', { member_id: 'm-kevin', house_profile_id: 'p-boo', match_status: 'match' }),
  ]);
  expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeDisabled();
  expect(screen.getByText(/assigned to multiple Houses/)).toBeInTheDocument();
});

it('saves a House change for a row and updates the counts', async () => {
  renderEditor([draft('Kevin Tran', { member_id: 'm-kevin', house_profile_id: 'p-toad', match_status: 'match' })]);

  await userEvent.selectOptions(screen.getByLabelText('House for Kevin Tran'), 'p-boo');

  await waitFor(() => expect(repo.updateDraft).toHaveBeenCalledWith('b1', 'Kevin Tran', { house_profile_id: 'p-boo' }));
  const counts = within(screen.getByLabelText('House counts'));
  await waitFor(() => expect(counts.getByTestId('house-count-Boo')).toHaveTextContent('Boo1'));
  await settle();
  expect(screen.getByLabelText('House for Kevin Tran')).toBeEnabled();
});

it('only moves someone when the admin accepts a preference-based suggestion', async () => {
  const rows = [
    ...['a', 'b', 'c', 'd'].map((id, i) => draft(id, { member_id: `x${i}`, house_profile_id: 'p-boo', match_status: 'match', source_order: i })),
    draft('Kevin Tran', { member_id: 'm-kevin', house_profile_id: null, match_status: 'match', preferences: ['Boo', 'Toad'], source_order: 9 }),
  ];
  renderEditor(rows);

  expect(screen.getByText(/Reason: Toad is smallest \+ Toad was Kevin's 2nd choice/)).toBeInTheDocument();
  expect(repo.updateDraft).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

  await waitFor(() => expect(repo.updateDraft).toHaveBeenCalledWith('b1', 'Kevin Tran', { house_profile_id: 'p-toad' }));
  await settle();
  expect(screen.getByLabelText('House for Kevin Tran')).toBeEnabled();
});

it('makes a locked batch read-only with a reopen action', () => {
  renderEditor([draft('Kevin Tran', { member_id: 'm-kevin', house_profile_id: 'p-toad', match_status: 'match' })], 'locked');

  expect(screen.getByLabelText('House for Kevin Tran')).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reopen draft' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reveal House assignments' })).toBeDisabled();
});
