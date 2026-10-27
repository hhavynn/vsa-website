// Discoverability decision for every public route in routes/index.tsx.
//
// A route is never "just missing from the nav": each one is deliberately placed
// in exactly the surfaces below. The test next to this file fails when a new
// public route is added without a decision, or when a recorded placement stops
// being true (e.g. a footer link is removed).
//
//   primary-nav  navConfig.ts (QUICK_LINKS / GET_INVOLVED / EXPLORE_LINKS) — header, drawer
//   dock         navConfig.ts DOCK_ITEMS — the 4-slot mobile dock (do not add casually)
//   footer       footerLinks.ts (FOOTER_GROUPS / FOOTER_LEGAL_LINKS)
//   contextual   linked from related pages; `linkedFrom` lists the source files that do
//   deep-link    intentionally reached only from within its parent flow
//   alias        a second URL for a canonical route; never navigated to on its own
//   redirect     a Navigate rule, no page of its own
//   unlinked     intentionally not linked anywhere public (admin entry points)

export type Placement =
  | 'primary-nav'
  | 'dock'
  | 'footer'
  | 'contextual'
  | 'deep-link'
  | 'alias'
  | 'redirect'
  | 'unlinked';

export interface RouteDecision {
  placements: Placement[];
  /** Exclude sensitive utility paths from crawlers and the generated sitemap. */
  noIndex?: boolean;
  /** Static HTML title/description for social preview crawlers that do not run JavaScript. */
  seo?: { title: string; description: string };
  /** Source files (repo-relative) that link to this path; required for `contextual`. */
  linkedFrom?: string[];
  note: string;
  /**
   * Display metadata for site search and breadcrumbs (lib/publicDestinations.ts).
   * Labels for routes that already sit in navConfig/footerLinks come from there;
   * these fields only fill in what the nav lists do not carry, so no destination
   * is described twice.
   */
  /** Page title for a route that is in no nav list (e.g. /vcn/current). */
  title?: string;
  /** One-line description shown under a search result. */
  description?: string;
  /** Short label for a breadcrumb crumb when the title is too long (e.g. "Archive"). */
  crumb?: string;
  /** Extra search terms (synonyms) that the title/description do not already contain. */
  keywords?: string[];
}

