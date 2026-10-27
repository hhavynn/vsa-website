# House assignment drafts and Intern cohort manager

Two private, admin-only workflows. Both follow **draft → lock → publish**; locking never makes anything public.

## House assignments (`/admin/houses` → House Assignments)

Flow: Import → Match → Save draft → Review → Preflight → Lock → Reveal.

- **Import House Applications** (the Google Form responses CSV, timestamp priority: first-come, first-served, then ranked choices, within capacities) is the default, primary import for every year, with stricter lock/reveal checks for those batches. See [house-auto-placement.md](house-auto-placement.md).
- The older wide/long sheet parser (`src/lib/houseAssignmentImport.ts`) is kept under the collapsed **Historical / Advanced Import** section for re-importing a sort decided by hand. It does not use timestamp-priority placement. It saves a **draft batch** (`house_assignment_batches` / `house_assignment_drafts`) instead of writing `house_memberships`. Emails are used to match and are never stored.
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

1. `20261001213414_create_house_assignment_batches.sql`
2. `20261001213433_create_intern_cohort_cycles.sql`

**Status:** both applied to production on 2026-10-01; filenames match the versions recorded in `supabase_migrations`.

3. `20261026230757_house_assignment_timestamp_placement.sql` — additive placement metadata columns for automatic House placement ([house-auto-placement.md](house-auto-placement.md#deploying)). Applied to production 2026-10-26 (recorded version `20261026230757`; the file was renamed from `20261026180000` to match).
4. `20261026200000_house_2026_my_little_pony.sql` — the 2026-2027 My Little Pony House profiles and the admin-only `house_parents` member links ([house-2026-my-little-pony.md](house-2026-my-little-pony.md)). Applied to production 2026-10-26 in the SQL Editor; its history row was inserted under the file's own version `20261026200000`.
5. `20261027120000_house_placement_override_rpc.sql` — `admin_apply_house_placement_override`, the atomic move/swap for automatic placement drafts (SECURITY INVOKER, EXECUTE for `authenticated` only; writes only draft rows). **Not yet applied; awaiting owner approval.** The frontend can ship first: swaps are refused until it is applied ([house-auto-placement.md](house-auto-placement.md#deploying)).

Both are additive: RLS enabled, `revoke all` from `anon, authenticated` then admin-only policies via `is_admin_user()`, plus triggers that stop a locked/published batch or cohort from being edited or deleted and enforce legal status transitions. Apply them **before** deploying the frontend (the pages need the tables).

## Member lookup

The Intern cohort page links members with the shared `MemberLinkPicker` and `memberLookupRepository` (the same control Cabinet, ACE and photo requests use). Matching is exact on a normalized name only: a pasted name auto-links only on one unambiguous, unclaimed match, an exact match is offered as a suggestion an admin clicks, ambiguous names list every candidate, and near-misses are never guessed (search is one click away). The old Intern-only directory (`InternCohortRepository.listMemberDirectory`) was removed.

`src/components/features/admin/MemberSearchSelect.tsx` is still used by the House assignment draft editor (`HouseDraftEditor`). That editor is a protected House-membership surface, so its swap to the shared picker is deliberately a separate change.

## Follow-up migration

`20261001222905_revoke_phase2_guard_function_execute.sql` revokes client `EXECUTE` on the six guard trigger functions above (they had been callable by `anon` and `authenticated`; applied to production 2026-10-01).
