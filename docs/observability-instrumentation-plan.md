# Observability instrumentation plan (Sentry, PostHog)

**Status:** proposed 2026-10-27. Phase 1 code is in the PR that adds this file. Every production step below (creating projects, setting Vercel variables, deploying) waits for explicit owner approval.

**Goal:** give the Sentry and PostHog connectors real production data, so debugging can start from observed evidence. Today both are empty because the site was never instrumented, and an empty connector is "no evidence", not "no problem".

## Evidence (checked 2026-10-27)

| Fact | Source |
| --- | --- |
| Sentry org `havyn` has no projects; no `@sentry/*` dependency before this PR | Sentry connector (starting session); `package.json` |
| PostHog "Default project" has ingested no events; no PostHog SDK | PostHog connector (starting session); `package.json` |
| Vercel project `vsa-website`: framework `create-react-app`, Node 22.x, domains `vsaatucsd.com` and `www.vsaatucsd.com`, Git integration builds previews | Vercel connector `get_project` (env-var listing returned 403, so current variable names are unverified) |
| Production serves full source maps publicly: `/static/js/main.cb5fd1b3.js.map` returned `200`, 4,988,825 bytes | `curl -I` against `https://www.vsaatucsd.com` |
| A production build emits 78 `.map` files (14 MB). Main bundle 288.99 kB gzip before this PR | Local `npm run build` on this branch before wiring Sentry |
| Repository is public, so the source in those maps is already public | `gh repo view --json visibility` |
| No `Content-Security-Policy` header is sent today | `vercel.json`, [security headers doc](security-headers-and-csp.md) |
| Any new `REACT_APP_*` name fails CI until added to the client-secret guard allowlist | `scripts/check-client-secrets.mjs`, [guard doc](client-secret-guard.md) |
| GA4 is consent-gated and also feeds `/admin/analytics` through the `analytics-proxy` Edge Function | `src/lib/analytics.ts`, `src/context/AnalyticsConsentContext.tsx`, `supabase/functions/analytics-proxy` |
| Latest SDKs: `@sentry/react` 11.9.0, `@sentry/cli` 3.8.2, `posthog-js` 1.440.0 | `npm view` |

**Sentry v11 changed the privacy model.** `sendDefaultPii` no longer exists. It was replaced by `dataCollection`, and when `dataCollection` is unset the SDK collects every category, including user info, headers, cookies and query parameters. So `sendDefaultPii: false` from the original brief would not compile, and leaving it out would collect *more*. Phase 1 switches every category off explicitly, and a test pins that.

**v11 also rewrites fetch errors by default.** `enhanceFetchErrorMessages: 'always'` changes real error messages ("Failed to fetch" becomes "Failed to fetch (host)"). `isSupabaseUnavailable()` classifies outages by matching message text, so Phase 1 sets `'report-only'`.

## Decisions (owner to confirm)

1. **Sentry first, errors only.** No performance tracing, no Session Replay, no feedback widget, no `setUser`. These can be proposed later, each with its own review.
2. **Sentry is not behind the analytics consent choice.** It sets no cookies or browser storage, carries no identity, and is needed to keep the site working. The privacy notice now says so (conditional on "if error monitoring is configured", the same pattern used for GA). If the owner prefers consent-gating, `initMonitoring()` can move behind `consent === 'granted'`, but most errors would then go unreported.
3. **PostHog is deferred to Phase 3 and, when added, runs alongside GA4.** It does not replace GA4: GA4 powers `/admin/analytics`, so replacing it means rebuilding that dashboard first. PostHog would sit behind the same "Allow analytics" choice. It is deferred because it needs an event design and a second privacy review (Session Replay above all), while Sentry is useful as soon as it is turned on. Until Phase 3 ships, the PostHog connector stays "no evidence".
4. **Upload source maps to Sentry and stop serving them publicly** (Phase 2). Stack traces become readable, and the public 14 MB of maps goes away.
5. **No `vercel.json` change in Phases 1 and 2.** No CSP is sent, so nothing blocks Sentry. The draft CSP in the security headers doc gains the ingest origin, so the future enforced policy is ready.

