import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { HouseAssignmentCoveragePanel } from './HouseAssignmentCoveragePanel';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { getCompleteHouseBatchCoverage, getRevealedHouseBatches } from '../../../data/repos/houseAssignmentCoverage';
import { housePaymentsRepository } from '../../../data/repos/housePayments';
import { houseMembershipsWriteRepository } from '../../../data/repos/houseMembershipWrites';
import { memberLookupRepository } from '../../../data/repos/memberLookup';
import { houseAssetsRepository } from '../../../data/repos/houseAssets';

jest.mock('../../../data/repos/houseAssignments', () => ({
  houseAssignmentsRepository: { listBatches: jest.fn() },
}));
jest.mock('../../../data/repos/houseAssignmentCoverage', () => ({
  getCompleteHouseBatchCoverage: jest.fn(), getRevealedHouseBatches: jest.fn(),
}));
jest.mock('../../../data/repos/housePayments', () => ({
  housePaymentsRepository: { listApplicants: jest.fn() },
}));
jest.mock('../../../data/repos/houseMembershipWrites', () => ({
  houseMembershipsWriteRepository: { listMembershipsForYear: jest.fn() },
}));
jest.mock('../../../data/repos/memberLookup', () => ({
  memberLookupRepository: { listMemberDirectory: jest.fn() },
}));
jest.mock('../../../data/repos/houseAssets', () => ({
  houseAssetsRepository: { getAdminAssets: jest.fn() },
}));

const batch = {
  id: 'fictional-batch', created_at: '2026-10-29T10:00:00Z', status: 'locked',
  source_label: 'Fictional House roster', published_at: null,
  payment_cycle_id: 'fictional-cycle', effective_start_date: '2026-10-29',
};
const applicant = (id: string, member: string) => ({
  id, source_name: 'Fictional Applicant ' + id, member_id: member,
  match_status: 'match', payment_status: 'paid', withdrawn_reason: null,
});
const row = {
  id: 'fictional-row', applicant_id: 'one', source_name: 'Fictional Applicant one',
  member_id: 'canonical-one', source_order: 0, source_house: 'fictional',
  house_profile_id: 'hp-one', match_status: 'match',
};

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><HouseAssignmentCoveragePanel selectedYear={2026} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (houseAssignmentsRepository.listBatches as jest.Mock).mockResolvedValue([batch]);
  (getRevealedHouseBatches as jest.Mock).mockResolvedValue([]);
  (getCompleteHouseBatchCoverage as jest.Mock).mockResolvedValue([row]);
  (houseMembershipsWriteRepository.listMembershipsForYear as jest.Mock).mockResolvedValue(new Map());
  (memberLookupRepository.listMemberDirectory as jest.Mock).mockResolvedValue([{ id: 'canonical-one' }]);
  (houseAssetsRepository.getAdminAssets as jest.Mock).mockResolvedValue([{
    id: 'hp-one', house_key: 'fictional', display_name: 'Fictional House', is_active: true,
  }]);
  (housePaymentsRepository.listApplicants as jest.Mock).mockResolvedValue([applicant('one','canonical-one')]);
});

it('requires the admin to run the read-only check and labels locked results private', async () => {
  mount();
  const button = await screen.findByRole('button', { name: 'Check coverage' });
  expect(screen.queryByText('Eligible')).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(await screen.findByText('Eligible')).toBeInTheDocument();
  expect(screen.getByText(/Private until Reveal/)).toBeInTheDocument();
  expect(screen.getByText('Assigned')).toBeInTheDocument();
  const values = screen.getAllByText('1');
  expect(values.length).toBeGreaterThan(0);
  expect(housePaymentsRepository.listApplicants).toHaveBeenCalledWith('fictional-cycle');
});

