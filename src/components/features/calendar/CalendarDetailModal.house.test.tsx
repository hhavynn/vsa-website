/**
 * Calendar detail for a House event (#632): who hosts it in text (not color
 * alone), that it awards no attendance points, a safe RSVP link, and no
 * Google Calendar button when the event turned it off.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalendarDetailModal } from './CalendarDetailModal';
import type { CalendarItem } from '../../../utils/calendar';

const item = (overrides: Partial<CalendarItem> = {}): CalendarItem => ({
  key: 'house:e1', source: 'house', title: 'Fictional Collab Night', description: null, date: '2026-11-14', endDate: null,
  startTime: '18:00:00', endTime: '20:00:00', location: 'Price Center', category: 'house', categoryLabel: 'House Event',
  points: null, imageUrl: null, thumbnailUrl: null,
  houses: [{ name: 'Twilight Sparkle', color: '#7b5ea7', pagePath: '/house/year/2026-2027/twilight-sparkle' }, { name: 'Rarity', color: '#6b8fd6', pagePath: '/house/year/2026-2027/rarity' }],
  detailPath: '/house/year/2026-2027/twilight-sparkle#house-event-e1', applicationStatus: null, deadlineKind: null,
  googleCalendarEnabled: false, rsvpUrl: 'https://forms.example/rsvp', ...overrides,
});

function renderItem(calendarItem: CalendarItem) {
  render(<MemoryRouter><CalendarDetailModal overlay={{ mode: 'item', item: calendarItem }} todayStr="2026-11-01" onClose={jest.fn()} onSelectItem={jest.fn()} /></MemoryRouter>);
}

it('names the hosts, says no attendance points, links RSVP safely and hides Google Calendar when turned off', () => {
  renderItem(item());
  expect(screen.getByText('Hosted by Twilight Sparkle + Rarity.')).toBeInTheDocument();
  expect(screen.getByText(/does not award VSA attendance points/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /RSVP/ })).toHaveAttribute('href', 'https://forms.example/rsvp');
  expect(screen.queryByRole('link', { name: /Google Calendar/ })).not.toBeInTheDocument();
});

it('drops an unsafe RSVP link and shows Google Calendar by default', () => {
  renderItem(item({ rsvpUrl: ['javascript', 'alert(1)'].join(':'), googleCalendarEnabled: undefined }));
  expect(screen.queryByRole('link', { name: /RSVP/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Google Calendar/ })).toBeInTheDocument();
});
