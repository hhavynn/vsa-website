# Sitewide UI coverage ledger

The single source of truth for the sitewide visual-unification campaign: every
registered route, overlay, embedded workflow and generated graphic, with its
design treatment and how far it has actually been verified.

**Reference identity:** PR #761 (`design/figma-editorial-homepage-draft`,
`452f62d13`): the "Culture, Community." hero, periwinkle/lavender palette,
Instrument Serif display type, Polaroids, iridescent stars. Public storytelling
pages stay expressive; admin gets the *operational expression* of the same
palette: calm, dense, and clearly the same brand.

**Baseline (2026-10-29):** #761 open and unmerged, so this campaign is stacked
on its head. Inventory regenerated from source: 60 route patterns in
`src/routes/index.tsx` (24 public, 32 admin, `/signin` → `/admin/login`, `*`),
56 page files, 98 admin feature files, 16 `ui/` + 21 `common/` files.

## Status vocabulary

| Status | Meaning |
|---|---|
| not started | Still renders legacy styling beyond what shared tokens changed |
| tokens | Inherits the new root tokens and shell; no page-specific design pass yet. **Not done.** |
| implemented | Page or component had its own design pass in code |
| visually verified | Screenshotted at 375 / 768 / 1440, light and dark, and reviewed |
| functionally verified | Above, plus exercised with real or fixture data and tests pass |

"Harness" means verified in a scratch component harness with placeholder
fixture rows (no Supabase calls, no auth bypass on real pages). Live admin
pages need an authorized session; anything verified only in the harness says so.

## How the theme is layered (Batch 1)

- `:root` / `html.dark` in `src/index.css` now hold the **operational
  palette**: periwinkle-mist background, ink-navy text, `--vsa-brand-*`
  periwinkle ramp, lavender accent, ink-navy `--color-scrim`, and the shared
  `--ed-*` editorial tokens. Admin, sign-in, toasts and every portaled
  dialog render with these. The legacy teal/parchment root is retired.
- `.vsa-editorial-shell` (public routes, `styles/public-editorial.css`)
  layers cream paper, page heroes and scrapbook accents on top. Unchanged.
- Nav, logo and footer chrome are editorial on every route. Only the
  "Join VSA" CTA and page decoration are public-only.
- Systemic admin patterns (index.css): `.vsa-admin-field` (header wash),
  `.vsa-admin-sky` (sign-in field), `.vsa-ribbon-top/bottom` (2px iridescent
  edge). Outside the public shell, `font-synthesis-weight: none` renders
  Instrument Serif's true face instead of faux bold (109 admin call sites use
  `font-serif font-bold`).

## Batches

| Batch | Scope | Branch | Status |
|---|---|---|---|
| 1 Foundation | Root tokens, nav/footer chrome, admin shell, page header, quick search, sign-in, common dialogs, primitives | `design/sitewide-admin-foundation` | implemented; harness-verified |
| 2 Story generator | StoryStudio editor + Top 3/5/10 PNG templates | `design/sitewide-story-generator` (stacked on 1) | implemented; exported PNGs verified |
| 3 Core admin ops | Dashboard, Events, Import, Members, Points, Merge, Photo Requests | `design/sitewide-core-admin-ops` (stacked on 2) | implemented; real pages verified with empty data |
| 4 Programs | Houses, ACE, Interns, Cabinet, Rollover, Years, Year Setup | `design/sitewide-programs-leadership` (stacked on 3) | implemented; real pages verified with empty data |
| 5 Content | Gallery, Content, Calendar, VCN, Applications, Feedback, Resources, UVSA Schools, External Events | `design/sitewide-content-outreach` (stacked on 4) | implemented; real pages verified with empty data |
| 6 Remaining admin | Analytics, Settings, AI ×3, Content Health, Launch Checklist, Recent Changes, Data Rights | `design/sitewide-remaining-admin` (stacked on 5) | implemented; real pages verified with empty data |
| 7 Residual public | Legacy CSS in index.css, scrapbook stickers, public overlays | — | not started |
| 8 Completion audit | Reconcile this ledger | — | not started |

