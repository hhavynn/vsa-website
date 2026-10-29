import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarItemCard } from './CalendarItemCard';
import type { CalendarItem } from '../../../utils/calendar';

const item: CalendarItem = {
  key: 'vsa:synthetic-1',
  source: 'vsa',
  title: 'Long Community Night Gathering',
  description: 'Public event description',
  date: '2026-11-05',
  endDate: null,
  startTime: '18:00:00',
  endTime: '20:00:00',
  location: 'Price Center',
  category: 'other',
  categoryLabel: 'General Events',
  points: 0,
  imageUrl: null,
  thumbnailUrl: null,
  houses: [],
  detailPath: '/events',
  applicationStatus: null,
  deadlineKind: null,
};

describe('public Calendar list card focus and separate actions (#313)', () => {
  it('provides a visible event-details button that activates once by keyboard', async () => {
    const onSelect = jest.fn();
    render(<CalendarItemCard item={item} index={0} onSelect={onSelect} />);
    const detail = screen.getByRole('button', { name: 'View details for Long Community Night Gathering' });
    expect(detail).toHaveClass('after:absolute', 'after:inset-0', 'after:z-10');
    await userEvent.tab();
    expect(detail).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(item);
  });

  it('does not treat the article as a separate invisible button or open details on calendar-save click', () => {
    const onSelect = jest.fn();
    const view = render(<CalendarItemCard item={item} index={1} onSelect={onSelect} />);
    const article = view.container.querySelector('article');
    expect(article).toBeInTheDocument();
    expect(article).not.toHaveAttribute('tabindex');
    expect(article).not.toHaveAttribute('role', 'button');
    fireEvent.click(article!);
    expect(onSelect).not.toHaveBeenCalled();
    const calendar = screen.getByRole('link', { name: /Add Long Community Night Gathering to Google Calendar/i });
    expect(calendar).toHaveClass('relative', 'z-20');
    expect(calendar).toHaveAttribute('target', '_blank');
    fireEvent.click(calendar);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /View details for Long Community Night Gathering/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps the Google Calendar action optional for restricted event kinds without hiding details', () => {
    render(<CalendarItemCard item={{ ...item, googleCalendarEnabled: false }} index={2} onSelect={jest.fn()} />);
    expect(screen.getByRole('button', { name: /View details for Long Community Night Gathering/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Google Calendar/i })).not.toBeInTheDocument();
  });
});
