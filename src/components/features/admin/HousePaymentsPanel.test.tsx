/**
 * Admin → Houses → Payments (#656, #658). What matters: unknown payment is
 * never shown as paid or unpaid, a final sort is blocked while anyone is
 * unresolved, a bulk change previews exactly who changes and is sent as one
 * versioned request, and nothing here touches House memberships.
 * Every person is fictional.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HousePaymentsPanel } from './HousePaymentsPanel';
import { housePaymentsRepository } from '../../../data/repos/housePayments';
import { houseAssignmentsRepository } from '../../../data/repos/houseAssignments';
import { memberIdentityRepository } from '../../../data/repos/memberIdentity';
import type { HouseApplicant, HousePaymentCycle } from '../../../lib/housePayments';
import type { HousePageAsset } from '../../../types';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../data/repos/housePayments', () => ({
  PAYMENTS_UNAVAILABLE: 'House payment eligibility is not available yet.',
  housePaymentsRepository: {
    listCycles: jest.fn(), listApplicants: jest.fn(), listAudit: jest.fn(), setPayments: jest.fn(),
    createCycle: jest.fn(), updateDeadline: jest.fn(), setCutoffAuthorization: jest.fn(),
  },
}));
jest.mock('../../../data/repos/houseAssignments', () => ({ houseAssignmentsRepository: { listBatches: jest.fn() } }));
jest.mock('../../../data/repos/memberIdentity', () => ({ memberIdentityRepository: { loadIdentityEmails: jest.fn() } }));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const payments = housePaymentsRepository as jest.Mocked<typeof housePaymentsRepository>;
const cycle: HousePaymentCycle = {
  id: 'cycle-1', academic_year_start: 2026, application_key: 'house_fall', payment_deadline: '2026-10-01T06:59:00.000Z',
  grace_until: null, deadline_note: null, cutoff_authorized_at: null, cutoff_authorized_by: null, cutoff_authorized_reason: null,
  last_change_reason: null, status_version: 5, publishing_batch_id: null, created_by: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
};
const person = (n: number, status: string): HouseApplicant => ({
  id: `app-${n}`, cycle_id: 'cycle-1', applicant_key: `k${n}`, source_name: `Fictional Applicant ${n}`,
  submission_timestamp: `2026-09-2${n}T17:00:00.000Z`, source_row_number: n + 1, preferences: ['p-rarity', 'p-pinkie'],
  member_id: null, match_status: 'unmatched', match_method: null, payment_status: status, payment_evidence: null,
  payment_reference: null, payment_note: null, payment_updated_by: null, payment_updated_at: null, withdrawn_reason: null,
  created_by: null, created_at: '', updated_at: '',
});
const profiles = [{ id: 'p-rarity', house_key: 'rarity', display_name: 'Rarity' }, { id: 'p-pinkie', house_key: 'pinkie', display_name: 'Pinkie Pie' }] as HousePageAsset[];

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HousePaymentsPanel selectedYear={2026} houseProfiles={profiles} members={[]} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  payments.listCycles.mockResolvedValue([cycle]);
  payments.listApplicants.mockResolvedValue([person(1, 'paid'), person(2, 'unverified'), person(3, 'pending'), person(4, 'unpaid')]);
  payments.listAudit.mockResolvedValue([]);
  payments.setPayments.mockResolvedValue({ applied: 2, unchanged: 0, keptWaivers: 0, statusVersion: 6, postReveal: false, replayed: false });
  (houseAssignmentsRepository.listBatches as jest.Mock).mockResolvedValue([]);
  (memberIdentityRepository.loadIdentityEmails as jest.Mock).mockResolvedValue([]);
});

it('counts statuses honestly and blocks a final sort while anyone is unresolved', async () => {
  renderPanel();
  const summary = await screen.findByRole('region', { name: 'Eligibility summary' });
  await waitFor(() => expect(summary).toHaveTextContent(/Applicants4Paid1Waived0Unpaid1Pending1Unverified1Eligible · provisional3Eligible · final1/));
  expect(within(summary).getByText(/2 applicants are still Unverified or Pending/)).toBeInTheDocument();
  expect(screen.getByText(/Payment cutoff passed/)).toBeInTheDocument();
  expect(screen.getAllByText('Unverified').length).toBeGreaterThan(1);
});

it('marks the selected unresolved applicants Unpaid in one versioned bulk request after review', async () => {
  renderPanel();
  await screen.findByText('Fictional Applicant 2');
  await userEvent.click(screen.getByRole('checkbox', { name: /Select Fictional Applicant 2/ }));
  await userEvent.click(screen.getByRole('checkbox', { name: /Select Fictional Applicant 3/ }));
  await userEvent.click(screen.getByRole('checkbox', { name: /Select Fictional Applicant 4/ }));
  await userEvent.type(screen.getByLabelText('Reason (required)'), 'Missed the deadline per CRC checklist');
  await userEvent.click(screen.getByRole('button', { name: 'Review 2 changes' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('Fictional Applicant 2, Fictional Applicant 3.');
  expect(dialog).toHaveTextContent('1 already have this status');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(payments.setPayments).toHaveBeenCalledTimes(1));
  expect(payments.setPayments.mock.calls[0][0]).toMatchObject({
    cycleId: 'cycle-1',
    source: 'bulk',
    reason: 'Missed the deadline per CRC checklist',
    expectedVersion: 5,
    changes: [
      { applicant_id: 'app-2', payment_status: 'unpaid', payment_evidence: 'crc_confirmation' },
      { applicant_id: 'app-3', payment_status: 'unpaid', payment_evidence: 'crc_confirmation' },
    ],
  });
});

it('shows an explicit unavailable state instead of an empty roster when the migration is missing', async () => {
  payments.listCycles.mockRejectedValue(new Error('House payment eligibility is not available yet.'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('House payment eligibility is not available yet.');
});
