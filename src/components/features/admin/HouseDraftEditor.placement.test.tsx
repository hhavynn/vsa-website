/**
 * HouseDraftEditor for a timestamp-priority (automatic) batch: priority and
 * achieved rank are visible, overrides need a reason and respect capacity,
 * unmatched applicants block locking, and the reveal confirmation is unchanged.
 * Moves and swaps go through one atomic repository call; when it fails the
 * persisted rows are reloaded and the admin is told. Exports reflect the draft.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HouseDraftEditor } from './HouseDraftEditor';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { housePaymentsRepository } from '../../../data/repos/housePayments';
import { logAdminActivity } from '../../../data/repos/adminActivity';
import { HouseAssignmentBatch, HouseAssignmentDraft, HouseProfileLite } from '../../../lib/houseAssignmentDraft';
import { HouseImportMember } from '../../../lib/houseAssignmentImport';
import { downloadCsv } from '../../../lib/housePlacementExport';
import toast from 'react-hot-toast';

import { academicTermsRepository } from '../../../data/repos/academicTerms';
import { houseParentsRepository } from '../../../data/repos/houseParents';
import { adminReviewRepository } from '../../../data/repos/adminReview';
import { applicationLinksRepository } from '../../../data/repos/applicationLinks';
jest.mock('../../../data/repos/academicTerms', () => ({ academicTermsRepository: { getActiveTerm: jest.fn() } }));
jest.mock('../../../data/repos/houseParents', () => ({ houseParentsRepository: { listForYear: jest.fn() } }));
jest.mock('../../../data/repos/applicationLinks', () => ({ applicationLinksRepository: { listAdminApplicationLinks: jest.fn() } }));
jest.mock('../../../data/repos/housePayments', () => ({
  PAYMENTS_UNAVAILABLE: 'House payment eligibility is not available yet.',
  housePaymentsRepository: {
    listCycles: jest.fn().mockResolvedValue([]),
    getBatchBlockers: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../../data/repos/adminReview', () => ({
  adminReviewRepository: { listReviewed: jest.fn().mockResolvedValue(new Set()), mark: jest.fn().mockResolvedValue(0), unmark: jest.fn() },
}));
jest.mock('../../../data/repos/adminOperations', () => ({
  adminOperationsRepository: { resolveYearStart: jest.fn().mockResolvedValue(2026) },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../lib/housePlacementExport', () => ({
  ...jest.requireActual('../../../lib/housePlacementExport'),
  downloadCsv: jest.fn(),
}));
jest.mock('../../../data/repos/houseAssignments', () => ({
  houseAssignmentsRepository: {
    updateDraft: jest.fn().mockResolvedValue(undefined),
    applyPlacementOverride: jest.fn(),
    getDrafts: jest.fn(),
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
  { id: 'p-pinkie', house_key: 'pinkie-pie', display_name: 'Pinkie Pie', is_active: true },
];
const members: HouseImportMember[] = ['a', 'b', 'c', 'd'].map((id) => ({
  id: `m-${id}`, first_name: `Member${id.toUpperCase()}`, last_name: 'Test', college: null, year: null, house: null, email: null, points: 0, events_attended: 0,
}));

function batch(status: HouseAssignmentBatch['status'] = 'draft'): HouseAssignmentBatch {
  return {
    id: 'b1', academic_year_start: 2026, academic_year_end: 2027, effective_start_date: '2026-11-08', status,
    source_label: 'Fall auto', created_by: null, locked_at: null, published_at: null,
    assignment_method: 'timestamp_ranked', capacity_config: { 'p-rarity': 2, 'p-pinkie': 2 }, excluded_applicants: [{ source_row_number: 9, name: 'Left Out', reason: 'Withdrew' }],
    payment_cycle_id: null, eligibility_mode: null, payment_snapshot_version: null, revised_from_batch_id: null, generation_reason: null, applicant_set_fingerprint: null, eligibility_summary: null,
    created_at: '2026-10-26T00:00:00Z', updated_at: '2026-10-26T00:00:00Z',
  };
}

function draft(order: number, name: string, houseId: string, prefs: string[], overrides: Partial<HouseAssignmentDraft> = {}): HouseAssignmentDraft {
  return {
    id: `d${order}`, batch_id: 'b1', applicant_id: null, source_name: name, source_house: null, member_id: `m-${'abcd'[order]}`,
    house_profile_id: houseId, generated_house_profile_id: houseId, override_reason: null,
    match_status: 'match', match_method: 'email', match_score: 100, preferences: prefs, notes: null,
    source_order: order, submission_timestamp: new Date(Date.UTC(2026, 9, 22, 3, order)).toISOString(), source_row_number: order + 2,
    created_at: '', updated_at: '', ...overrides,
  };
}

const R = 'p-rarity';
const P = 'p-pinkie';
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

const download = downloadCsv as jest.MockedFunction<typeof downloadCsv>;

beforeEach(() => {
  (adminReviewRepository.listReviewed as jest.Mock).mockResolvedValue(new Set());
  (academicTermsRepository.getActiveTerm as jest.Mock).mockResolvedValue({ academic_year_start: 2026 });
  (houseParentsRepository.listForYear as jest.Mock).mockResolvedValue([]);
  (applicationLinksRepository.listAdminApplicationLinks as jest.Mock).mockResolvedValue([]);
  (housePaymentsRepository.getBatchBlockers as jest.Mock).mockResolvedValue([]);
  jest.clearAllMocks();
  // The real RPC returns the updated rows; mimic that from the requested changes.
  repo.applyPlacementOverride.mockImplementation(async (_batchId, changes, reason) => changes.map((change) => {
    const row = placement().find((item) => item.id === change.draftId) as HouseAssignmentDraft;
    return { ...row, house_profile_id: change.houseProfileId, override_reason: change.houseProfileId === row.generated_house_profile_id ? null : reason };
  }));
});

async function openSwapForm() {
  const row = screen.getAllByTestId('house-draft-row')[2];
  await userEvent.click(within(row).getByRole('button', { name: 'Override…' }));
  const form = within(screen.getByTestId('override-form'));
  await userEvent.selectOptions(form.getByLabelText('Move to'), R);
  await userEvent.selectOptions(form.getByLabelText('Swap with (if full)'), 'd1');
  await userEvent.type(form.getByLabelText('Reason (required)'), 'Approved by president');
  return form;
}

it('shows priority, submission time, achieved rank and capacities, and hides the balance helper and bulk House edits', async () => {
  renderEditor(placement());
  const rows = screen.getAllByTestId('house-draft-row');
  expect(rows[2]).toHaveTextContent('#3');
  expect(rows[2]).toHaveTextContent('Submitted 10/21/2026 20:02:00 · sheet row 4');
  expect(rows[2]).toHaveTextContent('Prefers: Rarity › Pinkie Pie');
  expect(rows[2]).toHaveTextContent('2nd choice');
  expect(rows[2]).toHaveTextContent('Automatically assigned');
  const policy = within(screen.getByLabelText('Automatic placement'));
  expect(policy.getByTestId('placement-capacity-Rarity')).toHaveTextContent('2 / 2');
  expect(policy.getByText(/1 not placed \(excluded or repeat submission\)/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Balance helper')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('House for MemberA Test')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Add someone manually')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeEnabled());
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
  expect(form.getByText(/MemberC Test: Pinkie Pie \(2nd choice\) → Rarity \(1st choice\)/)).toBeInTheDocument();
  expect(form.getByText(/MemberB Test: Rarity \(1st choice\) → Pinkie Pie \(2nd choice\)/)).toBeInTheDocument();
  expect(form.getByText(/breaks first-come, first-served/)).toBeInTheDocument();

  await userEvent.clear(form.getByLabelText('Reason (required)'));
  expect(form.getByRole('button', { name: 'Apply override' })).toBeDisabled();
  await userEvent.type(form.getByLabelText('Reason (required)'), 'Approved by president');
  await userEvent.click(form.getByRole('button', { name: 'Apply override' }));

  // Both rows change in ONE atomic call, never two separate row updates.
  await waitFor(() => expect(repo.applyPlacementOverride).toHaveBeenCalledTimes(1));
  expect(repo.applyPlacementOverride).toHaveBeenCalledWith('b1', [
    { draftId: 'd2', houseProfileId: R },
    { draftId: 'd1', houseProfileId: P },
  ], 'Approved by president');
  expect(repo.updateDraft).not.toHaveBeenCalled();
  expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ summary: expect.stringMatching(/Manual override of the automatic placement: Approved by president/) }));
  // A one-row House undo would split the swap and drop its reason, so none is offered.
  (logAdminActivity as jest.Mock).mock.calls.forEach(([entry]) => expect(entry.metadata).toBeUndefined());
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
  await waitFor(() => expect(reveal).toBeEnabled());
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

it.each([
  'That House would have 3 applicants but its capacity is 2. Nothing was changed.',
  'House placement changes are unavailable. Ask a site administrator to verify database migration 20261027120000 and refresh the API schema cache. Nothing was changed.',
])('reloads saved rows without reporting success when an override fails: %s', async (message) => {
  repo.applyPlacementOverride.mockRejectedValue(new Error(message));
  repo.getDrafts.mockResolvedValue(placement());
  renderEditor(placement());
  const form = await openSwapForm();
  await userEvent.click(form.getByRole('button', { name: 'Apply override' }));

  await waitFor(() => expect(repo.getDrafts).toHaveBeenCalledWith('b1'));
  expect(toast.error).toHaveBeenCalledWith(`${message} The rows were reloaded from the saved draft.`);
  expect(toast.success).not.toHaveBeenCalled();
  expect(repo.updateDraft).not.toHaveBeenCalled();
  expect(logAdminActivity).not.toHaveBeenCalled();
  await settle();
  const rows = screen.getAllByTestId('house-draft-row');
  rows.forEach((row) => expect(row).not.toHaveTextContent('Manually overridden'));
  expect(within(screen.getByLabelText('Automatic placement')).getByTestId('placement-capacity-Rarity')).toHaveTextContent('2 / 2');
});

it('shows the persisted state the database reports after a failure, even if it differs from the screen', async () => {
  // E.g. another admin's change landed first: the reload shows what is actually saved.
  const persisted = placement().map((row) => (row.id === 'd3' ? { ...row, notes: 'saved elsewhere' } : row));
  repo.applyPlacementOverride.mockRejectedValue(new Error('This batch is locked. Reopen it before changing placements.'));
  repo.getDrafts.mockResolvedValue(persisted);
  renderEditor(placement());
  const form = await openSwapForm();
  await userEvent.click(form.getByRole('button', { name: 'Apply override' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/locked.*reloaded from the saved draft/)));
});

it('asks for a page refresh when the reload after a failure also fails', async () => {
  repo.applyPlacementOverride.mockRejectedValue(new Error('Network error occurred'));
  repo.getDrafts.mockRejectedValue(new Error('offline'));
  renderEditor(placement());
  const form = await openSwapForm();
  await userEvent.click(form.getByRole('button', { name: 'Apply override' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/could not be reloaded; refresh the page/)));
});

it('restores the automatic placement through the same atomic call, with no reason needed', async () => {
  const drafts = placement();
  drafts[3] = { ...drafts[3], house_profile_id: R, override_reason: 'Temporary move' };
  renderEditor(drafts);
  const row = screen.getAllByTestId('house-draft-row')[3];
  repo.applyPlacementOverride.mockResolvedValueOnce([{ ...drafts[3], house_profile_id: P, override_reason: null }]);
  // Pinkie Pie has room (1 / 2) after MemberD left, so the restore is a single move.
  await userEvent.click(within(row).getByRole('button', { name: /Restore automatic/ }));
  await waitFor(() => expect(repo.applyPlacementOverride).toHaveBeenCalledWith('b1', [{ draftId: 'd3', houseProfileId: P }], null));
  expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({ summary: expect.stringMatching(/Restored the automatic placement/) }));
});

it('exports the saved draft for Google Sheets, reflecting overrides, with draft row IDs and no emails', async () => {
  const drafts = placement();
  drafts[1] = { ...drafts[1], house_profile_id: P, override_reason: 'Approved swap' };
  drafts[2] = { ...drafts[2], house_profile_id: R, override_reason: 'Approved swap' };
  renderEditor(drafts);
  const panel = screen.getByRole('region', { name: 'Export for Google Sheets' });
  await userEvent.click(within(panel).getByRole('button', { name: 'Full roster (4)' }));
  await userEvent.click(within(panel).getByRole('button', { name: 'Rarity roster (2)' }));
  await userEvent.click(within(panel).getByRole('button', { name: 'Needs review (2)' }));
  expect(download.mock.calls.map(([, name]) => name)).toEqual([
    'vsa-house-placement-2026-2027-full-roster.csv',
    'vsa-house-placement-2026-2027-rarity-roster.csv',
    'vsa-house-placement-2026-2027-needs-review.csv',
  ]);
  const full = download.mock.calls[0][0].trim().split('\n');
  expect(full[2]).toBe('2,3,MemberB Test,MemberB Test,10/21/2026 20:01:00,2026-10-22T03:01:00.000Z,Rarity,Pinkie Pie,,,Rarity,Pinkie Pie,2,Manual override,Approved swap,Matched,Yes,Manual override,d1');
  expect(download.mock.calls[1][0]).toMatch(/MemberA Test/);
  expect(download.mock.calls[1][0]).toMatch(/MemberC Test/);
  expect(download.mock.calls[1][0]).not.toMatch(/MemberB Test/);
  expect(repo.updateDraft).not.toHaveBeenCalled();
  expect(repo.applyPlacementOverride).not.toHaveBeenCalled();
});

describe('payment eligibility gate (#660)', () => {
  const blockers = housePaymentsRepository.getBatchBlockers as jest.MockedFunction<typeof housePaymentsRepository.getBatchBlockers>;

  it('shows the server blockers, a stale-payments banner and keeps Lock disabled', async () => {
    blockers.mockResolvedValueOnce([
      'Payments changed since this sort. Rerun sorting with the current payment statuses.',
      '1 Paid or Waived applicant(s) are missing from this draft.',
    ]);
    renderEditor(placement());
    expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeDisabled();
    expect(await screen.findByText(/Payments changed since this sort — rerun required/)).toBeInTheDocument();
    expect(screen.getAllByText(/1 Paid or Waived applicant\(s\) are missing from this draft/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeDisabled();
  });

  it('treats a failed eligibility check as blocking, never as cleared', async () => {
    blockers.mockRejectedValueOnce(new Error('network'));
    renderEditor(placement());
    expect(await screen.findByText(/Payment eligibility could not be checked. Lock and Reveal stay blocked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock assignments' })).toBeDisabled();
  });
});

describe('Ready to Reveal (#635)', () => {
  it('lists what becomes public, with no House points, and keeps Reveal disabled while a check is Unknown', async () => {
    (academicTermsRepository.getActiveTerm as jest.Mock).mockRejectedValue(new Error('network'));
    renderEditor(placement(), 'locked');
    const panel = await screen.findByRole('region', { name: 'Ready to Reveal' });
    expect(panel).toHaveTextContent('no House points or standings');
    await waitFor(() => expect(within(panel).getByRole('status')).toHaveTextContent('Unknown'));
    await userEvent.click(screen.getByRole('checkbox', { name: /I confirm: reveal these 4 assignments/ }));
    expect(screen.getByRole('button', { name: 'Reveal House assignments' })).toBeDisabled();
    expect(repo.publishBatch).not.toHaveBeenCalled();
  });

  it('flags an open House application window without blocking the Reveal', async () => {
    (applicationLinksRepository.listAdminApplicationLinks as jest.Mock).mockResolvedValue([{
      id: 'l1', application_key: 'house_fall', title: 'Fall House application', is_enabled: true,
      open_at: '2020-01-01T00:00:00Z', due_at: '2999-01-01T00:00:00Z',
    }]);
    renderEditor(placement(), 'locked');
    const panel = await screen.findByRole('region', { name: 'Ready to Reveal' });
    await waitFor(() => expect(panel).toHaveTextContent('Fall House application is still open'));
    await userEvent.click(screen.getByRole('checkbox', { name: /I confirm: reveal these 4 assignments/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reveal House assignments' })).toBeEnabled());
  });
});
