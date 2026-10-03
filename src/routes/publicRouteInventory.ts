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
}

export const PUBLIC_ROUTE_DECISIONS: Record<string, RouteDecision> = {
  '/': { placements: ['primary-nav', 'dock', 'footer'], note: 'Logo, dock Home, footer.' },
  '/events': { placements: ['primary-nav', 'dock', 'footer'], note: 'Header quick link and dock.' },
  '/calendar': { placements: ['primary-nav', 'footer'], note: 'Header quick link; footer for mobile reach.' },
  '/leaderboard': {
    placements: ['primary-nav', 'footer', 'contextual'],
    linkedFrom: ['src/pages/House.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Header; related from /points and the House pages.',
  },
  '/points': {
    placements: ['primary-nav', 'dock', 'footer', 'contextual'],
    linkedFrom: ['src/pages/Leaderboard.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Personal lookup. The how-points-work explainer lives in-page at #how-points-work; a standalone /points-explainer route is intentionally NOT recreated.',
  },
  '/cabinet': { placements: ['primary-nav', 'footer'], note: 'Explore panel.' },
  '/gallery': { placements: ['primary-nav', 'footer'], note: 'Explore panel.' },
  '/uvsa-network': { placements: ['primary-nav', 'footer'], note: 'Explore panel.' },
  '/get-involved': { placements: ['primary-nav', 'footer', 'contextual'], linkedFrom: ['src/lib/relatedLinks.ts'], note: 'Programs hub; every program page links back to #programs.' },
  '/house': { placements: ['primary-nav', 'dock', 'contextual'], linkedFrom: ['src/pages/HouseArchive.tsx'], note: 'Programs menu and dock; archive/year pages link back.' },
  '/ace': { placements: ['primary-nav', 'footer'], note: 'Programs menu.' },
  '/intern-program': { placements: ['primary-nav', 'footer'], note: 'Programs menu.' },
  '/vcn': { placements: ['primary-nav', 'footer'], note: 'Programs menu.' },
  '/wild-n-culture': { placements: ['primary-nav', 'footer'], note: 'Programs menu.' },
  '/house/archive': {
    placements: ['contextual'],
    linkedFrom: ['src/pages/House.tsx', 'src/pages/HouseDetail.tsx', 'src/lib/relatedLinks.ts'],
    note: 'Past-year counterpart of /house; reached from every House page, not global nav.',
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
  },
  '/vcn/archive': {
    placements: ['contextual'],
    linkedFrom: ['src/pages/Vcn.tsx', 'src/pages/VcnCurrent.tsx', 'src/pages/GetInvolved.tsx'],
    note: 'Past productions; reached from the VCN overview.',
  },
  '/feedback': {
    placements: ['footer', 'contextual'],
    linkedFrom: ['src/pages/Points.tsx', 'src/components/features/points/PointsExplainer.tsx'],
    note: 'Footer legal/help row plus the points-correction path.',
  },
  '/privacy': {
    placements: ['footer', 'contextual'],
    linkedFrom: ['src/components/common/AnalyticsConsentBanner.tsx', 'src/components/common/ApplicationCTA.tsx'],
    note: 'Footer legal row; linked from consent and application forms. Not in primary nav.',
  },
  '/signin': { placements: ['redirect'], note: 'Redirects to /admin/login.' },
  '/admin/login': { placements: ['unlinked'], note: 'Admin entry point; intentionally not in public navigation.' },
};
