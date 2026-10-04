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
  '/': { placements: ['primary-nav', 'dock', 'footer'], note: 'Logo, dock Home, footer.' },
  '/events': { placements: ['primary-nav', 'dock', 'footer'], note: 'Header quick link and dock.', description: 'Upcoming events and past-event memories.', keywords: ['calendar of events', 'gbm', 'mixer'] },
  '/calendar': { placements: ['primary-nav', 'footer'], note: 'Header quick link; footer for mobile reach.', description: 'Month view of events and key dates.', keywords: ['schedule', 'dates'] },
  '/leaderboard': {
    placements: ['primary-nav', 'footer', 'contextual'],
    linkedFrom: ['src/pages/House.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Header; related from /points and the House pages.',
    description: 'Member and House standings.', keywords: ['rankings', 'standings', 'top members', 'house standings', 'points'],
  },
  '/points': {
    placements: ['primary-nav', 'dock', 'footer', 'contextual'],
    linkedFrom: ['src/pages/Leaderboard.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Personal lookup. The how-points-work explainer lives in-page at #how-points-work; a standalone /points-explainer route is intentionally NOT recreated.',
    description: 'Look up your own points and events.', keywords: ['my points', 'attendance', 'lookup', 'check points'],
  },
  '/cabinet': { placements: ['primary-nav', 'footer'], note: 'Explore panel.', description: 'This year’s cabinet and past cabinets.', keywords: ['officers', 'board', 'leadership', 'team', 'president'] },
  '/gallery': { placements: ['primary-nav', 'footer'], note: 'Explore panel.', description: 'Photo albums from past events.', keywords: ['photos', 'pictures', 'albums', 'memories'] },
  '/uvsa-network': { placements: ['primary-nav', 'footer'], note: 'Explore panel.', description: 'Vietnamese student associations across Southern California.', keywords: ['uvsa', 'schools', 'other vsas', 'socal'] },
  '/get-involved': { placements: ['primary-nav', 'footer', 'contextual'], linkedFrom: ['src/lib/relatedLinks.ts'], note: 'Programs hub; every program page links back to #programs.', description: 'New to VSA? Every way to join in.', keywords: ['get involved', 'join', 'programs', 'new member', 'freshman'] },
  '/house': { placements: ['primary-nav', 'dock', 'contextual'], linkedFrom: ['src/pages/HouseArchive.tsx'], note: 'Programs menu and dock; archive/year pages link back.', description: 'Join a House and compete through the year.', keywords: ['houses', 'house system', 'fam'] },
  '/ace': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Big/Little mentorship and fam bonds.', keywords: ['ace', 'big', 'little', 'mentor', 'mentorship', 'family', 'fam'] },
  '/intern-program': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Learn cabinet work and help run VSA.', keywords: ['intern', 'internship', 'cabinet intern'] },
  '/vcn': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Vietnamese Culture Night, our annual production.', keywords: ['vietnamese culture night', 'culture night', 'show', 'performance', 'props', 'stage ninja'] },
  '/wild-n-culture': { placements: ['primary-nav', 'footer'], note: 'Programs menu.', description: 'Cultural showcase and performance.', keywords: ['wnc', 'wild n culture', 'wild and culture', 'showcase'] },
  '/house/archive': {
    placements: ['contextual'],
    linkedFrom: ['src/pages/House.tsx', 'src/pages/HouseDetail.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Past-year counterpart of /house; reached from every House page, not global nav.',
    title: 'House archive', crumb: 'Archive', description: 'Past Houses and eras.', keywords: ['past houses', 'old houses', 'house history', 'lore'],
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
  },
  '/vcn/archive': {
    placements: ['contextual'],
    linkedFrom: ['src/pages/Vcn.tsx', 'src/pages/VcnCurrent.tsx', 'src/pages/GetInvolved.tsx'],
    note: 'Past productions; reached from the VCN overview.',
    title: 'VCN archive', crumb: 'Archive', description: 'Past Vietnamese Culture Night productions.', keywords: ['past vcn', 'old vcn', 'previous shows', 'videos'],
  },
  '/feedback': {
    placements: ['footer', 'contextual'],
    linkedFrom: ['src/pages/Points.tsx', 'src/components/features/points/PointsExplainer.tsx'],
    note: 'Footer legal/help row plus the points-correction path.',
    title: 'Feedback', description: 'Report a problem or a points correction.', keywords: ['contact', 'report', 'correction', 'help', 'suggestion'],
  },
  '/privacy': {
    placements: ['footer', 'contextual'],
    linkedFrom: ['src/components/common/AnalyticsConsentBanner.tsx', 'src/components/common/ApplicationCTA.tsx'],
    note: 'Footer legal row; linked from consent and application forms. Not in primary nav.',
    title: 'Privacy notice', description: 'How the site handles your data.', keywords: ['privacy', 'data', 'cookies', 'analytics', 'consent'],
  },
  '/signin': { placements: ['redirect'], note: 'Redirects to /admin/login.' },
  '/admin/login': { placements: ['unlinked'], note: 'Admin entry point; intentionally not in public navigation.' },
};
