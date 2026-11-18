/**
 * Admin → Houses → Points check (#622): a read-only measurement. What matters:
 * flagged findings link to the page that fixes them, expected outcomes are not
 * alarms, a failed or unavailable check is never shown as clean, and nothing
 * computes points in the browser (one RPC, no table reads).
 */
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HousePointsCheckPanel } from './HousePointsCheckPanel';
import { supabaseMock } from '../../../test-utils/supabaseMock';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

const RPC = 'rpc:admin_house_points_reconciliation';
const summary = {
  academic_year_start: 2026, year_credits: 6, credits_earning_house_points: 3, credits_member_has_no_house_this_year: 1,
  credits_outside_membership_interval: 1, credits_before_house_start: 1, credits_event_without_term_near_year: 2,
  credits_on_inactive_house_profile: 0, credits_attributed_to_two_houses: 0, overlapping_memberships: 0,
  members_transferred_this_year: 1, future_dated_memberships: 0, pacific_vs_utc_boundary_credits: 1,
  house_member_vs_house_total_mismatch: 0, recomputed_vs_view_mismatch: 0,
};

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><HousePointsCheckPanel selectedYear={2026} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => supabaseMock.reset());

it('flags findings with a link to fix them, keeps expected outcomes calm, and reads only through the RPC', async () => {
  supabaseMock.queueResult(RPC, {
    data: { summary, houses: [{ house_profile_id: 'h1', display_name: 'Twilight Sparkle', view_house_points: 2, view_member_points_sum: 2, membership_rows: 2 }], checked_at: '2026-10-28T06:00:00Z' },
    error: null,
  });
  renderPanel();
  const findings = await screen.findByRole('list', { name: 'Reconciliation findings' });
  const item = (text: string) => within(findings).getAllByRole('listitem').find((li) => li.textContent?.includes(text)) as HTMLElement;
  const noTerm = item('Credits on events with no academic term');
  expect(noTerm).toHaveTextContent('Investigate');
  expect(within(noTerm).getByRole('link', { name: 'Open Events' })).toHaveAttribute('href', '/admin/events');
  const beforeStart = item('Credits before the member’s House start date');
  expect(beforeStart).toHaveTextContent('Expected');
  expect(within(beforeStart).queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Twilight Sparkle');
  expect(supabaseMock.queries().map((query) => query.table)).toEqual([RPC]);
  expect(supabaseMock.queriesFor(RPC)[0].calls[0].args[0]).toEqual({ p_year: 2026 });
});

it('never shows a failed check as clean', async () => {
  supabaseMock.queueResult(RPC, { data: null, error: { code: '57014', message: 'statement timeout', details: '', hint: '' } });
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('nothing is shown rather than a false all-clear');
  expect(screen.queryByRole('list', { name: 'Reconciliation findings' })).not.toBeInTheDocument();
});

it('says the check is unavailable before its migration is applied', async () => {
  supabaseMock.queueResult(RPC, { data: null, error: { code: 'PGRST202', message: 'not found', details: '', hint: '' } });
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('migration 20261028070000');
});
