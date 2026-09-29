import { useMemo } from 'react';
import {
  CalendarDayCell,
  CalendarItem,
  compareCalendarItems,
  getMonthGrid,
  itemOccursOn,
} from '../../../utils/calendar';
import { formatDateOnly } from '../../../lib/dateOnly';
import { CalendarThumb } from './CalendarThumb';
import { getItemColor } from './calendarTheme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;
// Legible over a photo in both themes without hiding it.
const NUMBER_BACKDROP = 'color-mix(in srgb, var(--color-surface) 88%, transparent)';

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

function describeDay(dateStr: string, dayItems: CalendarItem[]): string {
  const label = formatDateOnly(dateStr, 'EEEE, MMMM d');
  if (dayItems.length === 0) return `${label}, nothing scheduled`;
  const count = `${dayItems.length} ${dayItems.length === 1 ? 'event' : 'events'}`;
  return `${label}, ${count}: ${dayItems.map((item) => item.title).join(', ')}`;
}

function dayNumberStyle(isToday: boolean, isSelected: boolean, onTile: boolean) {
  if (isSelected) {
    return {
      background: isToday ? 'var(--color-brand)' : 'var(--color-text)',
      color: 'var(--color-surface)',
    };
  }
  const background = onTile ? NUMBER_BACKDROP : undefined;
  if (isToday) {
    return { background, color: 'var(--color-brand)', boxShadow: 'inset 0 0 0 1.5px var(--color-brand)' };
  }
  return { background, color: onTile ? 'var(--color-text)' : 'var(--color-text2)' };
}

/** The item a phone tile features: the first one with a flyer, else the first. */
function pickFeatured(dayItems: CalendarItem[]): CalendarItem | undefined {
  return dayItems.find((item) => item.thumbnailUrl || item.imageUrl) ?? dayItems[0];
}

/**
 * Month board view. Desktop cells show up to three event chips plus a
 * "+N more" overflow. On small screens each event day becomes a photo tile
 * (event flyer, or the category color) with the event name underneath; the
 * whole cell selects the day so the agenda below can narrow to it.
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

        {cells.map((cell: CalendarDayCell) => {
          const dayItems = itemsByDay.get(cell.dateStr) ?? [];
          const hasItems = dayItems.length > 0;
          const isSelected = cell.dateStr === selectedDateStr;
          const featured = pickFeatured(dayItems);
          const isPast = cell.dateStr < todayStr;
          return (
            <div
              key={cell.dateStr}
              className={`border-t px-px py-0.5 sm:min-h-[104px] sm:p-1.5 ${
                cell.isToday ? 'sm:bg-[color-mix(in_srgb,var(--color-brand)_7%,transparent)]' : ''
              }`}
              style={{
                borderColor: 'var(--color-border)',
                opacity: cell.inMonth ? 1 : 0.42,
              }}
            >
              {/* Mobile: the whole cell selects the day */}
              <button
                type="button"
                onClick={() => onToggleDay(cell.dateStr)}
                aria-pressed={isSelected}
                aria-label={describeDay(cell.dateStr, dayItems)}
                className="flex min-h-[52px] w-full flex-col items-center gap-1 rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400 sm:hidden"
                style={{ boxShadow: isSelected ? 'inset 0 0 0 1.5px var(--color-text)' : undefined }}
              >
                {featured ? (
                  <>
                    <span
                      className="relative flex h-11 w-full justify-center overflow-hidden rounded pt-1"
                      style={{
                        background: `color-mix(in srgb, ${getItemColor(featured)} 24%, var(--color-surface))`,
                        opacity: isPast ? 0.55 : 1,
                      }}
                    >
                      <CalendarThumb item={featured} className="absolute inset-0 h-full w-full" />
                      <span
                        className="relative inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] font-bold"
                        style={dayNumberStyle(cell.isToday, isSelected, true)}
                      >
                        {cell.dayOfMonth}
                      </span>
                      {dayItems.length > 1 && (
                        <span
                          className="absolute bottom-0 right-0 rounded-tl px-1 font-mono text-[8px] font-bold leading-[12px]"
                          style={{ background: 'var(--color-text)', color: 'var(--color-surface)' }}
                          aria-hidden
                        >
                          +{dayItems.length - 1}
                        </span>
                      )}
                    </span>
                    <span
                      className="line-clamp-2 w-full break-words text-center font-sans text-[9px] font-bold leading-[1.15]"
                      style={{ color: isPast ? 'var(--color-text2)' : 'var(--color-text)' }}
                      aria-hidden
                    >
                      {featured.title}
                    </span>
                  </>
                ) : (
                  <span className="pt-1">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] ${
                        cell.isToday || isSelected ? 'font-bold' : 'font-medium'
                      }`}
                      style={dayNumberStyle(cell.isToday, isSelected, false)}
                    >
                      {cell.dayOfMonth}
                    </span>
                  </span>
                )}
              </button>

              {/* Desktop: day number opens the day sheet, chips open items */}
              <button
                type="button"
                onClick={() => hasItems && onSelectDay(cell.dateStr)}
                disabled={!hasItems}
                aria-label={hasItems ? describeDay(cell.dateStr, dayItems) : undefined}
                className="hidden w-full items-center justify-between rounded-md px-1 disabled:cursor-default sm:flex"
              >
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                  style={{
                    background: cell.isToday ? 'var(--color-brand)' : 'transparent',
                    color: cell.isToday ? '#fff' : 'var(--color-text2)',
                  }}
                >
                  {cell.dayOfMonth}
                </span>
              </button>

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
