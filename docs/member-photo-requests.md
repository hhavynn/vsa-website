# Member Photo Requests: Identity/Avatar System with Admin Approval

This document covers the member photo request workflow: the audit that shaped it, the data model, storage/egress design, admin review flow, and privacy/removal behavior.
It implements the avatar portion of "PR D: Media/avatar removal workflow" from `docs/privacy-data-rights-architecture.md`.

## Pre-existing state (audit summary)

- `user_profiles.avatar_url` and a **public** `avatars` bucket have existed since `20240321000000_add_avatar_url.sql`, with *unmoderated* self-serve upload from the Profile page (`Avatar.tsx`).
- `20260619000000_emergency_security_hardening.sql` restricted profile reads to own-row (+admin), so per-row `<Avatar userId>` lookups on the public leaderboard silently failed for everyone except admins.
- `20260619040000_minimize_public_member_exposure.sql` removed auth UUIDs from public member views; public identity flows through `members`-based definer views keyed by `member_id`.
- Data-rights anonymization (`20260620020000`) nulls `avatar_url` but defers storage object deletion to a manual step (`docs/data-rights-anonymization-runbook.md`).

## Critical Product Rule: No Member Login

The VSA website has **no general member login**. Login is reserved strictly for admins. Public visitors submit photo requests anonymously from the public leaderboard.

## Data model (`20260701000000_add_member_photo_requests.sql`)

### `member_photo_requests`

One row per submission. Key columns:
- `user_id` (optional, references `auth.users.id` on delete cascade; null for public/anonymous submissions).
- `matched_member_id` (required, links to `members.id`).
- `submitted_name` (requester name).
- `submitted_email` (requester UCSD email).
- `note_to_admins` (optional).
- `consent_confirmed` (CHECK-enforced true).
- `storage_path_pending` (private bucket, starts with `pending/`).
- `storage_path_approved` + `approved_avatar_url` (set at approval).
- `status` (`pending` -> `approved` | `rejected`, `approved` -> `removed`).
- `admin_notes` (internal).
- `reviewed_by`.
- `reviewed_at`.

RLS:
- **INSERT**: `anon` and `authenticated` roles can insert under strict checks:
  - `status = 'pending'`
  - `consent_confirmed = true`
  - `matched_member_id` is set
  - All review, approved, and rejected fields are null
  - If logged in, `user_id` matches `auth.uid()`; if logged out, `user_id` is null.
- **SELECT**: Admins only (`public.is_admin_user`).
- **UPDATE/DELETE**: No client policies. Every transition runs through admin-guarded `SECURITY DEFINER` RPCs: `approve_member_photo_request`, `reject_member_photo_request`, `remove_member_photo_request`.

### `member_photo_request_events`

Append-only audit trail (`submitted | approved | rejected | removed`, actor, optional note, timestamp). Admin-only SELECT; rows are written by a trigger on submission and by the review RPCs. Metadata only — never image payloads.

### `public_member_avatars` (view)

The only public read surface: `member_id` + `avatar_url` for **approved** requests, preferring `matched_member_id` and falling back to the `members.user_id` linkage, latest approval per member. It exposes no auth UUIDs, emails, notes, or pending/rejected rows. Granted to `anon` and `authenticated`.

## Storage & egress design

- **Pending uploads** go to the new **private** `member-photo-requests` bucket (5 MB limit, jpeg/png/webp only), under `pending/<uuid>.<ext>`. Clients compress image client-side first (`avatar` preset, ≤512px WebP). Only admins can read (signed URLs, 5-minute expiry) or delete these objects.
- **Approved avatars** are re-compressed in the reviewing admin's browser to the new `avatarThumbnail` preset (≤256px WebP, typically 5–20 KB) and uploaded to the public `avatars` bucket at `approved/<request_id>.webp` with `cacheControl: 31536000` (1 year). Originals are never published.
- **Public pages make one bulk query** (`public_member_avatars`) instead of the previous per-row `user_profiles` lookups, and thumbnails are CDN-cacheable at a stable path.
- The legacy self-serve write policies on the `avatars` bucket were dropped; only admins can write there now. Public SELECT on `avatars` is unchanged so existing and approved images keep serving from the CDN.

