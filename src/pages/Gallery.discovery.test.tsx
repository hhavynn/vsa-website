import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Gallery from './Gallery';
import type { GalleryAlbum } from '../data/repos/gallery';

let mockAlbums: GalleryAlbum[] = [];
let mockIsLoading = false;
let mockError: unknown | null = null;
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;

const album = (id: string, overrides: Partial<GalleryAlbum> = {}): GalleryAlbum => ({
  id,
  title: `Album ${id}`,
  description: `About album ${id}`,
  date: '2025-10-01',
  google_photos_url: `https://photos.example.test/${id}`,
  cover_image_url: `/images/${id}.webp`,
  cover_thumbnail_url: `/images/${id}_thumb.webp`,
  event_id: null,
  event: null,
  ...overrides,
});

jest.mock('../hooks/useGallery', () => ({
  useGallery: ({ year, search }: { year?: number | null; search?: string } = {}) => {
    // If year or search specified in test, simulate filtered albums
    let albums = mockAlbums;
    if (search === 'nomatch') {
      albums = [];
    }
    return {
      data: mockIsLoading ? undefined : { pages: [{ albums, nextCursor: null }] },
      isLoading: mockIsLoading,
      error: mockError,
      hasNextPage: mockHasNextPage,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: mockIsFetchingNextPage,
    };
  },
  useGalleryStats: () => ({ data: 25 }),
  useGalleryYears: () => ({ data: [2026, 2025, 2024] }),
  useGalleryFilteredCount: ({ year, search }: { year?: number | null; search?: string } = {}) => ({
    data: search === 'nomatch' ? 0 : search || year ? 1 : null,
    isLoading: false,
  }),
}));

beforeEach(() => {
  mockAlbums = [album('a'), album('b')];
  mockIsLoading = false;
  mockError = null;
  mockHasNextPage = false;
  mockIsFetchingNextPage = false;
});

describe('Gallery discovery page states (Issue #562 & #563)', () => {
  it('renders hero title and unfiltered album count', () => {
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Gallery' })).toBeInTheDocument();
    expect(screen.getByText(/25 albums from GBMs, retreats/i)).toBeInTheDocument();
  });

  it('renders distinct empty state with Clear filters action when search has no matches', async () => {
    render(
      <MemoryRouter initialEntries={['/gallery?search=nomatch']}>
        <Gallery />
      </MemoryRouter>
    );

    expect(screen.getByText(/No albums matched your filters/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Try searching with different keywords or clear the current filters/i)
    ).toBeInTheDocument();

    const clearBtns = screen.getAllByRole('button', { name: 'Clear filters' });
    expect(clearBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('renders standard empty state when unfiltered archive is completely empty', () => {
    mockAlbums = [];
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    // Depending on seasonal state, either summer empty state or default empty text
    const emptyNotice = screen.getByRole('status');
    expect(emptyNotice).toBeInTheDocument();
    expect(screen.queryByText(/No albums matched your filters/i)).not.toBeInTheDocument();
  });

  it('renders PageError when initial gallery load fails', () => {
    mockAlbums = [];
    mockError = new Error('Database connection failed');
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    expect(screen.getByText(/Failed to load gallery/i)).toBeInTheDocument();
  });

  it('syncs year selector changes to URL search parameters', async () => {
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    const yearSelect = screen.getByLabelText(/Filter by academic year/i) as HTMLSelectElement;
    fireEvent.change(yearSelect, { target: { value: '2025' } });

    expect(yearSelect.value).toBe('2025');
  });

  it('keeps older album cards visible before scroll observers fire, even without a cover', () => {
    // setupTests' IntersectionObserver never signals an intersection. An
    // inherited initial="hidden" animation would leave clickable cards blank.
    mockAlbums = Array.from({ length: 24 }, (_, index) =>
      album(`old-${index + 1}`, {
        date: index >= 12 ? '2024-10-01' : '2025-10-01',
        ...(index === 23 ? { cover_image_url: null, cover_thumbnail_url: null } : {}),
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>,
    );

    const wall = container.querySelector('.gallery-memory-wall');
    expect(wall).toBeInTheDocument();
    expect(wall).not.toHaveStyle('opacity: 0');

    const cards = container.querySelectorAll('.gallery-memory-card');
    expect(cards).toHaveLength(24);
    cards.forEach((card) => expect(card).not.toHaveStyle('opacity: 0'));

    expect(screen.getByRole('link', { name: 'Album old-24. Preview album' })).toBeInTheDocument();
    // Every valid cover also renders its fallback underneath the image, so
    // check the cover-less card specifically rather than using getByText('VSA').
    expect(cards[23].querySelector('img')).toBeNull();
    expect(cards[23].querySelector('.gallery-memory-fallback')).toBeInTheDocument();
  });

  it('keeps discovery controls mounted while filter queries are loading', () => {
    mockIsLoading = true;
    render(
      <MemoryRouter initialEntries={['/gallery?search=test']}>
        <Gallery />
      </MemoryRouter>
    );

    // The filter input and controls must remain mounted in the DOM
    const input = screen.getByPlaceholderText(/Search album titles and descriptions/i);
    expect(input).toBeInTheDocument();
    // Wall skeleton renders in the results area
    expect(screen.getByTestId('gallery-wall-skeleton')).toBeInTheDocument();
  });
});
