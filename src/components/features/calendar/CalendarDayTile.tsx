import { CalendarDayCell, CalendarItem } from '../../../utils/calendar';
import { formatDateOnly } from '../../../lib/dateOnly';
import { formatEventTime } from '../../../lib/eventTime';
import { cn } from '../../../lib/utils';
import { CalendarThumb } from './CalendarThumb';
import { getItemColor } from './calendarTheme';

interface Props {
  cell: CalendarDayCell;
  /** Every item on this day, already sorted */
  dayItems: CalendarItem[];
  isSelected: boolean;
  isPast: boolean;
  /** Open a single event */
  onSelectItem: (item: CalendarItem) => void;
  /** Open the day sheet (everything on one day) */
  onSelectDay: (dateStr: string) => void;
  /** Phone only: select the day so the agenda below narrows to it */
  onToggleDay: (dateStr: string) => void;
}

function describeDay(dateStr: string, dayItems: CalendarItem[]): string {
  const label = formatDateOnly(dateStr, 'EEEE, MMMM d');
  if (dayItems.length === 0) return `${label}, nothing scheduled`;
  const count = `${dayItems.length} ${dayItems.length === 1 ? 'event' : 'events'}`;
  return `${label}, ${count}: ${dayItems.map((item) => item.title).join(', ')}`;
}

/** The day-number chip, shared by the phone and desktop tiles. */
function dayNumberClasses(isToday: boolean, isSelected: boolean, onTile: boolean): string {
  if (isSelected) {
    return cn('text-surface', isToday ? 'bg-brand-600 dark:bg-brand-400' : 'bg-text-primary');
  }
  return cn(
    // Legible over a photo in both themes without hiding it.
    onTile && 'bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)]',
    isToday
      ? 'text-brand-600 ring-[1.5px] ring-inset ring-brand-600 dark:text-brand-400 dark:ring-brand-400'
      : onTile
        ? 'text-text-primary'
        : 'text-text-secondary'
  );
}

/** The item a tile features: the first one with a flyer, else the first. */
function pickFeatured(dayItems: CalendarItem[]): CalendarItem | undefined {
  return dayItems.find((item) => item.thumbnailUrl || item.imageUrl) ?? dayItems[0];
}

/** Category-color backdrop that shows when the item has no flyer (or it fails). */
function tileBackground(item: CalendarItem, percent: number): string {
  return `color-mix(in srgb, ${getItemColor(item)} ${percent}%, var(--color-surface))`;
}

