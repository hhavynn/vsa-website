import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AceEligibilityPanel } from './AceEligibilityPanel';
import { aceAssignmentsRepository } from '../../../data/repos/aceAssignments';
import type { AceEligibilityState } from '../../../hooks/useAceEligibility';
import type { ReadinessEvent } from '../../../data/repos/attendanceReadiness';
import { computeAceEligibility } from '../../../lib/aceEligibility';
import { downloadCsv } from '../../../lib/housePlacementExport';
import type { AceAssignmentCycle } from '../../../types';

jest.mock('../../../data/repos/aceAssignments', () => ({
  ...jest.requireActual('../../../data/repos/aceAssignments'),
  aceAssignmentsRepository: { saveEligibilityPolicy: jest.fn() },
}));
jest.mock('../../../data/repos/adminActivity', () => ({ logAdminActivity: jest.fn() }));
jest.mock('../../../lib/housePlacementExport', () => ({ downloadCsv: jest.fn() }));

// Synthetic people and events only.
const checkedAt = '2026-10-30T12:00:00Z';
const event = (id: string, name: string, patch: Partial<ReadinessEvent> = {}): ReadinessEvent =>
  ({
    id,
    name,
    date: '2026-10-10T19:00:00Z',
    is_published: true,
    academic_term_id: 'fall',
    term_label: 'Fall 2026',
    open_review_rows: 0,
    reconciliation_pending_rows: 0,
    reconciled_at: '2026-10-20T00:00:00Z',
    last_credit_at: null,
    latest_job: null,
    attestation: null,
    credits: 1,
    ...patch,
  }) as ReadinessEvent;
const events = [
  event('e1', 'Sample GBM'),
  event('e2', 'Sample Social', { date: '2026-10-17T19:00:00Z' }),
  event('e-future', 'Future Retreat', { date: '2026-11-20T19:00:00Z' }),
  event('e-hidden', 'Unpublished Mixer', { is_published: false }),
];
const readiness = { events, totalEvents: events.length, truncated: false, checkedAt };

const cycle = (status: AceAssignmentCycle['status'], mins: [number | null, number | null] = [null, null]): AceAssignmentCycle => ({
  id: 'cycle-1',
  academic_year_start: 2026,
  academic_year_end: 2027,
  status,
  little_min_events: mins[0],
  big_min_events: mins[1],
  created_by: null,
  created_at: '',
  updated_at: '',
});

function mount(c: AceAssignmentCycle, eligibility: AceEligibilityState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AceEligibilityPanel cycle={c} eligibility={eligibility} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (aceAssignmentsRepository.saveEligibilityPolicy as jest.Mock).mockResolvedValue({ cycleId: 'cycle-1', eventCount: 2, added: 2, removed: 0 });
});

