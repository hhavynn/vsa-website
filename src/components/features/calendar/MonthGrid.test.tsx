import { fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarItem } from '../../../utils/calendar';
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

function renderGrid(items: CalendarItem[], onToggleDay = jest.fn()) {
  render(
    <MonthGrid
      year={2026}
      monthIndex={9}
      todayStr="2026-09-29"
      items={items}
      selectedDateStr={null}
      onSelectItem={jest.fn()}
      onSelectDay={jest.fn()}
      onToggleDay={onToggleDay}
    />
  );
  return { onToggleDay };
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
