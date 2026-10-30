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
| 2 Story generator | StoryStudio editor + Top 3/5/10 PNG templates | `design/sitewide-story-generator` (stacked on 1) | see Batch 2 section |
| 3 Core admin ops | Dashboard, Events, Import, Members, Points, Merge, Photo Requests | — | not started |
| 4 Programs | Houses, ACE, Interns, Cabinet, Rollover, Years, Year Setup | — | not started |
| 5 Content | Gallery, Content, Calendar, VCN, Applications, Feedback, Resources, UVSA Schools, External Events | — | not started |
| 6 Remaining admin | Analytics, Settings, AI ×3, Content Health, Launch Checklist, Recent Changes, Data Rights | — | not started |
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
| `/admin` | Overview | 3 | tokens | |
| `/admin/events` | Events | 3 | tokens | 3 legacy classes; event recap editor |
| `/admin/import` | Import (+LegacyImport) | 3 | tokens | **47 + 52 legacy classes**: heaviest holdout; protected (attendance) |
| `/admin/members` | Members | 3 | tokens | **46 legacy classes**; protected (identity) |
| `/admin/points` | Points | 3 | tokens | Hosts the story generator (Batch 2) |
| `/admin/merge-suggestions` | MergeSuggestions | 3 | tokens | |
| `/admin/photo-requests` | PhotoRequests / `PhotoRequestsTab` | 3 | tokens | 9 legacy classes |
| `/admin/houses` | Houses | 4 | tokens | Placement/reveal/payments panels; protected |
| `/admin/ace` | AceFamilies | 4 | tokens | 7 legacy classes; assignment imports |
| `/admin/interns` | Interns | 4 | tokens | |
| `/admin/cabinet` | Cabinet | 4 | tokens | |
| `/admin/cabinet/rollover` | CabinetRollover | 4 | tokens | |
| `/admin/years` | YearsTerms | 4 | tokens | |
| `/admin/year-setup` | YearSetup | 4 | tokens | |
| `/admin/content` | Content | 5 | tokens | |
| `/admin/content-calendar` | ContentCalendar | 5 | tokens | 4 legacy classes |
| `/admin/gallery` | Gallery | 5 | tokens | Upload/preview tools |
| `/admin/vcn` | VcnArchives | 5 | tokens | 6 legacy classes |
| `/admin/feedback` | Feedback / `FeedbackTab` | 5 | tokens | **30 legacy classes** |
| `/admin/resources` | Resources | 5 | tokens | |
| `/admin/uvsa-schools` | UVSASchools | 5 | tokens | |
| `/admin/external-events` | ExternalEvents | 5 | tokens | |
| `/admin/applications` | Applications | 5 | tokens | `ApplicationWindowCard` 6 legacy classes; protected |
| `/admin/analytics` | Analytics | 6 | tokens | |
| `/admin/settings` | Settings | 6 | tokens | |
| `/admin/ai-knowledge` | AiKnowledge | 6 | tokens | 7 legacy classes |
| `/admin/ai-feedback` | AiFeedback | 6 | tokens | |
| `/admin/ai-usage` | AiUsage | 6 | tokens | |
| `/admin/content-health` | ContentHealth | 6 | tokens | |
| `/admin/launch-checklist` | LaunchChecklist | 6 | tokens | |
| `/admin/recent-changes` | RecentChanges | 6 | tokens | |
| `/admin/data-rights` | DataRightsRequests | 6 | tokens | protected |
| `/admin/login` | SignIn | 1 | visually verified | |

## Overlays and embedded workflows (non-route)

| Item | Owner | Batch | Status |
|---|---|---|---|
| ConfirmDialog, BulkRunDialog, BulkActionBar | common / admin ops | 1 / 3 | ConfirmDialog verified (harness); others tokens |
| AdminQuickSearch, AdminOnboardingHelp | admin | 1 | Quick search verified (harness); onboarding bar seen in harness |
| PublicPreviewDialog, PreviewFrame | admin/preview | 5 | tokens |
| RecoveryWorkspace, BatchReviewDialog, RecoveryFindingDialog | admin/recovery | 3 | tokens; protected |
| AceAssignmentsWorkspace | admin | 4 | tokens |
| HouseRosterPanel, HousePaymentsPanel, HouseEventsManager/Dashboard, HouseDraftEditor, placement panels | admin | 4 | tokens; protected |
| AttendanceReadinessPanel, ImportReviewPanel, ImportStepper | admin | 3 | tokens; protected |
| Top3StoryDialog + StoryStudio + PNG export | admin / story / lib/story | 2 | see Batch 2 |
| PhotoRequestSection | avatar | 7 | tokens |
| SessionExpiredDialog | auth | 1 | tokens (not screenshotted) |
| CalendarDetailModal, CabinetRoleModal, AlbumLightbox, FamSheet, PublicSearchDialog, VsaAiAssistant, MobileDrawer | public features | 7 | editorial shell (body-scoped); verify in Batch 7 |
| Toasts | App | 1 | implemented |

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
| 2026-10-29 | 1 | Before/after `/admin/login` at 375/1440 light+dark; harness: shell, header, table, filters, buttons, pagination, empty/error states, ConfirmDialog, quick search, mobile drawer at 375/1440 light+dark. Gates: typecheck, lint, full Jest suite, build (see PR). Live admin pages not yet screenshotted (no authorized session in the browser). |
