/**
 * Admin → Houses → House Events dashboard (#636), through the manager that owns
 * the writes. What matters: Publish/Unpublish never happens without a
 * confirmation and keeps the host Houses; Duplicate makes a new draft (no id,
 * not published); a collab event is listed once and found under each host;
 * drafts stay out of Upcoming; a failed load keeps what the admin typed.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { HouseEventsManager } from './HouseEventsManager';
import { houseEventsRepository } from '../../../data/repos/houseEvents';
import type { HouseEvent, HousePageAsset } from '../../../types';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../hooks/useAcademicTerms', () => ({ useAcademicTerms: () => ({ terms: [] }) }));
jest.mock('../../../hooks/useHouseAssets', () => ({ useAdminHouseAssets: jest.fn() }));
jest.mock('../../../utils/losAngelesDate', () => ({ getLosAngelesDateOnly: () => '2026-11-10' }));
jest.mock('../../../data/repos/houseEvents', () => ({
  ADMIN_HOUSE_EVENT_LIMIT: 500,
  houseEventsRepository: { getAdminEvents: jest.fn(), saveEventAtomic: jest.fn(), createEvent: jest.fn(), updateEvent: jest.fn(), deleteEvent: jest.fn() },
}));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const { useAdminHouseAssets } = jest.requireMock('../../../hooks/useHouseAssets');
const repo = houseEventsRepository as jest.Mocked<typeof houseEventsRepository>;
const twilight = { id: 'hp-twilight', house: 'twilight', house_key: 'twilight', display_name: 'Twilight Sparkle', academic_year_start: 2026, academic_year_end: 2027, is_active: true } as HousePageAsset;
const rarity = { id: 'hp-rarity', house: 'rarity', house_key: 'rarity', display_name: 'Rarity', academic_year_start: 2026, academic_year_end: 2027, is_active: true } as HousePageAsset;

function event(id: string, extra: Partial<HouseEvent> = {}): HouseEvent {
  return {
    id,
    house_profile_id: twilight.id,
    academic_year_start: 2026,
    academic_year_end: 2027,
    title: `Fictional ${id}`,
    description: null,
    event_date: '2026-11-20',
    start_time: '18:00:00',
    end_time: '20:00:00',
    location: 'Fictional Hall',
    image_url: null,
    image_thumbnail_url: null,
    gallery_url: null,
    recap_url: null,
    rsvp_url: 'https://example.org/rsvp',
    google_calendar_enabled: true,
    is_published: true,
    updated_at: '2026-11-01T00:00:00Z',
    houses: [twilight],
    ...extra,
  } as HouseEvent;
}

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => `uuid-${Math.random()}` }, configurable: true });
  }
});

beforeEach(() => {
  useAdminHouseAssets.mockReturnValue({ assets: [twilight, rarity] });
  repo.getAdminEvents.mockResolvedValue([]);
  repo.saveEventAtomic.mockImplementation(async ({ eventId }) => event(eventId ?? 'new'));
});

function renderManager() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HouseEventsManager selectedYear={2026} onYearChange={jest.fn()} />
    </QueryClientProvider>,
  );
}

const list = (name: RegExp) => screen.findByRole('list', { name });

it('lists a collab event once and finds it under each host House, and keeps drafts out of Upcoming', async () => {
  repo.getAdminEvents.mockResolvedValue([event('collab', { houses: [twilight, rarity] }), event('solo'), event('draft', { is_published: false })]);
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Upcoming \(2\)/ }));
  const upcoming = await list(/Upcoming House events/);
  expect(within(upcoming).getAllByText('Fictional collab')).toHaveLength(1);
  expect(within(upcoming).queryByText('Fictional draft')).not.toBeInTheDocument();

  await userEvent.selectOptions(screen.getByLabelText('Host House'), 'hp-rarity');
  const rarityOnly = await list(/Upcoming House events/);
  expect(within(rarityOnly).getByText('Fictional collab')).toBeInTheDocument();
  expect(within(rarityOnly).queryByText('Fictional solo')).not.toBeInTheDocument();
});

it('publishes only after confirming, keeping the host Houses and the loaded version', async () => {
  repo.getAdminEvents.mockResolvedValue([event('draft', { is_published: false, houses: [twilight, rarity] })]);
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Drafts/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Publish Fictional draft' }));
  expect(repo.saveEventAtomic).not.toHaveBeenCalled();

  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByText(/Twilight Sparkle \+ Rarity/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

  await waitFor(() => expect(repo.saveEventAtomic).toHaveBeenCalledTimes(1));
  expect(repo.saveEventAtomic.mock.calls[0][0]).toMatchObject({
    eventId: 'draft',
    formData: { is_published: true, house_ids: ['hp-twilight', 'hp-rarity'] },
    expectedUpdatedAt: '2026-11-01T00:00:00Z',
  });
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
});

it('unpublishes with a plain update that leaves the host Houses alone', async () => {
  repo.getAdminEvents.mockResolvedValue([event('live', { houses: [twilight, rarity] })]);
  repo.updateEvent.mockResolvedValue(event('live', { is_published: false }));
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Upcoming/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Unpublish Fictional live' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Unpublish' }));
  await waitFor(() => expect(repo.updateEvent).toHaveBeenCalledWith('live', { is_published: false }));
  expect(repo.saveEventAtomic).not.toHaveBeenCalled();
});

it('keeps an open edit of the same event in step after publishing it from the list', async () => {
  repo.getAdminEvents.mockResolvedValue([event('draft', { is_published: false })]);
  repo.saveEventAtomic.mockImplementation(async ({ eventId, formData }) =>
    event(eventId ?? 'new', { is_published: !!formData.is_published, updated_at: '2026-11-02T00:00:00Z' }));
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Drafts/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Fictional draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'Publish Fictional draft' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Publish' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

  const form = screen.getByRole('form');
  expect(within(form).getByRole('checkbox', { name: /Publish now/ })).toBeChecked();
  await userEvent.click(within(form).getByRole('button', { name: /Save Changes/ }));
  await waitFor(() => expect(repo.saveEventAtomic).toHaveBeenCalledTimes(2));
  // The form save carries the version the publish returned, not the stale one.
  expect(repo.saveEventAtomic.mock.calls[1][0]).toMatchObject({ eventId: 'draft', expectedUpdatedAt: '2026-11-02T00:00:00Z' });
});

it('clears the host filter when the year changes', async () => {
  repo.getAdminEvents.mockResolvedValue([event('solo')]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { rerender } = render(
    <QueryClientProvider client={client}><HouseEventsManager selectedYear={2026} onYearChange={jest.fn()} /></QueryClientProvider>,
  );
  await userEvent.selectOptions(await screen.findByLabelText('Host House'), 'hp-rarity');
  rerender(<QueryClientProvider client={client}><HouseEventsManager selectedYear={2025} onYearChange={jest.fn()} /></QueryClientProvider>);
  expect(screen.getByLabelText('Host House')).toHaveValue('');
});

it('cancelling the confirmation changes nothing', async () => {
  repo.getAdminEvents.mockResolvedValue([event('live')]);
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Upcoming/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Unpublish Fictional live' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(repo.saveEventAtomic).not.toHaveBeenCalled();
  expect(repo.updateEvent).not.toHaveBeenCalled();
});

it('shows a failed publish in the dialog instead of closing it', async () => {
  repo.getAdminEvents.mockResolvedValue([event('draft', { is_published: false })]);
  repo.saveEventAtomic.mockRejectedValue(new Error('Someone else changed this event after you opened it.'));
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Drafts/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Publish Fictional draft' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Publish' }));
  expect(await within(screen.getByRole('alertdialog')).findByText(/Someone else changed this event/)).toBeInTheDocument();
});

it('refuses to publish an event with no host House', async () => {
  repo.getAdminEvents.mockResolvedValue([event('orphan', { is_published: false, houses: [] })]);
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: 'Publish Fictional orphan' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Publish' }));
  expect(await within(screen.getByRole('alertdialog')).findByText(/Link a host House/)).toBeInTheDocument();
  expect(repo.saveEventAtomic).not.toHaveBeenCalled();
  expect(repo.updateEvent).not.toHaveBeenCalled();
});

it('duplicates as a new unpublished draft without the image, saved as a new event', async () => {
  repo.getAdminEvents.mockResolvedValue([event('live', { image_url: 'https://example.org/a.jpg', houses: [twilight, rarity] })]);
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Upcoming/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Duplicate Fictional live as a draft' }));

  const form = screen.getByRole('form');
  expect(within(form).getByLabelText('Title *')).toHaveValue('Fictional live (copy)');
  expect(within(form).getByRole('checkbox', { name: /Publish now/ })).not.toBeChecked();
  await userEvent.click(within(form).getByRole('button', { name: /Create House Event/ }));

  await waitFor(() => expect(repo.saveEventAtomic).toHaveBeenCalledTimes(1));
  const input = repo.saveEventAtomic.mock.calls[0][0];
  expect(input.eventId).toBeNull();
  expect(input.formData).toMatchObject({ is_published: false, image_url: null, house_ids: ['hp-twilight', 'hp-rarity'] });
});

it('asks before replacing unsaved form edits', async () => {
  repo.getAdminEvents.mockResolvedValue([event('live')]);
  renderManager();
  const title = () => within(screen.getByRole('form')).getByLabelText('Title *');
  await userEvent.type(title(), 'Half-typed idea');
  await userEvent.click(await screen.findByRole('button', { name: /^Upcoming/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Fictional live' }));

  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(title()).toHaveValue('Half-typed idea');

  await userEvent.click(screen.getByRole('button', { name: 'Edit Fictional live' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }));
  await waitFor(() => expect(title()).toHaveValue('Fictional live'));
});

it('keeps typed form input when the list fails to load, and offers a retry', async () => {
  repo.getAdminEvents.mockRejectedValue(new Error('network'));
  renderManager();
  await userEvent.type(within(screen.getByRole('form')).getByLabelText('Title *'), 'Kept text');
  expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  repo.getAdminEvents.mockResolvedValue([event('back')]);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(repo.getAdminEvents).toHaveBeenCalledTimes(2));
  expect(within(screen.getByRole('form')).getByLabelText('Title *')).toHaveValue('Kept text');
});

it('previews a draft as its public card and says the public cannot see it', async () => {
  repo.getAdminEvents.mockResolvedValue([event('draft', { is_published: false })]);
  renderManager();
  await userEvent.click(await screen.findByRole('button', { name: /^Drafts/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Preview Fictional draft' }));
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByText(/the public cannot see it/)).toBeInTheDocument();
  expect(within(dialog).getByText('Fictional draft')).toBeInTheDocument();
});
