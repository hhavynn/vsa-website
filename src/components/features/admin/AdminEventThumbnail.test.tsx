import { fireEvent, render, screen } from '@testing-library/react';
import { AdminEventThumbnail } from './AdminEventThumbnail';

const full = '/images/events/fall-gbm.webp';
const thumb = '/images/events/fall-gbm-thumb.webp';

describe('Admin Events list image delivery (#303)', () => {
  it('uses the existing thumbnail with explicit dimensions and lazy loading', () => {
    render(<AdminEventThumbnail name="Fictional Fall GBM" thumbnailUrl={thumb} imageUrl={full} />);
    const img = screen.getByRole('img', { name: 'Fictional Fall GBM' });
    expect(img).toHaveAttribute('src', thumb);
    expect(img).toHaveAttribute('width', '160');
    expect(img).toHaveAttribute('height', '160');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveClass('sm:h-16', 'sm:w-16', 'object-cover');
  });

  it('displays a legacy event photo when the thumbnail does not exist', () => {
    render(<AdminEventThumbnail name="Old Event" thumbnailUrl={null} imageUrl={full} />);
    expect(screen.getByRole('img', { name: 'Old Event' })).toHaveAttribute('src', full);
  });

  it('omits the whole preview when the event has no image', () => {
    const { container } = render(<AdminEventThumbnail name="No Photo" imageUrl={null} thumbnailUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('replaces a failed preview with an accessible placeholder', () => {
    render(<AdminEventThumbnail name="Broken Photo" thumbnailUrl={thumb} imageUrl={full} />);
    fireEvent.error(screen.getByRole('img', { name: 'Broken Photo' }));
    expect(screen.queryByRole('img', { name: 'Broken Photo' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Image unavailable for Broken Photo' })).toBeInTheDocument();
  });

  it('retries a new image when a different event replaces a failed row', () => {
    const { rerender } = render(<AdminEventThumbnail name="First" imageUrl={full} />);
    fireEvent.error(screen.getByRole('img', { name: 'First' }));
    rerender(<AdminEventThumbnail name="Second" imageUrl="/images/events/new.webp" />);
    expect(screen.getByRole('img', { name: 'Second' })).toHaveAttribute('src', '/images/events/new.webp');
  });
});
