/**
 * Admin → Houses → Overview (#651). What matters: Houses come from the year's
 * profiles (not hardcoded names), participation is out of the House's own
 * roster and says so, an empty roster is "—" not 0%, attention items are
 * specific, a failed read never shows zeros, pending imports are flagged
 * because the numbers may be low, and only the admin RPCs are called.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { HouseOverviewPanel } from './HouseOverviewPanel';
import { HOUSE_OVERVIEW_UNAVAILABLE, HouseOverviewHouse, houseOverviewRepository } from '../../../data/repos/houseOverview';
import { attendanceReadinessRepository } from '../../../data/repos/attendanceReadiness';
import { ValidationError } from '../../../data/errors';

jest.mock('../../../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [{ id: 'term-f26', label: 'Fall 2026', academic_year_start: 2026 }] }),
}));
jest.mock('../../../data/repos/houseOverview', () => ({
  ...jest.requireActual('../../../data/repos/houseOverview'),
  houseOverviewRepository: { getOverview: jest.fn() },
}));
jest.mock('../../../data/repos/attendanceReadiness', () => ({
  ...jest.requireActual('../../../data/repos/attendanceReadiness'),
  attendanceReadinessRepository: { getReadiness: jest.fn(), attest: jest.fn() },
}));
jest.mock('./HouseRosterPanel', () => ({
  HouseRosterPanel: ({ houseProfileId, onClose }: { houseProfileId: string; onClose: () => void }) => (
    <section aria-label="roster stub">roster for {houseProfileId}<button type="button" onClick={onClose}>Close roster</button></section>
  ),
}));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const overviewRepo = houseOverviewRepository as jest.Mocked<typeof houseOverviewRepository>;
const readinessRepo = attendanceReadinessRepository as jest.Mocked<typeof attendanceReadinessRepository>;

const house = (extra: Partial<HouseOverviewHouse>): HouseOverviewHouse => ({
  house_profile_id: 'hp', house_key: 'k', display_name: 'House', accent_color: null, is_active: true,
  roster_members: 20, joined_in_window: null, participating_members: 15, credited_attendance: 40,
  window_latest_activity_at: '2026-10-20T02:00:00Z', year_total_points: 40, year_unique_members: 15,
  year_latest_activity_at: '2026-10-20T02:00:00Z', rank: 1, matches_view: true, parents_listed: 2, parents_linked: 2,
  hosted_events: 3, overlapping_members: 0, ...extra,
});

beforeEach(() => {
  overviewRepo.getOverview.mockResolvedValue({
    houses: [
      house({ house_profile_id: 'a', display_name: 'Fictional Twilight', rank: 1 }),
      house({ house_profile_id: 'b', display_name: 'Fictional Rarity', rank: 2, participating_members: 5, parents_linked: 1 }),
      house({ house_profile_id: 'c', display_name: 'Fictional Applejack', roster_members: 0, participating_members: 0, credited_attendance: 0, year_total_points: null, rank: null, parents_listed: 0, parents_linked: 0 }),
      house({ house_profile_id: 'd', display_name: 'Fictional Pinkie', is_active: false, rank: null, roster_members: 12, participating_members: 0, matches_view: false }),
    ],
    window: { termId: null, termLabel: null, startsOn: null, endsOn: null, dated: true },
    distinctHouseEvents: 5,
    checkedAt: '2026-10-28T12:00:00Z',
  });
  readinessRepo.getReadiness.mockResolvedValue({ events: [], totalEvents: 0, truncated: false, checkedAt: '2026-10-28T12:00:00Z' });
});

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><HouseOverviewPanel selectedYear={2026} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

it('shows one card per year profile with participation out of its own roster and specific attention items', async () => {
  renderPanel();
  const cards = await screen.findByRole('list', { name: 'Houses' });
  expect(within(cards).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Fictional Twilight', 'Fictional Rarity', 'Fictional Applejack', 'Fictional Pinkie']);
  expect(within(cards).getByText('15 · 75%')).toBeInTheDocument();
  // An empty roster is "—", never 0%.
  expect(within(cards).getByText('0 · —')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Needs attention: Fictional Rarity' })).toHaveTextContent('15 members have no House-credited attendance');
  expect(screen.getByRole('list', { name: 'Needs attention: Fictional Rarity' })).toHaveTextContent('1 House Parent is not linked');
  expect(screen.getByRole('list', { name: 'Needs attention: Fictional Applejack' })).toHaveTextContent('No House Parents listed');
  expect(screen.getByRole('list', { name: 'Needs attention: Fictional Pinkie' })).toHaveTextContent('Profile not public yet');
  expect(screen.getByRole('list', { name: 'Needs attention: Fictional Pinkie' })).toHaveTextContent('disagree with the standings view');
  expect(screen.getByText(/5 published House events in this period/)).toBeInTheDocument();
  expect(screen.getByText(/Every past point-earning event in this period is imported/)).toBeInTheDocument();
});

it('warns that numbers may be low while imports are pending', async () => {
  readinessRepo.getReadiness.mockResolvedValue({
    events: [{
      id: 'e', name: 'Fictional GBM', date: '2026-10-20T02:00:00Z', event_type: 'gbm', points: 1, is_published: true,
      academic_term_id: 'term-f26', term_label: 'Fall 2026', credits: 0, scoring_credits: 0, last_credit_at: null, jobs: 0,
      latest_job: null, open_review_rows: 0, reconciled_at: null, reconciliation_pending_rows: 0, attestation: null, house_credits: [],
    }],
    totalEvents: 1, truncated: false, checkedAt: '2026-10-28T12:00:00Z',
  });
  renderPanel();
  expect(await screen.findByText(/1 past point-earning event is not fully imported or checked/)).toBeInTheDocument();
});

it('scopes to a term and asks both reads for it', async () => {
  renderPanel();
  await screen.findByRole('list', { name: 'Houses' });
  await userEvent.selectOptions(screen.getByLabelText('Period'), 'term-f26');
  await waitFor(() => expect(overviewRepo.getOverview).toHaveBeenLastCalledWith(2026, 'term-f26'));
  expect(readinessRepo.getReadiness).toHaveBeenLastCalledWith(2026, 'term-f26');
});

it('never shows zeros for a failed read, and explains a missing migration', async () => {
  overviewRepo.getOverview.mockRejectedValueOnce(new Error('network'));
  const { unmount } = renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent(/Nothing is shown rather than zeros/);
  expect(screen.queryByRole('list', { name: 'Houses' })).not.toBeInTheDocument();
  unmount();
  overviewRepo.getOverview.mockRejectedValueOnce(new ValidationError(HOUSE_OVERVIEW_UNAVAILABLE, 'year'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('20261028075724');
});

it('says when the import status could not be checked', async () => {
  readinessRepo.getReadiness.mockRejectedValue(new Error('network'));
  renderPanel();
  expect(await screen.findByText(/Event import status could not be checked/)).toBeInTheDocument();
});

it('flags an undated term, and never rounds to 100% or 0% when that is not exact', async () => {
  overviewRepo.getOverview.mockResolvedValue({
    houses: [
      house({ house_profile_id: 'a', display_name: 'Fictional Almost', roster_members: 300, participating_members: 299 }),
      house({ house_profile_id: 'b', display_name: 'Fictional Barely', roster_members: 250, participating_members: 1 }),
    ],
    window: { termId: 'term-f26', termLabel: 'Spring 2025', startsOn: null, endsOn: null, dated: false },
    distinctHouseEvents: 0,
    checkedAt: '2026-10-28T12:00:00Z',
  });
  renderPanel();
  expect(await screen.findByRole('note')).toHaveTextContent('Spring 2025 has no start and end dates');
  const cards = screen.getByRole('list', { name: 'Houses' });
  expect(within(cards).getByText('299 · 99%')).toBeInTheDocument();
  expect(within(cards).getByText('1 · <1%')).toBeInTheDocument();
});

it('does not vouch for imports when the status read was cut off', async () => {
  readinessRepo.getReadiness.mockResolvedValue({ events: [], totalEvents: 900, truncated: true, checkedAt: '2026-10-28T12:00:00Z' });
  renderPanel();
  expect(await screen.findByText(/Event import status could not be checked/)).toBeInTheDocument();
  expect(screen.queryByText(/Every past point-earning event/)).not.toBeInTheDocument();
});

it('opens and closes one House roster from its card', async () => {
  renderPanel();
  await userEvent.click(await screen.findByRole('button', { name: 'Open roster for Fictional Rarity' }));
  expect(screen.getByRole('region', { name: 'roster stub' })).toHaveTextContent('roster for b');
  expect(screen.getByRole('button', { name: 'Hide roster for Fictional Rarity' })).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Close roster' }));
  expect(screen.queryByRole('region', { name: 'roster stub' })).not.toBeInTheDocument();
});
