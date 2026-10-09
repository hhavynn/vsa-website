# Event Image Migration
Migrates event and House event images from Supabase Storage to repo-hosted `/public/images/events/` and `/public/images/house-events/` files so Vercel serves them as static assets.

## Why two steps?

**Admin uploads still go to Supabase first.** The browser cannot write directly into the Vercel `/public` directory — those files must live in the repo and be deployed through Vercel's build pipeline. So the flow is:

1. Admin uploads → Supabase Storage (immediate, no deploy needed)
2. Migration workflow (phase 1) → downloads those images, optimizes them, writes to `public/images/events/` or `public/images/house-events/` **and a relink plan**, commits, and pushes to `main`. The database is not touched.
3. Vercel redeploys `main` → image is now served from `/images/events/...` or `/images/house-events/...`
4. Migration workflow (phase 2) → confirms production really serves each new file, **then** updates the DB row to the local path instead of the Supabase URL

### Why the DB is updated last (#454)

The row used to be relinked inside the same step that wrote the file, before anything was pushed or deployed. A failed push or deploy left the row pointing at a path that was not served (a 404) and later runs skipped it because it already looked local.

Now:

| Phase | Command | Writes |
|---|---|---|
| 1 | `--apply` | WebP files + a relink plan (`scripts/reports/image-relink-plan.json`). **Never the database.** |
| (commit, push, wait for deploy) | | |
| 2 | `--relink <plan> --base-url <origin>` | For each plan entry: check the production asset, then `UPDATE … WHERE id = ? AND <field> = <expected Storage URL>`. |

Phase 2 treats an asset as served only when production returns **HTTP 200, an `image/*` content-type, and exactly the bytes of the committed file (length and SHA-256)**. A status check alone is not enough: `vercel.json` answers every missing path with `200` + `index.html` (SPA fallback), so a file that never deployed would look healthy. All distinct assets are polled together against **one shared deadline**: `--wait-seconds` (the workflows use 900) is the budget for the whole run, not per asset, so 50 missing files cost 15 minutes, not 12 hours. Each asset still has to pass on its own before its rows are relinked.

Before anything is verified or written, the whole plan is validated against the migration's category table (`scripts/lib/imageMigrationConfig.ts`). A plan is data read from disk and the relink uses the service-role key, so it may only touch the configured table and image columns of a known category, point at a plain `.webp` file directly inside that category's `/images/...` directory, have a `filePath` that matches its `newPath`, and carry no conflicting writes to the same row and column. One bad entry rejects the entire plan.

Outcomes per plan entry:

- **relinked** — asset served, row still held the expected Storage URL, now points at `/images/...`.
- **not served** — asset missing after the wait. The row is left on its working Storage URL; the job exits non-zero so a deploy that never landed is visible. The next run re-plans it (rows still on Storage are always planned, even if the file is already committed).
- **row changed** — someone saved a newer upload (or another run already relinked it) between the plan and the relink. Left untouched.

If the push fails, the workflow fails before phase 2, so no row is touched. Storage originals are never deleted.

> **How the deploy starts.** Commits pushed with the workflow's `GITHUB_TOKEN` never trigger other workflows, so after pushing, the migration workflows run `gh workflow run deploy.yml --ref main` (`deploy.yml` has a `workflow_dispatch` trigger for this). Its Vercel step is skipped when the `VERCEL_TOKEN` secret is unset; in that case the Vercel git integration, which watches `main` directly, is the deploy path (not verifiable from this repo; the bot commits no longer carry `[skip ci]`, so they are not excluded from it). If neither deploys, phase 2 times out and the rows stay on Storage; fix the deploy and re-run. Phase 2 also compares a SHA-256 of the served file, so a stale file of the same size at a reused path (`--overwrite`) is not accepted.

### Categories

