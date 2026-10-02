import { useMemo } from 'react';
import {
  CalendarDayCell,
  CalendarItem,
  compareCalendarItems,
  getMonthGrid,
  itemOccursOn,
} from '../../../utils/calendar';
import { CalendarDayTile } from './CalendarDayTile';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  year: number;
  monthIndex: number;
  todayStr: string;
  items: CalendarItem[];
  selectedDateStr: string | null;
  onSelectItem: (item: CalendarItem) => void;
  onSelectDay: (dateStr: string) => void;
  onToggleDay: (dateStr: string) => void;
}

/**
 * Month board. Every event day is a flyer tile (the first event with a flyer,
 * else its category color) with the event name and a "+N" for the rest — a
 * compact tile on phones, a larger flyer card on tablet and desktop. See
 * CalendarDayTile for the shared tile and the per-breakpoint interactions.
 */
export function MonthGrid({
  year,
  monthIndex,
  todayStr,
  items,
  selectedDateStr,
  onSelectItem,
  onSelectDay,
  onToggleDay,
}: Props) {
  const cells = useMemo(() => getMonthGrid(year, monthIndex, todayStr), [year, monthIndex, todayStr]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const cell of cells) {
      const dayItems = items.filter((item) => itemOccursOn(item, cell.dateStr));
      if (dayItems.length > 0) map.set(cell.dateStr, dayItems.sort(compareCalendarItems));
    }
    return map;
  }, [cells, items]);

  return (
    <div className="scrapbook-paper relative overflow-hidden p-2 sm:p-3">
      <span className="scrapbook-pin" aria-hidden />
      <div className="grid grid-cols-7" role="presentation">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-1 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-text3)' }}
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day[0]}</span>
          </div>
        ))}

        {cells.map((cell: CalendarDayCell) => (
          <CalendarDayTile
            key={cell.dateStr}
            cell={cell}
            dayItems={itemsByDay.get(cell.dateStr) ?? []}
            isSelected={cell.dateStr === selectedDateStr}
            isPast={cell.dateStr < todayStr}
            onSelectItem={onSelectItem}
            onSelectDay={onSelectDay}
            onToggleDay={onToggleDay}
          />
        ))}
      </div>
    </div>
  );
}
