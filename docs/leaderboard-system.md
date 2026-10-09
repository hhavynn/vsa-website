# Yearly Leaderboard System

This document describes the yearly leaderboard system implemented in May 2026.

## One active points and attendance model

Owner decision dated 2026-10-02: member accounts and code-based check-in are
formally retired (#233). This is not a temporary pause or a points-system merge.
See [the retirement decision and rollout](./member-account-retirement.md).

| Concern | Active model |
|---|---|
| Identity | `members.id`, independent of Supabase Auth |
| Ledger | `member_event_attendance`, one member/event pair with `points_earned` |
| Writers | CSV/Google Form import, Admin Members attendance editor, `smart_merge_members`, Historical Recovery (`admin_recover_import_row`) |
| Recalculation | Statement triggers `trg_sync_member_points_{insert,update,delete}` → `recalculate_members_points` (locks members, then recalculates); `trg_attendance_points_from_event` stores the event's current points; event edits use `sync_attendance_points_on_event_update` |
| Readers | `/points`, `/leaderboard`, House standings, member cards/history, Wrapped, Admin Points |
| Public projections | `member_yearly_points`, `house_member_yearly_points`, House aggregate views, `member_event_history`, `public_members` |
| Authentication | Existing/invited approved admins only; students use public lookup without accounts |

The legacy `event_attendance`, `user_points`, and code-storage tables remain
private archives for retention and data-rights dependencies. The retirement
migration removes client access and legacy execution grants and unregisters
code-generation/account-points triggers. No current point calculation reads them.
Do not write or transfer archive totals into the member ledger.

`pointsModelBoundary.test.ts` exercises every leaderboard repository method and
guards against archive/RPC dependencies. `memberAccountRetirement.test.ts` guards
the application against restoring obsolete APIs, components, hooks, or providers.

## Overview

The VSA website now supports filtering leaderboard points by academic year. This allows for seasonal competitions and better historical tracking of member involvement.

## Data Source

The primary source of truth for the public and admin leaderboards is the `member_event_attendance` table, joined through `events` to `academic_terms`.

### Key Tables & Views

- **`members`**: Stores global/all-time points and events attended (legacy/summary fields).
- **`member_event_attendance`**: Individual records of points earned per event.
- **`events`**: Each event is assigned to an `academic_term_id`.
- **`academic_terms`**: Defines the quarter and academic year (e.g., Fall 2025).
- **`member_yearly_points` (View)**: An aggregate view that calculates totals per member per academic year.

## Calculation Logic

Yearly points are calculated by summing `points_earned` in `member_event_attendance` where the associated event belongs to the selected academic year.

**Important**: Events MUST have an `academic_term_id` assigned to be counted in yearly totals. If an event has no term, its points will only appear in the "All-Time" view.

## Admin Operations

### Attendance Import

When importing attendance via CSV:
- Choose a local `.csv` file or a CSV/Google Sheets URL; both use the same parsing, column mapping, matching, preview, review, and import flow. Local file audit entries use `manual` with no source URL.
- The event dropdown now shows the academic term for each event.
- A warning is displayed if the selected event has no term assigned.
- Points are automatically attributed to the correct year based on the event's term.
- Matching proposes; an admin decides. Only two things match automatically: a unique email whose name is consistent, and a unique exact name with no conflicting email or college on file. Near-name matches (even with the same year or college), shared names, shared emails, conflicting emails, and a second row resolving to an already-matched member all wait in review.
- Every review row offers **Match Existing** (pick one specific candidate, shown with college, year, email and points), **Create New Member** (confirms a different person, even with an identical name), and **Skip**. Decisions are reversible (Undo) until the import is confirmed, and nothing unresolved is ever turned into a match or a member.
- A new member is never given an email another member already holds; they are created without it and the final summary counts them. An existing member's email, college and name are never overwritten by an uncertain match.
- Before confirming, the preview shows valid rows, existing members credited, new members, already-recorded, duplicate rows, unresolved matches, and rows skipped. Unresolved rows require an explicit acknowledgment before a partial import; the final summary reports what was written and what was not.
- Audit rows record `manual_decision`, `suggested_member_id` and a `final_reason` (`skipped_by_admin`, `skipped_unresolved_review`, `invalid_row_no_name`) on `decision = 'review'` rows. To recover them, import the same sheet again: people already credited show as already recorded, and skipped rows return for a decision. Attendance upserts ignore existing member/event pairs, so repeating an import never doubles points.
- If a write fails after members were created, a retry in the same session reuses those members instead of creating them again.
- A matched member's profile `year` advances (never rewinds) when the CSV reports a higher standing. This applies to safe matches and to review rows an admin explicitly matched; email and college are only filled on safe matches. Review rows left unconfirmed are skipped entirely.

### Historical Recovery

Admin → Import → Historical Recovery fixes audited import rows one at a time: credit a confirmed existing member, create a separate member, credit the correct member for a wrong match (the original credit is kept and flagged for investigation, never deleted), dismiss, or hold for more information. Every write goes through the `admin_recover_import_row` database function in one transaction. It only inserts attendance, with `ON CONFLICT DO NOTHING`, and leaves recalculation to `trg_sync_member_points`. A confirmed wrong credit is removed in Admin Members, then the finding is resolved. Details: [import-history-audit.md](./import-history-audit.md).

### Member Management

Admins can create a member with first/last name and optional email, year, and college using **Add Member**. House assignment remains on Admin Houses.

Use **History** or **Edit → Manage attendance** to view and edit attendance. Additions read current event points and ignore existing member/event pairs; removal requires confirmation. Database triggers own recalculation; the UI reloads member totals, history, and yearly totals after each mutation. Events need an academic term before attendance can be added.

The Member History modal includes:
- A yearly breakdown of points earned.
- The specific academic term for each attended event.

## Future Considerations

- **Auto-Term Assignment**: New events should automatically be assigned to the current active term to ensure data consistency.

### Points integrity and concurrency

`members.points` and `members.events_attended` are a cache of the ledger
(`member_event_attendance`). House and yearly standings are live views over
the ledger and never drift. Migration
`20261010000000_serialize_member_points_recalculation.sql` makes the cache safe
under concurrent writers:

- Every statement that changes attendance recalculates its affected members
  once, from statement-level triggers (old and new owners on update, FK
  cascades included). The recalculation first locks those `members` rows
  `FOR NO KEY UPDATE` in id order, then sums the ledger in a separate statement,
  whose fresh snapshot includes every writer that committed before it.
  Before this, two writers for one member could leave a total that missed the
  other's credit.
- Inserting a credit (or moving it to another event) locks the event row
  `FOR SHARE` and stores the event's current points, so a concurrent points
  edit either lands first or cascades to the new credit.
- Within a statement, members are locked in ascending id, so two imports can
  no longer deadlock on members. Writers for different members never wait for
  each other. The migration header lists each writer's lock order. The deadlocks
  that remain need two multi-step transactions crossing those orders (for
  example, a merge racing a points edit on an event both members attended).
  PostgreSQL detects them and rolls one transaction back whole, so they surface
  as a retryable error, never as wrong totals.
- Rule: a credit is stored at its event's current points, whatever the writer
  sends. The importer, Admin Members and Historical Recovery already send that
  value. `smart_merge_members` copies the source's stored value, so a source
  credit stored off its event's value is stored at the event's value on the
  merged member.
- Rollback: `scripts/sql/points-recalculation-rollback.sql` (one transaction;
  keeps the locking recalculation, restores the row trigger).

Proof is offline: `bash scripts/test-points-concurrency.sh` (production
trigger bodies as the baseline, which must reproduce each race; the fixed
schema, which must pass every round; and mutants with one protection removed,
which must fail). It also runs `scripts/test-attendance-recovery.sh` with the
migration applied.

Read-only check, safe against production: `scripts/sql/points-integrity-check.sql`
reports members whose cached totals differ from the ledger, and credits whose
stored value differs from the event's current points. Never repair a finding by
writing cached totals; fix the ledger and let the triggers recalculate.