1.  **events**: Standard VSA events (table: `events`). Files saved to `public/images/events/`.
2.  **house-events**: House-specific events (table: `house_events`). Files saved to `public/images/house-events/`.
3.  **cabinet**: Cabinet member profiles.
4.  **gallery**: Gallery event covers.
5.  **houses**: House page assets (cover images, etc.).
6.  **home**: Homepage content (presidents' photo).

## Usage

This is intentional. Supabase Storage acts as a staging buffer; the migration workflow is what graduates images into the repo's static asset tree.

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `REACT_APP_SUPABASE_URL` | Supabase project URL (used to read event rows) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS for DB updates in apply mode |

These are already used by the existing `migrate-images.yml` workflow and should already be configured in your repo settings.

## How to run

### Dry run (safe, read-only)

Go to **Actions → Migrate event images to static assets → Run workflow**.

Leave `apply` set to `false`. Choose optional `event_id` and `limit` inputs.

The workflow will print what it *would* download, compress, and plan to relink — but make no changes.

You can also run the script locally:

```bash
# All events, dry run
npm run migrate:images:dry -- --category events

# Single event, dry run
npm run migrate:images:dry -- --category events --event-id <uuid>

# House events, dry run
npm run migrate:images:dry -- --category house-events

# Single House event, dry run
npm run migrate:images:dry -- --category house-events --house-event-id <uuid>

# Limit rows
npm run migrate:images:dry -- --category events --limit 5
```

Requires `.env.local` with `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).

### Apply mode

**Always run a dry run first and review the output.**

Apply mode must run from the `main` branch. This is enforced by the workflow, because only `main`'s files are what production serves and what phase 2 verifies against.

Recommended process:

1. Run dry run → review printed output
2. Go to **Actions → Migrate event images to static assets → Run workflow**
3. Set `apply` to `true`
4. Set `event_id` if migrating a single event
5. Click **Run workflow** (must be run from `main`)
6. The workflow writes the files + plan, commits and pushes to `main`, then waits for Vercel to serve each new file (usually 1–3 minutes, up to 15) and only then relinks the rows
7. Visit `/events` and verify images load from `/images/events/...` URLs

To run it by hand (for example to retry after a "not served" failure):

```bash
# Phase 1: files + plan, no DB writes (needs only the anon key)
npm run migrate:images:apply -- --category events

# Review, commit and push public/images/, wait for the Vercel deploy, then:

# Check what is live without writing anything
npm run migrate:images:relink -- --relink scripts/reports/image-relink-plan.json \
  --base-url https://www.vsaatucsd.com --verify-only --wait-seconds 0

# Phase 2: relink (needs SUPABASE_SERVICE_ROLE_KEY; refuses off main in CI unless --force-apply)
npm run migrate:images:relink -- --relink scripts/reports/image-relink-plan.json \
  --base-url https://www.vsaatucsd.com
```

The workflows read the production origin from the `SITE_URL` repository variable and default to `https://www.vsaatucsd.com`.

## Script flags

| Flag | Description |
|---|---|
| `--apply` | Write files and a relink plan (default: dry run). Does not modify the database. |
| `--plan-out <file>` | Where `--apply` writes the plan (default `scripts/reports/image-relink-plan.json`) |
| `--relink <plan>` | Phase 2: verify each asset on production, then relink rows. Needs `--base-url`. |
| `--base-url <origin>` | Production origin used to verify assets |
| `--wait-seconds <n>` | Total time to poll for the deploy, shared by all assets (default 600; `0` = check once) |
| `--verify-only` | With `--relink`: verify assets, write nothing |
| `--category events` | Restrict to events table (script supports other categories too) |
| `--event-id <uuid>` | Migrate a single event row |
| `--limit <n>` | Max rows to process |
| `--overwrite` | Rewrite output files even when the derived image is identical. Rows still on Supabase Storage are always re-derived and planned; the file is only rewritten when the image changed (#436). |
| `--force-apply` | With `--relink`: override the CI main-branch guard (use carefully) |

## Image output

Images are saved as WebP at up to 1200×1200 px, quality 80. Filenames use the event name slug and date:

```
public/images/events/<event-name>_<date>.webp
public/images/events/<event-name>_<date>_thumb.webp
```

Once phase 2 confirms the file is served, the DB field `image_url` (and `thumbnail_url`) is updated to `/images/events/<filename>.webp`.

## Why old Supabase files are not deleted

Old Supabase Storage files are intentionally kept after migration. Deleting them immediately would break any cached CDN responses or browser caches still pointing at the old URL. If you want to clean up old Supabase files, do so manually after confirming that all DB rows have been updated and sufficient time has passed for caches to expire.

## Supabase egress reduction

Once phase 2 has updated the DB `image_url` fields to `/images/events/...`, the Supabase CDN stops serving those images. Vercel's edge network serves them instead — from the repo's static asset tree — without counting against Supabase egress.

## Relationship to the daily migration workflow

A separate `migrate-images.yml` workflow runs daily and applies all categories automatically. This `migrate-event-images.yml` workflow is for on-demand, targeted event migrations with dry-run safety built in. If you run both, the daily workflow will skip already-migrated images (local paths are not re-downloaded). Both use the same two-phase flow, and their relink updates are conditional, so two runs cannot overwrite each other's work.

---

## Phase 3: Automatic trigger from Supabase

When Phase 3 is enabled, uploading or changing an event image in the admin dashboard automatically triggers the migration — no manual workflow run needed.

### How it works

```
Admin uploads event image
  → image lands in Supabase Storage
  → DB row updated (image_url = Supabase Storage URL)
  → tracked trigger (request_event_image_migration) queues a pg_net POST,
    reading the URL and shared secret from Supabase Vault
  → Edge Function: trigger-event-image-migration
      → verifies shared secret
      → checks image URL changed + is Supabase Storage
      → POSTs repository_dispatch to GitHub
  → GitHub Action: migrate-event-images.yml
      → runs migration for that specific event in apply mode
      → writes public/images/events/<slug>.webp
      → updates DB image_url to /images/events/...
      → commits + pushes to main
  → Vercel redeploys → image served as static asset
```

### Required Supabase Edge Function secrets

Set these in the Supabase Dashboard under **Project Settings → Edge Functions**:

| Secret | Purpose |
|---|---|
| `IMAGE_MIGRATION_WEBHOOK_SECRET` | Shared secret between the database trigger and the Edge Function. Must equal the Vault secret `image_migration_webhook_secret` |
| `GITHUB_REPOSITORY` | Repo in `owner/repo` format, e.g. `hhavynn/vsa-website` |
| `GITHUB_DISPATCH_TOKEN` | Fine-grained PAT with `contents: write` on this repo (to trigger `repository_dispatch`) |
| `GITHUB_DISPATCH_EVENT_TYPE` | Optional. Default: `event-image-migration-requested` |

### Required GitHub secrets (already set for Phase 2)

| Secret | Purpose |
|---|---|
| `REACT_APP_SUPABASE_URL` | Read event rows |
| `SUPABASE_SERVICE_ROLE_KEY` | Update DB rows (bypasses RLS) |

### Supabase Dashboard setup

1. **Deploy the Edge Function:**
   ```bash
   supabase functions deploy trigger-event-image-migration
   ```
   `supabase/config.toml` sets `verify_jwt = false` for this function (equivalent to `--no-verify-jwt`). It must stay off: the webhook sends no JWT, so a gateway JWT check would reject every call. Confirm with `supabase functions list` (or the dashboard), which must show JWT verification disabled.

2. **Set Edge Function secrets** (Supabase Dashboard → Edge Functions → trigger-event-image-migration → Secrets):
   - `IMAGE_MIGRATION_WEBHOOK_SECRET` — any strong random string (e.g. `openssl rand -hex 32`)
   - `GITHUB_REPOSITORY` — e.g. `hhavynn/vsa-website`
   - `GITHUB_DISPATCH_TOKEN` — fine-grained PAT (see below)
   - `GITHUB_DISPATCH_EVENT_TYPE` — optional, leave unset to use default

3. **Create the GitHub PAT:**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Repository access: `hhavynn/vsa-website`
   - Permissions: **Contents → Read and write** (required for `repository_dispatch`)
   - Copy the token and set as `GITHUB_DISPATCH_TOKEN` in step 2

4. **Create the Vault secrets, then apply the trigger migration.** The database side is tracked in `supabase/migrations/20261010120000_vault_backed_image_migration_triggers.sql`; it is not a Dashboard webhook. In **Vault** (Dashboard → Integrations → Vault), create:
   - `image_migration_functions_url` — `https://<project-ref>.supabase.co/functions/v1`
   - `image_migration_webhook_secret` — the same value as `IMAGE_MIGRATION_WEBHOOK_SECRET`

   Then apply the migration manually (never `supabase db push` against production; see the runbook). It creates `request_event_image_migration` on `events` and `request_house_event_image_migration` on `house_events`. Both fire `AFTER INSERT OR UPDATE OF image_url` and call `private.request_image_migration()`, which reads both values from Vault at fire time and sends only `Content-Type` and `x-image-migration-secret`. If a secret is missing, the trigger skips with a warning and the row still saves. Exact steps and read-only verification queries: [`image-migration-webhook-credential-rotation.md`](image-migration-webhook-credential-rotation.md), stage 1.

   > **Do not create Database Webhooks for this in the Dashboard** (Database → Webhooks). A Dashboard webhook stores its headers in plain text in the trigger definition (`pg_trigger`, `pg_get_triggerdef`), which every database role can read, `anon` and `authenticated` included. Its "Add auth header with service key" button also writes the service-role JWT there. That happened in production; see `docs/edge-function-security-audit.md` § "Service-role key in image-migration webhooks". The functions authorize only on `x-image-migration-secret` and run with `verify_jwt = false`, so no `Authorization` header is ever needed. Database → Webhooks is expected to list nothing.

   To confirm no credential is in any trigger definition (prints counts only, never values):
   ```sql
   select count(*) as triggers_with_credentials
   from pg_trigger t
   where not t.tgisinternal
     and (pg_get_triggerdef(t.oid) ~* 'authorization|x-image-migration-secret'
          or pg_get_triggerdef(t.oid) ~ 'eyJ[A-Za-z0-9_-]+\.eyJ|sb_secret_');
   ```
   It must return `0`. Do not `select pg_get_triggerdef(...)` itself into a chat, issue, PR, or log.

5. **Test by uploading a new event image** in the admin dashboard. Check:
   - Edge Function logs (Supabase Dashboard → Edge Functions → Logs)
   - GitHub Actions run (repository → Actions → Migrate event images to static assets)
   - Confirm `triggered: true` in the function response (`select status_code, content from net._http_response order by id desc limit 5`; responses are kept for about 6 hours)
   - Confirm migration run completed on main
   - Confirm `/images/events/...` URL appears in DB

### House Event Automation

Repeat the setup steps for `house_events`:

1.  **Deploy the Edge Function:**
    ```bash
    supabase functions deploy trigger-house-event-image-migration
    ```
2.  **Set Edge Function secrets** (same as above, but for `trigger-house-event-image-migration`).
3.  **Nothing else to create.** The same migration (step 4 above) adds `request_house_event_image_migration` on `house_events`, which posts to `trigger-house-event-image-migration` with the same Vault secret.

### What does NOT trigger dispatch

The Edge Function only dispatches when:
- Operation is `INSERT` or `UPDATE`
- `image_url` is present and points to Supabase Storage
- `image_url` is different from the previous value (for UPDATE)

It will **not** dispatch for:
- Title, date, location, or description changes
- Empty image URL
- Image already at `/images/...`
- Invalid secret
- DELETE operations

### Manual test payloads

#### Unix (curl)
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/trigger-event-image-migration \
  -H "Content-Type: application/json" \
  -H "x-image-migration-secret: <your-secret>" \
  -d '{
    "type": "INSERT",
    "table": "events",
    "record": {
      "id": "test-event-uuid",
      "name": "Test Event",
      "image_url": "https://abc.supabase.co/storage/v1/object/public/event_images/test.jpg"
    },
    "old_record": null
  }'
```

#### PowerShell
```powershell
$params = @{
    Uri = "https://<project-ref>.supabase.co/functions/v1/trigger-event-image-migration"
    Method = "Post"
    Headers = @{
        "Content-Type" = "application/json"
        "x-image-migration-secret" = "<your-secret>"
    }
    Body = (@{
        type = "INSERT"
        table = "events"
        record = @{
            id = "test-event-uuid"
            name = "Test Event"
            image_url = "https://abc.supabase.co/storage/v1/object/public/event_images/test.jpg"
        }
        old_record = $null
    } | ConvertTo-Json -Depth 10)
}
Invoke-RestMethod @params
```

**Should return `triggered: false` (unchanged URL):**
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/trigger-event-image-migration \
  -H "Content-Type: application/json" \
  -H "x-image-migration-secret: <your-secret>" \
  -d '{
    "type": "UPDATE",
    "table": "events",
    "record": {
      "id": "test-event-uuid",
      "image_url": "https://abc.supabase.co/storage/v1/object/public/event_images/test.jpg"
    },
    "old_record": {
      "image_url": "https://abc.supabase.co/storage/v1/object/public/event_images/test.jpg"
    }
  }'
```

**Should return `401` (wrong secret):**
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/trigger-event-image-migration \
  -H "Content-Type: application/json" \
  -H "x-image-migration-secret: wrong-secret" \
  -d '{"type":"INSERT","record":{"id":"x","image_url":"https://abc.supabase.co/storage/..."}}'
```

### Cautions

- Run the manual workflow dry-run before enabling this automation to verify migration behavior.
- Keep old Supabase files until the migration completes and the Vercel deploy is verified.
- If multiple image edits happen quickly for the same event, the `concurrency` group in the workflow prevents duplicate runs.
- This does not run for non-image event edits (title, date, description, etc.).
- The Edge Function does not process images directly — it only validates and dispatches.
