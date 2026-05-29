# Event Image Migration
Migrates event and House event images from Supabase Storage to repo-hosted `/public/images/events/` and `/public/images/house-events/` files so Vercel serves them as static assets.

## Why two steps?

**Admin uploads still go to Supabase first.** The browser cannot write directly into the Vercel `/public` directory — those files must live in the repo and be deployed through Vercel's build pipeline. So the flow is:

1. Admin uploads → Supabase Storage (immediate, no deploy needed)
2. Migration workflow → downloads those images, optimizes them, writes to `public/images/events/` or `public/images/house-events/`, commits, and pushes to `main`
3. Vercel redeploys `main` → image is now served from `/images/events/...` or `/images/house-events/...`
4. DB row is updated to point at the local path instead of the Supabase URL

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

The workflow will print what it *would* download, compress, and update — but make no changes.

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

Apply mode must run from the `main` branch. This is enforced by the workflow. Updating the DB to `/images/events/...` before those files are deployed on `main` would temporarily serve broken images in production.

Recommended process:

1. Run dry run → review printed output
2. Go to **Actions → Migrate event images to static assets → Run workflow**
3. Set `apply` to `true`
4. Set `event_id` if migrating a single event
5. Click **Run workflow** (must be run from `main`)
6. Wait for the workflow to finish — it commits new WebP files and pushes to `main`
7. Wait for Vercel to redeploy (usually 1–3 minutes)
8. Visit `/events` and verify images load from `/images/events/...` URLs

To run apply locally (bypasses branch guard with `--force-apply`):

```bash
# Apply all events locally — requires SUPABASE_SERVICE_ROLE_KEY in .env.local
npm run migrate:images:apply -- --category events --force-apply

# Single event
npm run migrate:images:apply -- --category events --event-id <uuid> --force-apply
```

## Script flags

| Flag | Description |
|---|---|
| `--apply` | Execute writes and DB updates (default: dry run) |
| `--category events` | Restrict to events table (script supports other categories too) |
| `--event-id <uuid>` | Migrate a single event row |
| `--limit <n>` | Max rows to process |
| `--overwrite` | Re-download even if a local file already exists |
| `--force-apply` | Override the branch guard (use carefully) |

## Image output

Images are saved as WebP at up to 1200×1200 px, quality 80. Filenames use the event name slug and date:

```
public/images/events/<event-name>_<date>.webp
public/images/events/<event-name>_<date>_thumb.webp
```

The DB field `image_url` (and `thumbnail_url`) is updated to `/images/events/<filename>.webp`.

## Why old Supabase files are not deleted

Old Supabase Storage files are intentionally kept after migration. Deleting them immediately would break any cached CDN responses or browser caches still pointing at the old URL. If you want to clean up old Supabase files, do so manually after confirming that all DB rows have been updated and sufficient time has passed for caches to expire.

## Supabase egress reduction

Once the DB `image_url` fields are updated to `/images/events/...`, the Supabase CDN stops serving those images. Vercel's edge network serves them instead — from the repo's static asset tree — without counting against Supabase egress.

## Relationship to the daily migration workflow

A separate `migrate-images.yml` workflow runs daily and applies all categories automatically. This `migrate-event-images.yml` workflow is for on-demand, targeted event migrations with dry-run safety built in. If you run both, the daily workflow will skip already-migrated images (local paths are not re-downloaded).

---

## Phase 3: Automatic trigger from Supabase

When Phase 3 is enabled, uploading or changing an event image in the admin dashboard automatically triggers the migration — no manual workflow run needed.

### How it works

```
Admin uploads event image
  → image lands in Supabase Storage
  → DB row updated (image_url = Supabase Storage URL)
  → Supabase Database Webhook fires
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
| `IMAGE_MIGRATION_WEBHOOK_SECRET` | Shared secret between the DB webhook and the Edge Function |
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

4. **Create Database Webhook** (Supabase Dashboard → Database → Webhooks → Create new webhook):
   - Name: `event-image-migration`
   - Table: `events`
   - Events: **INSERT**, **UPDATE**
   - Method: `POST`
   - URL: your Edge Function endpoint
     ```
     https://<project-ref>.supabase.co/functions/v1/trigger-event-image-migration
     ```
   - Headers:
     ```
     x-image-migration-secret: <same value as IMAGE_MIGRATION_WEBHOOK_SECRET>
     ```

5. **Test by uploading a new event image** in the admin dashboard. Check:
   - Edge Function logs (Supabase Dashboard → Edge Functions → Logs)
   - GitHub Actions run (repository → Actions → Migrate event images to static assets)
   - Confirm `triggered: true` in function response
   - Confirm migration run completed on main
   - Confirm `/images/events/...` URL appears in DB

### House Event Automation

Repeat the setup steps for `house_events`:

1.  **Deploy the Edge Function:**
    ```bash
    supabase functions deploy trigger-house-event-image-migration
    ```
2.  **Set Edge Function secrets** (same as above, but for `trigger-house-event-image-migration`).
3.  **Create Database Webhook**:
    - Name: `house-event-image-migration`
    - Table: `house_events`
    - Events: **INSERT**, **UPDATE**
    - Method: `POST`
    - URL: `https://<project-ref>.supabase.co/functions/v1/trigger-house-event-image-migration`
    - Headers: `x-image-migration-secret: <your-secret>`

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

Use these curl examples to test the Edge Function without uploading real images:

**Should return `triggered: true`:**
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
