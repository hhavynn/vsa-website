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

## Post-Reveal House membership corrections (#621) — owner-gated

This section is an **operator decision and recovery runbook, not permission to
change a member's House**. It applies only after a legitimate batch for the same
academic year has finished Reveal (`status = published`, `published_at` set).
Do not confuse a timed-out or partial Reveal with a completed one: follow
"Reveal retry and interrupted-release recovery" above first. **The House Reveal
freeze also applies to any correction batch.** The release owner must authorize
the correction and its publication separately.

### Read-only review and explicit authorization

1. In **Admin → Houses → House Assignments → population coverage**, select
   the exact academic year and the already revealed batch, then run
   **Check coverage**. Check the payment roster's Paid/Waived final population,
   eligible/linked/ambiguous/Unassigned/Unknown totals, draft-row identities and
   `effective_start_date`. A blank or failed roster read means **Unknown**,
   never zero eligible or authorization to proceed.
2. In **Admin → Houses → Payments**, confirm the *same person's* application,
   payment status **Paid** or explicitly **Waived**, not withdrawn, and their
   canonical `members.id` using reviewed identity evidence. Confirm the correct
   active `house_page_assets.id` for the selected academic year. A similar
   display name or last year's `members.house` cache is not sufficient.
3. Have the House leadership/release owner explicitly approve the intended
   change (late addition or a transfer), the exact House, the year, and a
   **prospective** effective date. Capture the before-state interval(s) and
   the expected after-state in a restricted owner review record. The public
   GitHub issue/PR, browser URL, CSV exports and public logs must not contain
   private contact details, payment evidence, raw application answers or
   sensitive identities. Record **counts-only** completion in the public
   tracker.

### Existing path for a reviewed late add or transfer

1. Use **Admin → Houses → House Assignments**, select the *approved* academic
   year, a new accurate effective date, and a generic batch label (e.g.
   `Approved post-Reveal correction`). Under **Historical / Advanced Import**,
   choose the **Long CSV with name/email/house** format and paste the minimal
   **one-person** row from the approved restricted workspace. Do not make a
   publicly published Google Sheet of member details. This importer creates a
   `manual` assignment batch, **not** a new timestamp-priority rerun of the
   already-revealed paid cohort.
2. **Preview Matches**, review the canonical member and correct year-specific
   House profile, explicitly resolve any same-name ambiguity, then **Save
   draft**. Inspect that the saved batch has exactly **one** intended
   `house_assignment_drafts` row, one confirmed `member_id`, the intended
   `house_profile_id`, the approved effective date and no extra rows. Do not
   use name-only matching or create a new canonical member as a shortcut.
3. Open that draft, run its existing **preflight** and compare its proposed
   interval against the *complete current-year* `house_memberships` history.
   `planMembershipChange` uses half-open `[start, end)` intervals: a later
   effective date can close the earlier open interval and insert the approved
   House, while a different House at the **same** start date is a conflict and
   must **STOP**, not be worked around by changing the date, duplicating a
   member or directly editing the historical row. Never backdate an assignment
   merely to make Find My House appear immediately.
4. **Critical gate not automated for manual imports:** the manual batch does
   **not** carry the payment roster snapshot or automatic cutoff/capacity
   checks. Its existing generic Lock/preflight can succeed even if payment
   eligibility was never established. Therefore the signed Paid/Waived,
   withdrawal and authorized exception review in steps 1–3 is **mandatory**;
   never treat a green preflight alone as evidence of eligibility or permission
   to bypass first-come, first-served placement.
5. Only after approval and review, use the **existing** draft
   `Lock → Reveal` controls, within an owner-authorized release window.
   `HouseAssignmentsRepository.publishBatch` uses the existing
   `HouseMembershipsWriteRepository.applyMembership` writer; it does not
   write `members.house` alone. A second writer, direct table edits, use of
   **Historical Backfill** on the active year, and reopening an already
   published batch are **not** correction paths. Do not click Reveal during a
   Lock-stop rehearsal.

### After publication: reconciliation and stop conditions

Re-open the exact newly published correction batch, record `published_at`,
the one intended canonical member, source batch ID (restricted only), applied/
skipped counts, and the effective date. Re-run **House assignment population
coverage** for both the original released batch and the correction batch;
compare **before vs after** approved member/interval totals, including any
`conflicting-membership`, `missing-member` and out-of-batch counts. An
out-of-batch membership is not automatically an error: it may be a legitimate
later correction and must be reconciled against its reviewed source batch.

From an independent anonymous session, verify that the exact batch Reveal
gate (not merely an earlier published batch in the same year) controls the
public identity view, that the corrected House starts only on the approved
effective date, and that no draft person, payment status, private roster or
House points are exposed. Confirm prior academic-year intervals and House
history remain available, and that repeating an already published batch
creates **zero additional** membership rows.

