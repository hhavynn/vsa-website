/* eslint-disable testing-library/no-node-access, testing-library/no-container -- asserts on img attributes and the swipe surface */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Gallery from './Gallery';
import type { GalleryAlbum } from '../data/repos/gallery';

let mockAlbums: GalleryAlbum[] = [];

jest.mock('../hooks/useGallery', () => ({
  useGallery: () => ({
    data: { pages: [mockAlbums] },
    isLoading: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: () => undefined,
    isFetchingNextPage: false,
  }),
  useGalleryStats: () => ({ data: mockAlbums.length }),
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
        event: { id: 'evt-1', name: 'Fall GBM', date: '2025-10-01', academic_term_id: 'term-9' },
      }),
      // Same name, no foreign key: must NOT be linked by title matching.
      album('lookalike', { title: 'Fall GBM' }),
      // A foreign key whose event the public cannot read (e.g. unpublished).
      album('hidden', { event_id: 'evt-2', event: null }),
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
  });
});
