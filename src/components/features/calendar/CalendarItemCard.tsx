import { CalendarItem } from '../../../utils/calendar';
import { formatEventDateRange, formatEventTimeRange, formatEventTime } from '../../../lib/eventTime';
import { formatDateOnly } from '../../../lib/dateOnly';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { AddToGoogleCalendarLink } from './AddToGoogleCalendarLink';
import { getItemColor } from './calendarTheme';

const ROTATIONS = ['scrapbook-rotate-sm-left', '', 'scrapbook-rotate-sm-right'];

interface Props {
  item: CalendarItem;
  index: number;
  onSelect: (item: CalendarItem) => void;
}

/** Scrapbook list-view card: date note + details + Google Calendar button. */
export function CalendarItemCard({ item, index, onSelect }: Props) {
  const color = getItemColor(item);
  const thumb = item.thumbnailUrl || item.imageUrl;

  return (
    <article
      className={`scrapbook-paper relative grid cursor-pointer gap-4 p-4 transition-transform hover:-translate-y-1 sm:grid-cols-[84px_minmax(0,1fr)_auto] ${ROTATIONS[index % ROTATIONS.length]}`}
      style={{ borderColor: `${color}55` }}
      onClick={() => onSelect(item)}
    >
      <span className="scrapbook-pin" aria-hidden />

      {/* Date note */}
      <div
        className="scrapbook-note flex h-[72px] w-[84px] flex-col items-center justify-center border sm:h-auto sm:w-auto"
        style={{ borderColor: 'var(--color-border)' }}
        aria-hidden
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color }}>
          {formatDateOnly(item.date, 'EEE')}
        </span>
        <span className="font-sans text-2xl font-black leading-none" style={{ color: 'var(--text)' }}>
          {formatDateOnly(item.date, 'd')}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
          {formatDateOnly(item.date, 'MMM')}
        </span>
      </div>

      {/* Details */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
            {item.categoryLabel}
          </span>
          {item.deadlineKind && (
            <span className="scrapbook-sticker scrapbook-sticker-gold px-2 py-0.5 text-[9px]">
              {item.deadlineKind === 'opens' ? 'Opens' : 'Due'}
            </span>
          )}
          {(item.points ?? 0) > 0 && (
            <span className="scrapbook-sticker scrapbook-sticker-gold px-2 py-0.5 text-[9px]">
              +{item.points} pts
            </span>
          )}
          {item.houses.map((house) => (
            <span
              key={house.name}
              className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white"
              style={{ background: house.color }}
            >
              {house.name}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item);
          }}
          className="mt-1.5 block text-left font-sans text-[16px] font-bold leading-snug hover:underline"
          style={{ color: 'var(--text)' }}
        >
          {item.title}
        </button>

        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
          {formatEventDateRange(item.date, item.endDate)}
          {item.startTime && item.endTime && ` · ${formatEventTimeRange(item.startTime, item.endTime)}`}
          {item.startTime && !item.endTime && ` · ${formatEventTime(item.startTime)}`}
          {item.location && ` · ${item.location}`}
        </p>
      </div>

      {/* Thumbnail + action */}
      <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-between">
        {thumb && (
          <div className="scrapbook-photo hidden h-14 w-20 shrink-0 rotate-1 overflow-hidden lg:block" aria-hidden>
            <img
              src={getSupabaseImageUrl(thumb, { width: 240 }) || thumb}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <AddToGoogleCalendarLink item={item} />
      </div>
    </article>
  );
}