**Stop and escalate instead of retrying blindly** when: a prior Reveal may be
partial; payment/identity evidence is missing or inconsistent; a manual import
would override an unapproved priority/capacity decision; the member already
has a conflicting same-date House interval; the selected House or year is
wrong; a paginated read is incomplete; the operation produces an unexpected
applied/skipped count; or hosted permissions / anonymous Reveal checks fail.
Freeze further writes and use a separate owner-approved, audited recovery
plan. No client-side delete, forced public grant, direct
`house_memberships` SQL update, or `members.house` cache patch is a
substitute for that plan.

## Go/no-go evidence and outstanding blockers

#635 owns real H01–H12 evidence after #639; closure of #639 does not prove a rehearsal occurred. Staging remains unavailable (#569), so a disposable database with synthetic records or a local UI attempt must be labeled by environment; do not claim it proves production RLS or real-browser behavior. The rehearsal document must retain **Status: staging rehearsal and signoffs NOT performed** and **BLOCKED** until observed evidence and separate House, engineering, privacy, accessibility and final-owner signoffs exist.

Before authorizing Reveal, verify #640 hosted anonymous public House-event checks and remaining catalog checks, #621 paid/waived eligible-population reconciliation, #801 dependency, application cutoff, identity and payment gates, and the score-embargo RLS suite. The current House theme and Parent copy may be public already because profiles have their own publication state. Assignment identity is the Reveal gate; House point totals, ranks and scored activity stay embargoed and announced privately at GBMs after Reveal.

## Current migration status

The previous claim that 20261028060000_public_house_memberships.sql was 'not yet applied' is stale following #701 and the subsequent #704/#692 privacy changes. This runbook adds **no migration**, and no migration is applied here. Reconfirm live grants and row-level policies independently at the #635 launch gate, not from client tests. Offline synthetic proof: bash scripts/test-public-house-memberships.sh.

## #802 / #641: House badge RPC exact-batch Reveal gate

Forward-only migration `20261031164611_public_member_house_badge_matches_view.sql` replaces **only** the existing public identity-only `public_member_house_badge(uuid, integer)` function. Its sole read source is the owner-rights `public_house_memberships` view. The view itself requires the **exact `house_assignment_batches.source_import_id` batch to have `published_at`** before an assignment-batch row is public; one earlier published Fall batch never reveals a later partially written Winter batch. Using the view also preserves previously revealed **archived** batches, announced-but-upcoming membership starts, and the active-term rollover rule for hand-added/legacy membership years.

No score, attendance, contact, review note, private roster, batch ID, or raw `house_memberships` read appears in the function. Its seven original behavioral assumptions remain unchanged for consumers: the RPC still accepts one canonical member ID plus an optional academic year, returns NULL when not revealed, and returns only the same six JSON identity fields (`house`, `house_profile_id`, `display_name`, `accent_color`, `academic_year_start`, `latest_activity_at`). `anon` and `authenticated` keep EXECUTE; there are no new raw-table grants.

**Status:** the owner approved this freeze exception, and the migration was applied to production on 2026-10-31 as version 20261031164611. Before applying, the deployed function body matched `20261028073000_embargo_public_house_scores.sql`; afterwards it matched this file. Production had no House membership rows and no published batch at that time, so anonymous requests could only confirm NULL results and refused raw reads. A locked later batch and a real Reveal have not been exercised on production, so repeat those checks right after Reveal. There is no staging project. Run `bash scripts/test-public-house-memberships.sh` in an isolated PostgreSQL cluster; the fixture now applies the new migration twice and performs the anon negative and positive tests.

**Do not change `effective_start_date` or manually publish a batch as a workaround.** Partial Reveal rows must remain inaccessible even after a prior batch is published, and no public leaderboard modal / Find My House / Top 3 story should depend on legacy year-wide status checks. #815's House-linked leaderboard modal is gated on this fix.

### House page read failures

`/house` may only say Houses have not been announced after `published_house_page_assets` returns successfully with no rows. If that read fails, `houseAssetsRepository` rejects, so `/house` shows a temporarily-unavailable state (plus the degraded-mode banner in an outage) and a House detail page shows the same state instead of its 404. A rejected read is never treated as "nothing published".

### Find My House availability and navigation (#641)

The current-year House section displays a **Find My House** anchor in the House navigation only after the Reveal-gated `public_house_memberships` existence read confirms at least one published House membership. If the existence read errors, the lookup and anchor remain hidden and a nonrevealing status message explicitly says availability could not be checked; it must never claim House assignments have not been announced. Archives and future years have no current-year lookup. The results RPC is #802's exact-batch badge function, deployed 2026-10-31; its post-Reveal anonymous checks are still outstanding.
