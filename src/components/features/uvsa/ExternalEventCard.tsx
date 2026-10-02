import { useId } from "react";
import { ExternalEvent } from "../../../types";
import { formatExternalWhen } from "../../../lib/externalEventDisplay";
import { resolveExternalHost } from "../../../lib/externalEventLinking";
import { isHomeBaseSchool } from "../../../lib/uvsaNetwork";
import { Badge } from "../../ui/Badge";
import {
  CalendarIcon,
  ExternalLinkIcon,
  InstagramIcon,
  MapPinIcon,
} from "./icons";
import { LinkButton } from "./LinkButton";
import { ExternalHostMark } from "./ExternalHostMark";
import { ExternalEventImage } from "./ExternalEventImage";

const hasEventLinks = (event: ExternalEvent) =>
  Boolean(
    event.rsvp_url ||
    event.host_info_url ||
    event.instagram_url ||
    event.ride_form_url,
  );

/**
 * RSVP / info / Instagram post / ride form, in that order, only when each link
 * exists. RSVP takes its own full-width row and the rest share the next one;
 * every button is a 44px tap target on phones. Host links live on the host
 * logo, not in this row.
 */
export function ExternalEventActions({ event }: { event: ExternalEvent }) {
  if (!hasEventLinks(event)) return null;
  const tap = "min-h-[44px] flex-1 sm:min-h-[36px]";
  return (
    <div className="flex flex-wrap gap-2">
      {event.rsvp_url && (
        <LinkButton
          href={event.rsvp_url}
          variant="primary"
          className={`${tap} basis-full`}
        >
          RSVP / Tickets <ExternalLinkIcon size={10} aria-hidden />
        </LinkButton>
      )}
      {event.host_info_url && (
        <LinkButton href={event.host_info_url} className={tap}>
          Event Info <ExternalLinkIcon size={10} aria-hidden />
        </LinkButton>
      )}
      {event.instagram_url && (
        <LinkButton href={event.instagram_url} className={tap}>
          Instagram Post <InstagramIcon size={11} aria-hidden />
        </LinkButton>
      )}
      {event.ride_form_url && (
        <LinkButton href={event.ride_form_url} className={tap}>
          UCSD Ride Form <ExternalLinkIcon size={10} aria-hidden />
        </LinkButton>
      )}
    </div>
  );
}

/** "[logo] UCI VSA" / "[logo] UVSA SoCal": secondary to the event, logo opens the host's Instagram. */
export function ExternalHostLine({ event }: { event: ExternalEvent }) {
  const host = resolveExternalHost(event);
  const isHome = isHomeBaseSchool({ slug: event.uvsa_school?.slug ?? "" });
  const label = host.kind === "uvsa_socal" ? host.shortName : host.name;
  return (
    <div className="flex items-center gap-2.5">
      <ExternalHostMark host={host} size="xs" />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-sans text-xs font-semibold uppercase tracking-label text-text-secondary">
          {label}
        </span>
        {isHome && <Badge label="Hosted by VSA at UCSD" color="yellow" />}
      </div>
    </div>
  );
}

/** Date/time, location and points: the facts people scan for. */
export function ExternalEventFacts({
  event,
  large = false,
}: {
  event: ExternalEvent;
  large?: boolean;
}) {
  const when = formatExternalWhen(event);
  return (
    <div className="space-y-1.5">
      {when && (
        <p
          className={
            large
              ? "flex items-center gap-2 font-sans text-base font-semibold text-text-primary"
              : "flex items-center gap-2 font-sans text-sm font-semibold text-text-primary"
          }
        >
          <CalendarIcon
            size={13}
            aria-hidden
            className="shrink-0 text-brand-600 dark:text-brand-400"
          />
          {when}
        </p>
      )}
      {event.location && (
        <p className="flex items-center gap-2 font-sans text-sm text-text-secondary">
          <MapPinIcon size={12} aria-hidden className="shrink-0" />
          {event.location}
        </p>
      )}
      {event.points > 0 && (
        <p>
          <Badge label={`+${event.points} pts`} color="yellow" />
        </p>
      )}
    </div>
  );
}

/** Upcoming external card: flyer first, then host, name, when/where, and links. */
export function ExternalEventCard({ event }: { event: ExternalEvent }) {
  const titleId = useId();

  return (
    <article
      aria-labelledby={titleId}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-surface transition duration-150 hover:border-brand-600/50 focus-within:border-brand-600/50 motion-safe:hover:-translate-y-0.5 dark:hover:border-brand-400/50 dark:focus-within:border-brand-400/50"
    >
      <ExternalEventImage event={event} />

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <ExternalHostLine event={event} />

        <div>
          <h3
            id={titleId}
            className="font-serif text-xl leading-tight text-text-primary"
          >
            {event.title}
          </h3>
          {event.event_type && (
            <p className="mt-1 font-sans text-xs font-semibold uppercase tracking-label text-brand-600 dark:text-brand-400">
              {event.event_type}
            </p>
          )}
        </div>

        <ExternalEventFacts event={event} />

        {event.description && (
          <p className="line-clamp-2 font-sans text-sm text-text-secondary">
            {event.description}
          </p>
        )}
        {event.ride_info && (
          <p className="font-sans text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Rides: </span>
            {event.ride_info}
          </p>
        )}
      </div>

      {hasEventLinks(event) && (
        <div className="border-t border-[var(--color-border)] bg-surface2 p-4">
          <ExternalEventActions event={event} />
        </div>
      )}
    </article>
  );
}
