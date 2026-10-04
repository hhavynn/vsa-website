import { DOCK_ITEMS, GET_INVOLVED, QUICK_LINKS } from '../components/layout/navigation/navConfig';
import { POINTS_HELP_ANCHOR } from './relatedLinks';
import {
  buildStaticEntries,
  searchPublicEntries,
  type PublicSearchEntry,
} from './publicSearch';

// Helping a visitor off a dead link without pretending it was a live one.
//
// A 404 stays a 404: nothing here redirects. Two things are offered instead:
//   1. a deterministic "you probably want this" for legacy URLs we know used to
//      exist, and
//   2. likely destinations, found by running the URL's own words through the
//      same public-page index the search box uses.
// Admin paths get neither, so the page cannot be used to learn whether an
// admin route exists.

export interface LegacyDestination {
  to: string;
  label: string;
  description: string;
}

// Only URLs with evidence of having been real (git history of routes/index.tsx)
// and a single obvious current home. Anything else -- including every House
// and VCN shape we could not confirm ever existed -- is left to likelyDestinations.
const LEGACY_DESTINATIONS: Record<string, LegacyDestination> = {
  '/profile': {
    to: '/points',
    label: 'Find My Points',
    description: 'Member profiles were retired. You can still look up your points and events here.',
  },
  '/points-explainer': {
    to: `/points#${POINTS_HELP_ANCHOR}`,
    label: 'How points work',
    description: 'The points explainer now lives on the Find My Points page.',
  },
};

/** "/Profile/" -> "/profile". Same normalization the router applies when matching. */
export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '').toLowerCase();
  return trimmed === '' ? '/' : trimmed;
}

export function isAdminPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === '/admin' || normalized.startsWith('/admin/');
}

export function legacyDestinationFor(pathname: string): LegacyDestination | null {
  if (isAdminPath(pathname)) return null;
  return LEGACY_DESTINATIONS[normalizePathname(pathname)] ?? null;
}

/** Public pages whose name or synonyms share a word with the missing URL, best first. */
export function likelyDestinations(pathname: string, limit: number = 4): PublicSearchEntry[] {
  if (isAdminPath(pathname)) return [];
  const words = Array.from(
    new Set(
      normalizePathname(pathname)
        .split(/[^a-z0-9]+/)
        // Years, ids and fragments say nothing about which page was meant.
        .filter((word) => word.length >= 3 && !/^\d+$/.test(word)),
    ),
  );

  const pages = buildStaticEntries();
  const found = new Map<string, PublicSearchEntry>();
  for (const word of words) {
    for (const group of searchPublicEntries(pages, word, limit)) {
      for (const result of group.results) if (!found.has(result.key)) found.set(result.key, result);
    }
  }
  return Array.from(found.values()).slice(0, limit);
}

/** Home, Events, Get Involved: the entry points offered on every 404, from the nav config. */
export function primaryRecoveryLinks(): Array<{ to: string; label: string }> {
  return [
    { to: DOCK_ITEMS[0].path, label: DOCK_ITEMS[0].label },
    { to: QUICK_LINKS[0].path, label: QUICK_LINKS[0].label },
    { to: GET_INVOLVED[0].path, label: 'Get Involved' },
  ];
}
