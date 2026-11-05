import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarThumb } from './CalendarThumb';
import type { CalendarItem } from '../../../utils/calendar';

function item(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    key: 'vsa:example',
    source: 'vsa',
    title: 'Fictional GBM',
    description: null,
    date: '2026-11-12',
    endDate: null,
    startTime: null,
    endTime: null,
    location: null,
    category: 'gbm',
    categoryLabel: 'General Body Meeting',
    points: null,
    imageUrl: 'https://images.example.invalid/full.webp',
    thumbnailUrl: 'https://images.example.invalid/thumb.webp',
    houses: [],
    detailPath: '/events',
    applicationStatus: null,
    deadlineKind: null,
    ...overrides,
  };
}

describe('Calendar grid thumbnail shared delivery (#303)', () => {
  it('uses the published thumbnail and reserves dimensions without eager-loading the grid', () => {
    render(<CalendarThumb item={item()} width={420} className="absolute inset-0 h-full w-full" />);
    const img = screen.getByAltText('');
    expect(img).toHaveAttribute('src', 'https://images.example.invalid/thumb.webp');
    expect(img).toHaveAttribute('width', '420');
    expect(img).toHaveAttribute('height', '420');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveClass('object-cover', 'absolute', 'inset-0', 'h-full', 'w-full');
  });

  it('falls back to the published full photo when no thumbnail exists', () => {
    render(<CalendarThumb item={item({ thumbnailUrl: null })} />);
    expect(screen.getByAltText(''))
      .toHaveAttribute('src', 'https://images.example.invalid/full.webp');
  });

  it('shows the colored tile backdrop when a photo is missing or fails', () => {
    const { rerender } = render(<CalendarThumb item={item({ imageUrl: null, thumbnailUrl: null })} />);
    expect(screen.queryByAltText('')).not.toBeInTheDocument();
    rerender(<CalendarThumb item={item()} />);
    fireEvent.error(screen.getByAltText(''));
    expect(screen.queryByAltText('')).not.toBeInTheDocument();
  });
});
