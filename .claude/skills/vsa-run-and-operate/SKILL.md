---
name: vsa-run-and-operate
description: Load when running or deploying the VSA website, or operating its production machinery — "how do I deploy this?", "what actually ships to production?", applying supabase/migrations/ to prod, deploying Edge Functions (supabase functions deploy), running the image-migration pipeline (npm run migrate:images:*, migrate-images.yml, migrate-event-images.yml), operating scripts/ helpers, or figuring out where an artifact (build/, public/images/, ghcr image, Vercel deployment) lands. Provides the real deploy path (Vercel, not Docker), the migrations→frontend→edge-function ordering rule, and the never-delete-Storage-originals rule.
---

# VSA Run & Operate

**What this is for.** The operations manual for the VSA website: what `npm start`/`npm run build` actually produce, what REALLY deploys production (resolved with evidence — it's Vercel; the Docker image is a dead end), how schema migrations reach the production database (manually, in a strict order), how the five Supabase Edge Functions are deployed and configured, and how to run the image-migration pipeline that exists because of the Supabase egress crisis ("egress" = data transferred out of Supabase, which is billed/quota'd; serving images from Supabase Storage burned through the free-tier egress quota).

**When NOT to use this skill:**

| If you need... | Load instead |
|---|---|
| Setting up a dev environment from zero, `.env.local`, npm/jest/node traps | `vsa-build-and-env` |
| Whether a change is even allowed, PR/branch conventions, the manual-migration *policy* and freeze windows | `vsa-change-control` |
| Writing migration SQL safely (RLS, grants, view gotchas) | `vsa-supabase-security-reference` |
| Full incident narratives (egress crisis, RLS recursion) | `vsa-failure-archaeology` |
| Env var / secret *catalog* (every axis of configuration) | `vsa-config-and-flags` |
| Verifying a change works (test/lint/build evidence bar) | `vsa-validation-and-qa` |
| Something is broken and you don't know why | `vsa-debugging-playbook` |

---

## 1. Local run

`npm start` serves the CRA (Create React App) dev server on `http://localhost:3000`. `npm run build` emits a static bundle into `build/` (`npm run build:production` is an identical alias — both run `react-scripts build`, see `package.json`). Both need `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` in `.env.local`; without them the app boots into degraded mode or errors — see `vsa-build-and-env` for the from-zero runbook and setup traps. An optional Docker path exists (`Dockerfile`: node:18-alpine build stage → nginx stage serving `build/` on port 80 with an SPA `try_files $uri $uri/ /index.html` fallback in `nginx.conf`; `docker-compose.yml` wraps it) — useful for a local prod-like check, **not** part of the production deploy path (see §2).

```bash
npm start                        # dev server on :3000
npm run build                    # static bundle → build/
npx serve -s build               # quick local check of the prod bundle (optional)
```

## 2. THE production deploy path (resolved, as of 2026-07-06)

**Production is a static Vercel deployment of `build/`. Nothing else serves production.** Evidence trail:

`vercel.json` configures an SPA fallback while relying on Vercel zero-config for the CRA build (verbatim, abridged):

```json
{
  "version": 2,
  "routes": [
    { "src": "/static/(.*)", "headers": { "cache-control": "public, max-age=31536000, immutable" }, "dest": "/static/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "headers": { "cache-control": "no-cache, no-store, must-revalidate" }, "dest": "/index.html" }
  ]
}
```

The `handle: filesystem` + final catch-all to `/index.html` is the SPA (single-page app) fallback: any URL that isn't a real file serves `index.html` so React Router can route it. Security headers (HSTS, X-Frame-Options DENY, nosniff) are applied to every route in the same file. `AGENTS.md` (line 13) confirms: "Deployed to: Vercel (zero-config CRA build, SPA fallback in `vercel.json`)".

### What `.github/workflows/deploy.yml` actually does