/** "6 PM" / "All day", for the desktop tile footer and its accessible name. */
function timeLabel(item: CalendarItem): string {
  return item.startTime ? formatEventTime(item.startTime) : 'All day';
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400';
const FOCUS_OUTLINE =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400';

/**
 * One day of the month board. Below `sm` it is a compact phone tile where the
 * whole cell selects the day; from `sm` up it is the same tile grown into a
 * flyer card — the featured event opens that event, the day number and "+N"
 * open the day sheet. Both layouts read from the same featured-event, state
 * and color logic so the board looks like one design at every width.
 *
 * The two layouts are separate interactive shells (an event button cannot
 * nest inside a day button); the breakpoint hides the one that does not apply.
 */
export function CalendarDayTile({ cell, dayItems, isSelected, isPast, onSelectItem, onSelectDay, onToggleDay }: Props) {
  const featured = pickFeatured(dayItems);
  const extraCount = dayItems.length - 1;
  const dayLabel = describeDay(cell.dateStr, dayItems);

  return (
    <div
      className={cn(
        'border-t border-[var(--color-border)] px-px py-0.5 sm:h-[128px] sm:p-1 lg:h-[140px] xl:h-[152px]',
        cell.isToday && 'sm:bg-[color-mix(in_srgb,var(--color-brand)_7%,transparent)]',
        !cell.inMonth && 'opacity-[0.42]'
      )}
    >
      {/* Phone: the whole cell selects the day */}
      <button
        type="button"
        onClick={() => onToggleDay(cell.dateStr)}
        aria-pressed={isSelected}
        aria-current={cell.isToday ? 'date' : undefined}
        aria-label={dayLabel}
        className={cn(
          'flex min-h-[52px] w-full flex-col items-center gap-1 rounded-md p-0.5 sm:hidden',
          FOCUS_RING,
          isSelected && 'ring-[1.5px] ring-inset ring-text-primary'
        )}
      >
        {featured ? (
          <>
            <span
              className={cn(
                'relative flex h-11 w-full justify-center overflow-hidden rounded pt-1',
                isPast && 'opacity-60'
              )}
              style={{ background: tileBackground(featured, 24) }}
            >
              <CalendarThumb item={featured} className="absolute inset-0 h-full w-full" />
              <span
                className={cn(
                  'relative inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] font-bold',
                  dayNumberClasses(cell.isToday, isSelected, true)
                )}
              >
                {cell.dayOfMonth}
              </span>
              {extraCount > 0 && (
                <span
                  className="absolute bottom-0 right-0 rounded-tl bg-text-primary px-1 font-mono text-[8px] font-bold leading-[12px] text-surface"
                  aria-hidden
                >
                  +{extraCount}
                </span>
              )}
            </span>
            <span
              className={cn(
                'line-clamp-2 w-full break-words text-center font-sans text-[9px] font-bold leading-[1.15]',
                isPast ? 'text-text-secondary' : 'text-text-primary'
              )}
              aria-hidden
            >
              {featured.title}
            </span>
          </>
        ) : (
          <span className="pt-1">
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px]',
                cell.isToday || isSelected ? 'font-bold' : 'font-medium',
                dayNumberClasses(cell.isToday, isSelected, false)
              )}
            >
              {cell.dayOfMonth}
            </span>
          </span>
        )}
      </button>

      {/* Tablet / desktop */}
      <div className="hidden h-full sm:block">
        {featured ? (
          <div
            className="relative h-full overflow-hidden rounded-md border border-[var(--color-border)]"
            style={{ background: tileBackground(featured, 30) }}
          >
            <button
              type="button"
              onClick={() => onSelectItem(featured)}
              aria-label={`Open ${[featured.title, timeLabel(featured), featured.location].filter(Boolean).join(', ')}`}
              className={cn('group absolute inset-0 flex flex-col text-left', FOCUS_RING, 'focus-visible:ring-inset')}
            >
              <span className={cn('relative min-h-0 flex-1 overflow-hidden', isPast && 'opacity-60')}>
                <CalendarThumb
                  item={featured}
                  width={420}
                  className="absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </span>
              <span className="shrink-0 border-t border-[var(--color-border)] bg-surface px-2 py-1.5">
                <span
                  className={cn(
                    'line-clamp-2 font-sans text-[12px] font-bold leading-[1.2] lg:text-[13px]',
                    isPast ? 'text-text-secondary' : 'text-text-primary'
                  )}
                >
                  {featured.title}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wide text-text-secondary lg:text-[11px]">
                  {timeLabel(featured)}
                  {featured.location && <span className="hidden lg:inline"> · {featured.location}</span>}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectDay(cell.dateStr)}
              aria-current={cell.isToday ? 'date' : undefined}
              aria-label={dayLabel}
              className={cn(
                'absolute left-1.5 top-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[13px] font-bold',
                FOCUS_OUTLINE,
                dayNumberClasses(cell.isToday, isSelected, true)
              )}
            >
              {cell.dayOfMonth}
            </button>

            {extraCount > 0 && (
              <button
                type="button"
                onClick={() => onSelectDay(cell.dateStr)}
                aria-label={`Show all ${dayItems.length} events on ${formatDateOnly(cell.dateStr, 'MMMM d')}`}
                className={cn(
                  'absolute right-1.5 top-1.5 z-10 rounded bg-text-primary px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-wide text-surface hover:opacity-85',
                  FOCUS_OUTLINE
                )}
              >
                +{extraCount}
                <span className="hidden lg:inline"> more</span>
              </button>
            )}

            {/* Drawn above the flyer, which would otherwise cover an inset ring */}
            {(isSelected || cell.isToday) && (
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0 z-20 rounded-md ring-inset',
                  isSelected ? 'ring-2 ring-text-primary' : 'ring-[1.5px] ring-brand-600 dark:ring-brand-400'
                )}
              />
            )}
          </div>
        ) : (
          <div className="p-1">
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[13px]',
                cell.isToday || isSelected ? 'font-bold' : 'font-medium',
                dayNumberClasses(cell.isToday, isSelected, false)
              )}
            >
              {cell.dayOfMonth}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