## Phase 1: Sentry SDK, inert until a DSN is set (this PR)

Merging this PR changes nothing at runtime: without `REACT_APP_SENTRY_DSN`, `initMonitoring()` and `reportError()` return immediately and the SDK chunk is never fetched.

**Bundle cost.** A static import added +30.75 kB gzip (+10.6%) to the main bundle even while inert, which fails the "no heavy dependency without justification" rule. So the SDK is a lazy chunk. Until it loads, `window` `error` / `unhandledrejection` events and `reportError()` calls are buffered (at most 20) and sent once it is ready. The chunk goes through `src/lib/sentryClient.ts`, which re-exports only `init` and `captureException`: a dynamic `import('@sentry/react')` of the whole namespace defeats tree-shaking and pulls in Replay, Feedback and tracing (measured at 147 kB gzip).

Measured on this branch with `npm run build`, gzip:

| Build | Main bundle | Sentry chunk |
| --- | --- | --- |
| Before this PR | 288.99 kB | — |
| This PR, no DSN (inert) | 289.92 kB (+0.93 kB: scrubbers and buffer) | emitted, never fetched |
| This PR, DSN set | 289.96 kB | 32.9 kB, fetched in parallel at startup |

**Files**

| File | Change |
| --- | --- |
| `src/lib/monitoring.ts` | `initMonitoring()`, `reportError()`, the early-error buffer, the scrubbers (`redactText`, `stripUrl`, `scrubBreadcrumb`, `scrubEvent`) |
| `src/lib/sentryClient.ts` | The lazy chunk: named re-exports of `init` and `captureException` only |
| `src/instrument.ts` | Calls `initMonitoring()`; imported first in `src/index.tsx` so module-load errors are caught |
| `src/components/common/ErrorBoundary.tsx` | Reports caught render errors with the component stack. A stale-chunk reload is not reported |
| `scripts/check-client-secrets.mjs` (+ test) | Allowlists `REACT_APP_SENTRY_DSN`; detects Sentry auth tokens (`sntrys_`, `sntryu_`) as credentials |
| `.env.example`, `docs/client-secret-guard.md` | Documents the DSN and the future auth-token boundary |
| `src/pages/Privacy.tsx` | Conditional error-monitoring paragraph |
| `THREAT_MODEL.md`, `.claude/skills/vsa-config-and-flags/SKILL.md`, `.claude/skills/vsa-validation-and-qa/SKILL.md`, `docs/security-headers-and-csp.md` | Trust-boundary row, config-catalog entry, test-inventory row, draft CSP `connect-src` |

**SDK configuration** (`src/lib/monitoring.ts`; pinned by `src/lib/monitoring.test.ts`)

- Runs only when `REACT_APP_SENTRY_DSN` is set **and** the build is a production build.
- `environment`: `REACT_APP_VERCEL_ENV` (`production` / `preview`), falling back to `NODE_ENV`. `release`: `REACT_APP_VERCEL_GIT_COMMIT_SHA` when Vercel exposes it.
- `dataCollection`: `userInfo`, `cookies`, `httpHeaders`, `urlQueryParams`, `databaseQueryData`, `stackFrameVariables` are `false`, `httpBodies` is `[]`, and GraphQL and gen-AI capture are off.
- Default integrations without `Console`: the site has many `console.*` calls that log values it handles, so none become breadcrumbs.
- `beforeBreadcrumb` / `beforeSend` scrubbing:
  - Query strings and fragments are dropped from fetch/XHR URLs, navigation `from`/`to`, and `request.url`. PostgREST filters such as `email=in.(...)` (`memberLookup.ts`, `adminMembers.ts`) live in the query, and Supabase auth redirects put tokens in the fragment.
  - Email addresses become `[email]` and JWT-shaped strings become `[token]` in messages, exception values, breadcrumb messages and URLs.
  - Click breadcrumbs keep the tag, id and class selector, but `[aria-label=…]`/`[title=…]` attribute text is removed, because admin buttons can name members.
  - `event.user` is deleted. Request headers are reduced to `User-Agent`, and cookies are dropped.
