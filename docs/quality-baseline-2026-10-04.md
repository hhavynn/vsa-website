# Public quality baseline — October 4, 2026

Issues: #297 (baseline), #244 (44×44 touch floor), #249 (reduced motion + loading consistency), #320 (no colour-only meaning), #298 (serious axe findings, scoped). Branch `fix/a11y-mobile-interaction-defaults`, branched from `origin/main` at `445103f9`.

Every number below was measured on a **production build** with one harness, `scripts/measure-public-quality.mjs`, against the untouched `origin/main` build ("before") and the branch build ("after"). Nothing was fixed before the baseline was recorded. The harness and summarizer are committed so the run can be repeated.

## Summary

| | Before | After |
|---|---|---|
| Lighthouse mobile Performance (median, 7 routes) | 58–72 | 73–83 |
| Cumulative Layout Shift, mobile (median) | 0.36 on 5 routes, 0.56 on `/house` | 0.03–0.04 on those 5 routes, 0.215 on `/house` |
| axe critical / serious, default rule set | 0 / 0 on the 7 primary routes; 0 / 1 on the 11 extended routes (`/uvsa-network` `color-contrast`) | 0 / 0 on all 18 |
| axe serious incl. experimental rules, primary 7 routes (nodes) | 88 | 8 |
| Public controls under a 44×44 hit area (unique, non-inline, primary 7 routes) | 26–40 per route | 0 per route (one rail-edge artifact on `/gallery`) |
| Content hidden at rest under `prefers-reduced-motion` | 4 on `/`, 1 on `/events`, 1 on `/get-involved`, 3 on `/cabinet`, 4 on `/uvsa-network` | 0 on every route |
| Main JS / CSS (gzip) | 273.98 kB / 28.1 kB | 274.72 kB / 28.5 kB |

LCP, TBT, FCP and INP did not change meaningfully; the Performance gain is the layout-shift fix (see "Findings").

## Environment

- Apple M5 Pro (18 cores), macOS 26.6.2, Node v26.3.0, npm 11.16.0
- Microsoft Edge 154.0.4258.53 (headless=new) — the only Chromium on the machine (the September audit used Edge 153)
- Lighthouse 13.0.1 (default mobile emulation, simulated 4× CPU / slow-4G throttling), axe-core 4.10.3, puppeteer-core 25.12.0, web-vitals (latest)
- `.env.local` pointed at the production Supabase project (public read paths only), so pages render real data. Data-dependent results (Leaderboard, Gallery, Events) can shift as the site changes; compare runs taken close together
- The build is served by the harness's own static server: SPA fallback, gzip, immutable `/static/` caching (roughly Vercel's behaviour)
- Machine otherwise idle during timed runs. First-visit state: the analytics banner is showing in Lighthouse and axe (a real first-time visitor sees it)

## Commands

```sh
# one-time tool install (not repo dependencies)
mkdir /tmp/vsa-tools && cd /tmp/vsa-tools && npm init -y >/dev/null \
  && npm i lighthouse@13.0.1 puppeteer-core axe-core@4.10.3 chrome-launcher web-vitals

npm run build
node scripts/measure-public-quality.mjs --tools /tmp/vsa-tools --build build --out /tmp/vsa-measure/run --runs 5
# optional extra routes / interaction states
node scripts/measure-public-quality.mjs --tools /tmp/vsa-tools --build build --out /tmp/vsa-measure/ext --stages probe \
  --routes /calendar,/cabinet,/ace,/house-system,/intern-program,/vcn,/wild-n-culture,/uvsa-network,/feedback,/privacy,/signin
node scripts/measure-public-quality.mjs --tools /tmp/vsa-tools --build build --out /tmp/vsa-measure/states --stages states

# tables (two directories → before → after)
node scripts/summarize-public-quality.mjs /tmp/vsa-measure/before /tmp/vsa-measure/after
```

Stages: **lighthouse** (5 runs per route, median reported; mobile Performance / Accessibility / Best Practices / SEO, LCP, CLS, TBT), **probe** (390 px viewport, light and dark, normal and reduced motion: axe by impact, touch targets, content hidden at rest, INP), **states** (touch targets with the mobile menu, Ask VSA panel, sheets, back-to-top and the analytics banner open).

