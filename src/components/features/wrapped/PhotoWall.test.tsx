import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GalleryAlbum } from '../../../data/repos/gallery';
import { PhotoWall } from './PhotoWall';

function album(id: string, overrides: Partial<GalleryAlbum> = {}): GalleryAlbum {
  return {
    id,
    title: `Public album ${id}`,
    description: null,
    date: '2026-10-01',
    google_photos_url: 'https://photos.example.test/album',
    cover_image_url: `/images/${id}-full.webp`,
    cover_thumbnail_url: `/images/${id}-thumb.webp`,
    event_id: null,
    event: null,
    ...overrides,
  };
}

function renderWall(albums: GalleryAlbum[]) {
  return render(<MemoryRouter><PhotoWall albums={albums} /></MemoryRouter>);
}

describe('public PhotoWall image delivery (#303)', () => {
  it('uses approved thumbnail files and lazy, dimensioned shared images', () => {
    renderWall([album('one'), album('two', { cover_thumbnail_url: null })]);
    const thumbnail = screen.getByRole('img', { name: 'Public album one' });
    const full = screen.getByRole('img', { name: 'Public album two' });
    expect(thumbnail).toHaveAttribute('src', '/images/one-thumb.webp');
    expect(full).toHaveAttribute('src', '/images/two-full.webp');
    for (const image of [thumbnail, full]) {
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveAttribute('width', '480');
      expect(image).toHaveAttribute('height', '360');
      expect(image).toHaveAttribute('decoding', 'async');
    }
    expect(screen.getAllByRole('link', { name: /Public album/ })).toHaveLength(2);
  });

  it('keeps album navigation available and provides an image-error placeholder', () => {
    renderWall([album('one')]);
    fireEvent.error(screen.getByRole('img', { name: 'Public album one' }));
    expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Public album one/ })).toHaveAttribute('href', '/gallery');
    expect(screen.queryByRole('img', { name: 'Public album one' })).not.toBeInTheDocument();
  });

  it('preserves the nine-cover limit and gallery discovery when no covers exist', () => {
    const many = Array.from({ length: 12 }, (_, index) => album(String(index)));
    const view = renderWall(many);
    expect(screen.getAllByRole('img')).toHaveLength(9);
    view.rerender(
      <MemoryRouter><PhotoWall albums={[album('empty', { cover_image_url: null, cover_thumbnail_url: null })]} /></MemoryRouter>,
    );
    expect(screen.getByText(/photo wall lives in the gallery/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the gallery/ })).toHaveAttribute('href', '/gallery');
  });
});
