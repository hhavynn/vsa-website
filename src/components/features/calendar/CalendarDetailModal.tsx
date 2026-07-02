import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarItem, compareCalendarItems, formatDayGroupLabel } from '../../../utils/calendar';
import { formatEventDateRange, formatEventTime, formatEventTimeRange } from '../../../lib/eventTime';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { AddToGoogleCalendarLink } from './AddToGoogleCalendarLink';
import { getDetailLinkLabel, getItemColor } from './calendarTheme';

export type CalendarOverlayState =
  | { mode: 'item'; item: CalendarItem }
  | { mode: 'day'; dateStr: string; items: CalendarItem[] };

interface Props {
  overlay: CalendarOverlayState | null;
  todayStr: string;
  onClose: () => void;
  onSelectItem: (item: CalendarItem) => void;
}

function ItemDetail({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const color = getItemColor(item);
  const image = item.imageUrl || item.thumbnailUrl;

  return (
    <>
      {image && (
        <div className="scrapbook-photo -rotate-1 overflow-hidden">
          <img
            src={getSupabaseImageUrl(image, { width: 800 }) || image}
            alt=""
            className="max-h-56 w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="scrapbook-sticker scrapbook-sticker-teal px-2 py-0.5 text-[9px]">
          {item.categoryLabel}
        </span>
        {item.deadlineKind && (
          <span className="scrapbook-sticker scrapbook-sticker-gold px-2 py-0.5 text-[9px]">
            {item.deadlineKind === 'opens' ? 'Applications open' : 'Deadline'}
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
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white"
            style={{ background: house.color }}
          >
            {house.name}
          </span>
        ))}
      </div>

      <h2 id="calendar-detail-title" className="mt-3 font-sans text-xl font-bold leading-snug" style={{ color: 'var(--text)' }}>
        {item.title}
      </h2>

      <div className="mt-2 space-y-1 font-mono text-[11px] uppercase tracking-[0.06em]" style={{ color: 'var(--color-text3)' }}>
        <div>
          <span style={{ color }}>▸</span> {formatEventDateRange(item.date, item.endDate)}
          {item.startTime && item.endTime && ` · ${formatEventTimeRange(item.startTime, item.endTime)}`}
          {item.startTime && !item.endTime && ` · ${formatEventTime(item.startTime)}`}
        </div>
        {item.location && (
          <div>
            <span style={{ color }}>▸</span> {item.location}
          </div>
        )}
      </div>

      {item.description && (
        <p className="mt-3 whitespace-pre-line font-sans text-[14px] leading-[1.7]" style={{ color: 'var(--text2)' }}>
          {item.description}
        </p>
      )}

      {item.applicationStatus === 'open' && (
        <p className="mt-3 font-sans text-[13px] font-semibold" style={{ color: 'var(--brand)' }}>
          This application window is open — apply from the Get Involved page.
        </p>
      )}
      {item.applicationStatus === 'closed' && (
        <p className="mt-3 font-sans text-[13px]" style={{ color: 'var(--text2)' }}>
          This window has closed. Keep an eye out for the next one!
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <AddToGoogleCalendarLink item={item} />
        {item.detailPath && (
          <Link
            to={item.detailPath}
            onClick={onClose}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--brand)' }}
          >
            {getDetailLinkLabel(item)} →
          </Link>
        )}
      </div>
    </>
  );
}

function DaySheet({
  dateStr,
  items,
  todayStr,
  onSelectItem,
}: {
  dateStr: string;
  items: CalendarItem[];
  todayStr: string;
  onSelectItem: (item: CalendarItem) => void;
}) {
  return (
    <>
      <h2 id="calendar-detail-title" className="font-sans text-lg font-bold" style={{ color: 'var(--text)' }}>
        {formatDayGroupLabel(dateStr, todayStr)}
      </h2>
      <ul className="mt-3 space-y-2">
        {[...items].sort(compareCalendarItems).map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onSelectItem(item)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-[var(--surface2)]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: getItemColor(item) }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-[14px] font-bold" style={{ color: 'var(--text)' }}>
                  {item.title}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                  {item.startTime ? formatEventTime(item.startTime) : 'All day'} · {item.categoryLabel}
                </span>
              </span>
              <span aria-hidden style={{ color: 'var(--color-text3)' }}>→</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Public-safe detail overlay for the calendar: shows a single item, or a
 * day sheet listing everything on a tapped day. Closes on Escape/backdrop.
 */
export function CalendarDetailModal({ overlay, todayStr, onClose, onSelectItem }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!overlay) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [overlay, onClose]);

  if (!overlay) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="scrapbook-paper max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-b-xl sm:p-6"
      >
        <div className="flex justify-end">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full font-sans text-lg leading-none transition-colors hover:bg-[var(--surface2)]"
            style={{ color: 'var(--color-text2)' }}
          >
            ✕
          </button>
        </div>

        {overlay.mode === 'item' ? (
          <ItemDetail item={overlay.item} onClose={onClose} />
        ) : (
          <DaySheet
            dateStr={overlay.dateStr}
            items={overlay.items}
            todayStr={todayStr}
            onSelectItem={onSelectItem}
          />
        )}
      </div>
    </div>
  );
}
