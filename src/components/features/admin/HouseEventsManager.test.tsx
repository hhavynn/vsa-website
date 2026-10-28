/**
 * Admin → Houses → House Events (#631). What matters: no House is ever chosen
 * for the admin, a new event is a draft unless published on purpose, and the
 * save goes through the atomic database function with one request id per form
 * (so a retry cannot duplicate) and the loaded updated_at on edits.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { HouseEventsManager } from './HouseEventsManager';
import { houseEventsRepository } from '../../../data/repos/houseEvents';
import type { HousePageAsset } from '../../../types';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../hooks/useAcademicTerms', () => ({ useAcademicTerms: () => ({ terms: [] }) }));
jest.mock('../../../hooks/useHouseAssets', () => ({ useAdminHouseAssets: jest.fn() }));
jest.mock('../../../data/repos/houseEvents', () => ({
  houseEventsRepository: { getAdminEvents: jest.fn(), saveEventAtomic: jest.fn(), createEvent: jest.fn(), updateEvent: jest.fn(), deleteEvent: jest.fn() },
}));
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => { throw new Error('components must not query Supabase directly'); }) },
}));

const { useAdminHouseAssets } = jest.requireMock('../../../hooks/useHouseAssets');
const repo = houseEventsRepository as jest.Mocked<typeof houseEventsRepository>;
const profiles = [
  { id: 'hp-twilight', house: 'twilight', house_key: 'twilight', display_name: 'Twilight Sparkle', academic_year_start: 2026, academic_year_end: 2027, is_active: true, accent_color: '#7b5ea7' },
  { id: 'hp-rarity', house: 'rarity', house_key: 'rarity', display_name: 'Rarity', academic_year_start: 2026, academic_year_end: 2027, is_active: true, accent_color: '#6b8fd6' },
] as HousePageAsset[];

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => `uuid-${Math.random()}` }, configurable: true });
  }
});

beforeEach(() => {
  useAdminHouseAssets.mockReturnValue({ assets: profiles });
  repo.getAdminEvents.mockResolvedValue([]);
  repo.saveEventAtomic.mockResolvedValue({ id: 'ev-1' } as never);
});

function renderManager() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HouseEventsManager selectedYear={2026} onYearChange={jest.fn()} />
    </QueryClientProvider>,
  );
}

it('starts with no House chosen and as a draft, and saves through the atomic function', async () => {
  renderManager();
  expect(screen.getByText(/\(none chosen yet\)/)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /Publish now/ })).not.toBeChecked();

  await userEvent.type(screen.getByLabelText('Title *'), 'Fictional Movie Night');
  await userEvent.type(screen.getByLabelText('Date *'), '2026-11-14');
  await userEvent.click(screen.getByRole('button', { name: /Rarity/ }));
  await userEvent.click(screen.getByRole('button', { name: /Twilight Sparkle/ }));
  expect(screen.getByText(/primary host: Rarity/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Create|Save|Add/ }));

  await waitFor(() => expect(repo.saveEventAtomic).toHaveBeenCalledTimes(1));
  const input = repo.saveEventAtomic.mock.calls[0][0];
  expect(input.eventId).toBeNull();
  expect(input.expectedUpdatedAt).toBeNull();
  expect(typeof input.requestId).toBe('string');
  expect(input.formData).toMatchObject({ house_profile_id: 'hp-rarity', house_ids: ['hp-rarity', 'hp-twilight'], is_published: false, academic_year_start: 2026 });
  expect(repo.createEvent).not.toHaveBeenCalled();
});

it('refuses to save without a House instead of choosing one', async () => {
  renderManager();
  await userEvent.type(screen.getByLabelText('Title *'), 'No House Night');
  await userEvent.type(screen.getByLabelText('Date *'), '2026-11-14');
  await userEvent.click(screen.getByRole('button', { name: /Create|Save|Add/ }));
  expect(repo.saveEventAtomic).not.toHaveBeenCalled();
});

it('falls back to the previous save only when the database does not have the function yet', async () => {
  repo.saveEventAtomic.mockResolvedValue(false);
  repo.createEvent.mockResolvedValue({ id: 'ev-legacy' } as never);
  renderManager();
  await userEvent.type(screen.getByLabelText('Title *'), 'Legacy Night');
  await userEvent.type(screen.getByLabelText('Date *'), '2026-11-14');
  await userEvent.click(screen.getByRole('button', { name: /Rarity/ }));
  await userEvent.click(screen.getByRole('button', { name: /Create|Save|Add/ }));
  await waitFor(() => expect(repo.createEvent).toHaveBeenCalledTimes(1));
  expect(repo.createEvent.mock.calls[0][0]).toMatchObject({ is_published: false });
});
