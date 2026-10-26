# 2026–2027 Houses: My Little Pony

These Houses and House Parents were confirmed by the owner on 2026-10-26.

| Order | House | House Parents |
|---|---|---|
| 0 | Twilight Sparkle | Timothy (Tim) Huynh, Kent Nguyen |
| 1 | Applejack | Ryan Francisco, Nathan Centeno |
| 2 | Pinkie Pie | Ingyin Moh, Martin Dang |
| 3 | Rarity | Kirsten Ngo, Jonas Truong |

It is spelled **Pinkie Pie**. The Google Form says "Pinky Pie (Ingyin & Martin)"; the placement tool recognizes that option through its House Parents (see [house-auto-placement.md](house-auto-placement.md#houses)).

## Where the data lives

- **House profiles** are four `house_page_assets` rows for `academic_year_start = 2026`. They are active, with keys `twilight-sparkle`, `applejack`, `pinkie-pie` and `rarity`. They have no images or descriptions until real ones are uploaded in Profiles & Images, so House cards fall back to the House's initials. The accent colors are starting values you can edit there.
- **Public House Parents** use the existing House Parent fields. `house_parent_body` lists the two names; `house_parent_heading` and `house_parent_image_url` stay empty until an announcement poster is uploaded. Profiles & Images edits these fields, and `/house/year/2026-2027/<house>` shows them.
- **Member links** live in the new admin-only `house_parents` table. Each row is one House Parent: House, display name, `member_id`, and a `review_note` when unlinked. It isn't readable publicly, and the public page doesn't show it. To review or change a link, go to Admin → Houses → Profiles & Images → **House Parents · member links**. That control is the shared `MemberLinkPicker`, which matches exact names only and never creates a member.

## Migration `20261026200000_house_2026_my_little_pony.sql`

The migration is idempotent and only touches 2026 rows:

- It creates `house_parents` with RLS enabled, `anon` revoked, and admin-only policies through `is_admin_user()`.
- It upserts the four 2026 profiles, keeping any non-empty image, description, color or House Parent copy that an admin has already set.
- It renames a misspelled 2026 "Pinky Pie" row in place, so its id is kept.
- It deactivates any other 2026 row, such as a placeholder. Nothing is deleted.
- It links each House Parent only when exactly one member's normalized full name matches. Timothy Huynh is searched as both "Timothy Huynh" and "Tim Huynh". With no match, or more than one, the link is left empty with a review note. A link an admin has already set is never overwritten.

**What stays untouched:** the 2025–2026 Mario Houses and every earlier year; `house_memberships`; members; attendance; points; leaderboard views; and the public `published_house_page_assets` view.

**Read-only check against production (2026-10-26):** there were no 2026 House rows, no 2026 memberships, and no `house_parents` table. Each of the eight House Parents has exactly one member record with their exact name. Timothy is recorded as "Timothy Huynh", and there is no separate "Tim Huynh" record. So the migration is expected to link all eight. Re-check in the admin panel after applying it.

## Archive

In `src/data/legacyHouseArchive.ts`, 2025–2026 (Super Mario) is now an archived ("verified") year. Its links point at `/house/year/2025-2026/<house>`, and its House list is unchanged. 2026–2027 (My Little Pony) is the `current` entry. Mario pages, standings and memberships keep living under their own year.

## Steps

1. Apply `20261026180000_house_assignment_timestamp_placement.sql`, then `20261026200000_house_2026_my_little_pony.sql`, after staging verification.
2. Deploy the frontend.
3. In Admin → Houses → Profiles & Images (2026–2027), confirm that all eight House Parents show as **Linked**, and resolve any that say **Needs review**.
4. Optionally upload House images and House Parent posters there.

**Publishing:** applying the migration makes the four House profiles and their House Parent names visible on `/house` right away. That's needed because automatic placement only uses active profiles. House assignments stay private until a placement draft is locked and revealed.
