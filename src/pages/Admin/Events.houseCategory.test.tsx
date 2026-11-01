/**
 * Admin → Events: House Event category (#630). What matters: choosing House
 * Event opens the shared House event editor (house_events only) instead of the
 * regular form, so no regular `events` row is ever written for a House event;
 * Manage lists the same House event records with hosts and draft state.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminEvents from './Events';
import { houseEventsRepository } from '../../data/repos/houseEvents';

const mockInsert = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }) },
}));
jest.mock('../../hooks/useEvents', () => ({ useEvents: () => ({ events: [], refreshEvents: jest.fn() }) }));
jest.mock('../../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [], loading: false, error: null, refreshTerms: jest.fn() }),
}));
jest.mock('../../hooks/useExternalEvents', () => ({
  useAdminExternalEvents: () => ({ events: [], loading: false, error: null, refreshEvents: jest.fn() }),
}));
jest.mock('../../hooks/useUVSASchools', () => ({
  useAdminUVSASchools: () => ({ schools: [], loading: false, error: null, refreshSchools: jest.fn() }),
}));
jest.mock('../../hooks/useEventRecap', () => ({ useEventRecapEventIds: () => ({ recapEventIds: new Set<string>() }) }));
jest.mock('../../data/repos/academicTerms', () => ({ academicTermsRepository: {} }));
jest.mock('../../data/repos/houseEvents', () => ({ houseEventsRepository: { getAdminEvents: jest.fn() } }));
jest.mock('../../components/features/admin/HouseEventsManager', () => ({
  HouseEventsManager: ({ selectedYear }: { selectedYear: number | null }) => <div data-testid="house-event-editor">House event editor for {selectedYear}</div>,
}));

const repo = houseEventsRepository as jest.Mocked<typeof houseEventsRepository>;

function renderEvents() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><AdminEvents /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  repo.getAdminEvents.mockResolvedValue([
    { id: 'he-1', title: 'Fictional Movie Night', event_date: '2026-11-14', is_published: false, houses: [{ display_name: 'Twilight Sparkle' }, { display_name: 'Rarity' }] },
  ] as never);
});

it('lists House events in Manage with their hosts and draft state, and opens the shared editor', async () => {
  renderEvents();
  const section = await screen.findByRole('region', { name: 'House events' });
  expect(await within(section).findByText('Fictional Movie Night')).toBeInTheDocument();
  expect(section).toHaveTextContent('Twilight Sparkle + Rarity');
  expect(section).toHaveTextContent('Draft');
  expect(section).toHaveTextContent('never award attendance points');
  await userEvent.click(within(section).getByRole('button', { name: 'Open the House event editor' }));
  expect(screen.getByTestId('house-event-editor')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'House Event' })).toBeChecked();
});

it('choosing House Event replaces the regular form, so no regular event can be created for it', async () => {
  renderEvents();
  await userEvent.click(screen.getByRole('button', { name: '+ Create Event' }));
  expect(screen.getByLabelText('Event Type *')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'House Event' }));
  expect(screen.getByTestId('house-event-editor')).toBeInTheDocument();
  expect(screen.queryByLabelText('Event Type *')).not.toBeInTheDocument();
  expect(screen.getByText(/never as a regular VSA event, and they do not award attendance points/)).toBeInTheDocument();
  expect(mockInsert).not.toHaveBeenCalled();
});

it('External Event preselects the External type and General restores the default', async () => {
  renderEvents();
  await userEvent.click(screen.getByRole('button', { name: '+ Create Event' }));
  await userEvent.click(screen.getByRole('radio', { name: 'External Event' }));
  expect(screen.getByLabelText('Event Type *')).toHaveValue('external_event');
  await userEvent.click(screen.getByRole('radio', { name: 'General VSA Event' }));
  expect(screen.getByLabelText('Event Type *')).toHaveValue('other');
});
