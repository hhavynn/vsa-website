import { ExternalEvent } from '../../../types';
import { resolveExternalHost } from '../../../lib/externalEventLinking';
import { ExternalHostMark } from '../uvsa/ExternalHostMark';
import { ExternalLinkIcon, InstagramIcon } from '../uvsa/icons';
import { LinkButton } from '../uvsa/LinkButton';

/**
 * "Hosted by [logo] UCI VSA" for an external event on /events. The compact form
 * is a single line for cards; the full form adds the host's own shortcuts,
 * which are inherited from `uvsa_schools` (or the UVSA SoCal config) at read
 * time rather than copied onto the event.
 */
export function ExternalHostedBy({
  listing,
  compact = false,
}: {
  listing: ExternalEvent;
  compact?: boolean;
}) {
  const host = resolveExternalHost(listing);
  const shortcuts = [
    { label: 'Instagram', url: host.instagramUrl },
    { label: 'Linktree', url: host.linktreeUrl },
    { label: 'Website', url: host.websiteUrl },
  ].filter((link): link is { label: string; url: string } => Boolean(link.url));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ExternalHostMark host={host} size="xs" />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--color-text3)' }}>
          Hosted by
        </p>
        <p className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {host.kind === 'missing' ? 'Another VSA' : host.name}
        </p>
      </div>
      {!compact && shortcuts.length > 0 && (
        <ul className="flex list-none flex-wrap gap-3 p-0">
          {shortcuts.map((link) => (
            <li key={link.label}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${host.shortName} ${link.label}`}
                className="inline-flex min-h-[32px] items-center gap-1 font-sans text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
              >
                {link.label} <span aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Event-specific buttons; only links that exist render. */
export function ExternalEventLinks({ listing }: { listing: ExternalEvent }) {
  const hasLinks =
    listing.rsvp_url || listing.host_info_url || listing.instagram_url || listing.ride_form_url;
  if (!hasLinks && !listing.ride_info) return null;

  return (
    <div className="space-y-3">
      {hasLinks && (
        <div className="flex flex-wrap gap-2">
          {listing.rsvp_url && (
            <LinkButton href={listing.rsvp_url} variant="primary">
              RSVP / Tickets <ExternalLinkIcon size={10} aria-hidden />
            </LinkButton>
          )}
          {listing.host_info_url && (
            <LinkButton href={listing.host_info_url}>
              Event Info <ExternalLinkIcon size={10} aria-hidden />
            </LinkButton>
          )}
          {listing.instagram_url && (
            <LinkButton href={listing.instagram_url}>
              Instagram Post <InstagramIcon size={11} aria-hidden />
            </LinkButton>
          )}
          {listing.ride_form_url && (
            <LinkButton href={listing.ride_form_url}>
              UCSD Ride Form <ExternalLinkIcon size={10} aria-hidden />
            </LinkButton>
          )}
        </div>
      )}
      {listing.ride_info && (
        <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>Rides: </span>
          {listing.ride_info}
        </p>
      )}
    </div>
  );
}
