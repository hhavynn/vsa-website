import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Home } from './Home';
import { eventsRepository, PublicEventPreview } from '../data/repos/events';
import { galleryRepository } from '../data/repos/gallery';
import { losAngelesDateTimeToIso } from '../utils/losAngelesDate';

jest.mock('../lib/supabase', () => ({
  get supabase() {
    return require('../test-utils/supabaseMock').supabaseMock.client;
  },
}));

jest.mock('../hooks/usePresidentsContent', () => ({
  usePresidentsContent: () => ({ content: null, loading: false }),
}));

jest.mock('../components/features/home/ThisWeekInVSA', () => ({
  ThisWeekInVSA: () => <div data-testid="this-week-in-vsa" />,
}));

jest.mock('../components/features/home/OpenOpportunities', () => ({
  OpenOpportunities: () => <div data-testid="open-opportunities" />,
}));

jest.mock('../components/features/home/ClosingSoonApplications', () => ({
  ClosingSoonApplications: () => <div data-testid="closing-soon" />,
}));

jest.mock('../components/features/home/WrappedRecapCard', () => ({
  WrappedRecapCard: () => <div data-testid="wrapped-recap" />,
}));

jest.mock('../components/features/home/PresidentsMessage', () => ({
  PresidentsMessageSection: () => <div data-testid="presidents-message" />,
}));

const renderHome = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('Home.tsx Upcoming Events section', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, cacheTime: 0 },
      },
    });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(losAngelesDateTimeToIso('2026-10-20', '12:00')));
    jest.spyOn(galleryRepository, 'getAlbums').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the empty state when no upcoming events are available', async () => {
    jest.spyOn(eventsRepository, 'getPublicUpcomingPreview').mockResolvedValue([]);

    renderHome(queryClient);

    expect(await screen.findByText('No upcoming events posted yet.')).toBeInTheDocument();
    expect(screen.getByText('View past events')).toBeInTheDocument();
  });

  it('renders upcoming event cards with details and interest buttons', async () => {
    const mockEvents: PublicEventPreview[] = [
      {
        id: 'event-active-1',
        name: 'Future Social',
        date: '2026-10-25',
        start_time: '18:00:00',
        end_time: '21:00:00',
        end_date: null,
        location: 'Price Center Ballroom',
        points: 2,
        event_type: 'mixer',
        image_url: null,
        thumbnail_url: null,
        interest_counts: {
          event_id: 'event-active-1',
          interested_count: 5,
          going_count: 10,
          updated_at: '2026-10-20T00:00:00Z',
        },
      },
    ];

    jest.spyOn(eventsRepository, 'getPublicUpcomingPreview').mockResolvedValue(mockEvents);

    renderHome(queryClient);

    expect(await screen.findByText('Future Social')).toBeInTheDocument();
    expect(screen.getByText('Price Center Ballroom')).toBeInTheDocument();
    expect(screen.getByText('2 points')).toBeInTheDocument();
  });

  it('links recent photos to actual public gallery albums instead of hardcoded examples', async () => {
    jest.spyOn(eventsRepository, 'getPublicUpcomingPreview').mockResolvedValue([]);
    jest.spyOn(galleryRepository, 'getAlbums').mockResolvedValue([
      {
        id: 'public-album-1',
        title: 'Fall General Body Meeting',
        date: '2026-10-01',
        description: null,
        google_photos_url: 'https://photos.google.com/share/public-album-1',
        cover_image_url: '/images/gallery/fall-26-gbm-1_2026-09-30.webp',
        cover_thumbnail_url: null,
        event_id: null,
        event: null,
      },
    ]);

    renderHome(queryClient);

    const albumLink = await screen.findByRole('link', {
      name: 'Open Fall General Body Meeting photo album',
    });
    expect(albumLink).toHaveAttribute('href', 'https://photos.google.com/share/public-album-1');
    expect(albumLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(galleryRepository.getAlbums).toHaveBeenCalledWith({ limit: 5 });
    expect(screen.queryByText('La Jolla S’mores')).not.toBeInTheDocument();
  });

  it('disappears an event in real-time when the homepage remains open past its scheduled end', async () => {
    jest.useFakeTimers();

    // Event ending at 8:00 PM Pacific on 2026-10-19
    const endingEvent: PublicEventPreview = {
      id: 'ending-event',
      name: 'Eat with VSA',
      date: '2026-10-19',
      start_time: '17:00:00',
      end_time: '20:00:00',
      end_date: null,
      location: 'Tapioca Express',
      points: 1,
      event_type: 'gbm',
      image_url: null,
      thumbnail_url: null,
      interest_counts: null,
    };

    // Set time to Oct 19 at 7:59:50 PM Pacific (10 seconds before end)
    const initialInstant = new Date(losAngelesDateTimeToIso('2026-10-19', '19:59:50'));
    jest.setSystemTime(initialInstant);

    jest.spyOn(eventsRepository, 'getPublicUpcomingPreview').mockResolvedValue([endingEvent]);

    renderHome(queryClient);

    // Initial render before end time: event is visible
    expect(await screen.findByText('Eat with VSA')).toBeInTheDocument();

    // Advance time past 8:00 PM Pacific (by 15 seconds)
    act(() => {
      jest.advanceTimersByTime(15000);
    });

    // The expired card has disappeared, and the empty state is displayed
    expect(screen.queryByText('Eat with VSA')).not.toBeInTheDocument();
    expect(screen.getByText('No upcoming events posted yet.')).toBeInTheDocument();
  });
});
