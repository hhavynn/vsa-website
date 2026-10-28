/* eslint-disable testing-library/no-node-access, testing-library/no-container -- asserts on img attributes and the swipe surface */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Gallery from './Gallery';
import type { GalleryAlbum } from '../data/repos/gallery';

let mockAlbums: GalleryAlbum[] = [];
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;
let mockFetchNextPage = jest.fn();
let mockError: unknown | null = null;
let mockFilteredCount: number | null = null;

jest.mock('../hooks/useGallery', () => ({
  useGallery: () => ({
    data: { pages: [{ albums: mockAlbums, nextCursor: null }] },
    isLoading: false,
    error: mockError,
    hasNextPage: mockHasNextPage,
    fetchNextPage: mockFetchNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
  }),
  useGalleryStats: () => ({ data: mockAlbums.length }),
  useGalleryYears: () => ({ data: [2026, 2025] }),
  useGalleryFilteredCount: () => ({ data: mockFilteredCount, isLoading: false }),
}));

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

// Browser Back for a MemoryRouter: a POP of one history entry.
let goBack: () => void = () => undefined;
function BackProbe() {
  const navigate = useNavigate();
  goBack = () => navigate(-1);
  return null;
}

function renderGallery() {
  return render(
    <MemoryRouter initialEntries={['/gallery']}>
      <BackProbe />
      <Gallery />
    </MemoryRouter>,
  );
}

const openCard = (title: string) =>
  fireEvent.click(screen.getByRole('link', { name: `${title}. Preview album` }));

const getDialog = () => screen.getByRole('dialog', { name: 'Album preview' });

function swipe(element: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.touchStart(element, { touches: [{ clientX: from[0], clientY: from[1] }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: to[0], clientY: to[1] }] });
}

beforeEach(() => {
  mockAlbums = [album('a'), album('b'), album('c')];
  mockHasNextPage = false;
  mockIsFetchingNextPage = false;
  mockFetchNextPage = jest.fn();
  mockError = null;
  mockFilteredCount = null;
});

afterEach(() => {
  cleanup();
});