it('pre-fills 4 and 3 but checks nothing until the Chair saves them', async () => {
  mount(cycle('draft'), { policy: null, savedEventIds: [], readiness, result: null, loading: false, refreshing: false, error: null });
  expect(screen.getByText(/No minimums are saved for this cycle yet/)).toBeInTheDocument();
  expect(screen.getByLabelText('Little minimum')).toHaveValue(4);
  expect(screen.getByLabelText('Big minimum')).toHaveValue(3);

  // Only completed, dated, published events are offered.
  expect(screen.getByText('Sample GBM')).toBeInTheDocument();
  expect(screen.queryByText('Future Retreat')).not.toBeInTheDocument();
  expect(screen.queryByText('Unpublished Mixer')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Select all completed events this year' }));
  expect(screen.getAllByRole('checkbox').every((box) => (box as HTMLInputElement).checked)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save minimums & events' }));
  await waitFor(() =>
    expect(aceAssignmentsRepository.saveEligibilityPolicy).toHaveBeenCalledWith('cycle-1', {
      littleMin: 4,
      bigMin: 3,
      eventIds: ['e1', 'e2'],
    }),
  );
});

it('refuses minimums outside 1–20 before saving', () => {
  mount(cycle('draft'), { policy: null, savedEventIds: [], readiness, result: null, loading: false, refreshing: false, error: null });
  fireEvent.change(screen.getByLabelText('Little minimum'), { target: { value: '21' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Minimums must be whole numbers from 1 to 20.');
  expect(screen.getByRole('button', { name: 'Save minimums & events' })).toBeDisabled();
});

it('keeps a locked cycle\'s policy frozen and read-only', () => {
  const policy = { littleMin: 4, bigMin: 3, eventIds: ['e1'] };
  mount(cycle('locked', [4, 3]), { policy, savedEventIds: ['e1'], readiness, result: null, loading: true, refreshing: true, error: null });
  expect(screen.getByText(/frozen while the cycle is locked/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View policy' }));
  expect(screen.getByLabelText('Little minimum')).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Select all completed/ })).not.toBeInTheDocument();
});

it('shows counts and filters people by status and name', () => {
  const policy = { littleMin: 2, bigMin: 1, eventIds: ['e1', 'e2'] };
  const result = computeAceEligibility({
    drafts: [
      { id: 'd1', little_name: 'Sample Linh', little_member_id: 'm1', big_ace_member_id: 'n1' },
      { id: 'd2', little_name: 'Sample Bao', little_member_id: 'm2', big_ace_member_id: 'n1' },
      { id: 'd3', little_name: 'Sample Unlinked', little_member_id: null, big_ace_member_id: null },
    ],
    nodes: [{ id: 'n1', name: 'Sample Big', memberId: 'm-big' }],
    policy,
    events,
    attendance: new Map([['m1', new Set(['e1', 'e2'])], ['m2', new Set(['e1'])], ['m-big', new Set(['e1'])]]),
    now: new Date(checkedAt),
  });
  mount(cycle('draft', [2, 1]), { policy, savedEventIds: ['e1', 'e2'], readiness, result, loading: false, refreshing: false, error: null });

  const list = screen.getByRole('list');
  expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Short (1)' }));
  expect(within(screen.getByRole('list')).getByText('Sample Bao')).toBeInTheDocument();
  expect(screen.getByText(/1 of 2: 1 more needed/)).toBeInTheDocument();
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: /^All/ }));
  fireEvent.change(screen.getByPlaceholderText('Search names…'), { target: { value: 'big' } });
  expect(within(screen.getByRole('list')).getByText('Sample Big')).toBeInTheDocument();
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
});

it('never offers Save while the saved policy is unread, so it cannot overwrite it', () => {
  mount(cycle('draft', [4, 3]), { policy: null, savedEventIds: null, readiness, result: null, loading: false, refreshing: false, error: 'denied' });
  expect(screen.getByText('The saved policy could not be read.')).toBeInTheDocument();
  expect(screen.queryByText(/No minimums are saved/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit qualifying events & minimums' }));
  expect(screen.getByRole('button', { name: 'Save minimums & events' })).toBeDisabled();
});

it('warns before saving a minimum that no one could meet', () => {
  mount(cycle('draft'), { policy: null, savedEventIds: [], readiness, result: null, loading: false, refreshing: false, error: null });
  fireEvent.click(screen.getByRole('checkbox', { name: /Sample GBM/ }));
  expect(screen.getByText(/Only 1 qualifying event is selected, fewer than the Little and Big minimum/)).toBeInTheDocument();
});

it('exports exactly the visible needs-attention rows without emails or IDs', () => {
  const policy = { littleMin: 2, bigMin: 1, eventIds: ['e1', 'e2'] };
  const result = computeAceEligibility({
    drafts: [
      { id: 'd1', little_name: 'Synthetic Complete', little_member_id: 'm1', big_ace_member_id: 'n1' },
      { id: 'd2', little_name: 'Synthetic Short', little_member_id: 'm2', big_ace_member_id: 'n1' },
      { id: 'd3', little_name: 'Synthetic Unknown', little_member_id: null, big_ace_member_id: null },
    ],
    nodes: [{ id: 'n1', name: 'Synthetic Big', memberId: 'm-big' }],
    policy, events, now: new Date(checkedAt),
    attendance: new Map([['m1', new Set(['e1', 'e2'])], ['m2', new Set(['e1'])], ['m-big', new Set(['e1'])]]),
  });
  mount(cycle('draft', [2, 1]), { policy, savedEventIds: ['e1', 'e2'], readiness, result, loading: false, refreshing: false, error: null });
  fireEvent.click(screen.getByRole('button', { name: 'Needs attention (2)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download visible eligibility CSV' }));
  expect(downloadCsv).toHaveBeenCalledTimes(1);
  const [csv, filename] = (downloadCsv as jest.Mock).mock.calls[0] as [string, string];
  expect(filename).toBe('ace-eligibility-2026-filtered.csv');
  expect(csv).toContain('Synthetic Short');
  expect(csv).toContain('Synthetic Unknown');
  expect(csv).not.toContain('Synthetic Complete');
  expect(csv).not.toContain('Synthetic Big');
  expect(csv).not.toContain('m-big');
});

it('disables local export while eligibility is refreshing', () => {
  const policy = { littleMin: 2, bigMin: 1, eventIds: ['e1', 'e2'] };
  const result = computeAceEligibility({
    drafts: [{ id: 'd1', little_name: 'Synthetic Short', little_member_id: 'm1', big_ace_member_id: null }],
    nodes: [], policy, events, now: new Date(checkedAt), attendance: new Map(),
  });
  // A background refetch keeps the old rows on screen with loading false.
  const entry = { policy, savedEventIds: ['e1', 'e2'], readiness, result, loading: false, refreshing: true, error: null };
  mount(cycle('draft', [2, 1]), entry);
  expect(screen.getByRole('button', { name: 'Download visible eligibility CSV' })).toBeDisabled();
  expect(downloadCsv).not.toHaveBeenCalled();
});
