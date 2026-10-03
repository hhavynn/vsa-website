# House Profile Image Migration

Migrates House profile images and House Parent graphics from Supabase Storage to repo-hosted `/public/images/houses/` files so Vercel serves them as static assets. This reduces Supabase cached egress.

## Workflow

1.  **Admin Upload**: Admin uploads House logos or parent graphics in the Admin Houses dashboard. These land in the `house_images` Supabase Storage bucket immediately.
2.  **Migration (phase 1)**: The migration script downloads these images, optimizes them (WebP), saves them to the repo under `public/images/houses/`, and writes a relink plan. It does not touch the database.
3.  **Deployment**: Once committed and pushed to `main`, Vercel deploys the new static assets.
4.  **DB Update (phase 2)**: Only after production is confirmed to serve each file, the database is updated to point at the local path (e.g., `/images/houses/2025_bowser.webp`). If the push or deploy fails, rows keep their working Storage URL. Details: [event-image-migration.md](event-image-migration.md#why-the-db-is-updated-last-454).

## Manual Migration

You can run the migration manually using npm scripts.

### 1. Dry Run (Safe)

Always run a dry run first to see what will be migrated.

```bash
# Preview all house asset migrations
npm run migrate:house-assets:dry
```

### 2. Apply Migration

Apply writes files and a relink plan only; it never modifies the database, so it is safe to run from any branch.

```bash
# Phase 1: files + plan (scripts/reports/image-relink-plan.json)
npm run migrate:house-assets:apply

# Commit + push public/images/houses/, wait for the Vercel deploy, then phase 2.
# Needs SUPABASE_SERVICE_ROLE_KEY in .env.local; --verify-only checks without writing.
npm run migrate:images:relink -- --relink scripts/reports/image-relink-plan.json \
  --base-url https://www.vsaatucsd.com
```

## Storage Structure

Migrated files are stored as follows:

-   **House Logos**: `public/images/houses/<year>_<house-slug>.webp`
-   **Thumbnails**: `public/images/houses/<year>_<house-slug>_thumb.webp`
-   **Parent Graphics**: `public/images/houses/<year>_<house-slug>_parent.webp`
-   **Cover Images**: `public/images/houses/<year>_<house-slug>_cover.webp`

## Script Flags

| Flag | Description |
|---|---|
| `--apply` | Write files and a relink plan (default: dry run); no DB writes |
| `--relink <plan>` | Phase 2: verify assets on production, then relink rows (needs `--base-url`) |
| `--limit <n>` | Max rows to process |
| `--overwrite` | Re-download even if a local file already exists |
| `--force-apply` | With `--relink`: override the CI main-branch guard (use carefully) |

## Required Environment Variables

Ensure these are in your `.env.local`:

```env
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## GitHub Actions

A daily workflow `migrate-images.yml` automatically runs both phases for all categories, including houses. You can also trigger a manual run via the GitHub Actions tab.