Routes: `/`, `/events`, `/leaderboard`, `/gallery`, `/house`, `/points`, `/get-involved` (primary) and 11 more public routes (extended).

## Method notes (read before comparing numbers)

- **Medians, not best runs.** Performance range across 5 runs is shown in the harness output; run-to-run noise on `/house` and `/get-involved` is ±5 points.
- **Axe rule sets.** The default WCAG A/AA/2.1/2.2 + best-practice set reported **no** critical or serious findings on the 7 primary routes at baseline (one serious `color-contrast` on the extended `/uvsa-network`). The `experimental` tag set is also enabled because it contains rules Lighthouse itself surfaces (`label-content-name-mismatch`, WCAG 2.5.3) and `p-as-heading`. The September audit used the default set, which is why it reported zero.
- **Touch-target counts are unique controls** (deduplicated by name and size) taller or narrower than 44 px, excluding links inside running prose (WCAG 2.5.8 inline exception). A control whose box is small but whose *hit area* is larger (a stretched `::after`, `.touch-hit`) counts as passing when a 44×44 hit-test centred on it lands on the control at its four corners and centre. The hit-test does not see through a fixed overlay, so the harness measures with the analytics choice already made (and measures the banner itself as its own state).
- **Reduced-motion check** counts text elements whose effective opacity is below 0.05 *before* any scrolling, with `prefers-reduced-motion: reduce` emulated. Scroll-reveal content legitimately starts hidden in normal motion; under reduced motion it must not.
- **INP is a scripted lab proxy** (two taps on the menu button); web-vitals LCP/CLS inside the page are not reliable in this setup and are not reported. Lighthouse supplies LCP, CLS and TBT.
- The **Lighthouse Accessibility score is not additive**: it is a weighted average over *applicable* audits. See `/leaderboard` below.

## Baseline (untouched `origin/main`)

### Bundle

`npm run build` → 72 JS chunks. Main JS 273.98 kB gzip (971,589 B raw); main CSS 28.1 kB gzip. Largest chunks (gzip): `7627` 28.9 kB, `2290` 25.4 kB, `9065` 24.1 kB, `1103` 23.3 kB, `3253` 22.3 kB, `4818` 19.5 kB. Main chunk composition (source-map-explorer, raw): react-dom 127 KB, @supabase/auth-js 106 KB, motion-dom 104 KB, zod 53 KB, react-router 45 KB, react-query 44 KB, framer-motion 34 KB, @supabase/realtime-js 34 KB, react-hook-form 32 KB, tailwind-merge 28 KB. No bundle optimisation is in this PR.

### Lighthouse mobile (median of 5)

| Route | Perf (range) | A11y | BP | SEO | FCP ms | LCP ms | CLS | TBT ms |
|---|---|---|---|---|---|---|---|---|
| `/` | 60 (54–64) | 100 | 100 | 100 | 1443 | 5703 | 0.363 | 55 |
| `/events` | 58 (56–58) | 100 | 100 | 100 | 1431 | 7102 | 0.363 | 59 |
| `/leaderboard` | 65 (65–65) | 99 | 100 | 100 | 1431 | 4655 | 0.363 | 30 |
| `/gallery` | 72 (72–72) | 100 | 100 | 100 | 1445 | 7655 | 0.088 | 29 |
| `/house` | 62 (54–62) | 100 | 100 | 100 | 1442 | 4504 | 0.560 | 59 |
| `/points` | 65 (61–65) | 98 | 100 | 66 | 1449 | 4655 | 0.363 | 60 |
| `/get-involved` | 68 (61–68) | 100 | 100 | 100 | 1434 | 4203 | 0.364 | 58 |

Failing Lighthouse accessibility audits: `/leaderboard` — `heading-order`, `label-content-name-mismatch`; `/gallery` — `label-content-name-mismatch`; `/points` — `heading-order`. Best Practices: none. `/points` SEO 66 is `is-crawlable`: `public/robots.txt` disallows `/points` (and `/feedback`) — intentional, not touched.

