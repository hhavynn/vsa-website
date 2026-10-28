# House Parent access (#654): design and the interim share copy

Status (2026-10-28): **no House Parent login exists, and none should be built until CRC/cabinet approve it in writing.** Until then, the only way House Parents see their House's participation is the admin-reviewed **share copy** below. House points and standings stay embargoed (#692); official GBM results are #693.

## Interim: admin-reviewed share copy (shipped)

Admin → Houses → Overview → **Open roster** → **Prepare a copy for House Parents**. An admin sees exactly which columns are included, confirms, and downloads a CSV of that one House for the chosen period. It contains **only members publicly revealed in this House today**, using the same Reveal boundary as the public site (published House assignments, `public_house_memberships`); before the Reveal, or for members who transferred out, nothing is included and the button explains why. The admin then shares it privately with that House's own Parents.

| Column | Meaning |
|---|---|
| Name | First and last name |
| In the House since | Their House start date |
| Attended a House-credited event | Yes / No for the period |
| Last House-credited event | Date of the latest one |

Never included: email, phone, date of birth, member ids, notes, application answers, any other House, and **any per-member count**. House points are a count of credited attendance (`house_yearly_points.total_points = count(*)`), so per-member counts would add up to the embargoed House score, and Parents of two Houses comparing files would recover the ranking. Cells are formula-safe (`csvCell`), and the file starts with a UTF-8 byte order mark so Vietnamese names open correctly in Excel. This list (`HOUSE_PARENT_SHARE_FIELDS` in `src/lib/houseParentShare.ts`) is **provisional until CRC/cabinet approve it**; change the code and this table together.

No new accounts, roles, grants or RLS were added. Nothing here gives a House Parent access to the site.

## If a House Parent login is approved: required design

Decisions leadership must record first (with names and date):
1. **Whether** House Parents get any login this year, and only **after the Reveal** (default).
2. The **field allowlist** for their view (start from the table above). Participation only by default: their own House's score, per-member counts or any number that sums to it would let Parents of different Houses rebuild the ranking, so showing any of them needs CRC to release House totals explicitly. Other Houses' scores and ranks: never.
3. Who **invites** and who **revokes** (Webmaster/CRC), and what happens on resignation, House transfer and academic-year rollover.

Security requirements (from #654; all must hold, tested against seeded staging personas):
- **Identity:** invitation-only, never public signup. A House Parent is an authenticated user tied to an approved, current-year `house_parents` row whose `member_id` was verified by an admin. A display name, family-tree role or public badge is never proof.
- **Authorization in the database:** a new table such as `house_parent_grants (user_id, house_profile_id, academic_year_start, granted_by, granted_at, revoked_at)` with RLS on and **no** insert/update/delete for anyone but admins (through an audited admin RPC), so nobody can grant themselves access. Read access goes through narrow SECURITY DEFINER RPCs that read **only** the caller's granted House and year from that table, never from a request parameter. They return only the approved fields and refuse otherwise (42501). They are POST-only like the other private House reads. **Never** set `is_admin`, and never grant table or view SELECT.
- **Reveal boundary:** the RPCs return only members visible in `public_house_memberships` (published batches), never `house_memberships` directly and never keyed on `house_page_assets.is_active`.
- **Revocation** is immediate: `revoked_at` is checked on every call, and the grant is for one academic year only, so rollover ends it.
- **Tamper tests:** a Twilight Sparkle parent calling with Applejack's, Pinkie Pie's or Rarity's profile id, a previous year, another member's id, a GET, or after revocation gets nothing. Anonymous users, students without a grant, and expired parents get nothing. No email, phone or notes appear in any network payload.
- **No workarounds:** no mass student auth, no Google Drive sharing or grants, no repo or Supabase credentials.
- **Read-only:** corrections are requested from the Webmaster/CRC; any edit capability is a separate, audited authorization.

This is a separate, gated PR (RLS + auth) once the decisions above are recorded.