export const PUBLIC_ROUTE_DECISIONS: Record<string, RouteDecision> = {
  '/': { placements: ['primary-nav', 'dock', 'footer'], note: 'Logo, dock Home, footer.', seo: { title: 'VSA at UCSD', description: 'Vietnamese Student Association at UC San Diego — building community and celebrating Vietnamese culture.' } },
  '/events': { placements: ['primary-nav', 'dock', 'footer'], note: 'Header quick link and dock.', description: 'Upcoming events and past-event memories.', keywords: ['calendar of events', 'gbm', 'mixer'], seo: { title: 'Events | VSA at UCSD', description: 'Explore VSA at UCSD events, gatherings, and activities throughout the academic year.' } },
  '/calendar': { placements: ['primary-nav', 'footer'], note: 'Header quick link; footer for mobile reach.', description: 'Month view of events and key dates.', keywords: ['schedule', 'dates'], seo: { title: 'Calendar | VSA at UCSD', description: 'Browse the VSA at UCSD calendar for upcoming gatherings, activities, and important dates.' } },
  '/leaderboard': {
    placements: ['primary-nav', 'footer', 'contextual'],
    linkedFrom: ['src/pages/House.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Header; related from /points and the House pages.',
    description: 'Member and House standings.', keywords: ['rankings', 'standings', 'top members', 'house standings', 'points'],
    seo: { title: 'Leaderboard | VSA at UCSD', description: 'See member rankings and House standings on the VSA at UCSD leaderboard.' },
  },
  '/points': {
    placements: ['primary-nav', 'dock', 'footer', 'contextual'],
    linkedFrom: ['src/pages/Leaderboard.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Personal lookup. The how-points-work explainer lives in-page at #how-points-work; a standalone /points-explainer route is intentionally NOT recreated.',
    noIndex: true,
    description: 'Look up your own points and events.', keywords: ['my points', 'attendance', 'lookup', 'check points'],
  },
  '/cabinet': { placements: ['primary-nav', 'footer'], note: 'Explore panel.', description: 'This year’s cabinet and past cabinets.', keywords: ['officers', 'board', 'leadership', 'team', 'president'], seo: { title: 'Cabinet | VSA at UCSD', description: 'Meet the student leaders of VSA at UCSD and explore past cabinet teams.' } },
  '/gallery': { placements: ['primary-nav', 'footer'], note: 'Explore panel.', description: 'Photo albums from past events.', keywords: ['photos', 'pictures', 'albums', 'memories'], seo: { title: 'Gallery | VSA at UCSD', description: 'Explore photo albums and memories from VSA at UCSD events and celebrations.' } },
  '/uvsa-network': { placements: ['primary-nav', 'footer'], note: 'Explore panel.', description: 'Vietnamese student associations across Southern California.', keywords: ['uvsa', 'schools', 'other vsas', 'socal'], seo: { title: 'SoCal VSA Network | VSA at UCSD', description: 'Discover Vietnamese student associations across Southern California through the VSA at UCSD network page.' } },
  '/get-involved': { placements: ['primary-nav', 'footer', 'contextual'], linkedFrom: ['src/lib/relatedLinks.ts'], note: 'Programs hub; every program page links back to #programs.', description: 'New to VSA? Every way to join in.', keywords: ['get involved', 'join', 'programs', 'new member', 'freshman'], seo: { title: 'Get Involved | VSA at UCSD', description: 'Find ways to connect, participate, and get involved with the Vietnamese Student Association at UC San Diego.' } },
  '/house': { placements: ['primary-nav', 'dock', 'contextual'], linkedFrom: ['src/pages/HouseArchive.tsx'], note: 'Programs menu and dock; archive/year pages link back.', description: 'Join a House and compete through the year.', keywords: ['houses', 'house system', 'fam'], seo: { title: 'House Program | VSA at UCSD', description: 'Learn about the VSA at UCSD House program, communities, and activities.' } },
  '/ace': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Big/Little mentorship and fam bonds.', keywords: ['ace', 'big', 'little', 'mentor', 'mentorship', 'family', 'fam'], seo: { title: 'ACE Program | VSA at UCSD', description: 'Discover ACE mentorship and Big/Little family connections through VSA at UCSD.' } },
  '/intern-program': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Learn cabinet work and help run VSA.', keywords: ['intern', 'internship', 'cabinet intern'], seo: { title: 'Intern Program | VSA at UCSD', description: 'Learn how the VSA at UCSD intern program introduces students to cabinet work and leadership.' } },
  '/vcn': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Vietnamese Culture Night, our annual production.', keywords: ['vietnamese culture night', 'culture night', 'show', 'performance', 'props', 'stage ninja'], seo: { title: 'Vietnamese Culture Night | VSA at UCSD', description: 'Explore Vietnamese Culture Night, the annual cultural production by VSA at UCSD.' } },
  '/wild-n-culture': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Cultural showcase and performance.', keywords: ['wnc', 'wild n culture', 'wild and culture', 'showcase'], seo: { title: 'Wild N’ Culture | VSA at UCSD', description: 'Learn about Wild N’ Culture, a cultural showcase and performance program at VSA at UCSD.' } },
  '/house/archive': {
    placements: ['contextual'],
    linkedFrom: ['src/pages/House.tsx', 'src/pages/HouseDetail.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Past-year counterpart of /house; reached from every House page, not global nav.',
    title: 'House archive', crumb: 'Archive', description: 'Past Houses and eras.', keywords: ['past houses', 'old houses', 'house history', 'lore'],
    seo: { title: 'House Archive | VSA at UCSD', description: 'Explore past House programs and years in the VSA at UCSD House archive.' },
  },
  '/house/archive/:yearSlug': { placements: ['deep-link'], note: 'Year selector on /house.' },
  '/house/archive/:yearSlug/:houseSlug': { placements: ['deep-link'], note: 'House cards within an archive year.' },
  '/house/year/:yearSlug': { placements: ['deep-link'], note: 'Year selector on /house.' },
  '/house/year/:yearSlug/:houseSlug': { placements: ['deep-link'], note: 'House cards within a year.' },
  '/house/:houseSlug': { placements: ['deep-link'], note: 'House cards on /house.' },
  '/house-system': { placements: ['alias', 'footer'], note: 'Legacy alias of /house; still linked from older content, kept routed.' },
  '/vcn/current': {
    placements: ['contextual'],
    linkedFrom: ['src/pages/Vcn.tsx', 'src/pages/VcnArchive.tsx', 'src/pages/GetInvolved.tsx'],
    note: 'This year’s show; reached from the VCN overview.',
    title: 'VCN: this year’s show', crumb: 'This year’s show', description: 'The current Vietnamese Culture Night production.', keywords: ['current vcn', 'vietnamese culture night', 'cast', 'tickets'],
    seo: { title: 'Current VCN | VSA at UCSD', description: 'See the current Vietnamese Culture Night production and updates from VSA at UCSD.' },
  },
  '/vcn/archive': {
    placements: ['contextual'],
    linkedFrom: ['src/pages/Vcn.tsx', 'src/pages/VcnCurrent.tsx', 'src/pages/GetInvolved.tsx'],
    note: 'Past productions; reached from the VCN overview.',
    title: 'VCN archive', crumb: 'Archive', description: 'Past Vietnamese Culture Night productions.', keywords: ['past vcn', 'old vcn', 'previous shows', 'videos'],
    seo: { title: 'VCN Archive | VSA at UCSD', description: 'Browse past Vietnamese Culture Night productions and their history at VSA at UCSD.' },
  },
  '/feedback': {
    placements: ['footer', 'contextual'],
    noIndex: true,
    linkedFrom: ['src/pages/Points.tsx', 'src/components/features/points/PointsExplainer.tsx'],
    note: 'Footer legal/help row plus the points-correction path.',
    title: 'Feedback', description: 'Report a problem or a points correction.', keywords: ['contact', 'report', 'correction', 'help', 'suggestion'],
  },
  '/privacy': {
    placements: ['footer', 'contextual'],
    linkedFrom: ['src/components/common/AnalyticsConsentBanner.tsx', 'src/components/common/ApplicationCTA.tsx'],
    note: 'Footer legal row; linked from consent and application forms. Not in primary nav.',
    title: 'Privacy notice', description: 'How the site handles your data.', keywords: ['privacy', 'data', 'cookies', 'analytics', 'consent'],
    seo: { title: 'Privacy Notice | VSA at UCSD', description: 'Read how the VSA at UCSD website handles privacy, data, and analytics choices.' },
  },
  '/signin': { placements: ['redirect'], note: 'Redirects to /admin/login.' },
  '/admin/login': { placements: ['unlinked'], note: 'Admin entry point; intentionally not in public navigation.' },
};
