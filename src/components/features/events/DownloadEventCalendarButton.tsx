import type { Event } from '../../../types';
import { downloadPublicEventIcs } from '../../../lib/publicEventIcs';

export function DownloadEventCalendarButton({ events }: { events: ReadonlyArray<Event> }) {
  const published = events.filter((event) => event.is_published === true);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => downloadPublicEventIcs(published)}
        disabled={published.length === 0}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-sans text-xs font-semibold text-[var(--color-text)] transition-colors hover:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Download VSA events (.ics)
      </button>
      <span className="font-sans text-xs text-[var(--color-text3)]">
        One-time calendar import. Download again to get later updates.
      </span>
    </div>
  );
}
