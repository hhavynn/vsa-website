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
| Site search / breadcrumbs | `src/lib/publicDestinations.ts` — a *view* over the three rows above plus `publicRouteInventory.ts` (`title`, `description`, `crumb`, `keywords`) | Naming a page the same way everywhere; never a separate list to maintain |

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

## Site search

A global entry point (header button on desktop and mobile, `Ctrl/Cmd+K`, and `/`
outside text fields) opens a dialog; the 404 page embeds the same box.

- **Static pages** come from `publicDestinations.ts`, which reads `navConfig.ts`,
  `footerLinks.ts` and the inventory. Aliases (`/house-system`), redirects,
  unlinked entry points (`/admin/login`), parametric routes and anything under
  `/admin` are never indexed. A footer label that differs from the nav label
  ("Get Involved" vs "Start Here") stays searchable as a synonym.
  `publicSearch.test.ts` fails if a searchable inventory route is missing from
  the index, so a new route cannot go unsearchable.
- **Events and Gallery albums** are two slim reads, fetched once when search is
  first opened (React Query, 10-minute stale time) and filtered in memory after
  that, so typing makes no requests. They apply the same visibility rules as the
  public pages: `eventsRepository.getPublicSearchEntries` filters
  `is_published = true` and selects only id/name/date/end date/location/type/term
  (no description, no `check_in_form_url`); `galleryRepository.getPublicSearchAlbums`
  requires a Google Photos URL, like `getAlbums`.
- **Never indexed:** application links or their URLs (they are time-gated and only
  come from `public_application_links`), recaps, attendance, members, House events.
- **Result links:** pages go to their route; upcoming events to `/events#event-<id>`;
  past events to `/events?term=<term>#event-<id>` (the Gallery related-event link's
  shape); albums open Google Photos in a new tab with `noopener` — the Gallery
  quick-look is history state and only resolves for albums already loaded, so it is
  not a reliable deep link.
- **Telling look-alikes apart:** results are grouped (Pages & programs / Events /
  Photo albums) and every row carries a type tag, so *House* the program is never
  confused with *House Reveal* the event.
- Admin Quick Search is untouched; this reuses its interaction model only.

## Breadcrumbs

`PublicBreadcrumbs` is the one pattern. It is added where the URL has a parent:
`/vcn/current`, `/vcn/archive`, `/house/archive`, and the House year and House
detail routes (`/house/year/:year[/:house]`, `/house/archive/:year[/:house]`,
`/house/:house`). Flat top-level pages (`/events`, `/vcn`, `/house`, …) and unknown
paths get none. Trails come from `publicBreadcrumbs.ts`, using inventory `crumb`
labels, so a crumb never names a page differently from nav and search.

House trails are display-only. A past year sits under an "Archive" crumb; the live
year carries a "Current" badge; the decision is the year comparison the House pages
already make (the page passes its own `currentYear`), never the URL prefix — so
`/house/archive/<current year>` is not labelled an archive. The House name comes
from the page; the title-cased slug is only a fallback.

## 404 recovery

`NotFound` stays a real 404 (no redirect, no guessing). It shows search, the
likely destinations (the URL's own words run through the public page index), and
Home / Events / Get Involved. Two legacy URLs with evidence of having existed get a
direct "Looking for this?" card: `/profile` → `/points`, `/points-explainer` →
`/points#how-points-work`. No House/VCN legacy URL shape was found in the route
history, so none is mapped. `/admin/*` URLs render identically to any other unknown
URL: no suggestions, no echo. No 404 path logging was added: analytics is
consent-gated GA4 `page_view` only, with no aggregate store to extend.
