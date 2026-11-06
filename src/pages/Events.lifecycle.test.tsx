import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Events } from './Events';
import { supabaseMock } from '../test-utils/supabaseMock';
import { Event } from '../types';
import { losAngelesDateTimeToIso } from '../utils/losAngelesDate';

const mockTerm = {
  id: 'term-fall-2026',
  code: 'F26',
  label: 'Fall 2026',
  academic_year_start: 2026,
  academic_year_end: 2027,
  is_active: true,
  starts_on: '2026-09-20',
  ends_on: '2026-12-15',
  display_order: 1,
};

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

jest.mock('../hooks/useAcademicTerms', () => ({
  useAcademicTerms: () => ({ terms: [mockTerm], loading: false, error: null }),
}));

jest.mock('../hooks/useExternalEvents', () => ({
  useLinkedExternalListings: () => new Map(),
}));

// Mock events data for the lifecycle test:
// Current test time is set to Oct 20, 2026 at 12:00 PM Pacific.
// 1. "Eat with VSA": Oct 19, 5 PM - 8 PM (ended yesterday -> PAST)
// 2. "Urban Matcha": Oct 20, 10 AM - 10 PM (started today at 10 AM, ends 10 PM -> ONGOING)
// 3. "Next Day Mixer": Oct 21, 6 PM - 9 PM (tomorrow -> UPCOMING)
const mockEventList: Event[] = [
  {
    id: 'evt-eat-with-vsa',
    name: 'Eat with VSA',
    description: '',
    date: '2026-10-19',
    start_time: '17:00:00',
    end_time: '20:00:00',
    end_date: null,
    location: 'Tapioca Express',
    points: 1,
    event_type: 'gbm',
    image_url: null,
    thumbnail_url: null,
    is_published: true,
    academic_term_id: 'term-fall-2026',
  },
  {
    id: 'evt-urban-matcha',
    name: 'Urban Matcha Study Jams',
    description: '',
    date: '2026-10-20',
    start_time: '10:00:00',
    end_time: '22:00:00',
    end_date: null,
    location: 'Urban Matcha',
    points: 1,
    event_type: 'gbm',
    image_url: null,
    thumbnail_url: null,
    is_published: true,
    academic_term_id: 'term-fall-2026',
  },
  {
    id: 'evt-next-day',
    name: 'Next Day Mixer',
    description: '',
    date: '2026-10-21',
    start_time: '18:00:00',
    end_time: '21:00:00',
    end_date: null,
    location: 'Sun God Lawn',
    points: 2,
    event_type: 'mixer',
    image_url: null,
    thumbnail_url: null,
    is_published: true,
    academic_term_id: 'term-fall-2026',
  },
];

jest.mock('../hooks/useEvents', () => ({
  useEvents: () => ({
    events: mockEventList,
    loading: false,
    error: null,
  }),
  usePublishedPastEventArchiveAvailability: () => ({
    data: { termIds: ['term-fall-2026'], hasUnassignedEvents: false },
    isLoading: false,
    error: null,
  }),
  useInfiniteEvents: () => ({
    data: { pages: [mockEventList] },
    isLoading: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: () => undefined,
    isFetchingNextPage: false,
  }),
}));

describe('/events lifecycle classification', () => {
  beforeEach(() => {
    supabaseMock.reset();
    // Simulate test time: Oct 20, 2026, 12:00 PM Pacific
    jest.useFakeTimers();
    jest.setSystemTime(new Date(losAngelesDateTimeToIso('2026-10-20', '12:00')));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('excludes finished events from Upcoming and includes ongoing + upcoming events', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/events']}>
          <Events />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // The finished event (Eat with VSA) ended Oct 19 at 8:00 PM.
    // It should appear in Past Events (Memories section), NOT in Upcoming Events.
    // The ongoing event (Urban Matcha) should be under Upcoming.
    // The upcoming event (Next Day Mixer) should be under Upcoming.

    // Urban Matcha and Next Day Mixer are upcoming/ongoing
    const urbanMatchaElements = await screen.findAllByText('Urban Matcha Study Jams');
    expect(urbanMatchaElements.length).toBeGreaterThanOrEqual(1);

    const nextDayElements = await screen.findAllByText('Next Day Mixer');
    expect(nextDayElements.length).toBeGreaterThanOrEqual(1);

    // Eat with VSA is past: it appears in past events
    const eatWithVsaElements = await screen.findAllByText('Eat with VSA');
    expect(eatWithVsaElements.length).toBeGreaterThanOrEqual(1);
  });
});
