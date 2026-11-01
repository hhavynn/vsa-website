# ACE Orphan review foundation (#646)

**State: pure helper only, not a live roster.** `src/lib/aceOrphanReview.ts` prepares private ACE review states and a small reviewed CSV. No admin component calls it yet; it never reads or writes Supabase, never changes `ace_assignment_drafts`, and cannot publish a Little to `ace_family_members`.

## Why Orphans are first-class

An ACE Little can remain in the program without an assigned Big. **Orphan is a real, non-punitive outcome**, not a placeholder Big, a damaged family tree or a failure to import. The existing `computePreflight` / `publish_ace_assignment_cycle` still block unassigned drafts. Orphans belong to the separate **private intake/cycle roster**, intentionally **outside** the assignment publication draft. Never bypass that blocker by creating a fake ancestry link.

## State and export contract

- `littleState` classifies unpaired, tentative, confirmed, Orphan, withdrawn/declined, and **needs review**. The last state covers a contradictory live pairing or an unknown status, so a user is never shown a clean Orphan while the source claims a real match.
- The source of pairing state must be **reviewed, current cycle pairings**, not unsaved assignment draft counts or two unlinked names. Revoked pairings do not count as live.
- `buildOrphanCsv(rows, cycleId)` is an in-memory, **admin-reviewed export only**. The caller must verify private admin access and complete intake/pairing reads before calling. It rejects mixed cycles, duplicate participant IDs, unrecognized status values, and Orphans who are Bigs, ineligible, unreviewed, withdrawn or actively paired. It never silently changes a decision.
- CSV contains exactly **Name, Cycle, Follow-up, Continues**. Follow-up is the planned code (`none`, `to_contact`, `contacted`, `closed`), not arbitrary follow-up narrative. `csvCell` protects formula-like values; Unicode names are preserved with a BOM. There are no reason, email, private application answers, canonical IDs, contact details or free-text columns.
- The helper does not decide which eligible Little becomes an Orphan, infer reasons, automatically reassign, create historical records, or publish public Orphan badges.

## Integration gates — not implemented by this PR

1. **#644**: Owner-approved, authorized admin-only persistent participant schema/RPCs; complete, atomic reimport preserving manual decisions; privacy and retention approvals. The existing one-session paste cannot be treated as the canonical persistent source.
2. **#662/#663 and PR #856**: Approved mutual guarantee state, one canonical Little identity across both forms, and the shared reviewed capacity planner. No other capacity math is introduced here.
3. **#646**: Build the admin capacity editor, orphan roster/filter and controlled download using complete cycle reads and explicit chair review, with RLS/error/320px/keyboard tests and the mandated conflict policies.
4. **#647/#648**: Pair/reassign through authorized, audited RPCs and review-approved publication handoff. A later matching decision belongs to the correct approved draft cycle; it must not insert unassigned Orphans into publication.
5. **Owner/manual QA**: Verify denied anon/non-admin access, real two-admin conflict/version checks, retained Orphans after repeat import, privacy of downloaded spreadsheets and active/archived cycle boundaries. **No hosted or real applicant verification was performed in this foundation.**

## Test evidence

`src/lib/aceOrphanReview.test.ts` uses synthetic fictional rows only: review-state transitions, contradictory pairings, revoked match, withdrawn/noneligible/unknown states, duplicate or cross-cycle export refusal, minimal field allowlist, deterministic name ordering, Excel/Sheets formula defusing and UTF-8 names. This does not verify the future database or operational workflow.
