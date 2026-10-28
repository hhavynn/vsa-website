/**
 * House page landing on a linked event (#632 follow-up). What matters: a
 * calendar link to a published event outside the page's bounded lists still
 * lands on that event's card (fetched on its own), and nothing extra is
 * fetched when the event is already listed.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HouseDetail } from './HouseDetail';
import { houseAssetsRepository } from '../data/repos/houseAssets';
import { houseEventsRepository } from '../data/repos/houseEvents';
import type { HouseEvent, HousePageAsset } from '../types';

jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [{ id: 't', academic_year_start: 2026, is_active: true }], loading: false }),
}));
jest.mock('../data/repos/houseAssets', () => ({ houseAssetsRepository: { getPublishedAssets: jest.fn(), getAllPublishedAssets: jest.fn() } }));
jest.mock('../data/repos/houseEvents', () => ({
  houseEventsRepository: { getPublicUpcomingForHouse: jest.fn(), getPublicPastForHouse: jest.fn(), getPublicEventForHouse: jest.fn() },
}));
jest.mock('../utils/losAngelesDate', () => ({
  ...jest.requireActual('../utils/losAngelesDate'),
  getLosAngelesDateOnly: () => '2026-10-28',
}));

const assets = houseAssetsRepository as jest.Mocked<typeof houseAssetsRepository>;
const events = houseEventsRepository as jest.Mocked<typeof houseEventsRepository>;
const rarity = {
  id: 'hp-rarity', academic_year_start: 2026, academic_year_end: 2027, house: 'rarity', house_key: 'rarity', display_name: 'Rarity',
  description: null, image_url: null, image_thumbnail_url: null, image_alt: null, cover_image_url: null, accent_color: '#6b8fd6',
  emoji: null, display_order: 1, is_active: true, house_parent_image_url: null, house_parent_heading: null, house_parent_body: null,
} as unknown as HousePageAsset;
const event = (id: string, date: string, title: string) => ({
  id, house_profile_id: 'hp-rarity', academic_year_start: 2026, academic_year_end: 2027, title, slug: id, description: null,
  event_date: date, start_time: null, end_time: null, location: null, image_url: null, image_thumbnail_url: null, gallery_url: null,
  recap_url: null, rsvp_url: null, google_calendar_enabled: true, is_published: true, houses: [rarity],
}) as unknown as HouseEvent;

beforeEach(() => {
  Element.prototype.scrollIntoView = jest.fn();
  assets.getPublishedAssets.mockResolvedValue([rarity]);
  events.getPublicUpcomingForHouse.mockResolvedValue([event('up-1', '2026-11-05', 'Fictional Upcoming Picnic')]);
  events.getPublicPastForHouse.mockResolvedValue([event('past-1', '2026-10-01', 'Fictional Past Picnic')]);
  events.getPublicEventForHouse.mockResolvedValue(event('old-1', '2026-09-02', 'Fictional Long-Ago Social'));
});

function renderAt(hash: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/house/year/2026-2027/rarity${hash}`]}>
        <Routes><Route path="/house/year/:yearSlug/:houseSlug" element={<HouseDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('fetches and shows a linked event that is outside the bounded lists', async () => {
  renderAt('#house-event-old-1');
  expect(await screen.findByText('Fictional Long-Ago Social')).toBeInTheDocument();
  expect(events.getPublicEventForHouse).toHaveBeenCalledWith('old-1', 'hp-rarity');
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
});

it('does not fetch anything extra when the linked event is already listed', async () => {
  renderAt('#house-event-past-1');
  expect(await screen.findByText('Fictional Past Picnic')).toBeInTheDocument();
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  expect(events.getPublicEventForHouse).not.toHaveBeenCalled();
});
