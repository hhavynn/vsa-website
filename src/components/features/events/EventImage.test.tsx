import { fireEvent, render, screen } from '@testing-library/react';
import { EventImage } from './PublicEventCards';
import type { Event } from '../../../types';

const baseEvent = {
  id: 'e1',
  name: 'Spring GBM',
  thumbnail_url: 'https://cdn.example.com/events/spring_thumb.webp',
  image_url: 'https://cdn.example.com/events/spring.webp',
} as unknown as Event;

const props = {
  className: 'aspect-[5/3] w-full object-cover',
  titleClassName: 'title',
  imageWidth: 520,
  imageHeight: 312,
};

describe('EventImage', () => {
  it('renders the thumbnail lazily with reserved dimensions', () => {
    render(<EventImage event={baseEvent} {...props} />);
    const img = screen.getByAltText('Spring GBM');
    expect(img).toHaveAttribute('src', baseEvent.thumbnail_url);
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '520');
    expect(img).toHaveAttribute('height', '312');
  });

  it('only the priority image is eager with high fetch priority', () => {
    render(<EventImage event={baseEvent} {...props} priority />);
    const img = screen.getByAltText('Spring GBM');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('falls back to the title card when there is no image or it fails to load', () => {
    const { rerender } = render(
      <EventImage event={{ ...baseEvent, thumbnail_url: null, image_url: null } as unknown as Event} {...props} />
    );
    expect(screen.getByText('Spring GBM')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();

    rerender(<EventImage event={baseEvent} {...props} />);
    fireEvent.error(screen.getByAltText('Spring GBM'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Spring GBM')).toBeInTheDocument();
  });
});
