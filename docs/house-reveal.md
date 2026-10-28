# House Reveal: readiness check and public House identity

Issues #635 (Reveal release gate) and #621 (member links and current-year House coverage). Builds on the payment gate in [house-payment-eligibility.md](house-payment-eligibility.md).

## Ready to Reveal (admin, locked batch)

Admin → Houses → open a **locked** batch. The **Ready to Reveal?** panel is read-only and checks:

| Check | Complete | Needs review (Reveal allowed) | Blocked / Unknown (Reveal disabled) |
|---|---|---|---|
| Academic year | the active term is the batch's year | no active term, or another year is active | the term could not be read |
| House profiles | active profiles, each with House Parents | a used House has no Parents linked | no active profiles, a row in an inactive House, or Parents could not be read |
| Member links | every row linked to a confirmed member | a manual batch has unlinked rows (skipped at Reveal) | an automatic batch has unlinked/review rows, or no rows |
| Assignment preflight | no issues | warnings | blockers |
| Payment eligibility | Paid/Waived at the current version, or not payment-gated | | database payment blockers, or the check failed |
| House applications | no House window open | a House window is still open | windows could not be read |

**Unknown never passes:** if any read fails, the Reveal button stays disabled. The panel also states exactly what the Reveal makes public: each assigned member's House for that year, and nothing else — **no House points or standings** (embargoed and announced at GBMs, #692), payment status, application answers, member links under review or notes. After a Reveal the admin's own caches for House pages and Find My Points are refreshed; other visitors see the change on their next load.

## Public House identity (`public_house_memberships`)

`house_memberships` is admin-only. The public site reads a member's House from `public_house_memberships`, a read-only, score-free view (member, year, effective interval, House id/key/name/accent). A row is public only when its House profile is active **and**:

- **written by an assignment batch:** that exact batch has been published (`published_at` set). One year can hold Fall, Winter and Spring batches, and a Reveal writes rows before marking the batch published, so a partly written or failed Reveal stays private no matter what else is published, and even after rollover.
- **added by hand or backfilled:** some batch for that year has been published, or the year is earlier than the active term's year.

`published_at`, not status, so archiving a revealed batch keeps it public. The view is a `security_barrier`. For the current year, a membership that ended with no successor shows no House; the all-time view dates the House (e.g. "Rarity · 2026-2027") so an old House never reads as current.

Find My Points shows the House announced for the selected year (or each member's most recent revealed House for all-time) and links to that year's House page. It never reads `members.house`: that legacy display cache still held 221 members' 2025–26 Houses (with no 2025–26 membership rows) in production on 2026-10-28. A failed House read shows no House, never a guessed one.

## Known gaps (tracked separately)

- `public_members.house` (the legacy cache) is still anon-readable and is written during Reveal before the batch is marked published; the public Events page still shows a "top House" from it. See the follow-up issue linked in PR #701.
- `house_member_yearly_points` is anon-readable and joins memberships without this Reveal gate, and public per-member points plus public Houses let anyone sum House totals: both need an owner decision under the score embargo (#692).

## Migrations

`20261028060000_public_house_memberships.sql` — **not yet applied; needs owner approval.** Apply before shipping this frontend (until then the lookup shows no House, never the stale cache). Offline proof: `bash scripts/test-public-house-memberships.sh` (hidden before Reveal and while locked, public after, inactive Houses excluded, historical years public, read-only, score-free columns).
