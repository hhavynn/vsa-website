# Storage Egress Audit

Last updated: 2026-10-02

How to find public content that is still served from Supabase Storage, and what to configure outside the repo so a quota problem is noticed before it is an outage. Issues #299 / #303.

This doc does **not** migrate anything, delete anything, or change upload behavior. The audit script only runs `select` queries. Supabase Storage originals are never deleted (settled: see `vsa-failure-archaeology` §1, `AGENTS.md` "Things to never do"). The migration pipeline itself is documented in `docs/event-image-migration.md` and `docs/house-image-migration.md`. For bucket sizes and orphan candidates run `docs/supabase-usage-audit.sql` in the Supabase SQL editor; this doc does not duplicate it.

Egress = bytes served out of Supabase and billed. Storage, database responses, Auth, Edge Functions and Realtime all count toward one unified quota (Supabase docs, "Manage Egress usage").

## What still contributes to egress

| Source | Why it is still on Supabase | Size of the problem |
|---|---|---|
| Rows whose URL column still holds a `supabase.co/storage/v1/object/public/...` URL | Admin uploads land in Storage first; the file reaches `public/images/` only after the migrate workflow commits it and the relink step rewrites the row. A row stuck in between serves from Storage on every view. | Whatever `npm run audit:storage-content` lists. |
| Full-size file where a thumbnail would do | Current card lists already render `thumbnail_url` first (events, gallery covers, House, cabinet avatars) and go through `OptimizedImage`; keep new lists thumbnail-first (`docs/image-delivery.md`). The remaining cost is rows that have **no** thumbnail (older uploads): they serve the full 1200px file into a ~330px slot. | See "Local measurement" below: 104 committed full-size WebPs (8.48 MB) have no `_thumb` sibling. Generating thumbnails for them is open follow-up work. |
| Image columns the migration pipeline does not cover | The pipeline handles six categories only (`cabinet_members`, `events`, `gallery_events` cover, `house_page_assets`, `homepage_content`, `house_events`). Site logo, ACE family covers/photos, UVSA school logos and flyers, VCN posters, intern photos, avatars stay on Storage by design. | Mostly small (logos are <=512px WebP, avatars are 256px thumbnails, 5-20 KB, cached one year) but they are listed by the audit so growth is visible. |
| Avatars | Approved member photos are 256px WebP thumbnails in the public `avatars` bucket (`approved/<request id>.webp`). Pending uploads sit in the private `member-photo-requests` bucket and are read only by admins through 5-minute signed URLs (`docs/member-photo-requests.md`). | Low per view, high view count on the leaderboard and ACE tree: one bulk `public_member_avatars` query, thumbnails are CDN-cacheable. |
| Admin previews | Admin screens render whatever URL the row holds, so a row still on Storage is downloaded from Storage in the editor too. | Small audience; not a priority. |
| Supabase image transforms (`/storage/v1/render/image/...`) | Only produced when `REACT_APP_SUPABASE_IMAGE_TRANSFORMS=true` (off by default, paid-plan feature). The audit classifies these URLs as Storage-backed. | Zero while the flag is off. |
| Non-image egress | Database responses and Edge Functions count toward the same quota. The 2026-05 crisis had a query-refetch driver as well as an image driver. | Out of scope here; see `docs/supabase-log-ingestion-audit.md` and `vsa-failure-archaeology` §1. |

### What is not Supabase egress

Files under `public/images/**` referenced as `/images/...` are static assets served by Vercel's CDN. They never touch Supabase, so they do not appear in the audit's Storage counts. They still use Vercel bandwidth (Fast Data Transfer), so oversized committed files are a Vercel cost, not a Supabase one. Also not egress: files that exist in `public/images/` but that no page references.

## Run the audit

Prerequisites: `.env.local` with `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` (same file the migrate script reads).

```bash
npm run audit:storage-content                          # read-only scan, prints tables
npm run audit:storage-content -- --json scripts/reports/storage-audit.json
npm run audit:storage-content -- --fail-on-remaining   # exit 1 if any Storage URL remains, 2 if a table was unreadable
npm run audit:storage-content -- --service-role        # optional: raw tables (drafts, admin-only rows)
npm run audit:storage-content -- --local-assets        # offline: no env, no network
```

`scripts/reports/` is gitignored; put JSON output there. Default exit code is 0.

