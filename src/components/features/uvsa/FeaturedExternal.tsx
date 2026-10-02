import { ExternalEvent } from "../../../types";
import { formatDateOnly } from "../../../lib/dateOnly";
import { Badge } from "../../ui/Badge";
import { CalendarIcon, MapPinIcon } from "./icons";
import { ExternalEventActions, getEventHostName } from "./ExternalEventCard";
import { SchoolVisualMark } from "./SchoolVisualMark";

/** Large spotlight. Only ever rendered for a genuinely upcoming featured event. */
export function FeaturedExternal({ event }: { event: ExternalEvent }) {
  const host = getEventHostName(event);
  const pointsNote =
    event.points && event.points !== 4
      ? `${event.points} points when announced by VSA at UCSD.`
      : null;

  return (
    <article className="overflow-hidden rounded-lg border border-brand-600/40 bg-surface dark:border-brand-400/40">
      <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center justify-center border-b border-[var(--color-border)] bg-surface2 p-6 sm:border-b-0 sm:border-r sm:p-8">
          <SchoolVisualMark
            school={event.uvsa_school}
            fallbackLabel={host}
            size="lg"
          />
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge label="Featured External" color="yellow" />
            <Badge label={host} color="gray" />
            {event.event_type && (
              <span className="font-sans text-xs font-semibold uppercase tracking-label text-text-secondary">
                {event.event_type}
              </span>
            )}
          </div>

          <h3 className="font-serif text-3xl leading-tight text-text-primary sm:text-4xl">
            {event.title}
          </h3>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-sans text-sm text-text-primary">
            {event.date && (
              <span className="inline-flex items-center gap-2 font-semibold">
                <CalendarIcon
                  size={13}
                  aria-hidden
                  className="text-brand-600 dark:text-brand-400"
                />
                {formatDateOnly(event.date, "EEEE, MMMM d, yyyy")}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-2 text-text-secondary">
                <MapPinIcon size={12} aria-hidden /> {event.location}
              </span>
            )}
          </div>

          {event.description && (
            <p className="max-w-3xl font-sans text-sm leading-7 text-text-secondary sm:text-base">
              {event.description}
            </p>
          )}

          {pointsNote && (
            <p className="inline-flex rounded bg-surface2 px-3 py-2 font-sans text-xs font-medium text-text-secondary">
              {pointsNote}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <ExternalEventActions event={event} />
          </div>
        </div>
      </div>
    </article>
  );
}
