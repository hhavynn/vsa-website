import { fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarItem } from '../../../utils/calendar';
import { CalendarThumb } from './CalendarThumb';
import { MonthAgenda } from './MonthAgenda';
import { MonthGrid } from './MonthGrid';

function makeItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    key: 'vsa:1',
    source: 'vsa',
    title: 'Pho & Karaoke',
    description: null,
    date: '2026-10-08',
    endDate: null,
    startTime: '18:00:00',
    endTime: null,
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
    ...overrides,
  };
}

function renderGrid(
  items: CalendarItem[],
  { onToggleDay = jest.fn(), todayStr = '2026-09-29', selectedDateStr = null as string | null } = {}
) {
  const onSelectItem = jest.fn();
  const onSelectDay = jest.fn();
  render(
    <MonthGrid
      year={2026}
      monthIndex={9}
      todayStr={todayStr}
      items={items}
      selectedDateStr={selectedDateStr}
      onSelectItem={onSelectItem}
      onSelectDay={onSelectDay}
      onToggleDay={onToggleDay}
    />
  );
  return { onToggleDay, onSelectItem, onSelectDay };
}

// The phone cell is the only day button that carries aria-pressed.
// Thumbnails are decorative (alt=""), so they expose the presentation role.
function phoneCell(label: RegExp) {
  return screen.getAllByRole('button', { name: label }).find((b) => b.hasAttribute('aria-pressed'))!;
}

describe('MonthGrid phone tiles', () => {
  it('shows the flyer and name of the first event that has an image, plus a +N badge', () => {
    renderGrid([
      makeItem({ key: 'deadline', title: 'Intern Apps Due', startTime: null }),
      makeItem({ key: 'pho', thumbnailUrl: '/images/events/pho_thumb.webp' }),
    ]);
    const cell = phoneCell(/^Thursday, October 8, 2 events: Intern Apps Due, Pho & Karaoke$/);

    expect(within(cell).getByText('Pho & Karaoke')).toBeInTheDocument();
    expect(within(cell).getByRole('presentation')).toHaveAttribute('src', '/images/events/pho_thumb.webp');
    expect(within(cell).getByText('+1')).toBeInTheDocument();
  });

  it('names an event without an image and drops a thumbnail that fails to load', () => {
    renderGrid([
      makeItem({ key: 'deadline', date: '2026-10-21', title: 'Intern Apps Due' }),
      makeItem({ key: 'broken', imageUrl: '/images/events/missing.webp' }),
    ]);

    const deadline = phoneCell(/^Wednesday, October 21/);
    expect(within(deadline).getByText('Intern Apps Due')).toBeInTheDocument();
    expect(within(deadline).queryByRole('presentation')).not.toBeInTheDocument();

    const broken = phoneCell(/^Thursday, October 8/);
    fireEvent.error(within(broken).getByRole('presentation'));
    expect(within(broken).queryByRole('presentation')).not.toBeInTheDocument();
    expect(within(broken).getByText('Pho & Karaoke')).toBeInTheDocument();
  });

  it('selects any day, including empty ones', () => {
    const { onToggleDay } = renderGrid([makeItem()]);
    fireEvent.click(phoneCell(/^Thursday, October 8/));
    fireEvent.click(phoneCell(/^Friday, October 9, nothing scheduled$/));
    expect(onToggleDay.mock.calls).toEqual([['2026-10-08'], ['2026-10-09']]);
  });
});

