import { useMemo } from 'react';
import {
  CalendarDayCell,
  CalendarItem,
  compareCalendarItems,
  getMonthGrid,
  itemOccursOn,
} from '../../../utils/calendar';
import { getItemColor } from './calendarTheme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

interface Props {
  year: number;
  monthIndex: number;
  todayStr: string;
  items: CalendarItem[];
  onSelectItem: (item: CalendarItem) => void;
  onSelectDay: (dateStr: string) => void;
}

/**
 * Month board view. Desktop cells show up to three event chips plus a
 * "+N more" overflow; on small screens chips collapse to colored dots and
 * tapping the day opens the day sheet.
 */
export function MonthGrid({ year, monthIndex, todayStr, items, onSelectItem, onSelectDay }: Props) {
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

        {cells.map((cell: CalendarDayCell) => {
          const dayItems = itemsByDay.get(cell.dateStr) ?? [];
          const hasItems = dayItems.length > 0;
          return (
            <div
              key={cell.dateStr}
              className="min-h-[56px] border-t p-1 sm:min-h-[104px] sm:p-1.5"
              style={{
                borderColor: 'var(--color-border)',
                opacity: cell.inMonth ? 1 : 0.42,
                background: cell.isToday
                  ? 'color-mix(in srgb, var(--color-brand) 7%, transparent)'
                  : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => hasItems && onSelectDay(cell.dateStr)}
                disabled={!hasItems}
                aria-label={
                  hasItems
                    ? `${cell.dateStr}: ${dayItems.length} ${dayItems.length === 1 ? 'item' : 'items'}`
                    : undefined
                }
                className="flex w-full items-center justify-between rounded-md px-1 disabled:cursor-default"
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                    cell.isToday ? 'text-white' : ''
                  }`}
                  style={{
                    background: cell.isToday ? 'var(--color-brand)' : 'transparent',
                    color: cell.isToday ? '#fff' : 'var(--color-text2)',
                  }}
                >
                  {cell.dayOfMonth}
                </span>
                {/* Mobile: dots only */}
                {hasItems && (
                  <span className="flex gap-0.5 sm:hidden" aria-hidden>
                    {dayItems.slice(0, 3).map((item) => (
                      <span
                        key={item.key}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: getItemColor(item) }}
                      />
                    ))}
                  </span>
                )}
              </button>

              {/* Desktop: chips */}
              <div className="mt-1 hidden space-y-1 sm:block">
                {dayItems.slice(0, MAX_CHIPS).map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => onSelectItem(item)}
                    className="flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors hover:bg-[var(--surface2)]"
                    style={{
                      borderColor: `${getItemColor(item)}55`,
                      background: 'var(--color-surface)',
                    }}
                    title={item.title}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: getItemColor(item) }}
                      aria-hidden
                    />
                    <span className="truncate font-sans text-[11px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                      {item.title}
                    </span>
                  </button>
                ))}
                {dayItems.length > MAX_CHIPS && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(cell.dateStr)}
                    className="w-full rounded-md px-1.5 py-0.5 text-left font-mono text-[10px] font-bold uppercase tracking-wide hover:bg-[var(--surface2)]"
                    style={{ color: 'var(--color-text3)' }}
                  >
                    +{dayItems.length - MAX_CHIPS} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
