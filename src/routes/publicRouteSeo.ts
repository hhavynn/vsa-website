/**
 * The public route manifest: every canonical, indexable public route with the
 * metadata search engines and link unfurlers read (#573).
 *
 * One list drives three things, so they can never disagree:
 *   - `sitemap.xml`, generated from this list at build time
 *   - the per-route `<title>`, description, canonical and Open Graph / Twitter tags
 *     written into the prerendered HTML shells (and kept in sync client-side)
 *   - the runtime metadata the router applies when a visitor moves between routes
 *
 * Rules for this file:
 *   - Only canonical, indexable public routes belong here. Admin, private and
 *     non-indexable URLs are listed in NON_INDEXABLE_PUBLIC_PATHS instead.
 *   - Parameterized routes (`/house/:houseSlug`) are never listed: one entry per
 *     possible value cannot be enumerated, so they stay out of the sitemap.
 *   - `path` must match the router path exactly (src/routes/index.tsx).
 *   - `description` is the meta description: one or two sentences, no promises
 *     about events, deadlines or standings the site cannot guarantee.
 *
 * The discoverability decisions for the same routes (where each one is linked
 * from) live in src/routes/publicRouteInventory.ts; a test keeps the two in sync.
 */

export type SitemapChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface PublicRouteSeo {
  /** Canonical path, exactly as the router spells it. */
  path: string;
  /** Page title; the document title becomes "<title> | VSA at UCSD". */
  title: string;
  /** Full document title for routes whose title should not follow that pattern. */
  documentTitle?: string;
  /** Meta description, also used for the Open Graph and Twitter descriptions. */
  description: string;
  /** Absolute URL of the share image; defaults to the site thumbnail. */
  image?: string;
  /** Alt text for the share image. */
  imageAlt?: string;
  /** Sitemap priority, 0.0–1.0. */
  priority?: number;
  /** Sitemap change frequency hint. */
  changeFrequency?: SitemapChangeFrequency;
}

export const PUBLIC_ROUTE_SEO: PublicRouteSeo[] = [
  {
    path: '/',
    title: 'VSA at UCSD',
    documentTitle: 'VSA at UCSD — Vietnamese Student Association at UC San Diego',
    description:
      'The Vietnamese Student Association at UC San Diego builds community and celebrates Vietnamese culture through student-led events, Houses, mentorship programs, and annual productions.',
    priority: 1,
    changeFrequency: 'weekly',
  },
  {
    path: '/events',
    title: 'Events',
    description:
      'Upcoming VSA events at UC San Diego: general body meetings, socials, cultural shows, fundraisers, retreats, and the events members make together.',
    priority: 0.9,
    changeFrequency: 'daily',
  },
  {
    path: '/calendar',
    title: 'Calendar',
    description:
      'Browse the VSA at UC San Diego event calendar by month, with general body meetings, socials, cultural events, and other key dates in one place.',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    path: '/leaderboard',
    title: 'Leaderboard',
    description:
      'The VSA points leaderboard and House standings at UC San Diego: see how members and Houses rank by the points they earn across the academic year.',
    priority: 0.8,
    changeFrequency: 'daily',
  },
  {
    path: '/cabinet',
    title: 'Cabinet',
    description:
      'Meet the VSA at UC San Diego cabinet — the student leaders behind our events, programs, culture, and community outreach — and browse past years.',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/get-involved',
    title: 'Get Involved',
    description:
      'Find your place in VSA at UC San Diego: the House system, ACE mentorship, the Intern Program, Vietnamese Culture Night, and the events calendar.',
    priority: 0.9,
    changeFrequency: 'monthly',
  },
  {
    path: '/gallery',
    title: 'Gallery',
    description:
      'Photo albums and memories from VSA at UC San Diego — socials, general body meetings, Vietnamese Culture Night, and the gatherings members make together.',
    priority: 0.8,
    changeFrequency: 'weekly',
  },
  {
    path: '/ace',
    title: 'ACE (Anh Chị Em)',
    description:
      "ACE (Anh Chị Em) is VSA at UC San Diego's Big/Little program: members are paired with an older sibling who mentors them, and together they form multi-generation fams.",
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/house',
    title: 'House Program',
    description:
      'The VSA House system at UC San Diego: year-long teams with their own identity, events, and points standings, competing together across the academic year.',
    priority: 0.9,
    changeFrequency: 'weekly',
  },
  {
    path: '/house/archive',
    title: 'House Archive',
    description:
      'Browse every past VSA House year at UC San Diego — the themes, the Houses, and the stories behind each era of the House system.',
    priority: 0.6,
    changeFrequency: 'yearly',
  },
  {
    path: '/intern-program',
    title: 'Intern Program',
    description:
      'The VSA Intern Program gives UC San Diego students hands-on experience running the organization, from event logistics to cabinet work.',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/vcn',
    title: 'Vietnamese Culture Night',
    description:
      "Vietnamese Culture Night (VCN) is VSA at UC San Diego's annual culture show — student-led dance, theatre, and storytelling celebrating Vietnamese culture.",
    priority: 0.9,
    changeFrequency: 'monthly',
  },
  {
    path: '/vcn/current',
    title: 'VCN — This Year’s Show',
    description:
      "This year's Vietnamese Culture Night at VSA at UC San Diego: the show, the cast and crews behind it, and what to expect at this year's production.",
    priority: 0.8,
    changeFrequency: 'weekly',
  },
  {
    path: '/vcn/archive',
    title: 'VCN Archive',
    description:
      'Past Vietnamese Culture Night productions at VSA at UC San Diego — the shows, their themes, and the student crews who built them.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/wild-n-culture',
    title: 'Wild N’ Culture',
    description:
      "Wild N' Culture (WNC) is VSA at UC San Diego's annual intercollegiate comedy competition, where Vietnamese student organizations from across Southern California compete.",
    priority: 0.8,
    changeFrequency: 'yearly',
  },
  {
    path: '/uvsa-network',
    title: 'SoCal VSA Network',
    description:
      'UVSA connects Vietnamese student associations across Southern California. See the schools in the network, the externals they host, and how VSA at UC San Diego takes part.',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    path: '/privacy',
    title: 'Privacy Notice',
    description:
      'How VSA at UC San Diego handles data: what this site collects, what it does not, and how to reach us about a privacy question or request.',
    priority: 0.3,
    changeFrequency: 'yearly',
  },
];

/**
 * Public URLs that must never appear in the sitemap or carry a canonical URL.
 * `/admin`, `/profile`, `/points` and `/feedback` are also disallowed in
 * public/robots.txt, so the two lists stay in step.
 */
export const NON_INDEXABLE_PUBLIC_PATHS = [
  '/admin',
  '/admin/login',
  '/profile',
  '/points',
  '/feedback',
  '/signin',
] as const;

/** Canonical paths that belong in the sitemap, in manifest order. */
export const INDEXABLE_PUBLIC_PATHS = PUBLIC_ROUTE_SEO.map((route) => route.path);

/** The manifest entry for a pathname, or null when the path is not indexable. */
export function findPublicRouteSeo(pathname: string): PublicRouteSeo | null {
  return PUBLIC_ROUTE_SEO.find((route) => route.path === pathname) ?? null;
}

/** Whether a path (or a child of it) is on the non-indexable list. */
export function isNonIndexablePublicPath(pathname: string): boolean {
  return NON_INDEXABLE_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}
