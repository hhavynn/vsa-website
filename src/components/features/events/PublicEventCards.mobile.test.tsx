import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import type { Event } from '../../../types';
import { EventsSkeleton } from '../../common/PageSkeletons';
import { FeaturedEventCard, UpcomingEventRow } from './PublicEventCards';

jest.mock('./EventInterestButtons', () => ({
  EventInterestButtons: () => null,
}));

jest.mock('./AddToCalendarButton', () => ({
  AddToCalendarButton: () => <a href="https://calendar.google.com/calendar/render">Add to Google Calendar</a>,
}));

const event = {
  id: 'fictional-event',
  name: 'VSA Community Gathering',
  description: 'Fictional event description',
  date: '2026-11-03',
  start_time: '18:00:00',
  end_time: '20:00:00',
  end_date: null,
  location: 'Price Center',
  points: 1,
  event_type: 'mixer',
  thumbnail_url: null,
  image_url: null,
  is_published: true,
  academic_term_id: null,
} as Event;

const wrap = (node: JSX.Element) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {node}
  </QueryClientProvider>
);

describe('public Events phone logistics-first layout (#245)', () => {
  it('shows the featured event details and Google Calendar action before its flyer on phones', () => {
    render(wrap(<FeaturedEventCard event={event} />));
    const featured = screen.getByTestId('featured-event-card');
    expect(featured).toHaveClass('flex-col');
    expect(featured).not.toHaveClass('flex-col-reverse');
    expect(featured).toHaveClass('lg:grid');
    expect(screen.getByRole('heading', { name: event.name })).toBeInTheDocument();
    expect(screen.getByText('Price Center')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add to Google Calendar' })).toBeInTheDocument();
    expect(screen.getByTestId('featured-event-flyer')).toBeInTheDocument();
  });

  it('puts date, event details and actions before the flyer on phones, preserving desktop order', () => {
    render(wrap(<UpcomingEventRow event={event} />));
    const row = screen.getByTestId('upcoming-event-row');
    expect(row).toHaveClass('sm:grid-cols-[104px_minmax(0,1fr)]');
    expect(screen.getByTestId('upcoming-event-date')).toHaveClass('order-1', 'sm:order-1');
    expect(screen.getByTestId('upcoming-event-info')).toHaveClass('order-2', 'sm:order-3');
    expect(screen.getByTestId('upcoming-event-actions')).toHaveClass('order-3', 'sm:order-4');
    expect(screen.getByTestId('upcoming-event-flyer')).toHaveClass('order-4', 'sm:order-2');
    expect(screen.getByRole('heading', { name: event.name })).toBeInTheDocument();
    expect(screen.getByText('Price Center')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add to Google Calendar' })).toBeInTheDocument();
  });

  it('uses the same text-first featured order in the Events loading skeleton', () => {
    render(<EventsSkeleton />);
    const skeleton = screen.getByTestId('events-featured-skeleton');
    expect(skeleton).toHaveClass('flex-col');
    expect(skeleton).not.toHaveClass('flex-col-reverse');
    expect(skeleton).toHaveClass('lg:grid');
  });
});