- Check-in codes: the SDK never records form input values or request bodies (`httpBodies: []`), and no breadcrumb carries them. Code check-in is retired (#233).
- `denyUrls` drops errors from browser extensions; `ignoreErrors` drops the benign `ResizeObserver loop` noise.

**Owner actions after merge, in order (each needs explicit approval)**

1. Create Sentry project `vsa-website` (platform: React) in org `havyn`.
2. In Sentry project settings:
   - Security & Privacy: Data Scrubber **on**, Use Default Scrubbers **on**, Prevent Storing of IP Addresses **on**. Additional sensitive fields: `email`, `check_in_code`, `code`, `access_token`, `refresh_token`, `phone`.
   - Allowed Domains: `vsaatucsd.com`, `www.vsaatucsd.com`, plus the preview pattern if previews will report.
   - Inbound Filters: browser extensions, legacy browsers, web crawlers **on**.
   - Client Keys: a per-key rate limit (suggested 60 events/minute) so an error loop cannot exhaust the free quota.
3. Vercel → `vsa-website` → Environment Variables: add `REACT_APP_SENTRY_DSN` = the project's DSN, **Production only** to start. Confirm that "Automatically expose System Environment Variables" is on (it provides `REACT_APP_VERCEL_ENV` and `REACT_APP_VERCEL_GIT_COMMIT_SHA`).
4. Redeploy production. `REACT_APP_*` values are compiled in at build time, so the variable has no effect until the next build.

**Verification**

- On production, in the browser console, run `setTimeout(() => { throw new Error('sentry-smoke-test') })`. A plain `throw` typed in the console does not reach `window.onerror`.
- Sentry connector: `search_issues` for `sentry-smoke-test` shows one issue whose URL has no query string, whose user is empty, and with no IP address. Then resolve it in the Sentry UI (connector writes need their own approval).
- In devtools → Application, confirm Sentry wrote no cookies, `localStorage` or `sessionStorage` keys, as the privacy notice promises.
- Watch the first week of issues for PII, using aggregates only, and add scrubbing rules if anything slips through.
- Update the Sentry row of the connector table in `CLAUDE.md`.

**Rollback:** remove `REACT_APP_SENTRY_DSN` in Vercel and redeploy (the SDK goes inert), or revert the PR.

## Phase 2: source maps to Sentry, not to the public (separate PR)

CRA cannot take the Sentry webpack plugin without ejecting, so upload runs as an npm `postbuild` step that Vercel executes after `npm run build`.

**Files**

- `package.json`: add the `@sentry/cli` devDependency and `"postbuild": "node scripts/sentry-sourcemaps.mjs"`. This repo's npm enforces `allow-scripts`, which blocks `@sentry/cli`'s binary-download postinstall. That PR must approve it (`npm approve-scripts @sentry/cli`, checked in) or invoke the CLI another way, and it must be verified in a Vercel preview build.
- `scripts/sentry-sourcemaps.mjs`:
  - `SENTRY_AUTH_TOKEN` unset (local builds, GitHub CI, the Docker image): print "skipped" and exit 0. Maps stay, so `npm run analyze` keeps working.
  - Set (Vercel): `sentry-cli sourcemaps inject build/static/js`, then `sentry-cli sourcemaps upload --release "$VERCEL_GIT_COMMIT_SHA" build/static/js`, then delete `build/**/*.map` **only after** the upload succeeds.
  - Upload fails: warn and keep the build green with maps kept, which is today's behavior, so a Sentry outage cannot block a deploy.
- A test for the skip and delete branches. `npm run check:csp-hashes` must still pass: `inject` edits only `.js` files, never `index.html`.

**Vercel build variables** (server-side, not `REACT_APP_*`, never in the bundle)

| Variable | Environments | Value |
| --- | --- | --- |
| `SENTRY_AUTH_TOKEN` | Production (and Preview only if previews report) | Sentry **organization auth token**, release/source-map upload scope only. Sensitive |
| `SENTRY_ORG` | same | `havyn` |
| `SENTRY_PROJECT` | same | `vsa-website` |

**Verification:** `curl -sI https://www.vsaatucsd.com/static/js/main.<hash>.js.map` returns `404` (`200` today; the SPA rewrite already excludes `/static/`). The smoke-test issue shows original TypeScript frames, and `sentry-cli sourcemaps explain <event-id>` passes.

**Rollback:** remove `SENTRY_AUTH_TOKEN`; the script skips and maps are served again.

## Phase 3: PostHog alongside GA4 (deferred; separate approval)

Start only after Sentry has run cleanly for about two weeks and the owner names the questions PostHog should answer (for example, which public pages lead to event sign-ups).

**Variables:** `REACT_APP_POSTHOG_KEY` (project API key `phc_…`, which can only write events, so it is public by design) and `REACT_APP_POSTHOG_HOST` (`https://us.i.posthog.com`; confirm the project's region). Both need guard-allowlist entries and a review like this one.

**Files:** `src/lib/productAnalytics.ts` (new), `src/context/AnalyticsConsentContext.tsx` (allow/decline drives GA4 and PostHog together), `src/components/common/RouteTracker.tsx`, `src/pages/Privacy.tsx`, `THREAT_MODEL.md`, the client-secret guard, and the draft CSP.

**Privacy defaults.** Option names marked † were not checked against the installed types and must be confirmed in that PR.

- Load only after `consent === 'granted'`, the same as GA, so nothing is sent before consent. On decline, call `opt_out_capturing()` and `reset()`.
- `person_profiles: 'never'`, and **never** call `identify()`, `alias()` or `setPersonProperties()` with member data (emails, names, member or user ids). Events stay anonymous.
- `persistence: 'localStorage'` (no cookies). `capture_pageview: false`, with manual `$pageview` from `RouteTracker` using path only, matching GA's "no query strings" promise. A `before_send`† hook strips query and fragment from `$current_url`, `$referrer` and `$pathname`, and drops every event on `/admin/*` and `/signin`.
- Autocapture limited to clicks on links and buttons: `autocapture: { dom_event_allowlist: ['click'], element_allowlist: ['a', 'button'] }`, plus `mask_all_text: true`† and `mask_all_element_attributes: true`†.
- `capture_exceptions: false` (Sentry owns errors), `disable_external_dependency_loading: true` (no replay or survey scripts), and feature flags and surveys disabled. In the PostHog project settings, "Discard client IP data" is **on**.
- **Session Replay stays off in Phase 3a.** If it is approved later (3b): `session_recording: { maskAllInputs: true, maskTextSelector: '*', blockSelector: 'img' }`, console and network capture off, public routes only (block `/admin`, `/signin`, `/points`), sampled at 10% or less. It needs a privacy-notice update first.

**CSP (when one is enforced):** add `connect-src https://us.i.posthog.com`. Replay (3b) would also need `script-src https://us-assets.i.posthog.com` and `worker-src blob:`.

## Headers and CSP summary

| Phase | `vercel.json` | Draft CSP in `docs/security-headers-and-csp.md` |
| --- | --- | --- |
| 1 | No change | `connect-src` gains `https://o<org-id>.ingest.us.sentry.io` (the exact host from the DSN) |
| 2 | No change. Maps are removed from the output instead of blocked by a header | No change |
| 3 | No change | `connect-src` gains the PostHog host (see above) |

A same-origin Sentry `tunnel` (which keeps ad-blockers from dropping reports) would need a Vercel Function or rewrite placed before the SPA catch-all rewrite. It is out of scope here; consider it only if Sentry shows obvious under-reporting.

## Approval checklist

| # | Action | Reversible | Status |
| --- | --- | --- | --- |
| 1 | Merge the Phase 1 PR (SDK inert; bundle grows) | Revert | Awaiting review |
| 2 | Create Sentry project and set its privacy settings | Delete project | Needs approval |
| 3 | Set `REACT_APP_SENTRY_DSN` (Production) and redeploy | Unset and redeploy | Needs approval |
| 4 | Phase 2 PR, then set `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Unset | Not started |
| 5 | Phase 3 PostHog decision | — | Deferred |
