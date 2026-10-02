import { useId } from "react";
import { ExternalEvent } from "../../../types";
import { Badge } from "../../ui/Badge";
import {
  ExternalEventActions,
  ExternalEventFacts,
  ExternalHostLine,
} from "./ExternalEventCard";
import { ExternalEventImage } from "./ExternalEventImage";

/**
 * Large spotlight for an explicitly featured, genuinely upcoming event. Same
 * pieces as the card (flyer, host, facts, links), just given more room, so the
 * page never shows two different designs for the same information.
 */
export function FeaturedExternal({ event }: { event: ExternalEvent }) {
  const titleId = useId();

  return (
    <article
      aria-labelledby={titleId}
      className="grid grid-cols-1 overflow-hidden rounded-lg border border-brand-600/40 bg-surface md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] dark:border-brand-400/40"
    >
      <ExternalEventImage
        event={event}
        className="md:aspect-auto md:h-full md:min-h-[26rem] md:border-b-0 md:border-r"
        fallbackClassName="md:aspect-auto md:h-full md:border-b-0 md:border-r"
        width={900}
        height={1125}
        sizes="(min-width: 768px) 45vw, 100vw"
      />

      <div className="flex flex-col gap-4 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label="Featured External" color="yellow" />
          {event.event_type && (
            <span className="font-sans text-xs font-semibold uppercase tracking-label text-text-secondary">
              {event.event_type}
            </span>
          )}
        </div>

        <ExternalHostLine event={event} />

        <h3
          id={titleId}
          className="font-serif text-3xl leading-tight text-text-primary sm:text-4xl"
        >
          {event.title}
        </h3>

        <ExternalEventFacts event={event} large />

        {event.description && (
          <p className="max-w-3xl font-sans text-sm leading-7 text-text-secondary sm:text-base">
            {event.description}
          </p>
        )}
        {event.ride_info && (
          <p className="font-sans text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">Rides: </span>
            {event.ride_info}
          </p>
        )}

        <div className="mt-auto pt-1">
          <ExternalEventActions event={event} />
        </div>
      </div>
    </article>
  );
}
