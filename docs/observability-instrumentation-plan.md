# Observability instrumentation plan (Sentry, PostHog)

**Status (2026-10-28):** Sentry error monitoring (Phase 1, #705) and PostHog product analytics (Phase 3a, #713) are live in production. The source-map upload code (Phase 2, #711) is merged but waits for the owner to add `SENTRY_AUTH_TOKEN`. Every production step (creating projects, setting Vercel variables, deploying) needs explicit owner approval.

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
3. **PostHog runs alongside GA4 (Phase 3).** It does not replace GA4: GA4 powers `/admin/analytics`, so replacing it means rebuilding that dashboard first. PostHog sits behind the same "Allow analytics" choice. Session Replay is held back to Phase 3b because it needs its own privacy review. Until Phase 3 is switched on, the PostHog connector stays "no evidence".
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

## Phase 2: source maps to Sentry, not to the public

**Status:** merged 2026-10-28 (#711, `dac9b77a`). The production build log shows the step skipping ("SENTRY_AUTH_TOKEN is not set"), so maps are still served until the owner adds the token.

CRA cannot take the Sentry webpack plugin without ejecting, so the upload runs as an npm `postbuild` step. Vercel runs it automatically after `npm run build`.

**Files**

- `package.json`: the `@sentry/cli` devDependency, plus `postbuild` and `postbuild:production` hooks that run `node scripts/sentry-sourcemaps.mjs`.
  - npm 11.16 only *warns* about unreviewed install scripts; it doesn't block them yet.
  - `@sentry/cli` 3.x doesn't need its postinstall anyway. The binary comes from an optional platform package (`@sentry/cli-linux-x64` on Vercel), and the postinstall is only a download fallback.
  - So no `allowScripts` entry is added, and a test pins that the binary resolves.
- `scripts/sentry-sourcemaps.mjs` behaves in three ways:
  - **No `SENTRY_AUTH_TOKEN`** (local builds, GitHub CI, the Docker image): logs "skipped" and does nothing. The maps stay, so `npm run analyze` keeps working.
  - **Token set** (Vercel):
    1. Runs `sentry-cli sourcemaps inject build/static/js`.
    2. Runs `sentry-cli sourcemaps upload --org havyn --project vsa-website --release <commit SHA> build/static/js`.
    3. Deletes every `build/**/*.map` (JS and CSS), and only after the upload succeeds.
    4. The token reaches `sentry-cli` through the environment, never on the command line.
  - **Upload fails:** logs a warning and keeps the maps (today's behavior). The build stays green, so a Sentry outage cannot block a deploy.
- `scripts/sentry-sourcemaps.test.mjs`: tests the skip, upload-then-delete and failure paths, the org/project overrides, and that the real binary resolves. It runs in the `test` job of `.github/workflows/deploy.yml`.
- `npm run check:csp-hashes` still passes: `inject` edits only `.js` files, never `index.html`.

**Vercel build variables** (server-side, not `REACT_APP_*`, never in the bundle)

| Variable | Environments | Value |
| --- | --- | --- |
| `SENTRY_AUTH_TOKEN` (the script also accepts `SENTRY_AUTH_TOKENS`, the name the Production variable was created with) | Production only | A Sentry **organization auth token** (Settings → Developer Settings → Organization Tokens), which can only upload releases and source maps. Mark it Sensitive. The owner creates and pastes it: it is a credential, so an agent never handles it |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Optional | Only needed to override the defaults `havyn` and `vsa-website` |

Previews have no token, so preview deployments still serve their maps. That's harmless, because the repo is public.

**Turning it on (owner only; the token is a credential, so an agent never handles it)**

1. In Sentry, open **Settings → Developer Settings → Organization Tokens** (`https://havyn.sentry.io/settings/auth-tokens/`) and click **Create New Token**. Name it, for example, `vercel-sourcemaps`. Organization tokens come with the fixed `org:ci` scope, which only allows release and source-map uploads. Copy the token now, because Sentry shows it only once.
2. Add it in Vercel, using either the dashboard or the CLI:
   - **Dashboard:** project `vsa-website` → **Settings → Environment Variables**. Add `SENTRY_AUTH_TOKEN` with the token as its value, select **Production** only, turn on **Sensitive**, and save.
   - **CLI:** from the linked main checkout, run `vercel env add SENTRY_AUTH_TOKEN production --sensitive` and paste the token at the prompt. Don't pass it with `--value`, which would leave it in your shell history.
3. Redeploy production: either merge any PR, or go to **Deployments**, open the latest production deployment, click **⋯ → Redeploy**, and keep the target as Production. The variable only takes effect on a new build.

**Verification**

- After the next production deploy, `curl -sI https://www.vsaatucsd.com/static/js/main.<hash>.js.map` returns `404` (`200` today; the SPA rewrite already excludes `/static/`).
- The Vercel build log shows "uploaded, then removed N .map files".
- A new smoke-test issue shows original TypeScript frames.

**Rollback:** remove `SENTRY_AUTH_TOKEN` and redeploy. The script skips and the maps are served again.

## Phase 3: PostHog alongside GA4 (3a: no Session Replay)

**Status:** live in production since 2026-10-28 (#713, `fcf8bee1`). The owner asked for it earlier than the original "after two weeks of Sentry" suggestion. Production check, aggregates only:
- PostHog received `$pageview` and `$autocapture` events.
- No URL carried a query string or `#`, no property contained `@`, and no `$ip` property exists.
- `/admin` never loaded the SDK.

PostHog runs **alongside** GA4 and doesn't replace it, because GA4 still feeds `/admin/analytics`. Both sit behind the same "Allow analytics" choice. The consent banner now names both.

**Variables** (Vercel Production; both public; both need to be set):

| Variable | Value |
| --- | --- |
| `REACT_APP_POSTHOG_KEY` | The project key from PostHog `project-get` → `api_token` (`phc_…`). It can only send events. Personal API keys (`phx_…`) are secrets, and the client-secret guard now flags them |
| `REACT_APP_POSTHOG_HOST` | `https://us.i.posthog.com` (the project's `api_host`) |

**Files**

| File | Change |
| --- | --- |
| `src/lib/productAnalytics.ts` | Lazy-loaded `posthog-js` (1.440.0), `trackProductPageView`, `disableProductAnalytics`, and the `before_send` scrubber (`scrubProductEvent`) |
| `src/components/common/RouteTracker.tsx` | Sends a path-only `$pageview` next to GA4's, and only when `consent === 'granted'` |
| `src/context/AnalyticsConsentContext.tsx` | Counts PostHog as configured. Decline turns off GA4 and PostHog: it resets the anonymous ID and opts out, or clears stored `ph_<key>` data if the SDK never loaded on this visit |
| `src/components/common/AnalyticsConsentBanner.tsx`, `src/pages/Privacy.tsx` | Copy names PostHog and says what it records |
| Client-secret guard, `.env.example`, `THREAT_MODEL.md`, draft CSP, config catalog, test inventory | As for Phase 1 |

**SDK configuration** (pinned by `src/lib/productAnalytics.test.ts`)

- `defaults: '2026-08-30'`, the newest recommended set in 1.440.0. It also turns on `disable_capture_url_hashes`, so auth tokens in URL fragments are never captured.
- Identity and storage: `person_profiles: 'never'` and `persistence: 'localStorage'` (no PostHog cookies). There are no `identify()`, `alias()` or `setPersonProperties()` calls.
- Page views: `capture_pageview: false` and `capture_pageleave: false`. `RouteTracker` sends `$pageview` with `$current_url` = origin + path, without the query string, matching GA4.
- Autocapture: `{ dom_event_allowlist: ['click'], element_allowlist: ['a', 'button'] }`, with `mask_all_text`, `mask_all_element_attributes` and `mask_personal_data_properties` all on. `rageclick`, dead clicks, heatmaps and performance are off.
- Everything else off: `capture_exceptions: false` (Sentry owns errors); Session Replay, surveys, web experiments and flags (`advanced_disable_flags`); `disable_external_dependency_loading: true`, so no extra scripts load from PostHog's CDN. `respect_dnt: true`.
- `before_send`:
  - Drops every event whose `$pathname` is under `/admin` or `/signin`.
  - Strips query strings and fragments from `$current_url`, `$referrer` and the `$initial_*` URLs, including inside `$set` / `$set_once`.
  - Redacts emails and JWT-shaped strings in every other property, nested values included.

**Bundle** (`npm run build`, gzip):

- **Main bundle:** 289.99 kB on the Phase 2 branch. With this PR it is 290.72 kB while inert (+0.73 kB) and 290.82 kB with the variables set.
- **`posthog-js` chunk:** 108 kB, fetched only after a visitor allows analytics.
- **A smaller option:** posthog-js also ships an undocumented `module.slim.no-external` build (54 kB). It isn't used because how it loads autocapture isn't documented. Revisit it if the consented-visitor cost matters.

**Owner actions (each needs approval)**

1. PostHog project settings: turn on **Discard client IP data** (`anonymize_ips: true`, currently `false`). Turn off console-log capture (`capture_console_log_opt_in`, currently `true`, which only matters for replay), and leave Session Replay off. The privacy notice says IPs are discarded, so these settings come **before** the variables.
2. Optionally set Authorized URLs to `https://www.vsaatucsd.com` and `https://vsaatucsd.com`.
3. Vercel Production: set `REACT_APP_POSTHOG_KEY` and `REACT_APP_POSTHOG_HOST`, then redeploy. They are build-time values.

**Verification:** on production, after allowing analytics:
- `$pageview` events arrive with a path-only `$current_url` (PostHog connector `read-data-schema`, then a narrow `execute-sql` count).
- Visiting `/admin` sends nothing.
- After declining, the `ph_…` localStorage key is gone and no further requests go to `us.i.posthog.com`.

**Phase 3b (not started; needs its own approval and a privacy-notice update):** Session Replay on public routes only, with:
- `maskAllInputs: true`, `maskTextSelector: '*'` and `blockSelector: 'img'`;
- network and console capture off, 10% sampling or less;
- `/admin`, `/signin` and `/points` blocked.

It would also need `script-src https://us-assets.i.posthog.com` and `worker-src blob:` once a CSP is enforced.

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
| 1 | Merge the Phase 1 PR (SDK inert; bundle grows) | Revert | Done 2026-10-28 (#705, `7aedecf8`) |
| 2 | Create Sentry project and set its privacy settings | Delete project | Done 2026-10-28 (`havyn/vsa-website`) |
| 3 | Set `REACT_APP_SENTRY_DSN` (Production) and redeploy | Unset and redeploy | Done 2026-10-28; smoke test `VSA-WEBSITE-1` verified scrubbing, then resolved |
| 4 | Phase 2 PR, then the owner sets `SENTRY_AUTH_TOKEN` (Production) | Unset the token | Merged 2026-10-28 (#711); the owner set the token as `SENTRY_AUTH_TOKENS`, which the script accepts since #718 |
| 5 | Phase 3 PR; owner turns on PostHog IP discarding, then sets `REACT_APP_POSTHOG_KEY` / `_HOST` (Production) | Unset the variables | Done 2026-10-28 (#713); `anonymize_ips` on, console capture off, first events verified |