| Job | Runs when | Does |
|---|---|---|
| `test` | every push to `main`/`develop` AND every PR to `main` | `npm ci` → `npm run lint` → `CI=true npm test -- --coverage --watchAll=false` → `npm run build` |
| `security` | same triggers, needs `test` | CodeQL init + Trivy filesystem scan → SARIF upload |
| `build` (Docker) | **only `main`**, needs test+security | builds the `Dockerfile`, pushes to `ghcr.io/hhavynn/vsa-website` |
| `deploy-vercel` | **only `main`**, needs test+security | `npx vercel@latest --prod --token=$VERCEL_TOKEN` — **skipped entirely if the `VERCEL_TOKEN` secret is unset** (explicit check step) |

Resolved facts you must internalize:

1. **The ghcr Docker image is built but consumed by nothing.** `grep -rn ghcr` across the repo hits only `deploy.yml` itself. `scripts/deploy.sh` targets AWS EKS (`aws`/`kubectl`, cluster `vsa-website-cluster`) — there is no EKS cluster referenced anywhere else in the repo; treat that script as legacy/aspirational, never run it against production.
2. **CI runs tests but does not gate anything.** `main` has **no branch protection** (verified 2026-07-06: `gh api repos/hhavynn/vsa-website/branches/main/protection` → HTTP 404 "Branch not protected"). The jobs run, but a failing run blocks neither merges nor the push that already landed. Before pushing, run the proportional final gate assigned by `vsa-validation-and-qa`; application/runtime changes commonly need lint, relevant tests, and build, while docs-only changes use targeted documentation/reference checks. A red CI run is still blocking by convention.
3. **UNVERIFIED — the operative production trigger.** Strong repo evidence says Vercel's *git integration* auto-deploys pushes to `main` independently of deploy.yml: image-migration workflow commits use `[skip ci]` (which skips GitHub Actions, including the `deploy-vercel` job) yet `docs/event-image-migration.md` step 7 says "Wait for Vercel to redeploy (usually 1–3 minutes)" after that push, and `docs/DEPLOYMENT_GUIDE.md` says pushes auto-update the site. That only works if Vercel watches the repo directly. **Question a maintainer must answer:** in the Vercel dashboard (project → Settings → Git), is the GitHub integration connected and deploying `main` to production, and is the `VERCEL_TOKEN` GitHub secret set (making the Actions deploy a redundant second deploy) or unset (making git integration the only path)?