By default the audit reads as the anon key, so it sees exactly what a visitor sees (for example `published_house_page_assets`, not the admin-only raw table). `--service-role` needs `SUPABASE_SERVICE_ROLE_KEY` and is only needed for rows RLS hides (`user_profiles.avatar_url`, `member_photo_requests.approved_avatar_url`, draft rows). It still issues only selects.

### Reading the output

1. **Summary line**: counts of non-empty URLs by class: `local` (root-relative, Vercel), `supabase-storage`, `external` (other hosts), `other` (data URIs, bare relative paths).
2. **Table**: one row per `table.column` and class. The goal state for every migrated category is no `supabase-storage` rows.
3. **By bucket**: Storage URLs per bucket. Compare with section 1 of `docs/supabase-usage-audit.sql` to see which bucket actually holds the bytes.
4. **Storage-backed rows**: row id, column, bucket, URL (query strings stripped, so signed-URL tokens are never printed), and whether a committed file exists at the name the migrate script would choose (`scripts/lib/imageMigrationConfig.ts`).
   - `yes: public/images/...`: the file is already in the repo; the row only needs the relink step.
   - `no`: needs a migration run first. `no (hashed variant exists ...)` means the script already saved the image under a content-addressed name because the plain name was taken by a different picture.
   - `n/a (no migration category)`: the pipeline does not handle this column. Not a bug; decide whether it matters by bucket and size.
5. **Warnings**: a table that could not be read (missing view, RLS) makes the audit incomplete. Fix that before trusting a "zero remaining" result.

### Expected vs abnormal

| Observation | Meaning |
|---|---|
| A few `events` / `house_events` / `cabinet_members` rows on Storage right after an admin upload | Normal: the staging window before the migrate workflow runs and relinks. |
| The same row still on Storage after the next successful migrate + relink run | Abnormal. Check the run's relink report; a stale admin save can restore a Storage URL (#436), and the row is retried next run. |
| `supabase-storage` rows in categories with a migration pipeline that never shrink | Abnormal. The workflow is failing or not being triggered. |
| `supabase-storage` rows in `site_settings`, `ace_*`, `uvsa_schools`, `vcn_archives`, `intern_cohort_members`, `public_member_avatars` | Expected by design; watch the count and object size, not the existence. |
| `external` hosts | Expected for at least VCN posters (the migrate script skips them on purpose). They cost Supabase nothing; review the host list for anything unexpected. |
| A `render` access Storage URL | Abnormal unless transforms were deliberately enabled. |
| Supabase usage chart shows Storage egress high while the audit shows zero public Storage rows | The bytes are coming from somewhere the audit does not scan (a new image column, a URL embedded in rich text, direct bucket links). Add the column to `AUDIT_TARGETS` in `src/lib/storageContentAudit.ts` and re-run. |

Limits of the audit: it reads URL columns only. It does not look inside rich-text or JSON fields, and it does not prove a page renders a given column. A new image-bearing column is invisible until it is added to `AUDIT_TARGETS` (a Jest test checks the listed columns exist in `src/types/database.ts` and that every migration category is covered).

## Local measurement (offline)

`npm run audit:storage-content -- --local-assets` walks `public/images` and reports bytes per category dir, the 15 largest files, and, for every `X.webp` with a sibling `X_thumb.webp`, full vs thumbnail totals. No network, no credentials.

Snapshot on branch `feat/image-delivery-egress-consolidation`, 2026-10-02 (258 files, 43.25 MB total):

| Category dir | Files | Size |
|---|---|---|
| `cabinet` | 59 | 27.20 MB |
| `events` | 57 | 6.22 MB |
| `house-events` | 64 | 3.91 MB |
| `2024events` | 3 | 1.88 MB |
| `gallery` | 18 | 1.65 MB |
| (root) | 4 | 1.48 MB |
| `houses` | 43 | 792 KB |
| `ace` | 8 | 83 KB |
| `home` | 2 | 52 KB |

The largest files are legacy PNGs in `cabinet/` (up to 5.47 MB, `kirsten_ngo.png`) and `vsa-logo.png` (1.29 MB); these are Vercel bandwidth, not Supabase egress, and only cost anything if a page references them.

