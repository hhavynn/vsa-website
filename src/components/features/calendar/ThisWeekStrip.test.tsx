import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CalendarItem } from '../../../utils/calendar';
import { ThisWeekStrip } from './ThisWeekStrip';

const item = (i: number): CalendarItem => ({
  key: `vsa:weekly-${i}`,
  source: 'vsa',
  title: `Fictional Week Event ${i}`,
  description: null,
  date: '2026-10-29',
  endDate: null,
  startTime: '18:00:00',
  endTime: '20:00:00',
  location: 'Price Center',
  category: 'other',
  categoryLabel: 'General Events',
  points: 1,
  imageUrl: null,
  thumbnailUrl: null,
  houses: [],
  detailPath: '/events',
  applicationStatus: null,
  deadlineKind: null,
});

describe('public Calendar weekly rail discoverability (#209)', () => {
  it('renders no empty horizontal carousel or misleading swipe instructions', () => {
    const { container } = render(<ThisWeekStrip items={[]} todayStr="2026-10-29" onSelectItem={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('omits swipe instructions when only one event exists and keeps its full details', () => {
    render(<ThisWeekStrip items={[item(1)]} todayStr="2026-10-29" onSelectItem={jest.fn()} />);
    expect(screen.getByText('1 thing happening')).toBeInTheDocument();
    expect(screen.queryByText(/Swipe sideways/)).not.toBeInTheDocument();
    const rail = screen.getByRole('region', { name: "This week's event highlights" });
    expect(within(rail).getAllByRole('button')).toHaveLength(1);
    expect(rail).toHaveTextContent('Price Center');
  });

  it('explains horizontal scrolling and provides visible keyboard focus for each event', () => {
    const onSelectItem = jest.fn();
    render(<ThisWeekStrip items={[item(1), item(2)]} todayStr="2026-10-29" onSelectItem={onSelectItem} />);
    expect(screen.getByText("Swipe sideways to explore this week's events")).toHaveClass('sm:hidden');
    const rail = screen.getByRole('region', { name: "This week's event highlights" });
    const buttons = within(rail).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveClass('focus-visible:ring-2', 'motion-reduce:transition-none');
    fireEvent.click(buttons[1]);
    expect(onSelectItem).toHaveBeenCalledWith(item(2));
    expect(onSelectItem).toHaveBeenCalledTimes(1);
  });

  it('tells visitors when the 10-card preview excludes other weekly events', () => {
    render(
      <ThisWeekStrip
        items={Array.from({ length: 12 }, (_, index) => item(index + 1))}
        todayStr="2026-10-29"
        onSelectItem={jest.fn()}
      />,
    );
    expect(screen.getByText('12 things happening')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Showing the first 10 of 12 events');
    const buttons = within(screen.getByRole('region', { name: "This week's event highlights" })).getAllByRole('button');
    expect(buttons).toHaveLength(10);
    expect(screen.queryByText('Fictional Week Event 11')).not.toBeInTheDocument();
    expect(screen.queryByText('Fictional Week Event 12')).not.toBeInTheDocument();
  });
});
