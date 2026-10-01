# House assignment drafts and Intern cohort manager

Two private, admin-only workflows. Both follow **draft → lock → publish**; locking never makes anything public.

## House assignments (`/admin/houses` → House Assignments)

Flow: Import → Match → Save draft → Review → Preflight → Lock → Reveal.

- The existing wide/long sheet parser (`src/lib/houseAssignmentImport.ts`) now saves a **draft batch** (`house_assignment_batches` / `house_assignment_drafts`) instead of writing `house_memberships`. Emails are used to match and are never stored.
- A draft stays editable: change the member match, change the House, remove a row, add someone, inspect ambiguous/unmatched rows. Drafts can be reopened later.
- Long sheets may include `first choice` / `second choice` / `third choice` or `preference 1/2/3` columns; they are stored as an ordered `preferences` array. The Balance Helper **only suggests**, only toward Houses a person listed, and an admin accepts each one. Without preferences it reports imbalance and unassigned people only.
- Preflight blockers (lock and reveal refuse): one member in several Houses; a row whose House has no active profile this year; a placement that would overlap an existing membership interval. Warnings: unassigned, duplicate-in-same-House, ambiguous match (skipped at reveal until confirmed), no member match, House size gap.
- **Reveal** writes `house_memberships` through `src/data/repos/houseMembershipWrites.ts` — the same dated-interval behavior Admin → Houses has always used (close the open membership, insert the new one, stop it where a later one begins, refresh `members.house`). Each row is skipped if the member is already in that House from that date, so a retry is safe, and a published batch is a no-op.
- The Legacy Backfill tab is unchanged and separate.

## Intern cohort (`/admin/interns`)

- A cycle belongs to one cabinet year (`intern_cohort_cycles`); interns are `intern_cohort_drafts` rows with optional canonical `member_id`, optional cabinet mentor, role/track, caption, internal notes, and order.
- Pasted names link to a member only on one exact, unclaimed name match; near-misses are offered, never applied.
- Preflight blocks locking on an empty cohort or the same member linked twice. Unlinked members and duplicate names are warnings; a missing mentor is optional.
- **Publish** creates or updates `cabinet_members` rows with `category = 'Interns'` for the cycle's cabinet year (name, role = track or `Intern`, display order, `member_id`). That is the only public source; the approved-avatar system resolves through `member_id`. The new row's id is stored on the draft (`published_cabinet_member_id`); an existing Interns row for the same member (or same name, if unlinked) is adopted rather than duplicated. Mentor, caption, and internal notes stay private.
- The live-only `intern_cohort_members` table (not in migrations; see `docs/anon-key-exposure-audit-2026-08-19.md`) is not used.

## Migrations (apply manually, in order, after staging verification)

1. `20261002000100_create_house_assignment_batches.sql`
2. `20261002000200_create_intern_cohort_cycles.sql`

Both are additive: RLS enabled, `revoke all` from `anon, authenticated` then admin-only policies via `is_admin_user()`, plus triggers that stop a locked/published batch or cohort from being edited or deleted and enforce legal status transitions. Apply them **before** deploying the frontend (the pages need the tables).

## Temporary pieces to replace at merge

`src/components/features/admin/MemberSearchSelect.tsx` and `InternCohortRepository.listMemberDirectory()` are narrow stand-ins for the shared `MemberLinkPicker` / `memberLookupRepository` from the ACE member-link work. Swap and delete them when that lands.
