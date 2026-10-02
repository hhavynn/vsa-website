import { ExternalEvent } from "../../../types";
import { formatDateOnly } from "../../../lib/dateOnly";
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

/** RSVP / info / IG / host Linktree actions shared by the card and the spotlight. */
export function ExternalEventActions({ event }: { event: ExternalEvent }) {
  const host = resolveExternalHost(event);
  return (
    <>
      {event.rsvp_url && (
        <LinkButton href={event.rsvp_url} variant="primary">
          RSVP <ExternalLinkIcon size={10} aria-hidden />
        </LinkButton>
      )}
      {event.host_info_url && (
        <LinkButton href={event.host_info_url}>
          View Info <ExternalLinkIcon size={10} aria-hidden />
        </LinkButton>
      )}
      {event.instagram_url && (
        <LinkButton href={event.instagram_url}>
          IG Post <InstagramIcon size={11} aria-hidden />
        </LinkButton>
      )}
      {event.ride_form_url && (
        <LinkButton href={event.ride_form_url}>
          UCSD Ride Form <ExternalLinkIcon size={10} aria-hidden />
        </LinkButton>
      )}
      {host.linktreeUrl ? (
        <LinkButton href={host.linktreeUrl}>
          Host Linktree <ExternalLinkIcon size={10} aria-hidden />
        </LinkButton>
      ) : (
        host.kind === "uvsa_socal" &&
        host.instagramUrl && (
          <LinkButton href={host.instagramUrl}>
            {host.shortName} Instagram <InstagramIcon size={11} aria-hidden />
          </LinkButton>
        )
      )}
    </>
  );
}

/** Upcoming external card: the host school's logo leads, date is the loudest line. */
export function ExternalEventCard({ event }: { event: ExternalEvent }) {
  const hostIdentity = resolveExternalHost(event);
  const host = hostIdentity.shortName;
  const isHome = isHomeBaseSchool({ slug: event.uvsa_school?.slug ?? "" });
  const showPoints = isHome && event.points > 4;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-surface">
      <div className="flex items-start gap-4 p-5">
        <ExternalHostMark host={hostIdentity} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-sans text-xs font-semibold uppercase tracking-label text-text-secondary">
              {host}
            </span>
            {isHome && <Badge label="Hosted by VSA at UCSD" color="yellow" />}
            {showPoints && (
              <Badge label={`${event.points} pts`} color="yellow" />
            )}
          </div>
          <h3 className="mt-1 font-serif text-xl leading-tight text-text-primary">
            {event.title}
          </h3>
          {event.event_type && (
            <p className="mt-1 font-sans text-xs font-semibold uppercase tracking-label text-brand-600 dark:text-brand-400">
              {event.event_type}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 px-5 pb-4">
        {event.date && (
          <p className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-text-primary">
            <CalendarIcon
              size={13}
              aria-hidden
              className="text-brand-600 dark:text-brand-400"
            />
            {formatDateOnly(event.date, "EEE, MMM d, yyyy")}
          </p>
        )}
        {event.location && (
          <p className="flex items-center gap-2 font-sans text-xs text-text-secondary">
            <MapPinIcon size={12} aria-hidden /> {event.location}
          </p>
        )}
        {event.description && (
          <p className="line-clamp-3 font-sans text-sm text-text-secondary">
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

      <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] bg-surface2 p-4">
        <ExternalEventActions event={event} />
      </div>
    </article>
  );
}
