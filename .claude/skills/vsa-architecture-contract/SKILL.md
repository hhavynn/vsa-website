---
name: vsa-architecture-contract
description: Load this before any structural change to the VSA website — adding pages/routes/providers, touching the data layer or Supabase client, adding fetching logic, changing auth/admin gating, points/check-in flows, degraded-mode behavior, or the Ask VSA assistant. Provides the system map (CRA SPA → Supabase → Vercel), the exact provider hierarchy and route tiers, the invariants that must hold (with WHY and violation-detection commands), and the known-weak points labeled OPEN. Trigger keywords: architecture, invariant, repository layer, provider, route tier, degraded mode, server-authoritative points, dual points systems.
---

# VSA Architecture Contract

This skill is the contract of load-bearing design decisions for the VSA at UCSD website: what the system's shape is, which invariants must hold, WHY each exists, and how to detect a violation. It also states the known-weak points plainly so nobody mistakes them for intentional design. Read it before adding a page, a data source, a provider, or any fetching logic.

**When NOT to use this skill:**

| If you need… | Go to |
|---|---|
| Whether a change is even allowed / the never-do list / PR conventions | `vsa-change-control` |
| RLS mechanics, SECURITY DEFINER details, migration-authoring checklist | `vsa-supabase-security-reference` |
| Symptom-driven debugging steps | `vsa-debugging-playbook` |
| Full incident narratives (egress crisis, RLS recursion outage) | `vsa-failure-archaeology` |
| Tailwind tokens, component styling, mobile UI patterns | `vsa-design-system-reference` |
| Deploying, running migrations, operating the image pipeline | `vsa-run-and-operate` |
| Env vars and configuration axes | `vsa-config-and-flags` |

Jargon used below — defined once: **CRA** = Create React App (the build tooling; deprecated upstream, still what this repo uses). **SPA** = single-page application (one `index.html`, client-side routing). **RLS** = Row Level Security, Postgres per-row access policies — the real security boundary here. **SECURITY DEFINER** = a Postgres function that runs with its owner's privileges, letting clients trigger privileged writes without holding write permission themselves. **RPC** = calling such a Postgres function from the client via `supabase.rpc()`. **Egress** = bandwidth billed when Supabase serves files/data; the project once exhausted its quota (the "egress crisis"). **Degraded mode** = the app running while Supabase is down or over quota.

## 1. System map

```
Browser
  └─ CRA SPA (React 18, TypeScript 4.9, react-router v6, react-query v3, Tailwind v3)
       ├─ reads/writes → Supabase (Postgres + Auth + Storage + Deno Edge Functions)
       │     Edge Functions: analytics-proxy, trigger-event-image-migration,
       │                     trigger-house-event-image-migration, vsa-ai-assistant
       └─ served by → Vercel static hosting (zero-config CRA build)
             vercel.json: security headers on all routes, immutable cache for /static,
             no-cache for index.html, SPA fallback (everything else → /index.html)
```

There is no application server. Every dynamic behavior is either client-side, a Supabase query under RLS, or an Edge Function. This is WHY RLS and SECURITY DEFINER functions carry all server-side authority — there is no other backend to enforce anything.

### Provider hierarchy (verified in `src/App.tsx`, 2026-07-06)

```
ErrorBoundary
└─ QueryClientProvider          (react-query; staleTime 5 min, cacheTime 10 min, no refetchOnWindowFocus)
   └─ ThemeProvider             (dark mode class on <html>)
      └─ AnalyticsConsentProvider
         └─ AuthProvider        (Supabase auth session)
            └─ SiteSettingsProvider
               └─ AppRoutes  +  AnalyticsConsentBanner  +  Toaster (react-hot-toast)
```

`PointsProvider` is NOT in `App.tsx` — it wraps the route tree inside `src/routes/index.tsx` (line ~181). Order matters: anything needing auth must sit inside `AuthProvider`; anything using react-query must sit inside `QueryClientProvider`. Root `CLAUDE.md` now points to `src/App.tsx` instead of copying this hierarchy; source remains the ground truth.

