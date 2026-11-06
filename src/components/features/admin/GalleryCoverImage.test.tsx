import { fireEvent, render, screen } from '@testing-library/react';
import { GalleryCoverImage } from './GalleryCoverImage';

const full = '/images/gallery/annual-banquet.webp';
const thumb = '/images/gallery/annual-banquet-thumb.webp';

describe('Admin Gallery album cover delivery (#303)', () => {
  it('prefers an existing smaller thumbnail, reserves dimensions and lazy-loads the grid', () => {
    render(<GalleryCoverImage thumbnailUrl={thumb} imageUrl={full} alt="Fictional Banquet" />);
    const img = screen.getByRole('img', { name: 'Fictional Banquet' });
    expect(img).toHaveAttribute('src', thumb);
    expect(img).toHaveAttribute('width', '420');
    expect(img).toHaveAttribute('height', '144');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('uses the full cover if an older album has no generated thumbnail', () => {
    render(<GalleryCoverImage thumbnailUrl={null} imageUrl={full} alt="Historic Album" />);
    expect(screen.getByRole('img', { name: 'Historic Album' })).toHaveAttribute('src', full);
  });

  it('shows the same neutral placeholder for missing and broken covers', () => {
    const { rerender } = render(
      <GalleryCoverImage thumbnailUrl={null} imageUrl={null} alt="Missing Album" />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cover image unavailable')).toBeInTheDocument();
    rerender(<GalleryCoverImage thumbnailUrl={thumb} imageUrl={full} alt="Broken Album" />);
    fireEvent.error(screen.getByRole('img', { name: 'Broken Album' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cover image unavailable')).toBeInTheDocument();
  });

  it('retries the image when a different album is selected in the same editor', () => {
    const { rerender } = render(<GalleryCoverImage thumbnailUrl={thumb} imageUrl={full} alt="Before" />);
    fireEvent.error(screen.getByRole('img', { name: 'Before' }));
    const newThumb = '/images/gallery/new-album-thumb.webp';
    rerender(<GalleryCoverImage thumbnailUrl={newThumb} imageUrl={null} alt="After" />);
    expect(screen.getByRole('img', { name: 'After' })).toHaveAttribute('src', newThumb);
  });
});
