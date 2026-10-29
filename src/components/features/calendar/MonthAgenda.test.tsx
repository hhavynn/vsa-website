import { fireEvent, render, screen } from '@testing-library/react';
import type { CalendarItem } from '../../../utils/calendar';
import { MonthAgenda } from './MonthAgenda';

const makeItem = (key: string, overrides: Partial<CalendarItem> = {}): CalendarItem => ({
  key,
  source: 'vsa',
  title: 'The Annual Very Long Community Gathering and Social Night for New Students',
  description: null,
  date: '2026-10-29',
  endDate: null,
  startTime: '18:00:00',
  endTime: '20:00:00',
  location: 'A Very Long Room Name at Price Center West Near the Courtyard Entrance',
  category: 'mixer',
  categoryLabel: 'Mixer',
  points: 2,
  imageUrl: null,
  thumbnailUrl: null,
  houses: [],
  detailPath: '/events',
  applicationStatus: null,
  deadlineKind: null,
  ...overrides,
});

function mount(items: CalendarItem[], selectedDateStr: string | null = null, onSelectItem = jest.fn(), onClearDay = jest.fn()) {
  return render(
    <MonthAgenda
      year={2026}
      monthIndex={9}
      todayStr="2026-10-29"
      items={items}
      selectedDateStr={selectedDateStr}
      onSelectItem={onSelectItem}
      onClearDay={onClearDay}
    />,
  );
}

describe('public Calendar mobile agenda readability (#209)', () => {
  it('renders complete event title and the full time/location/points metadata without ellipsis truncation', () => {
    const item = makeItem('vsa:long');
    mount([item]);
    const button = screen.getByRole('button', { name: /Annual Very Long Community Gathering/ });
    expect(button).toHaveTextContent(item.title);
    expect(button).toHaveTextContent(item.location!);
    expect(button).toHaveTextContent('2 pts');
    const title = screen.getByText(item.title);
    expect(title).toHaveClass('break-words');
    expect(title).not.toHaveClass('line-clamp-2');
    const meta = screen.getByText(/A Very Long Room Name at Price Center West/);
    expect(meta).toHaveClass('break-words', 'whitespace-normal');
    expect(meta).not.toHaveClass('truncate');
  });

  it('opens the selected public item without changing item data', () => {
    const item = makeItem('vsa:one');
    const onSelectItem = jest.fn();
    mount([item], null, onSelectItem);
    fireEvent.click(screen.getByRole('button', { name: /Annual Very Long Community Gathering/ }));
    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith(item);
  });

  it('offers a 44px Show all action when a day is selected and restores only through the supplied callback', () => {
    const onClearDay = jest.fn();
    const one = makeItem('vsa:first');
    const other = makeItem('vsa:second', { date: '2026-10-30', title: 'The Next Day' });
    mount([one, other], '2026-10-29', jest.fn(), onClearDay);
    const showAll = screen.getByRole('button', { name: 'Show all' });
    expect(showAll).toHaveClass('min-h-11');
    expect(screen.getByRole('list', { name: /Oct 29/ })).toHaveTextContent(one.title);
    expect(screen.queryByText('The Next Day')).not.toBeInTheDocument();
    fireEvent.click(showAll);
    expect(onClearDay).toHaveBeenCalledTimes(1);
  });

  it('does not fabricate logistics or points for all-day and zero-point items', () => {
    const item = makeItem('vsa:all-day', { startTime: null, location: null, points: 0, title: 'Campus Celebration' });
    mount([item]);
    const button = screen.getByRole('button', { name: /Campus Celebration/ });
    expect(button).toHaveTextContent('All day');
    expect(button).not.toHaveTextContent('pts');
    expect(button).not.toHaveTextContent('undefined');
  });

  it('preserves the explicit no-events state for a filtered date', () => {
    mount([], '2026-10-29');
    expect(screen.getByText('Nothing scheduled this day.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