it('shows an eligible applicant missing from a batch with a payment-roster review link', async () => {
  (housePaymentsRepository.listApplicants as jest.Mock).mockResolvedValue([
    applicant('one','canonical-one'),applicant('two','canonical-two'),
  ]);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Check coverage' }));
  expect(await screen.findByText(/Fictional Applicant two · not-in-batch/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review payment roster' }))
    .toHaveAttribute('href', '/admin/houses?tab=payments');
});

it('shows duplicate applicant batch rows as review exceptions, not successful assignments', async () => {
  (getCompleteHouseBatchCoverage as jest.Mock).mockResolvedValue([
    row,
    { ...row, id: 'fictional-duplicate-row', source_order: 1, house_profile_id: 'hp-two' },
  ]);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Check coverage' }));
  expect(await screen.findByText(/Fictional Applicant one · duplicate-batch-row/)).toBeInTheDocument();
  expect(screen.getByText('Duplicate batch rows')).toBeInTheDocument();
  expect(screen.getByText('Needs review')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review draft row' })).toHaveAttribute(
    'href', '/admin/houses?batch=fictional-batch&row=fictional-row',
  );
});

it('reports a failed applicant read as unknown, never a zero-success summary', async () => {
  (housePaymentsRepository.listApplicants as jest.Mock).mockRejectedValue(new Error('synthetic outage'));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Check coverage' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Coverage is unknown/);
  expect(screen.queryByText('Eligible')).not.toBeInTheDocument();
});

it('retains a published row-only review when the payment roster is not associated', async () => {
  (houseAssignmentsRepository.listBatches as jest.Mock).mockResolvedValue([{
    ...batch, status: 'archived', published_at: '2026-10-29T12:00:00Z', payment_cycle_id: null,
  }]);
  (getRevealedHouseBatches as jest.Mock).mockResolvedValue([{
    ...batch, status: 'archived', published_at: '2026-10-29T12:00:00Z', payment_cycle_id: null,
  }]);
  (houseMembershipsWriteRepository.listMembershipsForYear as jest.Mock).mockResolvedValue(new Map([[
    'canonical-one',[{ id: 'membership', house_profile_id: 'hp-one', effective_start_date: '2026-10-29', effective_end_date: null }],
  ]]));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Check coverage' }));
  expect(await screen.findByText(/No payment roster for this batch/)).toBeInTheDocument();
  expect(screen.getByText('Verified linked')).toBeInTheDocument();
  expect(housePaymentsRepository.listApplicants).not.toHaveBeenCalled();
});


it('puts a blank House row with an active interval in the admin exception list, not Unassigned', async () => {
  (getCompleteHouseBatchCoverage as jest.Mock).mockResolvedValue([{
    ...row, house_profile_id: null, source_house: null,
  }]);
  (houseMembershipsWriteRepository.listMembershipsForYear as jest.Mock).mockResolvedValue(new Map([[
    'canonical-one', [{
      id: 'fictional-membership', house_profile_id: 'hp-one',
      effective_start_date: '2026-10-01', effective_end_date: null,
    }],
  ]]));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Check coverage' }));
  expect(await screen.findByText(/Fictional Applicant one · conflicting-membership/)).toBeInTheDocument();
  expect(screen.getByText(/Roster says no House/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review draft row' })).toHaveAttribute(
    'href', '/admin/houses?batch=fictional-batch&row=fictional-row',
  );
  expect(getCompleteHouseBatchCoverage).toHaveBeenCalledWith('fictional-batch');
});

it('does not silently accept a blank House when the linked canonical member is missing', async () => {
  (getCompleteHouseBatchCoverage as jest.Mock).mockResolvedValue([{
    ...row, member_id: 'fictional-removed', house_profile_id: null, source_house: null,
  }]);
  (housePaymentsRepository.listApplicants as jest.Mock).mockResolvedValue([
    applicant('one', 'fictional-removed'),
  ]);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Check coverage' }));
  expect(await screen.findByText(/Fictional Applicant one · missing-member/)).toBeInTheDocument();
  expect(screen.getByText(/Canonical member is absent/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review draft row' })).toBeInTheDocument();
});
