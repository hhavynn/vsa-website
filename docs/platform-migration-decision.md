# Frontend platform migration decision record

**Prepared:** 2026-10-27 · **Status:** proposal only; no upgrades authorized or applied · **Owner decision:** maintain existing runtime now, prepare incremental migrations · **Tracking:** [#301](https://github.com/hhavynn/vsa-website/issues/301), [#552](https://github.com/hhavynn/vsa-website/issues/552), [#553](https://github.com/hhavynn/vsa-website/issues/553), [#554](https://github.com/hhavynn/vsa-website/issues/554), [#555](https://github.com/hhavynn/vsa-website/issues/555)

## Decision in one paragraph

Do **not** replace the build toolchain or upgrade React in an ordinary feature PR or during VSA's academic-year/House/application freeze periods. In the next planned engineering window, first make the browser E2E and protected-domain characterization suite trustworthy; then migrate React Query v3 to TanStack Query v5 **separately**, then replace CRA 5 with a maintained bundler and test runner. Upgrade TypeScript/Zod/Tailwind after the new bundler passes parity checks. React 19 is optional and should follow a proven TanStack migration. Resume normal feature delivery in between phases. **Never run `npm run eject`.**

## Grounded baseline (check before execution)

| Constraint | Current repo evidence | Consequence |
| --- | --- | --- |
| CRA / `react-scripts ^5.0.1` | `package.json` build/test scripts call `react-scripts` directly | Aging build, Jest configuration and webpack/PostCSS behavior; replacing bundler also entails migrating test environment |
| TypeScript `^4.9.5` | `package.json` + `docs/typechecking.md` | CRA peer range permits TS 3/4; separate `npm run typecheck` already pins TS 5.6.3 but does **not** mean the production build uses TS 5 |
| `@tanstack/react-query ^5` | Migrated from `react-query ^3.39.3` (owner approved 2026-10-31); v3 behavior kept in `src/lib/queryClient.ts` | No longer blocks React 19 peer resolution. React 19 still needs `react`, `react-dom` and both type packages bumped together ([#555](https://github.com/hhavynn/vsa-website/issues/555)) |
| Tailwind `^3.3.5` | `package.json`, `tailwind.config.js`, [#554](https://github.com/hhavynn/vsa-website/issues/554) | Tailwind 4 requires `@tailwindcss/postcss`; CRA 5 hardwires old plugin and ignores `postcss.config.js` |
| Zod `^3.25.76` | `package.json`, [#553](https://github.com/hhavynn/vsa-website/issues/553) | Zod 4's typings require TS 5.5+; compatibility edits exist on a separate branch but must be re-reviewed, not blindly merged |
| React / React DOM `^18.2.0`, React Router `^7.18.4` | `package.json` | Router has **already** moved to v7; do not budget or ship a duplicate router migration (#375) |
| Production UI | CRA SPA on Vercel, route rewrites `vercel.json`, public env `REACT_APP_*`, theme bootstrap and CSP hashes | Bundler changes can break direct deep links, protected/admin lazy chunks, metadata, inline-script security policy, and public env behavior |
| Server boundaries | Supabase RLS, Edge Functions, public member/points projections | A frontend tooling PR should make **zero** SQL/grant/attendance/House-ranking mutations |

The `src/App.tsx` provider stack, route list, installed package resolutions, active build artifacts, CI baseline and audit counts must be re-derived from a **fresh branch of main** at each phase. This table records declared constraints, not deployed-version or vulnerability proof.

## Option costs and risks

**Planning estimates**, not measured actual time or monetary bids. Engineer-hours assume one contributor familiar with this repository, working in isolated PRs with mandatory review, CI and real browser QA; QA is included unless separated. Confidence is low to medium until a 1–2 day spike confirms actual failures and hidden adapters.

| Option | Estimated effort | Blast radius / prerequisites | Verification and rollback |
| --- | --- | --- | --- |
| **Stay on CRA 5 for 12–24 months** | 2–5 h/quarter for audit/maintenance *plus* unknown incident time | Maintains old transitive build tooling and peer constraints; cannot adopt Tailwind 4/Zod 4 safely | Keep CI, pin urgent reachable fixes only, monitor runtime advisory impact; no deployment change to roll back |
| **React Query v3 → TanStack v5** (done) | 36–70 h | ~116 imports in [#555](https://github.com/hhavynn/vsa-website/issues/555); object-style hooks, `isLoading`/`isPending`, `cacheTime`/`gcTime`, deleted query callbacks, mutations, stale/refetch semantics | Golden points/leaderboard and repo tests, query-cache tests, error/retry/offline/manual flows; one revert PR returns old package/import API |
| **CRA → Vite and maintained test runner** | 50–100 h | Build/env contract, HTML entry, `process.env.REACT_APP_*` compatibility, split chunks, Jest/React Testing Library setup, Tailwind PostCSS pipeline, static asset paths, Vercel SPA fallback and CSP | Compare asset URLs, metadata, lazy routes, direct URL refresh, 320/390px UI, test/timezone matrix, production build sizes; retain previous Vercel deployment for instant rollback, revert bundler PR if parity fails |
| **TypeScript 4.9 → 5.5+ in app build** | 8–18 h after Vite | tsconfig target and newer type errors, Zod inference; already has separate TS 5.6.3 CI check | Typecheck app **and** tests, build, no runtime behavior changes; revert version/config commit |
| **Zod 3 → 4** | 12–28 h after TypeScript 5.5+ | Form validation/error APIs, `.uuid()` stricter semantics, `.default()`, hook form types; [#553](https://github.com/hhavynn/vsa-website/issues/553) includes a pre-existing compatibility attempt | Invalid/valid form cases, IDs, auth/admin forms, Edge boundary unaffected; revert Zod-specific PR |
| **Tailwind 3 → 4** | 24–50 h after Vite | Global token definitions, PostCSS plugin, `dark:` custom variant, utility renames and visual regression over public/admin | Compare mobile/desktop light+dark, focus, print, navigation and modal screenshots; revert CSS/tooling PR |
| **React 18 → 19** | 16–35 h **after Query v5** | `react`, `react-dom`, `@types/react*` coordinated; refs, JSX types, portals, Framer Motion; #555 reports known TS failures | Check `npm ls` peers, full tests and browser interactions, revert coordinated React package PR |

These are **incremental** option estimates, not a single precise total or a guarantee they add linearly. Add 20–30% contingency for integration surprises; a Vite migration may remove some later TypeScript/Tailwind investigation but expands browser acceptance testing.

## Suggested sequence, dependency graph and acceptance gates

1. **Preflight / safety (~8–16 h):** complete or accept explicit gaps for [#571](https://github.com/hhavynn/vsa-website/issues/571) browser E2E (with failure traces), [#293](https://github.com/hhavynn/vsa-website/issues/293) characterization, and [#291](https://github.com/hhavynn/vsa-website/issues/291) repository behavior. Capture the exact-head baseline: Jest, lint, TS 5 check, build sizes/chunks, CSP hashes, timezone suite, anonymous and authorized-admin smoke flows. Do not read production private data for fixtures.
2. **Query migration (independent of bundler):** use incremental adapter PRs organized by repo/hooks and data consumers; preserve cache keys, stale times, abort/retry and optimistic mutations. Replace v3 imports only when the whole app can compile cleanly; keep the user-visible result and protected calculations unchanged. **Gate:** full CI, preserved public/privileged boundaries, manually verified cached/stale behavior.
3. **Build toolchain decision spike (1–2 days within estimate):** prove Vite can reproduce root HTML theme initialization, the current `REACT_APP_*` contract or an explicit coordinated environment rename, public SPA deep links, lazy admin routes and CSP content hashes. Decide Jest compatibility vs Vitest conversion with a realistic test suite sample. If spike fails, stop without migrating.
4. **Vite rollout [#552](https://github.com/hhavynn/vsa-website/issues/552):** separate PR, branch from fresh main. Keep the pre-migration Vercel deployment identified and available. **Gate:** repeat baseline tests, actual deploy preview, mobile and accessibility smoke checks, no accidental secret exposure in generated JS, no regression in static page metadata, asset 404s or auth guard behavior.
5. **TypeScript 5.5+ → Zod 4 [#553](https://github.com/hhavynn/vsa-website/issues/553) → Tailwind 4 [#554](https://github.com/hhavynn/vsa-website/issues/554):** separate PRs in that order; visually inspect CSS changes after TypeScript and Zod gates, not before. Keep chart/theme primitives and dark-mode behavior stable.
6. **Optional React 19 [#555](https://github.com/hhavynn/vsa-website/issues/555):** only after TanStack v5 is established. Explicitly test portal focus trapping, refs, forms, and motion. A peer-dependency override is **not** acceptance evidence.

**Dependencies:** Query v5 → React 19; CRA replacement → TypeScript ≥5.5 → Zod 4; CRA replacement → Tailwind 4. Query migration and CRA replacement are independent in principle, but do **not** combine in one PR. The actual Vite route/metadata contract may also depend on review/merge outcomes of open SEO/performance PRs.

## Stop, rollback and trigger policy

- **Do nothing urgently** merely because `npm audit` reports transitive CRA dev-tool vulnerabilities. Investigate *runtime reachability*, provider advisories, and actual emitted bundles; do not mass-upgrade to hide audit noise.
- **Start the build-toolchain phase** when (a) maintained tooling is needed for a concrete feature/security fix (for example the already-open Zod/Tailwind blockers), **and** (b) the core CI and browser E2E protections above are ready, **and** (c) a real owner selects a low-activity window.
- **Stop/revert** on an unexplained points/attendance discrepancy, private data/API exposure, broken admin authentication, broken public direct-link rendering, missing CSP hashes, or a failing golden suite. Never loosen RLS or alter ledger calculations as a migration workaround.
- **Deploy rollback:** do not combine releases; preserve the last verified Vercel deployment and identify the revert commit/PR before promoting a new build. Revert the isolated phase, rerun its relevant gates and confirm the old deployment's behavior. This does **not** authorize automatic rollback of live database changes (none are planned).
- **Production access:** draft/review PRs and staging previews are fine. Production deploys, env changes, secrets rotation, migrations and destructive actions follow `AGENTS.md`/change control; require the appropriate owner sign-off.
- **Forbidden:** `npm run eject`. It irreversibly exposes CRA's internal configuration and violates repo governance; Vite replaces the toolchain instead of ejecting.

## Decision request

Approve a **preflight and Vite feasibility spike only** (no dependencies modified yet), nominate a review owner and a quiet deployment window, and preserve the rest as separate tracked issues. Reassess the effort ranges from measured spike results before approving implementation phases.