Protected areas (attendance import, House placement, member identity,
applications, data rights) get an audit-first `vsa-change-control` review
before their batch. This campaign changes presentation only: no business
rules, RLS, migrations, data writes or permissions.

## Shared shell and primitives

| Item | Files | Before | Treatment | Status | Notes |
|---|---|---|---|---|---|
| Root tokens | `src/index.css`, `tailwind.config.js` | Teal/parchment, midnight-teal dark | Periwinkle/lavender operational palette, both modes, brand ramp fallbacks | implemented | Contrast: text3 ≥5:1 on every surface in both modes |
| Top nav | `NavigationShell`, `NavLogo`, `NavLinks`, `ExplorePanel`, `publicEditorialTheme.ts` | Teal pill nav on admin/sign-in | Editorial underline nav + Instrument Serif wordmark on every route | visually verified | `/admin/login` 375/1440 light+dark |
| Footer | `Footer.tsx`, `public-editorial.css` | Scrapbook teal footer on admin | Editorial periwinkle footer everywhere | implemented | Legacy footer removed |
| Admin layout + mobile bar | `AdminLayout.tsx` | Teal tokens | Sidebar-tone bar with ribbon edge, display-serif page label | visually verified (harness) | |
| Admin sidebar + drawer | `AdminNav.tsx` | "VSA Admin" text, gold pin, black scrim | Sparkle lockup, gradient active rail, lavender pins, ink scrim, house easing | visually verified (harness) | Drawer 375 light+dark |
| Page header | `AdminPageHeader.tsx` | Flat surface, bold DM Serif | Lavender/sky wash, ribbon edge, Instrument Serif title, brand-tinted related chips | visually verified (harness) | Propagates to every admin page using it |
| Quick search | `AdminQuickSearch.tsx` | Black scrim, gray selection | Ink scrim, ribbon top, brand selection rail, kbd chip | visually verified (harness) | 1440 dark |
| ConfirmDialog | `common/ConfirmDialog.tsx` | Black scrim, bold serif | Ink scrim + blur, ribbon top, display title, themed type-to-confirm input | visually verified (harness) | Typed tier shown |
| BottomSheet | `ui/BottomSheet.tsx` | Black scrim | Ink scrim | implemented | Used by public overlays too |
| Button | `ui/Button.tsx` | Hard-coded teal-era borders | Brand ramp secondary, brand-300 dark primary | visually verified (harness) | All variants incl. loading/disabled |
| PaginationControls | `common/PaginationControls.tsx` | slate/gray/zinc themes | One token theme; `theme` prop removed (3 callers) | visually verified (harness) | Leaderboard uses it publicly |
| PageError | `common/PageError.tsx` | zinc | Tokens, display title | visually verified (harness) | |
| Toasts | `App.tsx` Toaster | White in both modes | Token surface/text/border | implemented | Not screenshotted |
| Sign-in | `pages/SignIn.tsx`, `auth/SignInForm.tsx` | Teal card on parchment, zinc inputs | Sky field, sparkles, ribbon card, mono labels, themed inputs | visually verified | 375/1440 light+dark |
| `common/Modal.tsx` | — | zinc-900 legacy dialog | **Deleted**: no importers | n/a | |
| `common/Skeleton.tsx` | — | gray duplicate of `ui/Skeleton` | **Deleted**: no importers | n/a | |
| Badge, Input, Card, Skeleton (ui) | `ui/*` | Token-based already | Inherit new tokens | tokens | Badge `purple` still uses Tailwind purple; fine but could move to lavender |
| ops/* (EmptyState, FilterChips, StatusBadge, SaveBar, …) | `features/admin/ops/` | Token-based | Inherit tokens + faux-bold fix | tokens | EmptyState/FilterChips/StatusBadge seen in harness |

## Public routes

All public routes already wear the #761 editorial shell. They are listed so
nothing is missed. Each still needs a Batch 7 sweep for overlays and legacy CSS.

| Route | Page | Status | Remaining |
|---|---|---|---|
| `/` | Home | implemented in #761 | Hero preserved; verify after merge |
| `/events` | Events | implemented in #761 | Event detail overlays |
| `/calendar` | Calendar | implemented in #761 | `CalendarDetailModal` (BottomSheet) |
| `/leaderboard` | Leaderboard | implemented in #761 | Pagination now tokenized; story share links |
| `/cabinet` | Cabinet | implemented in #761 | `CabinetRoleModal`, `CabinetRoleExplorer` |
| `/get-involved` | GetInvolved | implemented in #761 | `FindYourVsaPath`, `NewMemberChecklist` |
| `/gallery` | Gallery | implemented in #761 | `AlbumLightbox`, `CameraFrame` |
| `/ace` | Ace | implemented in #761 | `FamSheet`, `FamilyTree`; `styles/ace.css` |
| `/house`, `/house-system`, `/house/:houseSlug`, `/house/archive`, `/house/archive/:yearSlug(/:houseSlug)`, `/house/year/:yearSlug(/:houseSlug)` | House, HouseDetail, HouseArchive | implemented in #761 | Archive/year variants unverified |
| `/intern-program` | Internship | implemented in #761 | |
| `/vcn`, `/vcn/current`, `/vcn/archive` | Vcn* | implemented in #761 | Stage hero variants |
| `/wild-n-culture` | WildNCulture | implemented in #761 | |
| `/uvsa-network` | UVSANetwork | implemented in #761 | |
| `/points` | Points | implemented in #761 | `FindMyPoints`, `MyVSACard`, `PointsExplainer` |
| `/feedback` | Feedback | implemented in #761 | |
| `/privacy` | Privacy | implemented in #761 | |
| `/signin` → `/admin/login` | SignIn | visually verified (Batch 1) | |
| `*` | NotFound | implemented in #761 | |

## Admin routes

Every admin page now renders inside the new shell, header and tokens. None has
had its own page pass, so all are **tokens**, not done. Hardcoded legacy class
counts (gray/zinc/slate/teal/coral/gold/hex) come from the Batch 1 holdout scan.

| Route | Page file | Batch | Status | Known holdouts / notes |
|---|---|---|---|---|
| `/admin` | Overview | 3 | visually verified (harness, empty data) | Display-serif greeting, wash + sparkles, raised search |
| `/admin/events` | Events | 3 | visually verified (harness, empty data) | String-only diff; recap editor and populated list unverified |
| `/admin/import` | Import (+LegacyImport) | 3 | visually verified (harness, empty data) | 99 zinc classes → tokens; **string-only diff** (protected); review/preview tables need live data |
| `/admin/members` | Members | 3 | visually verified (harness, empty data) | 46 → tokens; **string-only diff** (protected); edit/merge dialogs need live data |
| `/admin/points` | Points | 3 | visually verified (harness, empty data) | Now uses AdminPageHeader; year select gained an accessible label |
| `/admin/merge-suggestions` | MergeSuggestions | 3 | visually verified (harness, empty data) | Now uses AdminPageHeader; populated diff rows unverified |
| `/admin/photo-requests` | PhotoRequests / `PhotoRequestsTab` | 3 | visually verified (harness, empty data) | Header + status badges/actions moved from inline hex to classes; request cards need live data |
| `/admin/houses` | Houses | 4 | visually verified (harness, empty data) | All House panels **string-only**; placement/reveal/payments with data need a live session |
| `/admin/ace` | AceFamilies | 4 | visually verified (harness, empty data) | Ink-fill actions → brand primary; warning list off teal-era gold; assignment panels string-only |
| `/admin/interns` | Interns | 4 | visually verified (harness, empty data) | |
| `/admin/cabinet` | Cabinet | 4 | visually verified (harness, empty data) | Edit-member modal: ink scrim; populated directory unverified |
| `/admin/cabinet/rollover` | CabinetRollover | 4 | visually verified (harness, empty data) | |
| `/admin/years` | YearsTerms | 4 | visually verified (harness, empty data) | Now uses AdminPageHeader; create actions → brand primary |
| `/admin/year-setup` | YearSetup | 4 | visually verified (harness, empty data) | Custom header kept (embeds the year picker) with wash, ribbon and display title |
| `/admin/content` | Content | 5 | visually verified (harness, empty data) | Header wash + display title; save action → brand primary (ProgramContentManager too) |
| `/admin/content-calendar` | ContentCalendar | 5 | visually verified (harness, empty data) | Header wash; 'Later' chip on tokens |
| `/admin/gallery` | Gallery | 5 | visually verified (harness, empty data) | Album modal on ink scrim; upload previews need data |
| `/admin/vcn` | VcnArchives | 5 | visually verified (harness, empty data) | Inputs were black in light mode: now token inputs; header wash |
| `/admin/feedback` | Feedback / `FeedbackTab` | 5 | visually verified (harness, empty data) | 30 light-only hexes (teal-era) → status tokens, string-only; populated chips need data |
| `/admin/resources` | Resources | 5 | visually verified (harness, empty data) | Ink-fill action → brand primary; delete color → danger token |
| `/admin/uvsa-schools` | UVSASchools | 5 | visually verified (harness, empty data) | |
| `/admin/external-events` | ExternalEvents | 5 | visually verified (harness, empty data) | |
| `/admin/applications` | Applications | 5 | visually verified (harness, empty data) | **Applications + ApplicationWindowCard string-only**; window states on status tokens |
| `/admin/analytics` | Analytics | 6 | visually verified (harness, empty data) | Header wash; chart tooltip off gray-900; error state seen (no GA data offline) |
| `/admin/settings` | Settings | 6 | visually verified (harness, empty data) | Header wash + display title |
| `/admin/ai-knowledge` | AiKnowledge | 6 | visually verified (harness, empty data) | Status chip + checkbox on tokens; header wash |
| `/admin/ai-feedback` | AiFeedback | 6 | visually verified (harness, empty data) | |
| `/admin/ai-usage` | AiUsage | 6 | visually verified (harness, empty data) | |
| `/admin/content-health` | ContentHealth | 6 | visually verified (harness, empty data) | |
| `/admin/launch-checklist` | LaunchChecklist | 6 | visually verified (harness, empty data) | |
| `/admin/recent-changes` | RecentChanges | 6 | visually verified (harness, empty data) | |
| `/admin/data-rights` | DataRightsRequests | 6 | visually verified (harness, empty data) | **DataRightsRequestTracker string-only** (display title only); populated requests need data |
| `/admin/login` | SignIn | 1 | visually verified | |

## Batch 3 notes

- **Change control:** gated tier (displays protected-domain data). Every
  protected file (Import, LegacyImport, Members, ImportAuditPanel, recovery/*,
  Events, Houses) was proven **string-only** by normalizing away string
  literals and comparing token streams against the Batch 2 base. Structural
  edits are limited to headers (Points, MergeSuggestions, PhotoRequests,
  Overview), PhotoRequestsTab inline-hex → classes, and toast wiring.
- **Shared fixes that reach every later batch:** `src/lib/toastOptions.ts`
  themes the app Toaster and the 9 admin pages that mount their own;
  `scrapbook-paper` / `scrapbook-note` render as calm cards (no tape, no paper
  shadow) outside the public shell (~45 admin call sites); the no-faux-bold
  and scrapbook rules key off `.vsa-editorial-shell` ancestry so public pages
  are correct from the first paint.
- **Follow-up (behavior, not design):** those 9 pages mount a second
  `<Toaster>` beside App's, so react-hot-toast may draw each toast twice. Left
  unchanged here; worth a separate fix.
- **Verification method:** real page components rendered in the harness with
  an offline Supabase stand-in returning empty results (no network, no auth
  bypass against real data) at 375 and 1440, light and dark. Populated tables,
  dialogs with data and import previews still need an authorized session.

## Batch 4 notes

- **Change control:** House UI styling is exempt from reveal freezes; House
  data and reveal content were not touched. Every House component changed
  (HouseDraftEditor, HouseImagesManager, HousePlacementResults,
  HousePlacementReviewPanel) and the ACE assignment panels and Cabinet are
  **string-only** against the Batch 3 base. Structural edits: YearsTerms'
  header swap and inline ink-button styles → classes in AceFamilies/YearsTerms.
- **Primary actions:** the inverted ink-fill buttons (white in dark mode) in
  Batch 4 surfaces now use the brand primary. Three remain in Batch 5
  (Content, Resources, ProgramContentManager).
- Remaining data hexes (`#10b981` House accent fallback, `#000000` color-input
  default, `#E07856` placeholder) are data, not styling.

## Batch 5 notes

- **Status tokens** (`--status-{info,success,warning,danger,accent}-{text,border,bg}`
  in index.css, light + dark): FeedbackTab, ApplicationWindowCard,
  Applications and Resources used light-only inline hexes (FeedbackTab's
  "in progress" chip was teal `#1e8878`) that failed contrast on dark
  surfaces. Swapping the hex *strings* for `var(--status-…)` keeps those files
  **string-only**, including both protected Applications files.
- **Structural edits:** custom headers in Content, Content Calendar, VCN and
  Feedback gained the shared wash/ribbon/display title in place (inline
  `style` removed); the last three ink-fill buttons (Content, Resources,
  ProgramContentManager) → brand primary; VCN inputs (black in light mode) →
  token inputs. No handler, data or gating change. Application link
  visibility and window logic are untouched.

## Batch 6 notes

- **Data Rights** renders its header inside `DataRightsRequestTracker`
  (protected); only its class strings changed (display title), proven
  **string-only** against the Batch 5 base.
- Analytics, Settings, Ask VSA Knowledge/Feedback/Usage, Launch Checklist and
  Recent Changes headers gain the shared wash, ribbon and display title
  (inline `style` removed from four containers). AiUsage, RecentChanges and
  ContentHealth are string-only.
- **Every admin route now has its own design pass.** What remains for admin is
  live-data verification (Batch 8), not styling.

## Overlays and embedded workflows (non-route)

| Item | Owner | Batch | Status |
|---|---|---|---|
| ConfirmDialog, BulkRunDialog, BulkActionBar | common / admin ops | 1 / 3 | ConfirmDialog verified (harness); others tokens |
| AdminQuickSearch, AdminOnboardingHelp | admin | 1 | Quick search verified (harness); onboarding bar seen in harness |
| PublicPreviewDialog, PreviewFrame | admin/preview | 5 | implemented (ink scrim); not screenshotted open |
| RecoveryWorkspace, BatchReviewDialog, RecoveryFindingDialog | admin/recovery | 3 | tokens; protected |
| AceAssignmentsWorkspace | admin | 4 | tokens |
| HouseRosterPanel, HousePaymentsPanel, HouseEventsManager/Dashboard, HouseDraftEditor, placement panels | admin | 4 | tokens; protected |
| AttendanceReadinessPanel, ImportReviewPanel, ImportStepper | admin | 3 | tokens; protected |
| Top3StoryDialog + StoryStudio + PNG export | admin / story / lib/story | 2 | visually verified (harness + real PNG export) |
| PhotoRequestSection | avatar | 7 | tokens |
| SessionExpiredDialog | auth | 1 | tokens (not screenshotted) |
| CalendarDetailModal, CabinetRoleModal, AlbumLightbox, FamSheet, PublicSearchDialog, VsaAiAssistant, MobileDrawer | public features | 7 | editorial shell (body-scoped); verify in Batch 7 |
| Toasts | App | 1 | implemented |

## Batch 2: leaderboard story generator

| Item | Files | Treatment | Status |
|---|---|---|---|
| Canvas kit | `lib/story/storyCanvas.ts` | Blue-hour (dark) and daydream (light) fields with blooms and seeded film grain; four-point stars, iridescent bubbles, ribbon, glass cards, Polaroid prints, metallic medallions; Instrument Serif display | implemented |
| Top 3 podium | `lib/story/drawTop3Story.ts` | Taped champion Polaroid with name caption, gold medal, serif-italic headline; runner-up glass cards with tilted mini Polaroids, silver/bronze medals, House dot + name | visually verified (exported PNG) |
| Top 5/10 + tied Top 3 list | `lib/story/drawTopNStory.ts` | Glass rows, medals for ranks 1–3 (`T2` on ties), ringed avatars, serif names, House dot lines; row geometry retuned within the safe-zone test | visually verified (exported PNG) |
| Editor | `story/StoryStudio.tsx`, `admin/Top3StoryDialog.tsx` | Header wash + ribbon, story-tinted preview frame, rose safe-zone guides, gradient Look swatches, brand selection states | visually verified (harness 375/1440 light+dark) |

Preserved: 1080×1920 canvas, 250px safe bands, file names, download and
native share, CORS image loading with initials fallback, tie routing
(`shouldUseTopNList`), Top N selection, theme ids and labels. Rendered and
reviewed: Top 3 dark/light, Top 5 dark/light, Top 10 dark/light, tied Top 3,
Top 3 with open spots, "Take the crown" and "Heating up" presets, all with
placeholder names (no member photos; initials fallback exercised).
Remaining: the unknown-House fallback color in `top3Story.ts` is still teal
`#3bbdb5` (a data fallback with a test pinning it); real-photo export not yet
checked against live CORS headers.

## Other generated graphics

| Item | Files | Batch | Status |
|---|---|---|---|
| Member snapshot share image | `lib/snapshotImage.ts` | 7 | not started |

## Known residual legacy CSS (Batch 7)

`src/index.css` still carries teal/coral/gold literals in public decorative
classes: `.scrapbook-sticker-*` (overridden inside the editorial shell),
`.editorial-hero` grid/watermark vars, and two glow gradients. They are not
reachable from admin; audit them against public pages in Batch 7.
`src/lib/uvsaSchoolLogos.ts` uses `coral-`/`gold-` palette classes for school
initials. `StoryStudio` uses coral/gold (Batch 2).

## Verification log

| Date | Batch | Evidence |
|---|---|---|
| 2026-10-30 | 6 | Real Batch 6 page components in the offline harness, 375/1440 light+dark (analytics, settings, AI knowledge/feedback/usage, content health, launch checklist, recent changes, data rights). Gates: typecheck, lint (18 pre-existing warnings), 4198/4198 Jest, build, diff --check. |
| 2026-10-30 | 5 | Real Batch 5 page components in the offline harness, 375/1440 light+dark (gallery, content, calendar, vcn, applications, feedback, resources, uvsa schools, external events). Gates: typecheck, lint (18 pre-existing warnings), 4198/4198 Jest, build, diff --check. |
| 2026-10-30 | 4 | Real Batch 4 page components in the offline harness, 375/1440 light+dark (houses, ace, interns, cabinet, rollover, years, year setup). Gates: typecheck, lint (18 pre-existing warnings), 4198/4198 Jest, build, diff --check. |
| 2026-10-30 | 3 | Real Batch 3 page components in the offline harness, 375/1440 light+dark (dashboard, events, import, members, points, merge, photo requests); public /cabinet and /get-involved re-checked. Gates: typecheck, lint (18 pre-existing warnings), 4198/4198 Jest, build, diff --check. |
| 2026-10-29 | 2 | Real 1080×1920 PNG exports for every template/theme/state listed above; editor harness 375/1440 light+dark. Gates: typecheck, lint (18 pre-existing warnings, none in touched files), 4198/4198 Jest, build. |
| 2026-10-29 | 1 | Before/after `/admin/login` at 375/1440 light+dark; harness: shell, header, table, filters, buttons, pagination, empty/error states, ConfirmDialog, quick search, mobile drawer at 375/1440 light+dark. Gates: typecheck, lint, full Jest suite, build (see PR). Live admin pages not yet screenshotted (no authorized session in the browser). |
