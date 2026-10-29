import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CalendarItem } from '../../../utils/calendar';
import { CalendarDetailModal } from './CalendarDetailModal';

jest.mock('../../ui/BottomSheet', () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
}));
jest.mock('./AddToGoogleCalendarLink', () => ({
  AddToGoogleCalendarLink: () => null,
}));

function item(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    key: 'vsa:event-1',
    source: 'vsa',
    title: 'Community Night',
    description: null,
    date: '2026-10-27',
    endDate: null,
    startTime: '18:00:00',
    endTime: null,
    location: 'Price Center',
    category: 'other',
    categoryLabel: 'General Events',
    points: 0,
    imageUrl: '/images/events/community.webp',
    thumbnailUrl: '/images/events/community_thumb.webp',
    houses: [],
    detailPath: '/events',
    applicationStatus: null,
    deadlineKind: null,
    ...overrides,
  };
}

function mount(event: CalendarItem) {
  return render(
    <MemoryRouter>
      <CalendarDetailModal
        overlay={{ mode: 'item', item: event }}
        todayStr="2026-10-27"
        onClose={jest.fn()}
        onSelectItem={jest.fn()}
      />
    </MemoryRouter>,
  );
}

describe('calendar detail image delivery (#303)', () => {
  it('uses a dimensioned, lazy-loaded image with responsive sizing guidance', () => {
    mount(item());
    const img = screen.getByRole('presentation');
    expect(img).toHaveAttribute('src', '/images/events/community.webp');
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '450');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    // With transforms off (the default), the original URL is preserved.
    expect(img).not.toHaveAttribute('fetchpriority');
  });

  it('uses an existing thumbnail if no full-resolution image is present', () => {
    mount(item({ imageUrl: null }));
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src', '/images/events/community_thumb.webp',
    );
  });

  it('keeps detail content usable after a broken image or no image', () => {
    const view = mount(item());
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.getByText('Event image unavailable')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Community Night' })).toBeInTheDocument();
    view.unmount();

    mount(item({ imageUrl: null, thumbnailUrl: null }));
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Community Night' })).toBeInTheDocument();
  });
});
