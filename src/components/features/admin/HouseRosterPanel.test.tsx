/**
 * Private House roster (#652). What matters: names only (no contact details),
 * House-credited and all VSA attendance shown separately, filters that never
 * hide the counts they claim, a transfer flagged, the per-event drilldown
 * saying why an attendance did not count, an invitation list that is local and
 * unsaved, a failed read never shown as an empty House, and only admin RPCs.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { HouseRosterPanel } from './HouseRosterPanel';
import { HOUSE_ROSTER_UNAVAILABLE, RosterMember, houseRosterRepository } from '../../../data/repos/houseRoster';
import { ValidationError } from '../../../data/errors';

jest.mock('../../../data/repos/houseRoster', () => ({
  ...jest.requireActual('../../../data/repos/houseRoster'),
  houseRosterRepository: { getRoster: jest.fn(), getMemberAttendance: jest.fn() },
}));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const repo = houseRosterRepository as jest.Mocked<typeof houseRosterRepository>;
const member = (extra: Partial<RosterMember>): RosterMember => ({
  member_id: 'm', first_name: 'Fictional', last_name: 'Person', start_date: '2026-09-20', end_date: null, stints: 1, joined_in_period: false,
  other_house_memberships: 0, credited_attendance: 0, last_credited_at: null, events_attended: 0, ...extra,
});

beforeEach(() => {
  repo.getRoster.mockResolvedValue({
    house: { id: 'hp-r', displayName: 'Fictional Rarity', isActive: true, academicYearStart: 2026 },
    termLabel: null,
    dated: true,
    members: [
      member({ member_id: 'a', first_name: 'Ana', last_name: 'Example', credited_attendance: 3, events_attended: 4, last_credited_at: '2026-10-20T02:00:00Z' }),
      member({ member_id: 'b', first_name: 'Bao', last_name: 'Example', joined_in_period: true, start_date: '2026-10-15', events_attended: 1 }),
      member({ member_id: 'c', first_name: 'Cam', last_name: 'Example', other_house_memberships: 1, end_date: '2026-11-01', credited_attendance: 1 }),
    ],
    checkedAt: '2026-10-28T12:00:00Z',
  });
  repo.getMemberAttendance.mockResolvedValue([
    { event_id: 'e1', name: 'Fictional GBM 1', date: '2026-10-01T02:00:00Z', term_label: 'Fall 2026', points_earned: 1, house_name: null, reason: 'before_house_start' },
    { event_id: 'e2', name: 'Fictional GBM 2', date: '2026-10-20T02:00:00Z', term_label: 'Fall 2026', points_earned: 1, house_name: 'Fictional Rarity', reason: 'counted' },
  ]);
});

function renderPanel(onClose = jest.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><HouseRosterPanel houseProfileId="hp-r" termId={null} onClose={onClose} /></MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

it('lists members with House-credited and all VSA attendance separately, and flags a transfer', async () => {
  renderPanel();
  const list = await screen.findByRole('list', { name: 'Members' });
  expect(within(list).getByText(/3 House-credited · 4 VSA events/)).toBeInTheDocument();
  expect(within(list).getByText(/0 House-credited · 1 VSA event ·/)).toBeInTheDocument();
  expect(within(list).getByText(/Also in 1 other House this year/)).toBeInTheDocument();
  expect(repo.getRoster).toHaveBeenCalledWith('hp-r', null);
});

it('filters and searches, with counts that match', async () => {
  renderPanel();
  await screen.findByRole('list', { name: 'Members' });
  await userEvent.click(screen.getByRole('button', { name: 'No House-credited attendance yet (1)' }));
  let list = screen.getByRole('list', { name: 'Members' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(within(list).getByRole('checkbox', { name: /Bao Example/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Everyone (3)' }));
  await userEvent.type(screen.getByLabelText('Find a member'), 'cam');
  list = screen.getByRole('list', { name: 'Members' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
});

it('explains per event why attendance did or did not count', async () => {
  renderPanel();
  await userEvent.click(await screen.findByRole('button', { name: 'Events for Bao Example' }));
  const events = await screen.findByRole('list', { name: 'Events attended' });
  expect(within(events).getByText('Before their House start date')).toBeInTheDocument();
  expect(within(events).getByText('Counted for Fictional Rarity')).toBeInTheDocument();
  expect(repo.getMemberAttendance).toHaveBeenCalledWith('b', 2026);
});

it('keeps an unsaved invitation list and copies names only', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  renderPanel();
  await userEvent.click(await screen.findByRole('checkbox', { name: /Bao Example/ }));
  expect(screen.getByText(/Invitation list: 1 member\. Only you can see it, and it is not saved/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Copy names' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Bao Example'));
});

it('never shows a failed read as an empty House, and explains a missing migration', async () => {
  repo.getRoster.mockRejectedValueOnce(new Error('network'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent(/rather than an empty House/);
});

it('says plainly when the migration is not applied', async () => {
  repo.getRoster.mockRejectedValueOnce(new ValidationError(HOUSE_ROSTER_UNAVAILABLE, 'house'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('20261028110000');
});

it('says plainly when the House profile is not public, so zeros are not read as absence', async () => {
  repo.getRoster.mockResolvedValue({
    house: { id: 'hp-p', displayName: 'Fictional Pinkie', isActive: false, academicYearStart: 2026 },
    termLabel: null, dated: true,
    members: [member({ member_id: 'x', first_name: 'Xu', last_name: 'Example', events_attended: 6 })],
    checkedAt: '2026-10-28T12:00:00Z',
  });
  renderPanel();
  expect(await screen.findByRole('note')).toHaveTextContent(/zeros below do not mean nobody came/);
  expect(screen.queryByRole('button', { name: /No House-credited attendance yet/ })).not.toBeInTheDocument();
});

it('shows the names to copy by hand when the clipboard is blocked', async () => {
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
  renderPanel();
  await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Example/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Copy names' }));
  expect(await screen.findByRole('textbox', { name: 'Invitation names' })).toHaveValue('Ana Example');
});

it('shows the UTC date an evening event was counted on', async () => {
  repo.getMemberAttendance.mockResolvedValue([
    { event_id: 'e3', name: 'Fictional Night GBM', date: '2026-10-16T02:00:00Z', term_label: 'Fall 2026', points_earned: 1, house_name: 'Fictional Rarity', reason: 'counted' },
  ]);
  renderPanel();
  await userEvent.click(await screen.findByRole('button', { name: 'Events for Ana Example' }));
  expect(await screen.findByText(/Oct 15 \(counted as Oct 16, by UTC date\)/)).toBeInTheDocument();
});