### Route tiers (verified in `src/routes/index.tsx`, 2026-07-06)

| Tier | Gate | Routes |
|---|---|---|
| Public | none (inside `Layout`) | `/`, `/events`, `/calendar`, `/leaderboard`, `/cabinet`, `/get-involved`, `/gallery`, `/ace`, `/house*`, `/intern-program`, `/vcn*`, `/wild-n-culture`, `/uvsa-network`, `/points`, `/feedback`, `/privacy`, `/admin/login` |
| Parked | none — renders a static notice | `/profile` → `MemberAccountsUnavailable` component (member accounts intentionally disabled this release; `/points` is a public no-account lookup) |
| Admin | `<AdminRoute>` wrapping `<AdminLayout>` | all `/admin/*` pages (~28 routes) |

There is currently **no `ProtectedRoute` tier** — member-account routes are parked, so `AdminRoute` (`src/routes/AdminRoute.tsx`) is the only gate component. It redirects unauthenticated users to `/admin/login` and non-admins to `/admin/login` with `state.unauthorized=true`. If you reintroduce member accounts, that is a change-control decision, not a routing tweak — see `vsa-change-control`.

## 2. Invariants

Each row: the rule, WHY it exists, and how to detect a violation. All verified 2026-07-06.

| # | Invariant | WHY | Detect a violation |
|---|---|---|---|
| 1 | All Supabase queries go through repository singletons in `src/data/repos/`, wrapped in `withErrorHandling()` from `src/data/errors.ts` (L95). Components/pages never import `supabase` directly. | One choke point for error normalization (typed `DatabaseError`/`NotFoundError`/…), for degraded-mode detection, and for auditing what touches which table. Scattered queries made the egress crisis and RLS incidents hard to diagnose. | `grep -rln "lib/supabase" src/pages src/components` — should return nothing. Repo methods missing `withErrorHandling(` are also violations: `grep -L "withErrorHandling" src/data/repos/*.ts` |
| 2 | Exactly one Supabase client, the singleton in `src/lib/supabase.ts` (`getSupabaseClient()` / exported `supabase`). | Multiple clients mean multiple auth sessions and token-refresh races; the singleton also carries the typed `Database` generic. | `grep -rn "createClient" src/` — only legitimate hits: `src/lib/supabase.ts`, `src/setupTests.ts` (jest mock), and the one-off Node scripts `src/scripts/normalizeYears.ts` / `src/scripts/migrateCabinet.ts` (never bundled into the app). Any new hit in components/pages/hooks is a violation. |
| 3 | Server state is fetched via react-query (`useQuery`/`useMutation`) calling repositories — not raw `useEffect` + `useState` fetching. | react-query provides caching (5-min staleTime), dedupe, and retry; raw effects re-fetch on every mount, which costs egress and causes loading flicker. | Code review: any new `useEffect` whose body awaits a repo/supabase call and `setState`s the result. (Legacy exceptions exist in hooks, e.g. `src/hooks/useAdmin.ts` — don't add more.) |
| 4 | Every page is lazy-loaded in `src/routes/index.tsx` via `React.lazy()` + `Suspense` (`PageLoader` fallback). | Keeps the initial bundle small on a mobile-heavy audience; one eagerly-imported page drags its whole dependency tree into the main chunk. | `grep -n "^import.*pages" src/routes/index.tsx` — should return nothing (pages appear only inside `lazy(() => import(...))`; 48 `lazy(` calls as of 2026-07-06). Confirm with `npm run analyze` (see `vsa-diagnostics-and-measurement`). |
| 5 | **Degraded mode**: the app must render usefully with Supabase down or over quota. See §3. | The egress crisis took Supabase-served content down while the site stayed up; public pages must never white-screen because the database is unreachable. | New public-facing data fetch with no `isSupabaseUnavailable()` handling and no `ContentUnavailableState`/fallback path. Manual test: block `*.supabase.co` in devtools and load each public page. |
| 6 | **Server-authoritative points**: clients cannot write `event_attendance` or `user_points` directly. Check-ins happen only via the `check_in_to_event(uuid, text)` RPC — SECURITY DEFINER, EXECUTE granted to `authenticated` only, revoked from `anon` (migration `20260619000000_emergency_security_hardening.sql`, L173–237). Migration `20260620010000_harden_attendance_rls.sql` dropped all user insert/update/delete policies on both tables. `pointsRepository.addPoints()` deliberately throws (`src/data/repos/points.ts` L83–89). | Points feed the leaderboard and House competition; a client-writable path lets anyone award themselves points. This was a real hardening response — see `vsa-failure-archaeology`. | Any client-side `.insert`/`.update`/`.upsert` on those tables: `grep -rn "event_attendance\|user_points" src/ \| grep -i "insert\|update\|upsert"`. Any migration re-adding user write policies on them. The sanctioned call site is `src/hooks/useEventAttendance.ts` (L19). |
| 7 | **Ask VSA prompt-vs-DB split**: behavior rules (tone, refusals, scope) live in the `SYSTEM_PROMPT` constant inside `supabase/functions/vsa-ai-assistant/index.ts` (L34); volatile facts (dates, names, links) live as rows in the `ai_knowledge_base` table, retrieved via the `match_ai_knowledge_base` RPC (index.ts L382). Superseded facts are deactivated (`is_active = false`), never deleted (see `supabase/migrations/20260704000001_ai_knowledge_v2_dedupe.sql`). | Facts change every quarter; redeploying an Edge Function to fix a date is slow and error-prone, while admins can edit DB rows from `/admin/ai-knowledge`. Deactivation preserves an audit trail. | A date, person, or URL hardcoded into `SYSTEM_PROMPT`; or a behavior rule stuffed into a knowledge row; or a `DELETE FROM ai_knowledge_base` in a migration. Deploy order when both change: migrations → frontend → edge function. |
| 8 | **Admin gating**: `is_admin` boolean on `user_profiles`, read by the `useAdmin()` hook (`src/hooks/useAdmin.ts`, L26–33), enforced in routing by `AdminRoute`. Client gating is UX only — the real enforcement is RLS admin policies in Postgres. | A client check can always be bypassed with curl + the anon key; every admin capability must ALSO be denied by RLS (see `vsa-supabase-security-reference`). Note the `user_profiles` RLS recursion outage started exactly here (fix: `supabase/migrations/20260620020000_fix_user_profiles_rls_recursion.sql`). | An `/admin/*` route added outside the `<AdminRoute>` block in `src/routes/index.tsx`; or an admin-only table whose migration has no admin RLS policy. (Doc drift note: `AGENTS.md` says `useAdmin()` lives in `AuthContext.tsx`; verified location is `src/hooks/useAdmin.ts`.) |
| 9 | `src/types/database.ts` is the single source of truth for DB row types and domain enums (string unions like `SiteEventType`, `ApplicationKey`). Update it in the same PR as any schema migration. | The Supabase client is typed with this `Database` generic; drift between it and the schema produces silently-wrong types everywhere. | A migration PR that doesn't touch `src/types/database.ts`; duplicate enum/type definitions: `grep -rn "type SiteEventType\|type ApplicationKey" src/ \| grep -v types/database` |
| 10 | **Image strategy (post-egress-crisis)**: high-traffic surfaces serve repo-hosted static images from `public/images/` (events, house-events, cabinet, gallery, houses, home) via Vercel, not Supabase Storage URLs. Supabase Storage is only a staging buffer for admin uploads; a migration pipeline graduates files into the repo and rewrites DB rows to local paths (`docs/event-image-migration.md`). | Supabase egress is metered and was exhausted once; Vercel static serving is effectively free and CDN-cached. | New feature rendering `*.supabase.co/storage/...` URLs on a public page: `grep -rn "supabase.co/storage" src/`. Run the audits via the `vsa-storage-egress` playbook agent or the `vsa-diagnostics-and-measurement` skill. Pipeline operation lives in `vsa-run-and-operate`. `src/lib/supabaseImages.ts` image transforms are gated off by default (`REACT_APP_SUPABASE_IMAGE_TRANSFORMS === 'true'`). |

## 3. Degraded mode contract

The pieces, and when to use each (all verified 2026-07-06):

1. **`isSupabaseUnavailable(error)`** — `src/utils/isSupabaseUnavailable.ts`. Returns `true` for outage-shaped failures: HTTP 429/402/503/504, `TypeError` (network/CORS failure), or message/code fragments like `quota`, `egress`, `bandwidth`, `fetch failed`, `over_request_rate_limit`. Returns `false` for ordinary data errors (404, empty result, validation). Use it in `catch`/`onError` to decide between "outage UI" and "normal error UI". Do not treat every error as an outage — that hides real bugs.
2. **`ContentUnavailableState`** — `src/components/common/ContentUnavailableState.tsx`. Render when a section's data is unavailable and there is no meaningful static substitute (also see `DegradedModeBanner.tsx` for page-level notice).
3. **`src/config/publicFallbackContent.ts`** — hardcoded fallbacks for surfaces that must never be empty: `FALLBACK_LINKS`, `FALLBACK_EVENTS`, `FALLBACK_HOUSE_STANDINGS_2025_2026`, `FALLBACK_LEGACY_HOUSE_YEARS`, `FALLBACK_CABINET`, `FALLBACK_GALLERY`, `FALLBACK_GET_INVOLVED_PROGRAMS`, `FALLBACK_APPLICATIONS`, `FALLBACK_UVSA_NETWORK`, `FALLBACK_VCN`, `FALLBACK_WNC`. Prefer this over `ContentUnavailableState` on marquee public pages (home, house, get-involved) where a blank panel looks broken. Fallback content is a maintenance liability — when you add one, date-stamp it in the file and keep it generic enough to survive a year.

Decision rule: **public marquee surface → fallback content; secondary/data-dense surface → `ContentUnavailableState`; authenticated/admin surface → plain error UI** (admins can tolerate an honest failure message).

## 4. Known-weak points

State these plainly in reviews; none of them is intentional design.

| # | Weakness | Evidence | Status |
|---|---|---|---|
| 1 | **Dual points systems.** Public/admin leaderboard truth is `member_event_attendance` + `events` + `academic_terms`, read through the `member_yearly_points` / `house_member_yearly_points` views (`src/data/repos/leaderboard.ts` L9/L93/L134). A second system (`event_attendance` + `user_points`, fed by `check_in_to_event`) exists for authenticated check-ins. They are NOT reconciled. | `docs/leaderboard-system.md` L11, L44 ("Future work should consolidate…") | OPEN — consolidation is future work. Never present the systems as unified; never "fix" a leaderboard number by writing to the check-in tables. |
| 2 | **Thin automated tests.** The suite remains primarily metadata, utils/schemas/data helpers, and one `App.test.tsx` smoke test. Derive the current inventory with `find src -name "*.test.ts*" \| sort`; do not copy a count. Zero repository, RLS, or full-page behavior tests exist — invariants 1–8 above are enforced mainly by review. | `vsa-validation-and-qa` §2 + discovery command | OPEN — see `vsa-validation-and-qa` for how to add tests. |
| 3 | **Aging platform.** CRA (`react-scripts` ^5.0.1 — CRA is deprecated upstream), TypeScript ^4.9.5, `react-query` ^3.39.3 (superseded by TanStack Query v4/v5 with a different import path and API). `npm run eject` is explicitly forbidden (`AGENTS.md` L274). Any migration off CRA is a major change-control item. | `package.json` L19/25/28/75 | OPEN |
| 4 | **Client-side admin check is fetch-per-mount.** `useAdmin()` does a raw `useEffect` + `select is_admin` (not react-query, not cached) — a legacy exception to invariant 3 and a per-navigation query. Safe only because RLS is the real boundary. | `src/hooks/useAdmin.ts` | OPEN |
| 5 | **Check-in bypasses the repo layer.** The `check_in_to_event` RPC is called from `src/hooks/useEventAttendance.ts`, not from a repository — the one sanctioned deviation from invariant 1. Don't copy the pattern. | `src/hooks/useEventAttendance.ts` L19 | OPEN (candidate cleanup: move into `pointsRepository`) |
| 6 | **Documentation location drift.** Root `CLAUDE.md` now points to `src/App.tsx` for provider hierarchy, and `AGENTS.md` points to `src/hooks/useAdmin.ts` for admin lookup instead of copying stale structure. | compare docs vs. files above | **RESOLVED 2026-07-10** — keep source pointers instead of restoring copied inventories. |
| 7 | **Member accounts parked, code retained.** `/profile` renders `MemberAccountsUnavailable`; auth plumbing (`AuthProvider`, `PointsProvider`, `event_attendance` flow) remains live for admin sign-in and future re-enable. Dead-looking code here may not be dead. | `src/routes/index.tsx` L130–168, L220–224 | OPEN |

## 5. If you are about to violate an invariant

Stop. An invariant violation is a **change-control decision, not an implementation detail**:

1. Check `AGENTS.md` → "Things to never do" (L258) — if your change touches points, attendance, leaderboard, House membership, or RLS, it is in a protected domain.
2. Load `vsa-change-control` and follow its classification/approval flow before writing code. State in the PR description which invariant you are changing and why, and update THIS file's invariants table in the same PR.
3. Never route around a protection (e.g. re-granting client writes to `user_points` "temporarily"). The hardening migrations exist because each hole was exploited or nearly so — the stories are in `vsa-failure-archaeology`.

## Provenance and maintenance

Verified 2026-07-06 on branch `codex/reactbits-ui` (clean tree, HEAD `368fbf63`) against: `src/App.tsx`, `src/routes/index.tsx`, `src/routes/AdminRoute.tsx`, `src/lib/supabase.ts`, `src/data/errors.ts`, `src/data/repos/` (23 files), `src/data/repos/events.ts`, `src/data/repos/points.ts`, `src/data/repos/leaderboard.ts`, `src/hooks/useAdmin.ts`, `src/hooks/useEventAttendance.ts`, `src/utils/isSupabaseUnavailable.ts`, `src/config/publicFallbackContent.ts`, `src/lib/supabaseImages.ts`, `vercel.json`, `package.json`, `AGENTS.md`, `docs/leaderboard-system.md`, `docs/event-image-migration.md`, `supabase/migrations/20260619000000_emergency_security_hardening.sql`, `20260620010000_harden_attendance_rls.sql`, `20260620020000_fix_user_profiles_rls_recursion.sql`, `20260704000001_ai_knowledge_v2_dedupe.sql`, `supabase/functions/vsa-ai-assistant/index.ts`.

Re-verification one-liners (run when this file feels stale):

```bash
grep -n "Provider" src/App.tsx                          # provider hierarchy
grep -n "AdminRoute\|MemberAccountsUnavailable" src/routes/index.tsx   # route tiers
grep -c "lazy(" src/routes/index.tsx                    # lazy-loaded pages (48 as of 2026-07-06)
ls src/data/repos | wc -l                               # repo count (23)
grep -rln "lib/supabase" src/pages src/components       # invariant 1 (expect empty)
grep -rn "createClient" src/ | grep -v "lib/supabase\|setupTests\|src/scripts"  # invariant 2 (expect empty)
grep -n "check_in_to_event" supabase/migrations/20260619000000_emergency_security_hardening.sql
grep -rn "check_in_to_event" src/                       # sanctioned call sites
grep -n "SYSTEM_PROMPT\|match_ai_knowledge_base" supabase/functions/vsa-ai-assistant/index.ts
grep -n "is_admin" src/hooks/useAdmin.ts
find src -name "*.test.*" | wc -l                       # test-file count
grep -n '"typescript"\|"react-scripts"\|"react-query"' package.json
grep -n "member_yearly_points" src/data/repos/leaderboard.ts
```
