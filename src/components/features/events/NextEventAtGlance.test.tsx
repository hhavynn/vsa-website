import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UpcomingItem } from '../../../lib/upcomingEvents';
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
    expect(title).not.toHaveClass('truncate');
    expect(screen.getByText(/7 PM – 9:30 PM/)).toBeInTheDocument();
    expect(screen.getByText('Price Center Ballroom West')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Event details' })).toHaveAttribute('href', '#next-up');
    const calendarLink = screen.getByRole('link', { name: /Add to Google Calendar/i });
    expect(calendarLink).toHaveAttribute('target', '_blank');
    expect(calendarLink).toHaveAttribute('href', expect.stringContaining('calendar.google.com'));
  });

  it('shows both dates while a multi-day event remains ongoing', () => {
    render(<NextEventAtGlance event={{ ...event, date: '2026-10-30', end_date: '2026-11-01', start_time: null, end_time: null } as Event} />);
    expect(screen.getByText(/Oct 30 – Nov 1/)).toBeInTheDocument();
  });

  it('shows the next published House event on phones with its own detail link', () => {
    const houseItem = {
      kind: 'house',
      detailPath: '/house/year/2026-2027/rarity#house-event-synthetic-house-event',
      event: {
        id: 'synthetic-house-event',
        title: 'Fictional House Social',
        event_date: '2026-11-02',
        start_time: '18:00:00',
        end_time: null,
        location: 'Price Center',
        is_published: true,
      },
    } as Extract<UpcomingItem, { kind: 'house' }>;
    render(<MemoryRouter><NextEventAtGlance houseItem={houseItem} /></MemoryRouter>);
    expect(screen.getByText('Fictional House Social')).toBeInTheDocument();
    expect(screen.getByText(/6 PM/)).toBeInTheDocument();
    expect(screen.getByText('Price Center')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'House event details' }))
      .toHaveAttribute('href', houseItem.detailPath);
    expect(screen.queryByRole('link', { name: /Add to Google Calendar/i })).not.toBeInTheDocument();
  });

  it('never invents a time or location when the event does not specify them', () => {
    render(<NextEventAtGlance event={{ ...event, start_time: null, end_time: null, location: null } as Event} />);
    expect(screen.getByText(/Time to be announced/)).toBeInTheDocument();
    expect(screen.getByText('Location to be announced')).toBeInTheDocument();
  });
});
