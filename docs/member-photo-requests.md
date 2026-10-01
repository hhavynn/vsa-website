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

RLS (after `20261001000200_authorize_member_photo_uploads.sql`):
- **INSERT**: Browser roles have no direct INSERT grant. The service-only `reserve_member_photo_upload` RPC creates the pending, consented row atomically with the quota reservation.
- **SELECT**: Admins only (`public.is_admin_user`).
- **UPDATE/DELETE**: No client policies. Every transition runs through admin-guarded review RPCs.

### Upload broker and capacity budget (October 2026 hardening)

Public visitors invoke `member-photo-upload` with metadata only. The broker validates a member UUID, UCSD email, consent, JPEG/PNG/WebP MIME, a positive size up to 5 MiB, and bounded names/notes/body. It derives a SHA-256 HMAC identity using the server-only service-role key and a domain-separated IP input. Raw IPs are never persisted or logged. `cf-connecting-ip` is best effort; absent/invalid headers share one identity. Header provenance is not an authorization boundary: the global and lifetime budgets remain effective if an attacker varies an IP header.

`reserve_member_photo_upload(text, uuid, text, text, text, text, integer)` is service-role-only, SECURITY DEFINER with an empty search path and an internal service-role guard. A transaction advisory lock serializes the pending/member and pending/email trigger checks with all public reservations. Admission ceilings are 5 per IP identity / rolling 24 hours, 100 global / rolling 24 hours, and 1000 lifetime reservations. Existing pending limits remain 3 per member and 5 per submitted email. The request and reservation commit before signing. Signing/upload failures consume budget and can leave an empty pending request; an admin preview then fails and the request can be rejected through the existing workflow.

The Edge Function returns a signed upload capability for exactly one server-generated `pending/<request UUID>.<extension>` path with `upsert:false`. The frontend calls `uploadToSignedUrl`; it never uploads anonymously through `.upload()` or inserts a request row. Tokens expire after two hours and cannot overwrite an existing object. The private bucket's 5 MiB/MIME constraints remain the server payload ceiling. The client-reported size is validated but the token does not bind the actual payload size, so capacity accounting reserves the full 5 MiB per token. Signed upload mechanics: [Supabase createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [uploadToSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl).

The lifetime ceiling deliberately bounds newly authorized public originals to approximately 5 GiB, including abandoned uploads and retained/superseded originals. Reviewed requests do not release this budget. This does not bound pre-existing objects or admin uploads. Once 1000 reservations are reached, an owner must review actual bucket capacity and retention needs before increasing the limit through another reviewed migration. Do not automatically delete objects or reset counters. Auth key rotation changes per-IP identities; global/lifetime accounting is unaffected.

Direct browser INSERT into the private bucket is now admin-only, preserving Admin → Members publishing. Public pending objects remain unreadable, avatar publication remains admin-only, and service-role keys never leave the Edge Function.

### Deployment order and verification