describe('Gallery album quick-look', () => {
  it('opens in place instead of leaving for Google Photos, while the link still works for new-tab clicks', () => {
    renderGallery();
    const card = screen.getByRole('link', { name: 'Album b. Preview album' });
    expect(card).toHaveAttribute('href', 'https://photos.example.test/b');
    expect(card).toHaveAttribute('target', '_blank');

    // Ctrl/Cmd-click is left to the browser (opens Google Photos in a new tab).
    fireEvent.click(card, { ctrlKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openCard('Album b');
    const dialog = getDialog();
    expect(within(dialog).getByRole('heading', { name: 'Album b' })).toBeInTheDocument();
    expect(within(dialog).getByText('2 / 3')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Open full album in Google Photos/ })).toHaveAttribute(
      'href',
      'https://photos.example.test/b',
    );
  });

  it('swipes left for the next album and right for the previous one', () => {
    renderGallery();
    openCard('Album b');
    const surface = screen.getByTestId('album-swipe-area');

    swipe(surface, [260, 300], [120, 310]);
    expect(within(getDialog()).getByRole('heading', { name: 'Album c' })).toBeInTheDocument();

    swipe(surface, [100, 300], [240, 295]);
    expect(within(getDialog()).getByRole('heading', { name: 'Album b' })).toBeInTheDocument();

    swipe(surface, [100, 300], [240, 295]);
    expect(within(getDialog()).getByRole('heading', { name: 'Album a' })).toBeInTheDocument();
  });

  it('ignores short drags and vertical scrolls, and stops at either end', () => {
    renderGallery();
    openCard('Album a');
    const surface = screen.getByTestId('album-swipe-area');

    swipe(surface, [200, 300], [180, 300]); // too short
    swipe(surface, [200, 100], [120, 400]); // mostly vertical (a scroll)
    expect(within(getDialog()).getByRole('heading', { name: 'Album a' })).toBeInTheDocument();

    swipe(surface, [100, 300], [260, 300]); // swipe right on the first album
    expect(within(getDialog()).getByRole('heading', { name: 'Album a' })).toBeInTheDocument();
    expect(within(getDialog()).getByRole('button', { name: 'Previous album' })).toBeDisabled();
  });

  it('pinch-zooms the cover, supports panning, and suppresses album swipes while zoomed', () => {
    renderGallery();
    openCard('Album b');
    const image = within(getDialog()).getByRole('img', { name: 'Cover photo for Album b' });
    const zoomArea = screen.getByTestId('album-zoom-area');
    const surface = screen.getByTestId('album-swipe-area');

    fireEvent.touchStart(zoomArea, {
      touches: [{ clientX: 40, clientY: 70 }, { clientX: 140, clientY: 70 }],
    });
    fireEvent.touchMove(zoomArea, {
      touches: [{ clientX: 10, clientY: 70 }, { clientX: 210, clientY: 70 }],
    });
    expect(image).toHaveStyle({ transform: 'translate(0px, 0px) scale(2)' });
    expect(within(getDialog()).getByRole('button', { name: 'Reset photo zoom' })).toBeInTheDocument();

    fireEvent.touchEnd(zoomArea, { touches: [], changedTouches: [{ clientX: 10, clientY: 70 }] });
    swipe(surface, [260, 300], [100, 300]);
    expect(within(getDialog()).getByRole('heading', { name: 'Album b' })).toBeInTheDocument();

    fireEvent.click(within(getDialog()).getByRole('button', { name: 'Reset photo zoom' }));
    expect(image).toHaveStyle({ transform: 'translate(0px, 0px) scale(1)' });
    swipe(surface, [260, 300], [100, 300]);
    expect(within(getDialog()).getByRole('heading', { name: 'Album c' })).toBeInTheDocument();
  });

  it('clamps pan to the smaller bounds when pinching back toward 1x', () => {
    renderGallery();
    openCard('Album a');
    const area = screen.getByTestId('album-zoom-area');
    const image = within(getDialog()).getByRole('img', { name: 'Cover photo for Album a' });
    jest.spyOn(area, 'getBoundingClientRect').mockReturnValue({
      width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, x: 0, y: 0,
      toJSON: () => ({}),
    });
    fireEvent.touchStart(area, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 300, clientY: 0 }] });
    expect(image.style.transform).toContain('scale(3)');
    fireEvent.touchEnd(area, { touches: [], changedTouches: [] });
    fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 800, clientY: 800 }] });
    expect(image.style.transform).toContain('translate(300px, 200px)');
    fireEvent.touchEnd(area, { touches: [], changedTouches: [] });
    fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 140, clientY: 100 }] });
    const match = image.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    expect(match).not.toBeNull();
    expect(Math.abs(Number(match?.[1]))).toBeLessThanOrEqual(30.01);
    expect(Math.abs(Number(match?.[2]))).toBeLessThanOrEqual(20.01);
    expect(Number(image.style.transform.match(/scale\(([-\d.]+)\)/)?.[1])).toBeCloseTo(1.2);
  });

  it('clamps pinch zoom, and resets photo zoom when paging to another album', () => {
    renderGallery();
    openCard('Album a');
    const zoomArea = screen.getByTestId('album-zoom-area');
    fireEvent.touchStart(zoomArea, {
      touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }],
    });
    fireEvent.touchMove(zoomArea, {
      touches: [{ clientX: 0, clientY: 0 }, { clientX: 900, clientY: 0 }],
    });
    const firstImage = within(getDialog()).getByRole('img', { name: 'Cover photo for Album a' });
    expect(firstImage.style.transform).toContain('scale(3)');

    fireEvent.click(within(getDialog()).getByRole('button', { name: 'Next album' }));
    const next = within(getDialog()).getByRole('img', { name: 'Cover photo for Album b' });
    expect(next.style.transform).toContain('scale(1)');
    expect(within(getDialog()).queryByRole('button', { name: 'Reset photo zoom' })).not.toBeInTheDocument();
  });

  it('pages with the arrow keys and closes on Escape', async () => {
    renderGallery();
    openCard('Album a');

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(within(getDialog()).getByRole('heading', { name: 'Album b' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(within(getDialog()).getByRole('heading', { name: 'Album a' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes on browser Back, staying on the Gallery', async () => {
    renderGallery();
    openCard('Album a');
    expect(getDialog()).toBeInTheDocument();

    act(() => goBack());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Still on the Gallery with the grid intact.
    expect(screen.getByRole('heading', { name: 'Gallery' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Album a. Preview album' })).toBeInTheDocument();
  });

  it('keeps a single history entry no matter how many albums are swiped through', async () => {
    renderGallery();
    openCard('Album a');
    const surface = screen.getByTestId('album-swipe-area');
    swipe(surface, [260, 300], [100, 300]);
    swipe(surface, [260, 300], [100, 300]);
    expect(within(getDialog()).getByRole('heading', { name: 'Album c' })).toBeInTheDocument();

    // One Back closes it; it does not step back through each album.
    act(() => goBack());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('puts a full-size Close within thumb reach in the bottom bar', async () => {
    renderGallery();
    openCard('Album a');
    const close = within(getDialog()).getByRole('button', { name: 'Close' });
    expect(close.className).toMatch(/min-h-\[48px\]/);
    // Lives in the sticky bottom bar, not the top of the sheet.
    expect(close.parentElement!.className).toMatch(/sticky bottom-0/);

    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('falls back gracefully when the cover fails to load', () => {
    renderGallery();
    openCard('Album a');
    const dialog = getDialog();
    const image = within(dialog).getByRole('img', { name: 'Cover photo for Album a' });
    fireEvent.error(image);
    expect(within(dialog).getByText('Cover photo unavailable')).toBeInTheDocument();
    // The album itself is still reachable.
    expect(within(dialog).getByRole('link', { name: /Open full album/ })).toBeInTheDocument();
  });

  it('shows the fallback when an album has no cover at all', () => {
    mockAlbums = [album('a', { cover_image_url: null, cover_thumbnail_url: null })];
    renderGallery();
    openCard('Album a');
    expect(within(getDialog()).getByText('Cover photo unavailable')).toBeInTheDocument();
  });

  it('keeps OptimizedImage delivery: thumbnail as a srcset candidate, lazy-decoded, explicit size', () => {
    renderGallery();
    openCard('Album a');
    const image = within(getDialog()).getByRole('img', { name: 'Cover photo for Album a' });
    expect(image).toHaveAttribute('src', '/images/a.webp');
    expect(image.getAttribute('srcset')).toBe('/images/a_thumb.webp 720w, /images/a.webp 1400w');
    expect(image).toHaveAttribute('width', '1400');
    expect(image).toHaveAttribute('height', '933');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('shows a related-event link only when the album has an explicit event relationship', () => {
    mockAlbums = [
      album('linked', {
        event_id: 'evt-1',
        event: { id: 'evt-1', name: 'Fall GBM', date: '2025-10-01', academic_term_id: 'term-9', is_published: true },
      }),
      // Same name, no foreign key: must NOT be linked by title matching.
      album('lookalike', { title: 'Fall GBM' }),
      // A foreign key whose event the public cannot read (e.g. unpublished).
      album('hidden', { event_id: 'evt-2', event: null }),
      // A signed-in admin can read a draft through the join; still no public link.
      album('draft', {
        event_id: 'evt-3',
        event: { id: 'evt-3', name: 'Draft GBM', date: '2025-11-01', academic_term_id: 'term-9', is_published: false },
      }),
    ];
    renderGallery();

    openCard('Album linked' );
    const link = within(getDialog()).getByRole('link', { name: 'Fall GBM' });
    expect(link).toHaveAttribute('href', '/events?term=term-9#event-evt-1');

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(within(getDialog()).getByRole('heading', { name: 'Fall GBM' })).toBeInTheDocument();
    expect(within(getDialog()).queryByText(/Related event/)).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(within(getDialog()).getByRole('heading', { name: 'Album hidden' })).toBeInTheDocument();
    expect(within(getDialog()).queryByText(/Related event/)).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(within(getDialog()).getByRole('heading', { name: 'Album draft' })).toBeInTheDocument();
    expect(within(getDialog()).queryByText(/Related event/)).not.toBeInTheDocument();
  });

  it('enables Next and triggers fetchNextPage when navigating past loaded boundary if hasNextPage is true', () => {
    mockHasNextPage = true;
    renderGallery();
    openCard('Album c'); // album 3 of 3

    const dialog = getDialog();
    expect(within(dialog).getByText('3 / 3+')).toBeInTheDocument();
    const nextBtn = within(dialog).getByRole('button', { name: 'Next album' });
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    expect(mockFetchNextPage).toHaveBeenCalled();
  });

  it('triggers proactive prefetch as the user approaches the loaded boundary', () => {
    mockHasNextPage = true;
    renderGallery();
    openCard('Album b'); // album 2 of 3 (approaching boundary >= albums.length - 2)

    expect(mockFetchNextPage).toHaveBeenCalled();
  });

  it('shows Retry on boundary Next button when next page fetch fails', () => {
    mockHasNextPage = true;
    mockError = new Error('Network error');
    renderGallery();
    openCard('Album c');

    const dialog = getDialog();
    const retryBtn = within(dialog).getByRole('button', { name: /Retry loading next album/i });
    expect(retryBtn).toHaveTextContent('Retry →');

    fireEvent.click(retryBtn);
    expect(mockFetchNextPage).toHaveBeenCalled();
  });

  it('preserves query params on browser Back from lightbox', async () => {
    render(
      <MemoryRouter initialEntries={['/gallery?year=2025&search=gbm']}>
        <BackProbe />
        <Gallery />
      </MemoryRouter>,
    );

    openCard('Album a');
    expect(getDialog()).toBeInTheDocument();

    act(() => goBack());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Filter controls still hold their query parameters
    const yearSelect = screen.getByLabelText(/Filter by academic year/i) as HTMLSelectElement;
    expect(yearSelect.value).toBe('2025');
    const searchInput = screen.getByPlaceholderText(/Search album titles and descriptions/i) as HTMLInputElement;
    expect(searchInput.value).toBe('gbm');
  });

  it('cancels pending boundary advancement when user navigates backward before page loads', () => {
    mockHasNextPage = true;
    const { rerender } = renderGallery();
    openCard('Album c'); // index 2 of 3 (loaded boundary)

    const dialog = getDialog();
    const nextBtn = within(dialog).getByRole('button', { name: 'Next album' });
    fireEvent.click(nextBtn); // requests next page, pending advance from index 2

    // While request is pending, user clicks Previous to go back to Album b (index 1)
    const prevBtn = within(dialog).getByRole('button', { name: 'Previous album' });
    fireEvent.click(prevBtn);
    expect(within(dialog).getByRole('heading', { name: 'Album b' })).toBeInTheDocument();

    // Now page 2 finishes loading, adding album d
    mockAlbums = [...mockAlbums, album('d')];
    rerender(
      <MemoryRouter initialEntries={['/gallery']}>
        <BackProbe />
        <Gallery />
      </MemoryRouter>,
    );

    // Lightbox must remain on Album b and NOT unexpectedly advance forward
    expect(within(dialog).getByRole('heading', { name: 'Album b' })).toBeInTheDocument();
  });
});
