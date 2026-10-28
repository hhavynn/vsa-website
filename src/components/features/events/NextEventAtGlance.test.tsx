import { render, screen } from '@testing-library/react';
import { Event } from '../../../types';
import { NextEventAtGlance } from './NextEventAtGlance';

const event = {
  id: 'synthetic-event',
  name: 'A Very Long Name For Our Upcoming Community Gathering',
  date: '2026-11-03T00:00:00Z',
  start_time: '19:00:00',
  end_time: '21:30:00',
  end_date: null,
  location: 'Price Center Ballroom West',
  description: 'Public description',
} as Event;

describe('NextEventAtGlance (#245)', () => {
  it('shows the next VSA event title, local date/time and location without truncation', () => {
    render(<NextEventAtGlance event={event} />);
    const title = screen.getByText(event.name);
    expect(title).toBeInTheDocument();
    expect(title.className).not.toContain('truncate');
    expect(screen.getByText(/7 PM – 9:30 PM/)).toBeInTheDocument();
    expect(screen.getByText('Price Center Ballroom West')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Event details' })).toHaveAttribute('href', '#next-up');
    const calendarLink = screen.getByRole('link', { name: /Add to Google Calendar/i });
    expect(calendarLink).toHaveAttribute('target', '_blank');
    expect(calendarLink.getAttribute('href')).toContain('calendar.google.com');
  });

  it('never invents a time or location when the event does not specify them', () => {
    render(<NextEventAtGlance event={{ ...event, start_time: null, end_time: null, location: null } as Event} />);
    expect(screen.getByText(/Time to be announced/)).toBeInTheDocument();
    expect(screen.getByText('Location to be announced')).toBeInTheDocument();
  });
});