Apply `20261001000100_restrict_raw_member_reads.sql` and `20261001000200_authorize_member_photo_uploads.sql` manually, then deploy `member-photo-upload` with `supabase functions deploy member-photo-upload --no-verify-jwt`, then deploy the frontend. The endpoint intentionally accepts anonymous metadata and owns validation/quota enforcement. It uses only standard Supabase `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; no new provider or secret is needed. This change is not active until those manual deployments occur. During the interval between migration and broker/frontend deployment, public submissions fail closed.

For rollback, keep restrictive policies and grants: restore service availability by fixing/redeploying the broker. Do not restore anonymous Storage INSERT.

Local verification: `deno test supabase/functions/member-photo-upload/handler.test.ts`; targeted Jest photo submission/admin publishing tests; disposable Postgres role/RLS/quota/concurrency tests. The read-only default of `scripts/verify-rls-security.mjs` checks public projection access, raw-table counts for ordinary accounts, and admin grants. Write probes require `RLS_ALLOW_MUTATION_TESTS=true` and belong in an owner-approved local/staging environment. A staging end-to-end check must prove direct anonymous Storage INSERT is rejected, signed upload succeeds once, replay cannot overwrite, bucket oversize/MIME rejects, pending preview is admin-only, and public avatars stay approval-only. No live upload or account creation is needed for the local checks.

### Why a submission is refused, and what the visitor sees

`supabase.functions.invoke` reports every non-2xx reply as a generic "Edge Function returned a non-2xx status code" error and leaves the broker's explanation in the response body. `photoRequestsRepository` reads that body (`explainBrokerError`) and throws it as a `ValidationError`, so the form shows the broker's own sentence. The broker sends a distinct, visitor-safe message per cause: bad member, missing name, non-`@ucsd.edu` email, missing consent, unsupported type, over 5 MB, over the per-member/per-email pending limit, and the per-IP/global/lifetime budget (both limit kinds arrive as `P0001` and pass the database's own text through). Network failures and failed signed uploads are translated too. A new message is never needed for the client to behave: unknown bodies fall back to "photo upload service is unavailable".

`PhotoRequestSection` mirrors the broker's rules before calling it (name, `@ucsd.edu` email, JPEG/PNG/WebP, 5 MB, consent), so most mistakes are caught beside the field. Keep the two in sync: if the broker's accepted email domain or size limit changes, change `MemberPhotoRequestFormSchema` and `checkPhoto` together with it. The new broker messages take effect only after `supabase functions deploy member-photo-upload --no-verify-jwt`.

### `member_photo_request_events`

Append-only audit trail (`submitted | approved | rejected | removed`, actor, optional note, timestamp). Admin-only SELECT; rows are written by a trigger on submission and by the review RPCs. Metadata only — never image payloads.

### `public_member_avatars` (view)

The only public read surface: `member_id` + `avatar_url` for **approved** requests, preferring `matched_member_id` and falling back to the `members.user_id` linkage, latest approval per member. It exposes no auth UUIDs, emails, notes, or pending/rejected rows. Granted to `anon` and `authenticated`.

### Cross-page member links (`20260929071851_link_ace_cabinet_members_to_members.sql`)

One approved photo shows everywhere a person appears publicly. `public_member_avatars` (keyed by `members.id`) is the single source of truth; other surfaces point at it:

- `ace_family_members.member_id` and `cabinet_members.member_id` are nullable links to `members.id` (`on delete set null`). `published_ace_family_members` exposes `member_id`.
- For a linked person, the approved avatar wins over ACE `photo_url` and Cabinet `image_url`/`thumbnail_url`. Unlinked and historical people keep their local photo, then initials (`resolveMemberPhoto` in `src/lib/memberPhotos.ts`).
- Every surface reads avatars through one cached React Query hook, `useMemberAvatars` (a single bulk `public_member_avatars` query, never per person): Leaderboard (all years), Find My Points, House member rows, ACE tree nodes, ACE fam-head cards, Cabinet, and Internship intern cards. Admin approve/remove invalidates it.
- On an ACE tree, selecting a linked node opens the same `PhotoRequestSection` flow as the Leaderboard, pre-matched to that `members.id`. Unlinked nodes say an admin must link the name first.
- The backfill was conservative and covers 2025–26 onward only. It links a name only when it matches exactly one `members` row with 2025–26+ attendance. ACE names must also be unique across all trees, outside graveyard fams, and either sit in the fam's latest three generations or have a current-member Big/Little. Cabinet is limited to 2025–26+ years. Ambiguous people (for example, three different "Andy Tran" members) stay unlinked until an admin picks the right person in Admin → ACE.
- Renaming an ACE tree member or Cabinet member in the admin editors clears its `member_id` (case and whitespace edits don't), so a renamed entry never keeps the previous person's photo.
- Admin → ACE links nodes without SQL. Each node shows its link status with a member search (`public_members` only: name, college, year) and Change/Unlink. An unlinked node whose exact normalized full name (case, spacing, and diacritics ignored) matches exactly one member gets a one-click suggestion. Several same-name members are listed for the admin to choose from, never auto-picked. A member already linked to another node is flagged instead of suggested. Each fam's **Review unlinked** panel bulk-links only the checked unique matches, and only on nodes that are still unlinked. JSON imports start unlinked, then point to the same review. Cabinet linking is still a manual `update`.
- Merging duplicate `members` rows deletes the duplicate, which nulls any ACE/Cabinet link that pointed at it; re-link to the surviving row.

## Storage & egress design

- **Pending uploads** go to the new **private** `member-photo-requests` bucket (5 MB limit, jpeg/png/webp only), under `pending/<uuid>.<ext>`. Clients compress image client-side first (`avatar` preset, ≤512px WebP). Only admins can read (signed URLs, 5-minute expiry) or delete these objects.
- **Approved avatars** are re-compressed in the reviewing admin's browser to the new `avatarThumbnail` preset (≤256px WebP, typically 5–20 KB) and uploaded to the public `avatars` bucket at `approved/<request_id>.webp` with `cacheControl: 31536000` (1 year). Originals are never published.
- **Public pages make one bulk query** (`public_member_avatars`) instead of the previous per-row `user_profiles` lookups, and thumbnails are CDN-cacheable at a stable path.
- The legacy self-serve write policies on the `avatars` bucket were dropped; only admins can write there now. Public SELECT on `avatars` is unchanged so existing and approved images keep serving from the CDN.

### Storage abuse and retained originals

Public uploads require a broker-issued one-object capability and an atomic quota reservation, as described above. Private-bucket RLS rejects direct anonymous or ordinary-account INSERT, SELECT, UPDATE, and DELETE. The frontend honeypot is an additional UI deterrent; the server quota is the security boundary.

The existing `scripts/cleanup-stale-photo-requests.mjs` can inventory older orphaned objects in dry-run mode. Object deletion remains an owner-approved manual operation. Do not schedule automatic cleanup or release quota based on review status: a reviewed request can still reference a retained original, and deletion does not invalidate outstanding signed capabilities until expiry.

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

## Admin upload from Admin → Members (`20260930053224_admin_publish_member_photo.sql`)

Admins can also add a photo for a member directly: **Admin → Members → Edit → Photo**. The edit dialog shows the member's current approved photo, takes a JPEG/PNG/WebP up to 5 MB, and requires the admin to confirm the member agreed to the photo being public. Saving the dialog saves the member's details first, then publishes the photo. The dialog cannot be closed until that finishes. If publishing fails, the details stay saved and the dialog stays open with the photo selected so it can be retried.

Under the hood `photoRequestsRepository.adminPublishMemberPhoto` uploads the 512px original to `member-photo-requests/pending/` and the 256px thumbnail to `avatars/approved/<request id>`. It then calls `admin_publish_member_photo`, an admin-guarded SECURITY DEFINER RPC that inserts an **already-approved** `member_photo_requests` row. If the RPC reports an error, the client first looks up the request row by id. A committed call whose response was lost still reports an error, and deleting its objects then would leave the approved row pointing at a missing image.

- **Row found:** the publish succeeded; nothing is deleted.
- **Row absent:** both uploaded objects are deleted. If a delete fails, the admin sees the leftover storage paths and is asked to get a maintainer to remove them, because nothing in the admin UI can find an object with no row.
- **Lookup fails:** nothing is deleted, and the admin is asked to check Photo requests before retrying.

The row is shaped so every existing tool keeps working:

| Column | Value for an admin upload |
|---|---|
| `user_id` | `NULL`. No member account submitted it, so no `user_profiles.avatar_url` is set. |
| `matched_member_id` | The member being edited |
| `submitted_name` | The member's name at upload time |
| `submitted_email` | The uploading admin's email, as the contact of record |
| `note_to_admins` | `Uploaded by an admin from Admin -> Members.` |
| `consent_confirmed` | `true`, attested by the admin's checkbox |
| `status`, `reviewed_by`, `reviewed_at` | `approved`, the admin, now |

The audit trail gets `submitted` from the existing insert trigger and `approved` with the note `Admin upload`, both attributed to the admin. The photo then appears in `/admin/photo-requests` under **All**, where **Remove from public display** works as for any approved request.

The newest approved photo per member wins in `public_member_avatars`. Removing it falls back to that member's previous approved photo, if one exists.

The client RLS insert path could not be reused. Its policy binds an authenticated row to `user_id = auth.uid()`, so an admin-made request would have been attributed to the admin, and approving it would have set the **admin's** profile avatar.

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

Upon submission, the broker atomically records the pending request and quota reservation with `matched_member_id` pre-filled, then the browser uploads through its one-object signed capability.

## Applying to production

Follow the exact migration → broker → frontend sequence in **Deployment order and verification** above. New environments must first apply the baseline migration chain. Existing deployments need the two October hardening migrations and `member-photo-upload` before serving the updated submission client. The earlier July migration alone leaves the anonymous upload bypass open.

Review all acceptance checks in an owner-approved staging environment. Pending originals stay private and only approved thumbnails become public. Never revert to anonymous Storage INSERT to work around a deployment mismatch.
