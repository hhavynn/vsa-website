# Member Photo Requests: Identity/Avatar System with Admin Approval

This document covers the member photo request workflow added in the
`Add member photo and profile system` PR: the audit that shaped it, the data
model, storage/egress design, admin review flow, and privacy/removal behavior.
It implements the avatar portion of "PR D: Media/avatar removal workflow" from
`docs/privacy-data-rights-architecture.md`.

## Pre-existing state (audit summary)

- `user_profiles.avatar_url` and a **public** `avatars` bucket have existed
  since `20240321000000_add_avatar_url.sql`, with *unmoderated* self-serve
  upload from the Profile page (`Avatar.tsx`).
- `20260619000000_emergency_security_hardening.sql` restricted profile reads
  to own-row (+admin), so per-row `<Avatar userId>` lookups on the public
  leaderboard silently failed for everyone except admins.
- `20260619040000_minimize_public_member_exposure.sql` removed auth UUIDs from
  public member views; public identity flows through `members`-based definer
  views keyed by `member_id`.
- Data-rights anonymization (`20260620020000`) nulls `avatar_url` but defers
  storage object deletion to a manual step
  (`docs/data-rights-anonymization-runbook.md`).

## Data model (`20260701000000_add_member_photo_requests.sql`)

### `member_photo_requests`

One row per submission. Key columns: `user_id` (requester, auth UUID),
`matched_member_id` (optional admin-set link to `members`), `submitted_name`,
`submitted_email`, `note_to_admins`, `consent_confirmed` (CHECK-enforced
true), `storage_path_pending` (private bucket, must live under the
requester's own folder), `storage_path_approved` + `approved_avatar_url`
(set at approval), `status` (`pending → approved | rejected`, `approved →
removed`), `admin_notes` (internal), `reviewed_by`, `reviewed_at`.

RLS:

- INSERT: authenticated, own `user_id` only, `status = 'pending'`, consent
  confirmed, review fields empty. A partial unique index allows one pending
  request per account.
- SELECT: admins only (`public.is_admin_user`). Members read their own status
  through the `my_member_photo_requests` definer view, which exposes only
  safe columns (no `admin_notes`, no reviewer identity, no other users' rows).
- No client UPDATE/DELETE. All transitions run through admin-guarded
  `SECURITY DEFINER` RPCs: `approve_member_photo_request`,
  `reject_member_photo_request`, `remove_member_photo_request`.

### `member_photo_request_events`

Append-only audit trail (`submitted | approved | rejected | removed`, actor,
optional note, timestamp). Admin-only SELECT; rows are written by a trigger on
submission and by the review RPCs. Metadata only — never image payloads.

### `public_member_avatars` (view)

The only public read surface: `member_id` + `avatar_url` for **approved**
requests, preferring `matched_member_id` and falling back to the
`members.user_id` linkage, latest approval per member. It exposes no auth
UUIDs, emails, notes, or pending/rejected rows. Granted to `anon` and
`authenticated`.

## Storage & egress design

- **Pending uploads** go to the new **private** `member-photo-requests`
  bucket (5 MB limit, jpeg/png/webp only), under `<auth uid>/<uuid>.<ext>`.
  Members compress client-side first (`avatar` preset, ≤512px WebP — existing
  canvas pipeline in `src/lib/imageUpload.ts`, no new dependencies). Only
  admins can read (signed URLs, 5-minute expiry) or delete these objects.
- **Approved avatars** are re-compressed in the reviewing admin's browser to
  the new `avatarThumbnail` preset (≤256px WebP, typically 5–20 KB) and
  uploaded to the public `avatars` bucket at `approved/<request_id>.webp`
  with `cacheControl: 31536000` (1 year). Originals are never published.
- **Public pages make one bulk query** (`public_member_avatars`) instead of
  the previous per-row `user_profiles` lookups, and thumbnails are
  CDN-cacheable at a stable path. A re-approved photo gets a new request id →
  new path, so caches bust naturally.
- The legacy self-serve write policies on the `avatars` bucket were dropped;
  only admins can write there now. Public SELECT on `avatars` is unchanged so
  existing and approved images keep serving from the CDN.

## Admin workflow (`/admin/photo-requests`)

Admin-gated route (existing `AdminRoute` + `useAdmin` pattern). Admins can:

- list pending/all requests with submitter name/email, note, and timestamps;
- preview the pending photo via a short-lived signed URL;
- see the auto-matched `members` row (via `members.user_id`) or search by
  name to set an explicit match;
- **Approve & Publish** — publishes the 256px thumbnail, then the RPC
  atomically marks the request approved, sets the requester's
  `user_profiles.avatar_url`, and writes an audit event;
- **Reject** with an internal admin-only note (RPC), after which the pending
  object is deleted (best-effort, request-scoped);
- **Remove from public display** for approved photos (see below);
- expand the per-request audit trail.

Approval never touches attendance, points, House membership, check-in, or
import logic.

## Privacy & removal

- `remove_member_photo_request` marks the request `removed`, records an audit
  event, and clears `user_profiles.avatar_url` **only if it still points at
  this request's image**, so removing an old request never blanks a newer
  avatar. The admin UI then deletes this request's published thumbnail and
  pending original — never other buckets or other requests' objects
  (gallery/event photos are untouched).
- CDN caveat: the public thumbnail is cached with a 1-year TTL, so copies may
  be served from CDN edge caches for a period after deletion. For urgent
  requests, purge the asset via the Supabase dashboard or rotate the path.
- Data-rights anonymization already nulls `avatar_url`; with this PR the
  runbook's manual avatar-object deletion step can be completed from
  `/admin/photo-requests` for photos submitted through this workflow. Legacy
  self-uploaded objects in `avatars/<user_id>/…` still require the manual
  cleanup described in `docs/data-rights-anonymization-runbook.md`.
- The unmoderated self-upload path is closed end-to-end: bucket write
  policies are admin-only, and a `user_profiles` trigger
  (`guard_avatar_url_review`) blocks non-admin `avatar_url` changes at the
  database level (server-side jobs with no JWT remain exempt). Existing
  `avatar_url` values were intentionally left untouched; they continue to
  render only on own-profile surfaces (Header, Profile) and never through
  `public_member_avatars`.

## Member-facing flow

The Profile page (auth-gated — existing auth makes this the easy, safe route)
replaces direct upload with **Request profile photo**. The form collects
name, UCSD email, the photo, an optional note to admins, and a required
consent checkbox that states: the photo is reviewed before publishing, an
approved image may appear publicly on the VSA website, removal can be
requested at any time, and photos of others must not be uploaded without
permission. Members see their latest request status (pending / approved /
rejected / removed); internal admin notes are never exposed.

## Applying to production

Nothing in this PR mutates production. To roll out:

1. Apply `supabase/migrations/20260701000000_add_member_photo_requests.sql`
   manually (creates tables, views, bucket, policies, triggers, RPCs).
2. Verify with an ordinary account: pending request objects and rows are not
   readable; submitting works; only one pending request is allowed.
3. Verify with an admin account: preview, approve, reject, remove.
4. Confirm the approved thumbnail appears on `/leaderboard` for the matched
   member and that anon sessions cannot read `member_photo_requests` or the
   pending bucket.