### axe, touch targets, reduced motion — primary routes

| Route | axe C/S/M/m (nodes, both themes) | Controls < 44 px / measured | Hidden at rest (normal / reduced) |
|---|---|---|---|
| `/` | 0/10/0/0 | 32 / 42 | 4 / 4 |
| `/events` | 0/2/0/0 | 40 / 63 | 1 / 1 |
| `/leaderboard` | 0/50/2/0 | 31 / 67 | 0 / 0 |
| `/gallery` | 0/24/0/0 | 26 / 34 | 0 / 0 |
| `/house` | 0/2/0/0 | 38 / 59 | 0 / 0 |
| `/points` | 0/0/2/0 | 26 / 36 | 0 / 0 |
| `/get-involved` | 0/0/0/0 | 29 / 46 | 1 / 1 |

Serious rules hit (experimental set): `label-content-name-mismatch` on `/` (3 "Event details" links), `/events` (1), `/leaderboard` (25 profile rows), `/gallery` (12 album links); `p-as-heading` on `/` and `/house`. Moderate: `heading-order` on `/leaderboard` and `/points`. Extended routes: `/cabinet` 16 `p-as-heading`, `/house-system` 1 `p-as-heading`, `/uvsa-network` 1 `color-contrast` (a stable WCAG rule: the count beside each directory filter chip was drawn at 70 % opacity).

### Findings from the baseline

1. **Layout shift is the biggest measurable defect.** CLS was 0.363 on five routes. Lighthouse attributes all of it to the footer card: while a route chunk or data skeleton shows, the page is shorter than a phone screen, the (tall, stacked) mobile footer sits inside the viewport, and it jumps down when content arrives.
2. **Accessible names had regressed** since the September audit: `aria-label`s on leaderboard profile rows, gallery album links, home "Event details" links did not contain their visible text (WCAG 2.5.3).
3. **Touch targets:** the shared `Button` was 30/38/42 px tall; filter chips 33; footer links 20; icon links 36–40; Ask VSA minimize 28; calendar and gallery controls 24–40. "Load more" (`vsa-btn-outline`) used a CSS class that does not exist, so it rendered as an unstyled 24 px button.
4. **Reduced motion:** `RevealOnScrollWrapper`, `SplitText`, `BackToTop`, `GetInvolved`, `CabinetBoard`, `PageError` and the legacy `Skeleton` had no reduced-motion path; the page hid or translated content at rest regardless of the preference. Nothing was permanently stuck after scrolling.
5. **Colour-only meaning:** selected filter chips were a fill colour only; form errors were `text-red-400` (≈2.5:1 on cream) with no icon; Ask VSA bubbles were distinguished by colour and side only; House chips were white text on gold / slate / orange fills (≈2:1).

## What changed

