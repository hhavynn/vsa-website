import type { RelatedLink } from '../components/common/RelatedLinks';
import type { GalleryAlbum } from '../data/repos/gallery';

// Event <-> Gallery relationships. The ONLY source of truth is the explicit
// gallery_events.event_id foreign key. Titles, dates and names are never
// compared or fuzzy-matched: with no explicit link there is no contextual link.

export const EVENT_ANCHOR_PREFIX = 'event-';

export function eventAnchorId(eventId: string) {
  return `${EVENT_ANCHOR_PREFIX}${eventId}`;
}

/** The event id in a `#event-<id>` location hash, or null. */
export function parseEventAnchor(hash: string): string | null {
  const anchor = decodeURIComponent(hash.replace(/^#/, ''));
  return anchor.startsWith(EVENT_ANCHOR_PREFIX) && anchor.length > EVENT_ANCHOR_PREFIX.length
    ? anchor.slice(EVENT_ANCHOR_PREFIX.length)
    : null;
}

interface AlbumLinkRow {
  event_id: string | null;
  google_photos_url: string | null;
}

/** event_id → album URL for events that have an explicitly linked album (first album wins). */
export function buildEventAlbumMap(rows: AlbumLinkRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.event_id && row.google_photos_url && !map[row.event_id]) {
      map[row.event_id] = row.google_photos_url;
    }
  }
  return map;
}

/**
 * Link from a gallery album to its related event on /events, or null. Requires
 * the foreign key and the joined event row, that they agree, and that the event
 * is published. RLS hides drafts from the public, but an admin viewing the
 * public Gallery can read them through the join, and /events never lists a draft.
 * Missing publication status is treated as unpublished.
 */
export function getAlbumEventLink(
  album: Pick<GalleryAlbum, 'event_id' | 'event'>,
): RelatedLink | null {
  const { event_id: eventId, event } = album;
  if (!eventId || !event || event.id !== eventId || event.is_published !== true) return null;

  return { to: pastEventPath(event), label: event.name };
}

/**
 * Where a past event's card lives on /events. Past events sit in the
 * term-filtered archive; `term` selects it so the card is actually on screen,
 * and the hash scrolls to it.
 */
export function pastEventPath(event: { id: string; academic_term_id?: string | null }): string {
  const term = event.academic_term_id ?? 'unassigned';
  return `/events?term=${encodeURIComponent(term)}#${eventAnchorId(event.id)}`;
}
