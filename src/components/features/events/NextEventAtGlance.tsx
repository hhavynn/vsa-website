import { Link } from 'react-router-dom';
import { Event } from '../../../types';
import { formatDateOnly } from '../../../lib/dateOnly';
import { formatEventDay, formatEventDateRange, formatEventTime, formatEventTimeRange } from '../../../lib/eventTime';
import { UpcomingItem } from '../../../lib/upcomingEvents';
import { AddToCalendarButton } from './AddToCalendarButton';

type Props =
  | { event: Event; houseItem?: never }
  | { event?: never; houseItem: Extract<UpcomingItem, { kind: 'house' }> };

/** Mobile-first summary shown before the archive/filter controls on /events. */
export function NextEventAtGlance({ event, houseItem }: Props) {
  const next = event ?? houseItem?.event;
  if (!next) return null;
  const startTime = next.start_time;
  const endTime = next.end_time;
  const time = startTime && endTime
    ? formatEventTimeRange(startTime, endTime)
    : startTime
      ? formatEventTime(startTime)
      : 'Time to be announced';
  const dateLabel = event
    ? (event.end_date ? formatEventDateRange(event.date, event.end_date, event.start_time) : formatEventDay(event.date, event.start_time))
    : formatDateOnly(houseItem!.event.event_date, 'EEE, MMM d, yyyy');
  const name = event ? event.name : houseItem!.event.title;

  return (
    <section aria-label="Next upcoming event" className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:hidden">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
        Next up{houseItem ? ' · House event' : ''}
      </p>
      <p className="mt-1 break-words font-sans text-base font-bold leading-6 text-[var(--color-text)]">{name}</p>
      <dl className="mt-2 grid gap-1 font-sans text-xs leading-5 text-[var(--color-text2)]">
        <div className="flex flex-wrap gap-1">
          <dt className="font-semibold">When:</dt>
          <dd>{dateLabel} · {time}</dd>
        </div>
        <div className="flex flex-wrap gap-1">
          <dt className="font-semibold">Where:</dt>
          <dd className="min-w-0 break-words">{next.location?.trim() || 'Location to be announced'}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {event && <AddToCalendarButton event={event} variant="ghost" />}
        {houseItem
          ? <Link to={houseItem.detailPath} className="inline-flex touch:min-h-11 items-center font-sans text-xs font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400">House event details</Link>
          : <a href="#next-up" className="inline-flex touch:min-h-11 items-center font-sans text-xs font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400">Event details</a>}
      </div>
    </section>
  );
}
