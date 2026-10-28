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

`house_memberships` is admin-only. The public site reads a member's House from `public_house_memberships`, a read-only, score-free view (member, year, effective interval, House id/key/name/accent). A row is public only when its House profile is active **and** either that year's assignment batch is **published** or the year is earlier than the active term's year. A locked batch writes no memberships, and a membership an admin adds by hand for the upcoming year stays hidden until the Reveal.

Find My Points shows the House announced for the selected year (or each member's most recent revealed House for all-time) and links to that year's House page. It never reads `members.house`: that legacy display cache still held 221 members' 2025–26 Houses (with no 2025–26 membership rows) in production on 2026-10-28. A failed House read shows no House, never a guessed one.

## Migrations

`20261028060000_public_house_memberships.sql` — **not yet applied; needs owner approval.** Apply before shipping this frontend (until then the lookup shows no House, never the stale cache). Offline proof: `bash scripts/test-public-house-memberships.sh` (hidden before Reveal and while locked, public after, inactive Houses excluded, historical years public, read-only, score-free columns).
