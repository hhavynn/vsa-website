/**
 * Admin → Houses → Attendance status (#653). What matters: it calls only the
 * admin RPCs (no table reads, no points math), shows the work queue first,
 * never shows a failed read as "all done", and records a statement only after
 * a confirmation, with the note.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { AttendanceReadinessPanel } from './AttendanceReadinessPanel';
import { attendanceReadinessRepository, ATTENDANCE_READINESS_UNAVAILABLE, ReadinessEvent } from '../../../data/repos/attendanceReadiness';
import { ValidationError } from '../../../data/errors';

jest.mock('../../../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [{ id: 'term-f26', label: 'Fall 2026', academic_year_start: 2026 }, { id: 'term-f25', label: 'Fall 2025', academic_year_start: 2025 }] }),
}));
jest.mock('../../../data/repos/attendanceReadiness', () => ({
  ...jest.requireActual('../../../data/repos/attendanceReadiness'),
  attendanceReadinessRepository: { getReadiness: jest.fn(), attest: jest.fn() },
}));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const repo = attendanceReadinessRepository as jest.Mocked<typeof attendanceReadinessRepository>;
const base: ReadinessEvent = {
  id: 'ev', name: 'Fictional GBM', date: '2026-10-20T02:00:00Z', event_type: 'gbm', points: 1, is_published: true,
  academic_term_id: 'term-f26', term_label: 'Fall 2026', credits: 0, scoring_credits: 0, last_credit_at: null, jobs: 0,
  latest_job: null, open_review_rows: 0, reconciled_at: null, attestation: null, house_credits: [],
};
const events: ReadinessEvent[] = [
  { ...base, id: 'pending', name: 'Fictional Pending Mixer' },
  { ...base, id: 'review', name: 'Fictional Review GBM', credits: 30, jobs: 1, open_review_rows: 2,
    latest_job: { id: 'j', status: 'completed', created_at: '2026-10-21T00:00:00Z', completed_at: '2026-10-21T00:05:00Z', total_rows: 32, review_rows: 2, error_count: 0 },
    house_credits: [{ house_profile_id: 'hp-r', display_name: 'Rarity', credits: 9 }] },
  { ...base, id: 'clean', name: 'Fictional Clean GBM', credits: 20, jobs: 1,
    latest_job: { id: 'k', status: 'completed', created_at: '2026-10-11T00:00:00Z', completed_at: '2026-10-11T00:05:00Z', total_rows: 20, review_rows: 0, error_count: 0 } },
  { ...base, id: 'social', name: 'Fictional Social', points: 0 },
];

beforeEach(() => {
  repo.getReadiness.mockResolvedValue({ events, totalEvents: 4, truncated: false, checkedAt: '2026-10-28T12:00:00Z' });
  repo.attest.mockResolvedValue();
});

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><AttendanceReadinessPanel selectedYear={2026} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

it('opens on the work queue, point-earning events only, with House credits and the last clean import', async () => {
  renderPanel();
  const list = await screen.findByRole('list', { name: 'Events' });
  expect(within(list).getByText('Fictional Review GBM')).toBeInTheDocument();
  expect(within(list).getByText('Fictional Pending Mixer')).toBeInTheDocument();
  expect(within(list).queryByText('Fictional Clean GBM')).not.toBeInTheDocument();
  expect(within(list).queryByText('Fictional Social')).not.toBeInTheDocument();
  expect(within(list).getByText(/House credits: Rarity 9/)).toBeInTheDocument();
  expect(screen.getByText(/Last import with nothing left to review/)).toHaveTextContent('Fictional Clean GBM');
  expect(screen.getByText(/2 past events may still change the standings/)).toBeInTheDocument();
  expect(repo.getReadiness).toHaveBeenCalledWith(2026, null);

  await userEvent.selectOptions(screen.getByLabelText('Term'), 'term-f26');
  await waitFor(() => expect(repo.getReadiness).toHaveBeenLastCalledWith(2026, 'term-f26'));
  expect(screen.queryByRole('option', { name: 'Fall 2025' })).not.toBeInTheDocument();
});

it('records "no sign-in" only after confirming, with the note', async () => {
  renderPanel();
  await userEvent.click(await screen.findByRole('button', { name: /Mark: no sign-in for Fictional Pending Mixer/ }));
  expect(repo.attest).not.toHaveBeenCalled();
  const dialog = screen.getByRole('alertdialog');
  await userEvent.type(within(dialog).getByLabelText(/Note/), 'Rained out');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Record' }));
  await waitFor(() => expect(repo.attest).toHaveBeenCalledWith('pending', 'no_signin', 'Rained out'));
  await waitFor(() => expect(repo.getReadiness).toHaveBeenCalledTimes(2));
});

it('never shows a failed read as all done', async () => {
  repo.getReadiness.mockRejectedValue(new Error('network'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent(/rather than a false "all done"/);
  expect(screen.queryByText(/Nothing needs work/)).not.toBeInTheDocument();
});

it('says plainly when the migration is not applied yet', async () => {
  repo.getReadiness.mockRejectedValue(new ValidationError(ATTENDANCE_READINESS_UNAVAILABLE, 'year'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('20261028090000');
});

it('can show every event, including clean ones', async () => {
  renderPanel();
  await userEvent.click(await screen.findByRole('button', { name: /^All \(3\)/ }));
  const list = screen.getByRole('list', { name: 'Events' });
  expect(within(list).getByText('Fictional Clean GBM')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: /Point-earning events only/ }));
  expect(await within(screen.getByRole('list', { name: 'Events' })).findByText('Fictional Social')).toBeInTheDocument();
});
