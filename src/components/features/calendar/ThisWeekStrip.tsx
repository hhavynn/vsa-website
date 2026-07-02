import { CalendarItem, formatDayGroupLabel } from '../../../utils/calendar';
import { formatEventTime } from '../../../lib/eventTime';
import { formatDateOnly } from '../../../lib/dateOnly';
import { getItemColor } from './calendarTheme';

interface Props {
  items: CalendarItem[];
  todayStr: string;
  onSelectItem: (item: CalendarItem) => void;
}

const ROTATIONS = ['scrapbook-rotate-sm-left', 'scrapbook-rotate-sm-right', ''];

/** Horizontally scrollable "This Week" highlight strip of scrapbook cards. */
export function ThisWeekStrip({ items, todayStr, onSelectItem }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Happening this week">
      <div className="mb-3 flex items-center gap-3">
        <span className="scrapbook-sticker scrapbook-sticker-coral px-2.5 py-1 text-[10px]">
          This Week
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
          {items.length} {items.length === 1 ? 'thing' : 'things'} happening
        </span>
      </div>

      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 pt-2">
        {items.slice(0, 10).map((item, index) => {
          const color = getItemColor(item);
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => onSelectItem(item)}
              className={`scrapbook-photo scrapbook-hover-tilt w-[210px] shrink-0 snap-start p-3 text-left transition-transform ${ROTATIONS[index % ROTATIONS.length]}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color }}>
                  {formatDayGroupLabel(item.date, todayStr)}
                </span>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                  aria-hidden
                />
              </div>
              <div className="mt-1.5 line-clamp-2 font-sans text-[14px] font-bold leading-snug" style={{ color: 'var(--text)' }}>
                {item.title}
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                {item.startTime ? formatEventTime(item.startTime) : formatDateOnly(item.date, 'MMM d')}
                {item.location ? ` · ${item.location}` : ''}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
                  {item.categoryLabel}
                </span>
                {(item.points ?? 0) > 0 && (
                  <span className="scrapbook-sticker scrapbook-sticker-gold px-2 py-0.5 text-[9px]">
                    +{item.points} pts
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
