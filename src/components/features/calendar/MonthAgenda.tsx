import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDayGroup,
  CalendarItem,
  compareCalendarItems,
  formatDayGroupLabel,
  groupMonthAgenda,
  itemOccursOn,
} from '../../../utils/calendar';
import { formatDateOnly } from '../../../lib/dateOnly';
import { formatEventTime } from '../../../lib/eventTime';
import { cn } from '../../../lib/utils';
import { CalendarThumb } from './CalendarThumb';
import { getItemColor } from './calendarTheme';

interface Props {
  year: number;
  monthIndex: number;
  todayStr: string;
  items: CalendarItem[];
  selectedDateStr: string | null;
  onClearDay: () => void;
  onSelectItem: (item: CalendarItem) => void;
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'thing' : 'things'}`;
}

function itemMeta(item: CalendarItem): string {
  const parts = [item.startTime ? formatEventTime(item.startTime) : 'All day'];
  if (item.location) parts.push(item.location);
  if ((item.points ?? 0) > 0) parts.push(`+${item.points} pts`);
  return parts.join(' · ');
}

/**
 * Phone companion to the month board: lists what is on each day so the grid
 * dots are never the only clue. Narrows to one day while a day is selected.
 */
export function MonthAgenda({
  year,
  monthIndex,
  todayStr,
  items,
  selectedDateStr,
  onClearDay,
  onSelectItem,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  const groups = useMemo<CalendarDayGroup[]>(() => {
    if (!selectedDateStr) return groupMonthAgenda(items, year, monthIndex);
    const dayItems = items.filter((item) => itemOccursOn(item, selectedDateStr)).sort(compareCalendarItems);
    return dayItems.length > 0 ? [{ dateStr: selectedDateStr, items: dayItems }] : [];
  }, [items, year, monthIndex, selectedDateStr]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const monthName = formatDateOnly(`${year}-${String(monthIndex + 1).padStart(2, '0')}-01`, 'MMMM');
  const heading = selectedDateStr
    ? [formatDayGroupLabel(selectedDateStr, todayStr), total > 0 && countLabel(total)].filter(Boolean).join(' · ')
    : `${countLabel(total)} in ${monthName}`;

  return (
    <section aria-labelledby="month-agenda-heading" className="mb-6 mt-4 sm:hidden">
      <div className="mb-3 flex min-h-[32px] items-center gap-3">
        <h2
          id="month-agenda-heading"
          aria-live="polite"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-text-primary"
        >
          {heading}
        </h2>
        <div className="scrapbook-rule flex-1" aria-hidden />
        {selectedDateStr && (
          <button
            type="button"
            onClick={onClearDay}
            className="vsa-filter-btn shrink-0 px-2.5 py-1 text-[10px]"
          >
            Show all
          </button>
        )}
      </div>

      <motion.div
        key={selectedDateStr ?? `${year}-${monthIndex}`}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {groups.length === 0 ? (
          <p className="scrapbook-empty py-6 font-sans text-[13px] text-text-secondary">
            {selectedDateStr
              ? 'Nothing scheduled this day.'
              : `Nothing on the calendar in ${monthName} yet.`}
          </p>
        ) : (
          // Tape parked on the right so it doesn't stack under the board's.
          <ol className="scrapbook-paper [--tape-r:3deg] [--tape-x:82%]">
            {groups.map((group, index) => {
              const isToday = group.dateStr === todayStr;
              const isPast = group.dateStr < todayStr && group.items.every((item) => (item.endDate ?? item.date) < todayStr);
              return (
                <li
                  key={group.dateStr}
                  className={cn(
                    'flex gap-3 border-[var(--color-border)] px-3 py-3',
                    index > 0 && 'border-t',
                    isPast && 'opacity-60'
                  )}
                >
                  <div className="flex w-10 shrink-0 flex-col items-center pt-0.5" aria-hidden>
                    <span
                      className={cn(
                        'font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
                        isToday ? 'text-brand-600 dark:text-brand-400' : 'text-text-muted'
                      )}
                    >
                      {isToday ? 'Today' : formatDateOnly(group.dateStr, 'EEE')}
                    </span>
                    <span
                      className={cn(
                        'font-sans text-[22px] font-black leading-none',
                        isToday ? 'text-brand-600 dark:text-brand-400' : 'text-text-primary'
                      )}
                    >
                      {formatDateOnly(group.dateStr, 'd')}
                    </span>
                  </div>

                  <ul className="min-w-0 flex-1 space-y-2" aria-label={formatDayGroupLabel(group.dateStr, todayStr)}>
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => onSelectItem(item)}
                          className="flex w-full items-center gap-2.5 rounded-r-md border-l-[3px] py-1 pl-2.5 pr-1 text-left transition-colors hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
                          style={{ borderColor: getItemColor(item) }}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 font-sans text-[14px] font-bold leading-snug text-text-primary">
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wide text-text-secondary">
                              {itemMeta(item)}
                            </span>
                          </span>
                          <CalendarThumb
                            item={item}
                            className="h-12 w-12 shrink-0 rounded border border-[var(--color-border)]"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </motion.div>
    </section>
  );
}
