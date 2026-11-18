/**
 * House events in /events Upcoming (#634). What matters: published House events
 * are read (the old call passed the row limit as the academic year, so none
 * ever showed), merged in date/time order with regular events, listed once per
 * collab with every host, linked to their own card; the House filter and host
 * live in the URL; and a failed House read leaves the regular events usable.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Events } from './Events';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { supabaseMock } from '../test-utils/supabaseMock';
import { Event } from '../types';
import { losAngelesDateTimeToIso } from '../utils/losAngelesDate';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));
jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({
    terms: [{ id: 'term-f26', code: 'F26', label: 'Fall 2026', academic_year_start: 2026, academic_year_end: 2027, is_active: true, starts_on: '2026-09-20', ends_on: '2026-12-15', display_order: 1 }],
    loading: false,
    error: null,
  }),
}));
jest.mock('../hooks/useExternalEvents', () => ({ useLinkedExternalListings: () => new Map() }));

const regular: Event[] = [
  { id: 'evt-gbm', name: 'Fictional GBM', description: '', date: '2026-10-23', start_time: '18:00:00', end_time: '20:00:00', end_date: null, location: 'Price Center', points: 1, event_type: 'gbm', image_url: null, thumbnail_url: null, is_published: true, academic_term_id: 'term-f26' } as Event,
];
jest.mock('../hooks/useEvents', () => ({
  useEvents: () => ({ events: regular, loading: false, error: null }),
  usePublishedPastEventArchiveAvailability: () => ({ data: { termIds: [], hasUnassignedEvents: false }, isLoading: false, error: null }),
  useInfiniteEvents: () => ({ data: { pages: [[]] }, isLoading: false, error: null, hasNextPage: false, fetchNextPage: () => undefined, isFetchingNextPage: false }),
}));

const rarity = { id: 'hp-rarity', house: 'rarity', house_key: 'rarity', display_name: 'Rarity', academic_year_start: 2026, academic_year_end: 2027, accent_color: '#6b8fd6', is_active: true };
const applejack = { id: 'hp-applejack', house: 'applejack', house_key: 'applejack', display_name: 'Applejack', academic_year_start: 2026, academic_year_end: 2027, accent_color: '#e8a33d', is_active: true };
const houseRow = (id: string, date: string, hosts: object[], title: string) => ({
  id, house_profile_id: 'hp-rarity', academic_year_start: 2026, academic_year_end: 2027, title, slug: id, description: null,
  event_date: date, start_time: '17:00:00', end_time: '19:00:00', location: 'Fictional Lawn', image_url: null, image_thumbnail_url: null,
  gallery_url: null, recap_url: null, rsvp_url: null, google_calendar_enabled: true, is_published: true,
  houses: hosts.map((house) => ({ house_page_asset_id: (house as { id: string }).id })),
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location" data-key={location.key}>{location.search}</output>;
}

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Events />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setDefault('published_house_page_assets', { data: [rarity, applejack], error: null });
  jest.useFakeTimers();
  jest.setSystemTime(new Date(losAngelesDateTimeToIso('2026-10-20', '12:00')));
  supabaseMock.setDefault('house_events', {
    data: [
      houseRow('he-collab', '2026-10-21', [rarity, applejack], 'Fictional Pony Picnic'),
      houseRow('he-solo', '2026-10-25', [applejack], 'Fictional Apple Bake'),
    ],
    error: null,
  });
});

afterEach(() => jest.useRealTimers());

it('reads published House events without a bogus year filter and merges them in time order', async () => {
  renderAt('/events');
  const collab = await screen.findByRole('link', { name: /House event.*Rarity.*Applejack.*Fictional Pony Picnic.*Wed, Oct 21, 2026/ });
  expect(collab).toHaveAttribute('href', '/house/year/2026-2027/rarity#house-event-he-collab');
  // The mobile glance intentionally repeats the featured event title; verify the real House card and glance separately.
  expect(within(collab).getByText('Fictional Pony Picnic')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Next upcoming event' })).toHaveTextContent('Fictional Pony Picnic');

  // The Oct 21 House event is Next Up, ahead of the Oct 23 GBM; the Oct 25 one follows it.
  const text = document.body.textContent ?? '';
  expect(text.indexOf('Fictional Pony Picnic')).toBeLessThan(text.indexOf('Fictional GBM'));
  expect(text.indexOf('Fictional GBM')).toBeLessThan(text.indexOf('Fictional Apple Bake'));
  expect(screen.getByText(/do not award VSA attendance points/)).toBeInTheDocument();

  expect(supabaseMock.filtersFor('house_events')).toContainEqual(['is_published', true]);
  expect(supabaseMock.filtersFor('house_events').some(([column]) => column === 'academic_year_start')).toBe(false);
});

it('keeps the House filter and host in the URL', async () => {
  renderAt('/events');
  fireEvent.click(await screen.findByRole('button', { name: 'House Events' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?type=house');
  expect(screen.queryByText('Fictional GBM')).not.toBeInTheDocument();

  fireEvent.change(await screen.findByLabelText('Hosted by'), { target: { value: 'rarity' } });
  expect(screen.getByTestId('location')).toHaveTextContent('?type=house&host=rarity');
  expect(screen.getByRole('link', { name: /House event.*Fictional Pony Picnic/ })).toBeInTheDocument();
  expect(screen.queryByText('Fictional Apple Bake')).not.toBeInTheDocument();
});

it('names every host for logged-out visitors, whose profile embed comes back empty', async () => {
  // Anon cannot read house_page_assets; the join still carries the host ids.
  supabaseMock.setDefault('house_events', {
    data: [{ ...houseRow('he-collab', '2026-10-21', [], 'Fictional Pony Picnic'), houses: [
      { house_page_asset_id: 'hp-applejack', house: null },
      { house_page_asset_id: 'hp-rarity', house: null },
    ] }],
    error: null,
  });
  supabaseMock.setDefault('published_house_page_assets', { data: [rarity, applejack], error: null });
  renderAt('/events');
  // Primary host (Rarity) first, both named, linked to the primary's card.
  const link = await screen.findByRole('link', { name: /House event.*Rarity.*Applejack.*Fictional Pony Picnic/ });
  expect(link).toHaveAttribute('href', '/house/year/2026-2027/rarity#house-event-he-collab');
});

it('ignores an unknown host instead of hiding every event', async () => {
  renderAt('/events?type=house&host=not-a-house');
  expect(await screen.findByText('Fictional Apple Bake')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /House event.*Fictional Pony Picnic/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Hosted by')).toHaveValue('');
});

it('does not navigate when the active filter is clicked again', async () => {
  renderAt('/events?type=house');
  await screen.findByText('Fictional Apple Bake');
  const key = screen.getByTestId('location').getAttribute('data-key');
  fireEvent.click(screen.getByRole('button', { name: 'House Events' }));
  expect(screen.getByTestId('location')).toHaveAttribute('data-key', key);
});

it('opens straight onto a shared House filter link', async () => {
  renderAt('/events?type=house&host=applejack');
  expect(await screen.findByText('Fictional Apple Bake')).toBeInTheDocument();
  // The collab is hosted by Applejack too, so it stays.
  expect(screen.getByRole('link', { name: /House event.*Fictional Pony Picnic/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'House Events' })).toHaveAttribute('aria-pressed', 'true');
});

it('still lists regular events when House events fail to load', async () => {
  supabaseMock.setDefault('house_events', { data: null, error: { message: 'boom', code: '500', details: '', hint: '' } });
  renderAt('/events');
  expect(await screen.findByText(/House events could not be loaded right now/)).toBeInTheDocument();
  const nextUp = screen.getAllByText('Fictional GBM');
  expect(nextUp.length).toBeGreaterThan(0);
  expect(within(document.body).queryByText('Fictional Pony Picnic')).not.toBeInTheDocument();
});

it('still lists every event when the House host fallback lookup fails', async () => {
  const lookup = jest.spyOn(houseAssetsRepository, 'getPublishedAssets').mockRejectedValue(new Error('synthetic read failure'));
  try {
    renderAt('/events');
    expect(await screen.findByRole('link', { name: /House event.*Rarity.*Applejack.*Fictional Pony Picnic/ })).toBeInTheDocument();
    expect(lookup).toHaveBeenCalledWith(2026);
    expect(screen.getAllByText('Fictional GBM').length).toBeGreaterThan(0);
    expect(screen.queryByText(/House events could not be loaded right now/)).not.toBeInTheDocument();
  } finally {
    lookup.mockRestore();
  }
});
