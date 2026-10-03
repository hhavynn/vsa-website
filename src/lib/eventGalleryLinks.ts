import type { RelatedLink } from '../components/common/RelatedLinks';
import type { GalleryAlbum } from '../data/repos/gallery';

// Event <-> Gallery relationships. The ONLY source of truth is the explicit
// gallery_events.event_id foreign key. Titles, dates and names are never
// compared or fuzzy-matched: with no explicit link there is no contextual link.

export const EVENT_ANCHOR_PREFIX = 'event-';

export function eventAnchorId(eventId: string) {
  return `${EVENT_ANCHOR_PREFIX}${eventId}`;
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
 * both the foreign key and the joined event row (the join is RLS-filtered, so a
 * draft/unpublished event never produces a link), and that they agree.
 */
export function getAlbumEventLink(
  album: Pick<GalleryAlbum, 'event_id' | 'event'>,
): RelatedLink | null {
  const { event_id: eventId, event } = album;
  if (!eventId || !event || event.id !== eventId) return null;

  // Past events live in the term-filtered archive; `term` selects it so the
  // card is actually on screen, and the hash scrolls to it.
  const term = event.academic_term_id ?? 'unassigned';
  return {
    to: `/events?term=${encodeURIComponent(term)}#${eventAnchorId(event.id)}`,
    label: event.name,
  };
}
