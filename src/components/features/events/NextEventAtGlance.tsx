import { Event } from '../../../types';
import { formatEventDay, formatEventDateRange, formatEventTime, formatEventTimeRange } from '../../../lib/eventTime';
import { AddToCalendarButton } from './AddToCalendarButton';

/** Mobile-first summary shown before the archive/filter controls on /events. */
export function NextEventAtGlance({ event }: { event: Event }) {
  const time = event.start_time && event.end_time
    ? formatEventTimeRange(event.start_time, event.end_time)
    : event.start_time
      ? formatEventTime(event.start_time)
      : 'Time to be announced';
  return (
    <section aria-label="Next upcoming VSA event" className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:hidden">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">Next up</p>
      <p className="mt-1 break-words font-sans text-base font-bold leading-6 text-[var(--color-text)]">{event.name}</p>
      <dl className="mt-2 grid gap-1 font-sans text-xs leading-5 text-[var(--color-text2)]">
        <div className="flex flex-wrap gap-1">
          <dt className="font-semibold">When:</dt>
          <dd>{event.end_date ? formatEventDateRange(event.date, event.end_date, event.start_time) : formatEventDay(event.date, event.start_time)} · {time}</dd>
        </div>
        <div className="flex flex-wrap gap-1">
          <dt className="font-semibold">Where:</dt>
          <dd className="min-w-0 break-words">{event.location?.trim() || 'Location to be announced'}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <AddToCalendarButton event={event} variant="ghost" />
        <a href="#next-up" className="inline-flex touch:min-h-11 items-center font-sans text-xs font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400">
          Event details
        </a>
      </div>
    </section>
  );
}