**Touch targets (#244).** New `touch:` Tailwind variant (`max-width: 767px` or `pointer: coarse`) and a matching media query in `index.css`. Shared primitives first: `Button` (all sizes), `PaginationControls`, `.vsa-filter-btn`, `.vsa-btn-primary/ghost`, `.scrapbook-select`, a `.touch-hit` utility that grows only the hit area (Ask VSA minimize, UVSA host marks), ACE family tabs. Then call sites: header logo, footer links and icons, calendar close and month arrows, gallery cards (title link stretched over the card), leaderboard rows (name button stretched over the row), home pills and text links, House sub-nav and year chips, Ask VSA launcher / close / prompt chips, back-to-top, forms (Feedback, Sign in, photo request), Cabinet filters. Desktop sizes are unchanged. The undefined `vsa-btn-outline` was replaced with the defined `vsa-btn-ghost`.

**Reduced motion and loading (#249).** `<MotionConfig reducedMotion="user">` at the app root as a safety net; explicit static paths in `SplitText`, `RevealOnScrollWrapper`, `BackToTop` (also `behavior: 'auto'`), `GetInvolved`, `CabinetBoard`, `CabinetRoleExplorer`, `CabinetRoleModal`, `PageError`, the legacy `Skeleton`; CSS drops entrance animations and smooth scrolling; Tailwind `animate-pulse` placeholders are `motion-safe`. Hero parallax and the BottomSheet already had reduced paths and are untouched (so are #204's normal-motion GPU settings). Loading: `main` reserves a viewport of height so the footer starts below the fold (the CLS fix); `HouseDetailSkeleton` and `VcnArchiveSkeleton` replace full-page spinners; Calendar, Leaderboard rows, application CTA and My VSA use the shared shimmer `Skeleton`.

**No colour-only meaning (#320).** Selected filter / tab / year chips and Going/Interested buttons carry a ✓ (decorative to AT; `aria-pressed` / `aria-current` still announce state). Shared `FieldError` and `FormAlert` (icon + message, readable reds in both themes) in Feedback, Sign in, photo request. `readableInk` picks near-black or white text for House chips, podium rank bubbles and the House rank badge so the existing fills are unchanged but text reaches 4.5:1. Ask VSA bubbles are labelled "You" / "Ask VSA". The calendar agenda spells the category out next to the coloured edge. Already compliant, left alone: application-window states (text label per state), Admin published/draft chips (text), podium (rank number + medal icon), House standings (name + rank), event-type breakdown (label × count). Display-only for House, Leaderboard, attendance and points — no data, ranking or points logic was touched.

**Serious findings (#298).** Leaderboard profile rows and gallery album links now follow a stretched-name pattern so the accessible name contains the visible text; Home "Event details" label; the UVSA directory count no longer uses 70 % opacity.

## After (branch build, same harness)

### Lighthouse mobile (median of 5), before → after

| Route | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms |
|---|---|---|---|---|---|---|---|
| `/` | 60 → 78 | 100 → 100 | 100 → 100 | 100 → 100 | 5703 → 5703 | 0.363 → 0.037 | 55 → 61 |
| `/events` | 58 → 76 | 100 → 100 | 100 → 100 | 100 → 100 | 7102 → 7250 | 0.363 → 0.031 | 59 → 59 |
| `/leaderboard` | 65 → 83 | 99 → 98 | 100 → 100 | 100 → 100 | 4655 → 4655 | 0.363 → 0.036 | 30 → 31 |
| `/gallery` | 72 → 74 | 100 → 100 | 100 → 100 | 100 → 100 | 7655 → 7654 | 0.088 → 0.000 | 29 → 33 |
| `/house` | 62 → 73 | 100 → 100 | 100 → 100 | 100 → 100 | 4504 → 4953 | 0.560 → 0.215 | 59 → 61 |
| `/points` | 65 → 83 | 98 → 98 | 100 → 100 | 66 → 66 | 4655 → 4654 | 0.363 → 0.037 | 60 → 62 |
| `/get-involved` | 68 → 79 | 100 → 100 | 100 → 100 | 100 → 100 | 4203 → 4802 | 0.364 → 0.037 | 58 → 61 |

LCP and TBT are within run-to-run noise (the LCP spread on `/house` and `/get-involved` follows the ±5-point Performance noise noted above). Lighthouse failures: `/leaderboard` `label-content-name-mismatch` and `/gallery` `label-content-name-mismatch` are gone; `heading-order` remains on `/leaderboard` and `/points`.

**`/leaderboard` Accessibility 99 → 98 is a scoring artefact, not a regression.** Lighthouse weights `aria-command-name` at 7 and it only applies when `role="button"` elements exist. The profile rows were `div role="button"`; they are now real buttons, so that passing audit became "not applicable", shrinking the denominator while the same `heading-order` failure (weight 3) stays. Measured: baseline `aria-command-name` 1/w7, after n/a; `label-content-name-mismatch` has weight 0 in the score, which is why fixing it never moved the number. Fixing the one `heading-order` node on each of `/leaderboard` and `/points` would restore 100; it is left as a moderate follow-up per scope.

### axe, touch targets, reduced motion — primary routes

| Route | axe C/S/M/m | Controls < 44 px | Hidden at rest, reduced motion |
|---|---|---|---|
| `/` | 0/10/0/0 → 0/4/0/0 | 32 → 0 | 4 → 0 |
| `/events` | 0/2/0/0 → 0/2/0/0 | 40 → 0 | 1 → 0 |
| `/leaderboard` | 0/50/2/0 → 0/0/2/0 | 31 → 0 | 0 → 0 |
| `/gallery` | 0/24/0/0 → 0/0/0/0 | 26 → 1* | 0 → 0 |
| `/house` | 0/2/0/0 → 0/2/0/0 | 38 → 0 | 0 → 0 |
| `/points` | 0/0/2/0 → 0/0/2/0 | 26 → 0 | 0 → 0 |
| `/get-involved` | 0/0/0/0 → 0/0/0/0 | 29 → 0 | 1 → 0 |

\* The last album card sits half off-screen in the horizontal rail; the 44×44 hit-test box is clamped to the viewport edge where the card does not reach. Not a real shortfall.

Extended routes: every route 0 controls under 44 px (before 25–38), reduced-motion hidden-at-rest 3→0 (`/cabinet`), 4→0 (`/uvsa-network`); `/uvsa-network` `color-contrast` serious → none.

Interaction states (unique controls under 44 px, before → after): analytics banner 2 → 0, mobile menu 2 → 0, Ask VSA panel 8 → 0, calendar day sheet 2 → 0, leaderboard profile sheet 1 → 0, gallery album preview 0 → 0.

### Bundle

Main JS 273.98 → 274.72 kB gzip (+0.74 kB); main CSS 28.1 → 28.5 kB (+0.4 kB); total JS across all 72 chunks 898.4 → 904.1 kB gzip (+0.6 %). The additions are the touch classes, `FieldError`, two skeletons and `readableInk`.

## Unresolved

1. **`/house` CLS 0.215** (was 0.560). The remaining shift is the four-House card grid (`program-section`) changing height when published House assets replace the placeholder content. Needs reserved card geometry or a skeleton until assets settle — a House page change, so left for its own PR.
2. **`heading-order` (moderate)** — `/leaderboard`: the "House Competition" `h3` follows the `h1`; `/points`: an `h4` (`PointsExplainer`) follows an `h2`. Out of the serious-only scope.
3. **`p-as-heading` (experimental, flagged serious by axe)** — `/` (2 nodes: "Standings will be back soon", "Every event adds up."), `/house` and `/house-system` (empty-state titles), `/cabinet` (16 role names in cards). These are display text inside cards that already sit under real headings; turning them into headings would pad the outline, and swapping the tag only to silence the rule would not change what assistive technology hears. Needs a content-model decision.
4. **`label-content-name-mismatch` on `/events`** (1 node): the UVSA SoCal logo link. Its fallback-initials mark has its own `role="img"` name inside a link labelled differently. Marking the mark decorative breaks the established `SchoolVisualMark` / `ExternalEventHost` accessible-name tests, so it needs a decision on the intended name.
5. **Calendar month grid dots and category colours** remain colour-coded; the agenda, detail sheet and card text carry the category, but the grid dots themselves have no shape/pattern distinction.
6. **Spoken output of toasts** and screen-reader behaviour of the new stretched buttons were not verified with a screen reader (no assistive-technology session was run; the accessibility tree and the automated rules above were).
7. Moving the whole-card click target from a `div role="button"` to a stretched `<button>`/`<a>` on the leaderboard and gallery changes the focus ring (now drawn on the card via `::after`) and where focus returns after closing a sheet (the name button). Worth a manual keyboard pass on a phone-sized viewport.

## Is #315 (axe in CI) safe now?

Not added here. At baseline the **default** rule set already had zero critical and zero serious findings on the 7 primary routes (and one `color-contrast` on `/uvsa-network`), so an axe job over the default set would have been nearly green all along; it would not have caught the accessible-name regressions, which only the experimental rules report. After this PR the default set is clean on all 18 routes audited, and the experimental set has the unresolved items above (3, 4). Recommendation: tackle #315 next as a default-ruleset gate (WCAG 2.0/2.1/2.2 A/AA + best-practice, light and dark, the 7 primary routes plus the interaction states), keep the experimental rules as a non-blocking report, and fix or consciously baseline items 3–4 first. Runtime is the real cost — the harness takes about 4–5 minutes for the probe stage alone — so it belongs in a separate workflow, not the PR test job.
