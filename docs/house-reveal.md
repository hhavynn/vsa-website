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

## Lock-stop trial — do not Reveal

This is an operator checklist and is **not authorization to Lock or Reveal**. The House Reveal freeze stays active until the release owner lifts it or grants an explicit exception. Never create fictional production applicants, upload private form responses to GitHub, or use a production Reveal as a test.

1. Confirm the selected academic year and read-only House application-window status from public_application_links. No open window or closed/future URL may be visible; record status and cutoff in Los Angeles local time.
2. On Admin → Houses → Payments, verify the current final roster. The payment roster is unique by year/application key. Do not create a duplicate roster to solve a mismatch.
3. Import the authorized final **unmodified** response export, preserving row order. Store it only in an approved restricted workspace.
4. Save Draft A, reconcile payment status, wait for or explicitly authorize the cutoff, rerun placement, and save Draft B. Compare source fingerprint/version and aggregate assigned/unassigned/ambiguous results; never publish a provisional unpaid cohort.
5. Explicitly review canonical member links, wrong-year or inactive Houses, current House Parent assets and planned effective start date. A date later than Reveal means Find My House identity may not appear immediately; no silent backdating.
6. Review preflight and payment gate. If any item is Blocked/Unknown, **STOP before confirming Lock**. Only a designated authorized operator may confirm a fully reviewed Lock. **The trial stops at Lock; do not tick Reveal confirmation and never press Reveal.**
7. Save only statuses, counts and timestamps to the restricted H01–H12 signoff ledger, not member names, contacts or private form answers. A green admin panel is not launch approval.
8. From a separate anonymous session, check a HEAD count of zero for the unrevealed current year's public_house_memberships, and ensure /house does not offer Find My House. Verify no anon House score views or scored RPCs are readable.
9. If changes are needed *before* publication, use the reviewed Reopen → regenerate draft → preflight → authorized Lock path. A payment change requires a new cutoff-aware placement run.

## Reveal retry and interrupted-release recovery

If the owner's real Reveal request times out or loses the response, reload the **same** batch first and inspect its status, published_at, payment fingerprint and original rows. Do not create another batch or assume the failure was a rollback. The existing planMembershipChange skips already placed members, and admin_begin_house_batch_publish accepts the same batch; only an authorized operator should retry that same Reveal after revalidating its state.

An interrupted Reveal may have written individual membership rows before it set published_at. Those rows stay out of public_house_memberships through the originating batch's published_at gate. `public_member_house_badge` uses a looser gate until #802 ships, so check it too if an earlier batch that year is already published. **Do not Reopen after a partial Reveal.** Client-side deletion of those intervals is unsupported; a changed House at the same start can conflict. If a same-batch retry is unsafe, stop and escalate for owner-approved, audited SQL recovery only. While publishing_batch_id is set, payment and member-merge writes intentionally refuse with 55006. After successful publication, use the reviewed #621 correction path, never direct updates to members.house or House scores.

## Go/no-go evidence and outstanding blockers

#635 owns real H01–H12 evidence after #639; closure of #639 does not prove a rehearsal occurred. Staging remains unavailable (#569), so a disposable database with synthetic records or a local UI attempt must be labeled by environment; do not claim it proves production RLS or real-browser behavior. The rehearsal document must retain **Status: staging rehearsal and signoffs NOT performed** and **BLOCKED** until observed evidence and separate House, engineering, privacy, accessibility and final-owner signoffs exist.

Before authorizing Reveal, verify #640 hosted anonymous public House-event checks and remaining catalog checks, #621 paid/waived eligible-population reconciliation, #801 dependency, application cutoff, identity and payment gates, and the score-embargo RLS suite. The current House theme and Parent copy may be public already because profiles have their own publication state. Assignment identity is the Reveal gate; House point totals, ranks and scored activity stay embargoed and announced privately at GBMs after Reveal.

## Current migration status

The previous claim that 20261028060000_public_house_memberships.sql was 'not yet applied' is stale following #701 and the subsequent #704/#692 privacy changes. This runbook adds **no migration**, and no migration is applied here. Reconfirm live grants and row-level policies independently at the #635 launch gate, not from client tests. Offline synthetic proof: bash scripts/test-public-house-memberships.sh.