### Storage Abuse & Cleanup Considerations
Since any public visitor can upload files to the `pending/` directory of the `member-photo-requests` bucket to submit a photo request:
1. **Private Bucket**: The `member-photo-requests` bucket is completely private. Anonymous users have no read, update, or delete access to it. They can only perform `INSERT`.
2. **Database Rate Limits**: Enforced via a `BEFORE INSERT` trigger on the database (`guard_member_photo_request_rate_limit`):
   - **Max 3 pending requests per matched member**: Prevents spamming requests for a single individual.
   - **Max 5 pending requests per normalized requester email**: Prevents a single email address from flooding the admin inbox with requests.
   - Triggers throw a generic database error message on violation to avoid leaking email/member details.
3. **Honeypot Field**: The public form contains a visually hidden honeypot text field (`middle_name`) styled off-screen. Real users cannot see or focus/tab into it, but spam bots will fill it. If filled, the client UI silently drops the submission (exhibiting success behavior on-screen but performing no uploads or database writes).
4. **Stale Uploads Cleanup**: A utility script is available at `scripts/cleanup-stale-photo-requests.mjs` to automatically clean up orphaned pending uploads (stale objects older than 7 days that do not have an active pending database row).
   - Run in Dry-Run mode: `node scripts/cleanup-stale-photo-requests.mjs`
   - Run actual cleanup: `CONFIRM_DELETE=true node scripts/cleanup-stale-photo-requests.mjs`
   - *Future option:* Set up a scheduled cron pipeline to run this script periodically.
5. **Egress & Cloudflare Note**: If spam persists, a future mitigation is adding a Cloudflare page rule to rate limit `/storage/v1/object/member-photo-requests/` API path. Since Supabase storage is routed directly to the database API endpoint, Cloudflare is deferred until actual abuse is observed.

## Admin workflow (`/admin/photo-requests`)

Admin-gated route (existing `AdminRoute` + `useAdmin` pattern). Admins can:
- list pending/all requests with submitter name/email, note, and timestamps;
- preview the pending photo via a short-lived signed URL;
- see the matched `members` row or search by name to override or set the match;
- **Approve & Publish** — publishes the 256px thumbnail, then the RPC atomically marks the request approved, sets `user_profiles.avatar_url` (if `user_id` is linked), and writes an audit event;
- **Reject** with an internal admin-only note (RPC), after which the pending object is deleted;
- **Remove from public display** for approved photos (see below);
- expand the per-request audit trail.

Approval never touches attendance, points, House membership, check-in, or import logic.

## Privacy & removal

- `remove_member_photo_request` marks the request `removed`, records an audit event, and clears `user_profiles.avatar_url` **only if it still points at this request's image**. The admin UI then deletes this request's published thumbnail and pending original — never other buckets or other requests' objects.
- CDN caveat: the public thumbnail is cached with a 1-year TTL, so edge caches may serve it for a period. Purge manually if needed.
- Legacy self-uploaded objects in `avatars/<user_id>/…` still require the manual cleanup described in `docs/data-rights-anonymization-runbook.md`.

## Member-facing flow

Public visitors open `/leaderboard`, search/click their member row, and open the public-safe member profile modal. If no avatar exists, they see initials. Clicking **Request photo** or **Update photo** opens the anonymous submission form, which collects:
- Submitter name
- UCSD email
- Image file
- Optional note to admins
- Required consent checkbox stating that the photo is moderated, will be displayed publicly on approval, can be removed, and that upload of others' photos is prohibited.

Upon submission, the photo is uploaded to `pending/`, and the request row is inserted with the target `matched_member_id` pre-filled.

## Applying to production

Nothing in this PR mutates production. To roll out:
1. Apply `supabase/migrations/20260701000000_add_member_photo_requests.sql` manually.
2. Verify with an anonymous session: submitting works, pending request rows and storage files are not readable.
3. Verify with an admin account: preview, approve, reject, remove.
4. Confirm approved thumbnail appears publicly on `/leaderboard` for the matched member.