**Manual production deploy** (when you must): `npx vercel --prod` from repo root with the project linked, or trigger a redeploy from the Vercel dashboard. Env vars (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`) live in Vercel project settings, not in the repo.

## 3. Database operations runbook (migrations)

`supabase/migrations/*.sql` is the **source of truth for schema** (`AGENTS.md` line 162), but nothing applies them automatically — no workflow touches the database schema. **Migrations are applied manually to production** (policy owned by `vsa-change-control`; SQL-authoring safety owned by `vsa-supabase-security-reference`):

```bash
supabase link --project-ref <project-ref>   # once per machine
supabase db push                            # applies pending migrations, in filename order
# — or paste the migration file into Supabase Dashboard → SQL Editor and run it
```

### The iron ordering rule for schema-coupled releases

**Migrations → frontend deploy → Edge Function deploy.** Never invert it.

Why, proven by the Ask VSA v2 case (all in-repo, as of 2026-07-06):

- `supabase/migrations/20260704000000_ai_knowledge_v2_schema.sql` adds columns to `ai_knowledge_base`: `aliases text[]`, `confidence`, `freshness`, `academic_year`, `valid_until` (lines 6–11).
- The admin frontend **writes those exact columns on every save**: `src/data/repos/aiKnowledge.ts` builds its payload with `aliases`, `confidence`, `freshness`, `academic_year`, `valid_until` (lines 80–87; types at lines 29–36). Ship this frontend before the migration and every admin knowledge save fails on unknown columns.
- The Edge Function **reads them**: `supabase/functions/vsa-ai-assistant/index.ts` selects/renders `confidence`, `freshness`, `academic_year` (lines 118–120, 227–229) and its `SYSTEM_PROMPT` (line 34+) instructs archive-language handling for `confidence: medium/low` entries. Deploy the function before the migration and it queries columns that don't exist.

So for any release where frontend or Edge Function code touches new schema: **(1)** `supabase db push`, **(2)** merge/push frontend to `main` and wait for the Vercel deploy, **(3)** `supabase functions deploy <name>`. Additive-only migrations (like `add column if not exists` above) are safe to run ahead of the code; that is exactly why this ordering works without downtime.

Follow-up data migrations `20260704000001_ai_knowledge_v2_dedupe.sql` and `20260704000002_ai_knowledge_v2_expansion.sql` run after the schema file (timestamp order). Note the dedupe deactivates rows (`is_active=false`) rather than deleting — preserve that convention.

## 4. Edge Function operations

Five Deno Edge Functions live in `supabase/functions/` (verify: `ls supabase/functions`). "Edge Function" = Deno TypeScript deployed to Supabase's runtime, invoked at `https://<project-ref>.supabase.co/functions/v1/<name>`.

| Function | Purpose | Secrets it reads (`Deno.env.get`) |
|---|---|---|
| `vsa-ai-assistant` | Current "Ask VSA" public assistant, Gemini-backed; behavior rules in its `SYSTEM_PROMPT`, volatile facts from `ai_knowledge_base` rows | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-provided), `GEMINI_API_KEY`, `GEMINI_MODEL` (optional override), `VSA_AI_ASSISTANT_ENABLED` (kill switch — set to `"false"` to disable) |
| `secure-ai` | Legacy OpenAI-backed chat proxy (zod-validated requests, CORS-pinned to vsaatucsd.com/localhost) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` |
| `analytics-proxy` | Serves GA4 report data to `/admin/analytics` (`src/pages/Admin/Analytics.tsx` invokes it) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (OAuth refresh-token flow, NOT a service account), `GA4_PROPERTY_ID` (numeric ID, not `G-…`), `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `trigger-event-image-migration` | DB-webhook receiver: validates secret, checks `events.image_url` changed and points at Supabase Storage, fires GitHub `repository_dispatch` | `IMAGE_MIGRATION_WEBHOOK_SECRET`, `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_EVENT_TYPE` (optional, default `event-image-migration-requested`) |
| `trigger-house-event-image-migration` | Same, for `house_events` | `IMAGE_MIGRATION_WEBHOOK_SECRET`, `GITHUB_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_DISPATCH_EVENT_TYPE_HOUSE` (optional, default `house-event-image-migration-requested`) |

Operations:

```bash
supabase functions deploy <name>                 # deploy one function (e.g. vsa-ai-assistant)
supabase functions list                          # confirm deployed versions
supabase secrets set GEMINI_API_KEY="..."        # secrets are project-wide, set once
supabase secrets list                            # names only, never prints values
```

Logs: Supabase Dashboard → Edge Functions → *function* → Logs (this is the path the runbooks in `docs/event-image-migration.md` and `docs/admin-analytics-setup.md` use). Deploy order relative to schema changes: see §3.

## 5. The image-migration pipeline (egress-crisis machinery)

This is the most operationally important system in the repo. Background: serving event/House/cabinet images straight from Supabase Storage blew the Supabase egress quota (full story: `vsa-failure-archaeology`). The fix: admin uploads still land in Supabase Storage (browsers cannot write into the repo), then a pipeline downloads, compresses to WebP (≤1200×1200, q80, via `sharp`), commits them under `public/images/…`, and rewrites the DB `image_url`/`thumbnail_url` to `/images/...` so Vercel's edge serves them with zero Supabase egress. Doc of record: `docs/event-image-migration.md`.

### THE IRON RULE

**NEVER delete the Supabase Storage originals after migration.** `docs/event-image-migration.md` ("Why old Supabase files are not deleted"): deleting immediately breaks CDN/browser caches still pointing at the old URL. Storage is the intentional staging buffer. Cleanup, if ever, is a manual, delayed, human decision after confirming all DB rows point at `/images/...` and caches have expired.

### The script and npm entrypoints

`scripts/migrate-supabase-images-to-public.ts` (run via `tsx`). **Dry run is the default; `--apply` is the only thing that writes.** Categories: `cabinet`, `events`, `gallery`, `houses`, `home`, `house-events`.

```bash
npm run migrate:images:dry                                    # scan ALL categories, read-only
npm run migrate:images:apply                                  # apply ALL categories
npm run migrate:house-assets:dry                              # = --category houses, dry
npm run migrate:house-assets:apply                            # = --category houses --apply
npm run migrate:images:dry -- --category events --event-id <uuid>
npm run migrate:images:apply -- --category events --force-apply    # local apply (see guard below)
```

Flags (verified against the script header and arg parsing): `--apply`, `--overwrite` (re-download existing files), `--category <c>`, `--limit <n>`, `--event-id <uuid>`, `--house-event-id <uuid>`, `--force-apply`. Env (auto-loaded from `.env.local`): `REACT_APP_SUPABASE_URL` + `REACT_APP_SUPABASE_ANON_KEY` required; `SUPABASE_SERVICE_ROLE_KEY` needed for `--apply` DB updates (bypasses RLS — Row Level Security, Postgres per-row access policies). **Branch guard** (script lines ~598–607): in CI, `--apply` refuses to run off `main` unless `--force-apply` — because rewriting DB URLs to `/images/...` before those files are deployed on `main` serves broken images in production.

### The two workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/migrate-images.yml` | daily cron `0 8 * * *` (midnight PT) + manual dispatch | `npm run migrate:images:apply` across ALL categories, then commits/pushes `public/images/` with `[skip ci]` |
| `.github/workflows/migrate-event-images.yml` | manual dispatch (inputs: `category` events/house-events, `apply` default **false**, optional `event_id`/`house_event_id`, `limit` default 20) + `repository_dispatch` types `event-image-migration-requested` / `house-event-image-migration-requested` | targeted migration; repository_dispatch runs always apply with `--limit 1`; guard step fails apply-mode runs not on `main`; per-event concurrency group prevents duplicate runs |

Both need GitHub secrets `REACT_APP_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### End-to-end automatic flow (Phase 3, live per docs)

Admin uploads image → Supabase Storage + DB row updated → Database Webhook (Dashboard → Database → Webhooks, header `x-image-migration-secret`) → Edge Function `trigger-event-image-migration` (validates secret, only dispatches when `image_url` is new AND a Supabase Storage URL) → `repository_dispatch` → `migrate-event-images.yml` applies for that one event → commit to `main` → Vercel redeploys → image served from `/images/events/<slug>_<date>.webp` (+ `_thumb.webp`). Full webhook/PAT setup steps: `docs/event-image-migration.md` §Phase 3.

**Standard operating procedure for a manual run:** dry run first (Actions → "Migrate event images to static assets" → `apply=false`), read the printed plan, then re-run with `apply=true` from `main`, wait for the Vercel deploy, verify `/events` serves `/images/events/...` URLs.

## 6. Operational scripts inventory (`scripts/`)

| Script | One-liner |
|---|---|
| `migrate-supabase-images-to-public.ts` | The image-migration engine (§5) |
| `cleanup-stale-photo-requests.mjs` | Deletes pending member-photo upload files in Storage older than 7 days with no active `member_photo_requests` row; dry-run by default, real deletion requires `CONFIRM_DELETE=true node scripts/cleanup-stale-photo-requests.mjs` |
| `verify-ace-import.mjs` | Offline smoke test mirroring the `src/lib/aceFamilyImport.ts` parser against a sample JSON — sanity-check ACE family import numbers without touching Supabase (`node scripts/verify-ace-import.mjs`) |
| `restore-house-events.sql` | Hand-run restoration SQL for House events reconstructed from `public/images/house-events/` filenames; PART A runnable after fixing `-- TODO: fix date` placeholders, PART B needs real `house_profile_id` UUIDs; inserts with `is_published = false` |
| `deploy.sh` | Legacy AWS EKS deploy script (`aws`/`kubectl`) — NOT the production path (§2); do not run |
| `verify-rls-security.mjs` | RLS security probe — interpretation guide lives in `vsa-diagnostics-and-measurement` |
| `graphify-run` | Wrapper to run Graphify queries — see `graphify` skill / `vsa-docs-and-writing` |

## 7. Analytics operations (one paragraph)

Two separate systems share the word "analytics": (1) public page-view tracking in the React app, gated by user consent (`src/context/AnalyticsConsentContext.tsx` + `src/components/common/RouteTracker.tsx`) and configured via `REACT_APP_GA4_MEASUREMENT_ID`; (2) the admin reporting page `/admin/analytics`, which calls the `analytics-proxy` Edge Function to pull GA4 report data server-side using Google OAuth refresh-token secrets (§4 table; setup and failure modes in `docs/admin-analytics-setup.md` — e.g. `invalid_grant` means mint a new refresh token). The measurement ID and the reporting credentials are independent: setting one never fixes the other. Env-var catalog: `vsa-config-and-flags`; consent-UX conventions: `vsa-design-system-reference`.

## 8. What lands where

| Artifact | Produced by | Lands | Committed to git? |
|---|---|---|---|
| `build/` | `npm run build` (locally, in CI, and by Vercel) | local dir / Vercel static deployment | No (gitignored build output) |
| `public/images/events/`, `/house-events/`, `/houses/`, etc. | image-migration pipeline (§5) | repo static asset tree, served by Vercel edge | **Yes — committed to `main` by workflow bots** |
| Production site | Vercel static build of `main` (§2) | vsaatucsd.com / *.vercel.app | n/a |
| `ghcr.io/hhavynn/vsa-website` Docker image | deploy.yml `build` job on `main` | GitHub Container Registry | n/a — built but consumed by nothing (§2) |
| Edge Function code | `supabase functions deploy <name>` | Supabase runtime | source in `supabase/functions/`, yes |
| Schema | manual `supabase db push` / dashboard SQL (§3) | production Postgres | migrations in `supabase/migrations/`, yes |
| `graphify-out/` | Graphify indexing | `graph.json`, `graph.html`, `GRAPH_REPORT.md`, `manifest.json` **committed** (in a separate `chore: update graphify graph` commit); `graphify-out/cost.json` and `graphify-out/cache/` **gitignored, never commit** |

## Provenance and maintenance

Sources (all read 2026-07-06, branch `codex/reactbits-ui` @ `368fbf63`): `package.json`, `vercel.json`, `Dockerfile`, `nginx.conf`, `.github/workflows/{deploy,migrate-images,migrate-event-images}.yml`, `docs/DEPLOYMENT_GUIDE.md`, `docs/event-image-migration.md`, `docs/admin-analytics-setup.md`, `AGENTS.md` (lines 13, 162, 246), `scripts/{migrate-supabase-images-to-public.ts,cleanup-stale-photo-requests.mjs,verify-ace-import.mjs,restore-house-events.sql,deploy.sh}`, `supabase/functions/*/index.ts`, `supabase/migrations/20260704000000_ai_knowledge_v2_schema.sql`, `src/data/repos/aiKnowledge.ts`, `src/pages/Admin/Analytics.tsx`. Branch-protection check: `gh api repos/hhavynn/vsa-website/branches/main/protection` → 404 (2026-07-06).

Re-verify before trusting (things that drift):

```bash
grep -n '"migrate' package.json                          # npm entrypoints still match
ls supabase/functions                                    # still five functions
grep -rn "Deno.env.get" supabase/functions/ | grep -v SUPABASE_   # secret names per function
grep -n "use.*static-build\|distDir" vercel.json         # deploy mechanism unchanged
grep -n "VERCEL_TOKEN\|ghcr" .github/workflows/deploy.yml # CI deploy step + Docker job
gh api repos/hhavynn/vsa-website/branches/main/protection # branch protection still absent?
grep -n "skip ci" .github/workflows/migrate-*.yml        # bot commits still skip Actions
ls supabase/migrations | tail -5                         # newest migrations
```

Open item for a maintainer (UNVERIFIED, §2.3): confirm in the Vercel dashboard whether the GitHub git integration deploys `main` to production, and whether the `VERCEL_TOKEN` GitHub secret is set. Update §2 with the answer.
