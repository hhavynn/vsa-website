// House events in Admin → Events (#630). Read-only list of the same
// house_events records Admin → Houses edits (shared query key, so both stay in
// sync). Editing opens the shared House event editor; nothing here writes.
import { useQuery } from 'react-query';
import { houseEventsRepository } from '../../../data/repos/houseEvents';
import { formatAcademicYear } from '../../../lib/academicTerms';
import { formatDateOnly } from '../../../lib/dateOnly';

export function AdminEventsHouseSection({ academicYearStart, onOpenEditor }: { academicYearStart: number | null; onOpenEditor: () => void }) {
  const events = useQuery({
    queryKey: ['admin', 'house-events', academicYearStart],
    queryFn: () => houseEventsRepository.getAdminEvents(academicYearStart),
    enabled: academicYearStart !== null,
    staleTime: 60 * 1000,
  });
  if (academicYearStart === null) return null;
  const list = events.data ?? [];
  const drafts = list.filter((event) => !event.is_published).length;

  return (
    <section className="border-t px-6 py-5 sm:px-8 border-[var(--color-border)]" aria-label="House events">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-text-primary">House events · {formatAcademicYear(academicYearStart)}</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Hosted by Houses and shown on House pages and the calendar. They are separate from regular VSA events and never award attendance points.
            {list.length > 0 ? ` ${list.length} event${list.length === 1 ? '' : 's'}, ${drafts} draft${drafts === 1 ? '' : 's'}.` : ''}
          </p>
        </div>
        <button type="button" onClick={onOpenEditor} className="rounded border bg-transparent px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface2)] border-[var(--color-border)] text-text-primary">
          Open the House event editor
        </button>
      </div>
      {events.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-300">House events could not be loaded.</p>
      ) : events.isLoading ? (
        <p className="mt-3 text-xs text-text-muted" role="status">Loading House events…</p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-xs text-text-muted">No House events for this year yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)]">
          {list.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
              <span className="text-text-primary">
                <span className="font-semibold">{event.title}</span>
                <span className="ml-2 text-xs text-text-muted">{formatDateOnly(event.event_date)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] border-[var(--color-border)]">House Event</span>
                {(event.houses ?? []).map((house) => house.display_name || house.house_key).join(' + ') || 'No host'}
                {!event.is_published && <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] border-amber-400 text-amber-800 dark:text-amber-300">Draft</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
