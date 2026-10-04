import { formatDateOnly } from './dateOnly';
import { eventAnchorId, pastEventPath } from './eventGalleryLinks';
import { GET_INVOLVED, QUICK_LINKS } from '../components/layout/navigation/navConfig';
import { getPublicDestinations } from './publicDestinations';
import type { PublicSearchEvent } from '../data/repos/events';
import type { PublicSearchAlbum } from '../data/repos/gallery';

// Site-wide public search: what is indexed, how a query is ranked, and where a
// result goes. Pure: no network, no React. The palette fetches the dynamic
// rows once (data/repos: getPublicSearchEntries / getPublicSearchAlbums, which
// apply the same visibility filters as the public pages) and everything after
// that is client-side filtering over memory.
//
// Nothing here can reach a private row: static pages come from the public
// route metadata (never /admin), and events/albums arrive already filtered at
// the query. Application links are deliberately not indexed at all -- their
// URLs are time-gated and only ever come from the application-link model.

export type PublicSearchType = 'page' | 'event' | 'album';

export interface PublicSearchEntry {
  /** Stable unique key (type-prefixed, so a page and an event never collide). */
  key: string;
  type: PublicSearchType;
  title: string;
  /** Short type tag shown on every row: "Program", "Page", "Event", "Photo album". */
  typeLabel: string;
  /** Secondary line: a page's description, an event's date and place. */
  detail?: string;
  emoji?: string;
  /** Internal route, or an external https URL when `external` is set. */
  to: string;
  external?: boolean;
  /** Lowercased synonyms/alternate names. */
  keywords: string[];
  /** Tie-break among equal scores: lower comes first. */
  order: number;
}

export interface PublicSearchResult extends PublicSearchEntry {
  score: number;
}

export interface PublicSearchGroup {
  type: PublicSearchType;
  label: string;
  results: PublicSearchResult[];
  /** Matches beyond the visible cap, so the group can offer "browse all". */
  hiddenCount: number;
  browseAll: { to: string; label: string } | null;
}

export const GROUP_ORDER: PublicSearchType[] = ['page', 'event', 'album'];

const GROUP_META: Record<PublicSearchType, { label: string; browseAll: { to: string; label: string } | null }> = {
  page: { label: 'Pages & programs', browseAll: null },
  event: { label: 'Events', browseAll: { to: '/events', label: 'Browse all events' } },
  album: { label: 'Photo albums', browseAll: { to: '/gallery', label: 'Browse the gallery' } },
};

export const MAX_RESULTS_PER_GROUP = 5;
const MAX_QUERY_LENGTH = 80;
const MAX_TOKENS = 8;

/** Lowercase, strip diacritics (so "van hoa" finds "Văn Hóa"), and flatten punctuation. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ─── Entry builders ──────────────────────────────────────────────────────────

export function buildStaticEntries(): PublicSearchEntry[] {
  return getPublicDestinations().map((destination, index) => ({
    key: `page:${destination.path}`,
    type: 'page' as const,
    title: destination.title,
    typeLabel: destination.isProgram ? 'Program' : 'Page',
    detail: destination.description,
    emoji: destination.emoji,
    to: destination.path,
    keywords: destination.keywords,
    order: index,
  }));
}

const EVENT_TYPE_LABEL: Record<PublicSearchEvent['event_type'], string> = {
  gbm: 'GBM',
  mixer: 'Mixer',
  vcn: 'VCN',
  winter_retreat: 'Retreat',
  wildn_culture: "Wild n' Culture",
  external_event: 'External event',
  other: '',
};

/**
 * `today` is a "YYYY-MM-DD" date (America/Los_Angeles): upcoming events sort
 * ahead of past ones on equal scores, soonest first; past events newest first.
 */
