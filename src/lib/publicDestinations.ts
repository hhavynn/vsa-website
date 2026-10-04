import {
  DOCK_ITEMS,
  EXPLORE_LINKS,
  GET_INVOLVED,
  QUICK_LINKS,
} from '../components/layout/navigation/navConfig';
import { FOOTER_GROUPS, FOOTER_LEGAL_LINKS } from '../components/layout/navigation/footerLinks';
import { PUBLIC_ROUTE_DECISIONS } from '../routes/publicRouteInventory';

// The static, public page destinations: what site search indexes and what
// breadcrumbs name. This is a *view* over metadata that already exists, not a
// registry of its own:
//
//   navConfig.ts          primary-nav labels, descriptions, emoji
//   footerLinks.ts        footer labels (also kept as alternate search terms)
//   publicRouteInventory  every public route, plus title/description/keywords
//                         for the routes the nav lists do not carry
//
// Admin routes, redirects, aliases, unlinked entry points and parametric
// routes never become destinations. Adding a public route means recording it
// in the inventory (a test enforces that); it then shows up here with no
// further list to edit.

export interface PublicDestination {
  path: string;
  title: string;
  /** Short crumb label; falls back to `title`. */
  crumb: string;
  description?: string;
  emoji?: string;
  /** Alternate names/synonyms, lowercased. */
  keywords: string[];
  /** A program a member can join or learn about, as opposed to a utility page. */
  isProgram: boolean;
}

const PROGRAM_PATHS = new Set(GET_INVOLVED.map((link) => link.path));

/** `/vcn#x` -> `/vcn`. Hash links to the same page share one decision. */
export function stripHash(path: string): string {
  const hash = path.indexOf('#');
  return hash === -1 ? path : path.slice(0, hash);
}

function isIndexable(path: string): boolean {
  if (path.startsWith('/admin') || path.includes(':')) return false;
  const decision = PUBLIC_ROUTE_DECISIONS[path];
  // A path with no recorded decision of its own is a hash link on a page that has one ("/#wrapped").
  if (!decision) return PUBLIC_ROUTE_DECISIONS[stripHash(path)] !== undefined;
  return !decision.placements.some(
    (placement) => placement === 'alias' || placement === 'redirect' || placement === 'unlinked',
  );
}

interface DestinationPatch {
  title?: string;
  description?: string;
  emoji?: string;
  /** A second name for the same page (e.g. the footer's "Get Involved" for the nav's "Start Here"). */
  altLabel?: string;
}

let cache: PublicDestination[] | null = null;

export function getPublicDestinations(): PublicDestination[] {
  if (cache) return cache;

  const byPath = new Map<string, PublicDestination>();
  const upsert = (path: string, patch: DestinationPatch) => {
    if (!isIndexable(path)) return;
    const decision = PUBLIC_ROUTE_DECISIONS[path];
    const existing = byPath.get(path);
    const title = existing?.title ?? patch.title ?? decision?.title;
    if (!title) return;

    const keywords = new Set(existing?.keywords ?? (decision?.keywords ?? []).map((word) => word.toLowerCase()));
    if (patch.altLabel && patch.altLabel.toLowerCase() !== title.toLowerCase()) {
      keywords.add(patch.altLabel.toLowerCase());
    }

    byPath.set(path, {
      path,
      title,
      crumb: existing?.crumb ?? decision?.crumb ?? title,
      description: existing?.description ?? patch.description ?? decision?.description,
      emoji: existing?.emoji ?? patch.emoji,
      keywords: Array.from(keywords),
      isProgram: PROGRAM_PATHS.has(path),
    });
  };

  for (const link of [...QUICK_LINKS, ...GET_INVOLVED, ...EXPLORE_LINKS, ...DOCK_ITEMS]) {
    upsert(link.path, { title: link.label, description: link.description, emoji: link.emoji });
  }
  for (const link of [...FOOTER_GROUPS.flatMap((group) => group.links), ...FOOTER_LEGAL_LINKS]) {
    upsert(link.to, { title: link.label, altLabel: link.label });
  }
  // Public routes in no nav list ("/house/archive", "/vcn/current") carry their own title.
  for (const path of Object.keys(PUBLIC_ROUTE_DECISIONS)) upsert(path, {});

  cache = Array.from(byPath.values());
  return cache;
}

/** The destination for an exact public path, or undefined. */
export function getPublicDestination(path: string): PublicDestination | undefined {
  return getPublicDestinations().find((destination) => destination.path === path);
}
