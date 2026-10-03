# Public route discoverability

Why each public route is (or is not) in the navigation, and the contextual
"Related" pattern that carries the rest. The machine-checked version of the table
below is `src/routes/publicRouteInventory.ts`, enforced by
`src/routes/publicRouteDiscoverability.test.ts`: adding a public route without a
decision here fails that test.

## Surfaces

| Surface | Source of truth | Use for |
| --- | --- | --- |
| Header / Explore / drawer | `navConfig.ts` (`QUICK_LINKS`, `GET_INVOLVED`, `EXPLORE_LINKS`) | Genuine primary/global destinations only |
| Mobile dock (4 slots) | `navConfig.ts` `DOCK_ITEMS` | Do not add casually |
| Footer | `footerLinks.ts` (`FOOTER_GROUPS`, `FOOTER_LEGAL_LINKS`) | Secondary destinations, legal/help |
| Contextual "Related" | `RelatedLinks` + `src/lib/relatedLinks.ts` | 1-3 next steps on a page; never a second nav |

## Decisions

- **`/points-explainer` is not a route.** Current `main` embeds `PointsExplainer`
  directly in `/points` and `/leaderboard`. `PublicPointsExplainer.tsx` is unrouted
  and unreferenced dead source (candidate for deletion in a later cleanup PR). Both
  pages expose the explainer at `#how-points-work`; "How points work" links target
  that anchor (on `/leaderboard` the link also opens the collapsed section).
- **`/points`, `/leaderboard`, `/calendar`, `/cabinet`, `/gallery`, `/uvsa-network`,
  programs:** already in primary nav; the footer now also lists Find My Points,
  Calendar, Get Involved and UVSA Network.
- **`/feedback`:** footer (Navigate group and the legal/help row) plus the
  points-correction path. Not primary nav.
- **`/privacy`:** footer legal row, plus consent banner / application forms.
- **`/house/archive`:** contextual only (every House page links it). Archive and
  year routes (`/house/archive/:yearSlug`, `/house/year/:yearSlug`, `:houseSlug`
  detail routes) stay deep-link-only, reached from the year selector and House cards.
- **`/vcn/current`, `/vcn/archive`:** contextual from the VCN overview.
- **`/house-system`:** a legacy alias of `/house`; kept routed because older content
  links to it.
- **`/admin/login`:** intentionally unlinked from public navigation.

## Related links by page

| Page | Related |
| --- | --- |
| `/points` | Leaderboard, Events ("earn more points") |
| `/leaderboard` | Find My Points, How points work (`#how-points-work`, keeps `?view=`) |
| `/house` (current year) | Leaderboard, How points work, House archive |
| `/house/archive/:year`, `/house/year/:year` (past years) | Current Houses, House archive, Leaderboard |
| `/vcn`, `/wild-n-culture` | Compare programs (`/get-involved#programs`); `/vcn` also shows an apply button for each VCN window that is open |
| `/ace`, `/intern-program` | Already end with "All Programs" and an in-page application block; no extra card |
| Gallery album quick-look | Related event, only when `gallery_events.event_id` is set and the event row is publicly readable |
| `/events` past events | "View Photos", only when an album has that explicit `event_id` |

Application buttons and URLs always come from `public_application_links` (via
`ApplicationCTA`); closed, future and disabled windows render nothing. Event and
gallery relationships are explicit foreign keys only: never title or date matching.

## Gallery album quick-look

Gallery cards open an in-page quick-look (`AlbumLightbox`, built on `BottomSheet`)
instead of leaving straight for Google Photos; modified clicks and the "Open full
album" button still reach Google Photos. Open state lives in history state, so
Back closes it, swiping between albums replaces (not stacks) the entry, and the
site's scroll-to-top on URL change never fires behind it. Swipe, arrow keys,
Escape, a centered thumb-reach Close, and a fallback for missing or broken covers
are covered by `src/pages/Gallery.lightbox.test.tsx`. Pinch-zoom is not implemented.
