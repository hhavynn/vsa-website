/**
 * Home "Next Event" and House events (#634). What matters: the House event is
 * actually read (the old call passed the row limit as the academic year), it
 * links to its own card rather than the generic House page, and it is shown
 * first when it happens before the next all-VSA event.
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThisWeekInVSA } from './ThisWeekInVSA';
import { eventsRepository } from '../../../data/repos/events';
import { houseEventsRepository } from '../../../data/repos/houseEvents';
import { losAngelesDateTimeToIso } from '../../../utils/losAngelesDate';
import type { HouseEvent } from '../../../types';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../../../hooks/useAcademicTerms', () => ({ useAcademicTerms: () => ({ terms: [], loading: false, error: null }) }));
jest.mock('../../../data/repos/events', () => ({ eventsRepository: { getPublicUpcomingPreview: jest.fn() } }));
jest.mock('../../../data/repos/houseEvents', () => ({ houseEventsRepository: { getPublicUpcomingPreview: jest.fn() } }));

const events = eventsRepository as jest.Mocked<typeof eventsRepository>;
const houseEvents = houseEventsRepository as jest.Mocked<typeof houseEventsRepository>;
const rarity = { id: 'hp-rarity', house: 'rarity', house_key: 'rarity', display_name: 'Rarity', academic_year_start: 2026 };
const picnic = {
  id: 'he-1', title: 'Fictional Pony Picnic', event_date: '2026-10-21', start_time: '17:00:00', end_time: '19:00:00',
  academic_year_start: 2026, is_published: true, houses: [rarity],
} as unknown as HouseEvent;
const gbm = { id: 'evt-1', name: 'Fictional GBM', date: '2026-10-23', start_time: '18:00:00', end_time: '20:00:00', end_date: null, event_type: 'gbm', points: 1, location: 'Price Center', image_url: null, thumbnail_url: null };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(losAngelesDateTimeToIso('2026-10-20', '12:00')));
  events.getPublicUpcomingPreview.mockResolvedValue([gbm] as never);
  houseEvents.getPublicUpcomingPreview.mockResolvedValue([picnic]);
});
afterEach(() => jest.useRealTimers());

function renderHome() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><ThisWeekInVSA /></MemoryRouter>
    </QueryClientProvider>,
  );
}

it('reads House events without a year filter and links to the event card, first when it is sooner', async () => {
  renderHome();
  const link = await screen.findByRole('link', { name: /First up: House event · Rarity.*Fictional Pony Picnic/ });
  expect(link).toHaveAttribute('href', '/house/year/2026-2027/rarity#house-event-he-1');
  expect(houseEvents.getPublicUpcomingPreview).toHaveBeenCalledWith('2026-10-20', null, 3);
});

it('labels it as the next House event when the all-VSA event comes first', async () => {
  houseEvents.getPublicUpcomingPreview.mockResolvedValue([{ ...picnic, event_date: '2026-10-28' } as HouseEvent]);
  renderHome();
  expect(await screen.findByRole('link', { name: /Next House event · Rarity.*Fictional Pony Picnic/ })).toBeInTheDocument();
});
