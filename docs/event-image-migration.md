# Event Image Migration

Migrates event images from Supabase Storage to repo-hosted `/public/images/events/` files so Vercel serves them as static assets.

## Why two steps?

**Admin uploads still go to Supabase first.** The browser cannot write directly into the Vercel `/public` directory — those files must live in the repo and be deployed through Vercel's build pipeline. So the flow is:

1. Admin uploads → Supabase Storage (immediate, no deploy needed)
2. Migration workflow → downloads those images, optimizes them, writes to `public/images/events/`, commits, and pushes to `main`
3. Vercel redeploys `main` → image is now served from `/images/events/...`
4. DB row is updated to point at `/images/events/...` instead of the Supabase URL

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
