import { render, screen } from '@testing-library/react';
import type { Event } from '../../../types';
import { AddToCalendarButton } from './AddToCalendarButton';

const makeEvent = (id: string, name: string, overrides: Partial<Event> = {}): Event => ({
  id,
  name,
  date: '2026-11-03',
  start_time: '19:00:00',
  end_time: '21:00:00',
  end_date: null,
  description: 'Published event details',
  location: 'Price Center Ballroom West',
  points: 1,
  event_type: 'mixer',
  image_url: null,
  thumbnail_url: null,
  is_published: true,
  academic_term_id: null,
  ...overrides,
});

describe('public event calendar-save accessibility (#245)', () => {
  it('provides a genuine 44px keyboard target and an event-specific link name', () => {
    const event = makeEvent('one', 'A Long and Detailed Community Night');
    render(<AddToCalendarButton event={event} variant="ghost" />);
    const link = screen.getByRole('link', {
      name: 'Add to Google Calendar: A Long and Detailed Community Night (opens in new tab)',
    });
    expect(link).toHaveClass('min-h-11', 'focus-visible:ring-2', 'max-w-full');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const url = new URL(link.getAttribute('href')!);
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('text')).toBe(event.name);
    expect(url.searchParams.get('ctz')).toBe('America/Los_Angeles');
    expect(url.searchParams.get('location')).toBe(event.location);
  });

  it('distinguishes multiple event links to screen readers even when visual text stays compact', () => {
    render(
      <>
        <AddToCalendarButton event={makeEvent('one', 'First VSA Mixer')} />
        <AddToCalendarButton event={makeEvent('two', 'Second VSA GBM')} />
      </>,
    );
    expect(screen.getByRole('link', { name: /Add to Google Calendar: First VSA Mixer/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add to Google Calendar: Second VSA GBM/ })).toBeInTheDocument();
    expect(screen.getAllByText('Add to Google Calendar')).toHaveLength(2);
  });

  it('retains the existing all-day Google calendar path when a time is not provided', () => {
    const event = makeEvent('all-day', 'Cultural Celebration', { start_time: null, end_time: null, location: null });
    render(<AddToCalendarButton event={event} />);
    const link = screen.getByRole('link', { name: /Add to Google Calendar: Cultural Celebration/ });
    const url = new URL(link.getAttribute('href')!);
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe(event.name);
    expect(url.searchParams.has('dates')).toBe(true);
    expect(url.searchParams.has('location')).toBe(false);
  });
});