export function buildEventEntries(events: PublicSearchEvent[], today: string): PublicSearchEntry[] {
  const upcoming = events.filter((event) => (event.end_date ?? event.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((event) => (event.end_date ?? event.date) < today).sort((a, b) => b.date.localeCompare(a.date));

  return [...upcoming, ...past].map((event, index) => {
    const isUpcoming = index < upcoming.length;
    const when = formatDateOnly(event.date, 'MMM d, yyyy');
    const typeTag = EVENT_TYPE_LABEL[event.event_type];
    return {
      key: `event:${event.id}`,
      type: 'event' as const,
      title: event.name,
      typeLabel: 'Event',
      detail: [when, event.location, typeTag].filter(Boolean).join(' · '),
      // Same deep links the Gallery's related-event link uses: past events
      // select their archive term; upcoming ones are already on the page.
      to: isUpcoming ? `/events#${eventAnchorId(event.id)}` : pastEventPath(event),
      keywords: [normalizeSearchText(typeTag), normalizeSearchText(event.location ?? '')].filter(Boolean),
      order: index,
    };
  });
}

export function buildAlbumEntries(albums: PublicSearchAlbum[]): PublicSearchEntry[] {
  return albums
    .filter((album) => /^https:\/\//i.test(album.google_photos_url))
    .map((album, index) => ({
      key: `album:${album.id}`,
      type: 'album' as const,
      title: album.title,
      typeLabel: 'Photo album',
      detail: `${formatDateOnly(album.date, 'MMM d, yyyy')} · opens in Google Photos`,
      to: album.google_photos_url,
      external: true,
      keywords: ['photos', 'pictures'],
      order: index,
    }));
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

function wordStartsWith(words: string[], token: string): boolean {
  return words.some((word) => word.startsWith(token));
}

/** Score for one entry against the tokens, or 0 when any token fails to match. */
function scoreEntry(entry: PublicSearchEntry, tokens: string[], phrase: string): number {
  const title = normalizeSearchText(entry.title);
  const titleWords = title.split(' ');
  const keywordText = normalizeSearchText(entry.keywords.join(' '));
  const keywordWords = keywordText.split(' ');
  const detail = normalizeSearchText(entry.detail ?? '');

  let score = 0;
  for (const token of tokens) {
    if (wordStartsWith(titleWords, token)) score += 10;
    else if (title.includes(token)) score += 6;
    else if (wordStartsWith(keywordWords, token)) score += 5;
    else if (keywordText.includes(token) || detail.includes(token)) score += 3;
    else return 0;
  }

  if (title === phrase) score += 50;
  else if (title.startsWith(phrase)) score += 20;
  // A multi-word synonym ("big little") that the whole query spells out.
  else if (tokens.length > 1 && keywordText.includes(phrase)) score += 8;
  return score;
}

/** Entries matching `query`, grouped by type in a fixed order. Empty groups are omitted. */
export function searchPublicEntries(
  entries: PublicSearchEntry[],
  query: string,
  perGroup: number = MAX_RESULTS_PER_GROUP,
): PublicSearchGroup[] {
  const phrase = normalizeSearchText(query.slice(0, MAX_QUERY_LENGTH));
  const tokens = phrase.split(' ').filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];

  const scored: PublicSearchResult[] = [];
  for (const entry of entries) {
    const score = scoreEntry(entry, tokens, phrase);
    if (score > 0) scored.push({ ...entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.order - b.order);

  return GROUP_ORDER.flatMap((type) => {
    const matches = scored.filter((result) => result.type === type);
    if (matches.length === 0) return [];
    return [
      {
        type,
        label: GROUP_META[type].label,
        results: matches.slice(0, perGroup),
        hiddenCount: Math.max(matches.length - perGroup, 0),
        browseAll: GROUP_META[type].browseAll,
      },
    ];
  });
}

/** Results in on-screen order, which is the order arrow keys move through. */
export function flattenGroups(groups: PublicSearchGroup[]): PublicSearchResult[] {
  return groups.flatMap((group) => group.results);
}

/**
 * Where to start a visitor who has not typed anything or whose search came up
 * empty: the primary-nav quick links plus the Get Involved entry point. Read
 * from navConfig so there is no second list of "popular" pages.
 */
export function suggestedDestinations(): PublicSearchEntry[] {
  const pages = buildStaticEntries();
  return [...QUICK_LINKS, GET_INVOLVED[0]].flatMap((link) => {
    const entry = pages.find((page) => page.to === link.path);
    return entry ? [entry] : [];
  });
}