// Tablet/desktop tiles share the DOM with the phone tiles (the breakpoint only
// hides one), so they are found by their own labels, never by aria-pressed.
describe('MonthGrid desktop tiles', () => {
  const deadline = makeItem({ key: 'deadline', title: 'Intern Apps Due', startTime: null });
  const pho = makeItem({ key: 'pho', thumbnailUrl: '/images/events/pho_thumb.webp' });

  it('features the first event with a flyer, with its name, time and place', () => {
    renderGrid([deadline, pho]);
    const featured = screen.getByRole('button', { name: 'Open Pho & Karaoke, 6 PM, Price Center' });

    expect(within(featured).getByRole('presentation')).toHaveAttribute('src', '/images/events/pho_thumb.webp');
    expect(within(featured).getByText('Pho & Karaoke')).toBeInTheDocument();
    expect(within(featured).getByText('6 PM')).toBeInTheDocument();
    expect(within(featured).getByText(/Price Center/)).toBeInTheDocument();
  });

  it('opens the featured event when its tile is clicked', () => {
    const { onSelectItem, onSelectDay } = renderGrid([deadline, pho]);
    fireEvent.click(screen.getByRole('button', { name: /^Open Pho & Karaoke/ }));

    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem.mock.calls[0][0]).toMatchObject({ key: 'pho' });
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it('shows +N for the other events and opens the day from it or the day number', () => {
    const { onSelectItem, onSelectDay } = renderGrid([deadline, pho]);

    const more = screen.getByRole('button', { name: 'Show all 2 events on October 8' });
    expect(within(more).getByText('+1')).toBeInTheDocument();
    fireEvent.click(more);

    const dayNumber = screen
      .getAllByRole('button', { name: /^Thursday, October 8, 2 events/ })
      .find((b) => !b.hasAttribute('aria-pressed'))!;
    fireEvent.click(dayNumber);

    expect(onSelectDay.mock.calls).toEqual([['2026-10-08'], ['2026-10-08']]);
    expect(onSelectItem).not.toHaveBeenCalled();
  });

  it('offers no +N for a single event', () => {
    renderGrid([pho]);
    expect(screen.queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();
  });

  it('stays readable without a flyer, or when the flyer fails to load', () => {
    renderGrid([
      makeItem({ key: 'deadline', date: '2026-10-21', title: 'Intern Apps Due', startTime: null, location: null }),
      makeItem({ key: 'broken', imageUrl: '/images/events/missing.webp' }),
    ]);

    const noFlyer = screen.getByRole('button', { name: 'Open Intern Apps Due, All day' });
    expect(within(noFlyer).queryByRole('presentation')).not.toBeInTheDocument();
    expect(within(noFlyer).getByText('Intern Apps Due')).toBeInTheDocument();
    expect(within(noFlyer).getByText('All day')).toBeInTheDocument();

    const broken = screen.getByRole('button', { name: /^Open Pho & Karaoke/ });
    fireEvent.error(within(broken).getByRole('presentation'));
    expect(within(broken).queryByRole('presentation')).not.toBeInTheDocument();
    expect(within(broken).getByText('Pho & Karaoke')).toBeInTheDocument();
  });

  it('leaves empty days as plain day numbers (only the phone cell is a button)', () => {
    renderGrid([pho]);
    expect(screen.getAllByRole('button', { name: /^Friday, October 9, nothing scheduled$/ })).toHaveLength(1);
  });

  it('marks today on both layouts and the selected day on the phone cell', () => {
    renderGrid([pho], { todayStr: '2026-10-08', selectedDateStr: '2026-10-08' });
    const buttons = screen.getAllByRole('button', { name: /^Thursday, October 8, 1 event: Pho & Karaoke$/ });

    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toHaveAttribute('aria-current', 'date'));
    expect(buttons.find((b) => b.hasAttribute('aria-pressed'))).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('MonthAgenda', () => {
  const items = [
    makeItem({ key: 'a', date: '2026-10-02', title: "La Jolla S'mores" }),
    makeItem({ key: 'b', date: '2026-10-08', title: 'Pho & Karaoke' }),
    makeItem({ key: 'nov', date: '2026-11-03', title: 'November GBM' }),
  ];

  function renderAgenda(selectedDateStr: string | null) {
    render(
      <MonthAgenda
        year={2026}
        monthIndex={9}
        todayStr="2026-09-29"
        items={items}
        selectedDateStr={selectedDateStr}
        onClearDay={jest.fn()}
        onSelectItem={jest.fn()}
      />
    );
  }

  it('spells the category out in text so the coloured edge is never the only cue', () => {
    renderAgenda(null);
    const meta = screen.getAllByText(/General Events · /);
    expect(meta.length).toBeGreaterThanOrEqual(2);
    expect(meta[0]).toHaveTextContent('General Events · 6 PM · Price Center · +1 pts');
  });

  it('lists every event in the month by day', () => {
    renderAgenda(null);
    expect(screen.getByRole('heading', { name: '2 things in October' })).toBeInTheDocument();
    expect(screen.getByText("La Jolla S'mores")).toBeInTheDocument();
    expect(screen.getByText('Pho & Karaoke')).toBeInTheDocument();
    expect(screen.queryByText('November GBM')).not.toBeInTheDocument();
  });

  it('narrows to the selected day', () => {
    renderAgenda('2026-10-08');
    expect(screen.getByRole('heading', { name: 'Thu, Oct 8 · 1 thing' })).toBeInTheDocument();
    expect(screen.queryByText("La Jolla S'mores")).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument();
  });
});

describe('CalendarThumb', () => {
  it('retries when a tile that lost one image shows a different event', () => {
    const { rerender } = render(<CalendarThumb item={makeItem({ imageUrl: '/images/events/missing.webp' })} />);
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();

    rerender(<CalendarThumb item={makeItem({ key: 'gbm', thumbnailUrl: '/images/events/gbm_thumb.webp' })} />);
    expect(screen.getByRole('presentation')).toHaveAttribute('src', '/images/events/gbm_thumb.webp');
  });
});