Thumbnails: 62 `X.webp` / `X_thumb.webp` pairs, 3.91 MB as full files vs 1.84 MB as thumbs, so a thumbnail-first card list saves 2.07 MB (52.9%) per full pass over those images. A further 104 full-size WebP files (8.48 MB) have no `_thumb` sibling, so there is nothing smaller to offer for them. By category: `house-events` 32 pairs (2.77 MB vs 1.33 MB), `events` 10 (0.70 MB vs 0.38 MB), `houses` 19 (0.59 MB vs 0.20 MB), `gallery` 1.

This is a measurement of bytes on disk, not of traffic. Real savings scale with page views.

## External configuration required

Nothing below can be set from the repo. Someone with the right role has to do it in each dashboard and write the owner and date in the table. Setting names below are from the Supabase and Vercel docs as read on 2026-10-02; the dashboards change, so confirm the label when you get there.

Which plan each account is on determines what is available. Confirm it first and record it here; this repo does not state it.

| # | Item | Where | Notes (from the docs) | Owner | Done |
|---|---|---|---|---|---|
| 1 | Confirm the Supabase plan | Organization billing page (`supabase.com/dashboard/org/_/billing`) | Egress quota is 5 GB uncached + 5 GB cached on Free, 250 GB + 250 GB on Pro/Team. | TBD | [ ] |
| 2 | Decide the Spend Cap | Billing page, **Cost Control** section (Pro only) | On: egress over quota is blocked until the next billing cycle, not billed, and the site's Supabase-backed content can stop loading. Off: overage is billed ($0.09/GB uncached, $0.03/GB cached). The Spend Cap does **not** support per-item budgets or notifications at a cost amount (stated in the docs). Choose on purpose and record the choice. | TBD | [ ] |
| 3 | Make sure the billing email is monitored | Organization settings (confirm exact page in the dashboard) | Supabase emails the billing address when quota is exceeded on Free, or on Pro with the Spend Cap on, and starts a grace period before Fair Use restrictions (402 responses). That email is the only automatic warning the docs describe. Whether an earlier, percentage-based warning exists must be confirmed in the dashboard. | TBD | [ ] |
| 4 | Check usage on a schedule | Organization **Usage** page (`supabase.com/dashboard/org/_/usage`): Total Egress chart with per-service breakdown, plus cached egress | There is no repo-side alert. Put a recurring reminder (for example weekly, and after any release that uploads or lists images) on the owner's calendar. Storage egress dominating the chart while the audit shows public Storage rows is the classic signature. | TBD | [ ] |
| 5 | Optional: egress custom report | Project **Observability** page, **New custom report**, add blocks for the services | Documented way to chart egress per service for one project. | TBD | [ ] |
| 6 | Vercel: Spend Management | Team **Settings > Billing > Spend Management** (Pro, or Enterprise on Flexible Commitment; Owner or Billing role) | Set the On-Demand Budget. Notifications go out at 50%, 75% and 100% of it. **Pause Production Deployments** is a separate switch that takes the whole site down (503) at the budget; leave it off unless an outage is preferable to a bill. Checks run every few minutes, not continuously. Not available on Hobby. | TBD | [ ] |
| 7 | Vercel: usage notifications | **Settings > My Notifications**, Team section: "Usage increased", "Usage limit reached" (Pro owners can customize usage categories by percentage or dollar amount) | Per-user setting: each Owner/Billing member sets their own. | TBD | [ ] |
| 8 | Vercel: Usage Anomaly alerts | Vercel **Alerts** (docs: requires Observability Plus on Pro, or Enterprise; confirm where it appears in the project UI) | Fires when 5-minute usage is more than 4 standard deviations above the 24-hour average. Useful for a sudden bandwidth spike; not a budget. | TBD | [ ] |
| 9 | Vercel bandwidth | Team **Usage** page, **Fast Data Transfer** chart | Where Vercel-served `/images/...` bytes show up. | TBD | [ ] |

If the plan does not support an item, write "not available on <plan>" in the Owner column instead of leaving it blank.

## Related

- `docs/supabase-usage-audit.sql`: bucket sizes, largest objects, duplicate ETags, referenced vs orphaned objects (SQL editor; review only).
- `docs/event-image-migration.md`, `docs/house-image-migration.md`: how rows leave Storage.
- `docs/supabase-log-ingestion-audit.md`: the separate log-ingestion quota.
- `src/lib/storageContentAudit.ts`: the audited column list and the pure classify/summarize code.
