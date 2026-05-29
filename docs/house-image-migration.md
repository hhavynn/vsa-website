# House Profile Image Migration

Migrates House profile images and House Parent graphics from Supabase Storage to repo-hosted `/public/images/houses/` files so Vercel serves them as static assets. This reduces Supabase cached egress.

## Workflow

1.  **Admin Upload**: Admin uploads House logos or parent graphics in the Admin Houses dashboard. These land in the `house_images` Supabase Storage bucket immediately.
2.  **Migration**: The migration script downloads these images, optimizes them (WebP), and saves them to the repo under `public/images/houses/`.
3.  **Deployment**: Once committed and pushed to `main`, Vercel deploys the new static assets.
4.  **DB Update**: The database is updated to point at the local path (e.g., `/images/houses/2025_bowser.webp`).

## Manual Migration

You can run the migration manually using npm scripts.

### 1. Dry Run (Safe)

Always run a dry run first to see what will be migrated.

```bash
# Preview all house asset migrations
npm run migrate:house-assets:dry
```

### 2. Apply Migration

Requires `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local` for database write access.

**Note**: Apply mode should generally be run on the `main` branch to avoid serving broken images before they are deployed.

```bash
# Apply migrations locally (bypasses branch guard)
npm run migrate:house-assets:apply -- --force-apply
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
| `--apply` | Execute writes and DB updates (default: dry run) |
| `--limit <n>` | Max rows to process |
| `--overwrite` | Re-download even if a local file already exists |
| `--force-apply` | Override the branch guard (use carefully) |

## Required Environment Variables

Ensure these are in your `.env.local`:

```env
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## GitHub Actions

A daily workflow `migrate-images.yml` automatically scans and applies migrations for all categories, including houses. You can also trigger a manual run via the GitHub Actions tab.
