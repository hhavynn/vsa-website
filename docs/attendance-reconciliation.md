# Attendance reconciliation (Fall 2026)

How the thirteen Fall 2026 sign-in sheets were reconciled against the live attendance ledger, what the decision rules are, and where the evidence lives. The ledger (`member_event_attendance`) stays the single source of truth; nothing here adds a second points source. Sheets contain student data and are never committed.

## What it fixes

Older imports matched on name alone, and four events were never imported. The result was missing credits, credits recorded on the wrong person (two students with one name, one of them credited for both), and duplicate member records for one student with a UCSD and a personal address.

## The pipeline

Parse, normalize, resolve, compare, reconcile, verify, one event at a time in date order so a person created at one event is known to the next.

1. **Resolve** every sheet row with the importer's own resolver (`identityResolution.ts`).
2. **Decide** the rows the resolver left to an admin with [`attendanceReconciliation.ts`](../src/lib/attendanceReconciliation.ts). It records which rule decided each row.
3. **Plan** with `planAttendanceImport` and send the plan through `admin_apply_attendance_import`, the same atomic, revalidating write the Import page uses. Event points, term and member snapshots are rechecked inside the transaction.
4. **Correct** credits that were provably recorded from another person's row (see below), after the right member is credited.
5. **Audit** every row and every change in `attendance_reconciliation_log`.

Each event ran as one transaction. Re-running plans nothing: every row finishes as "already credited" (verified after the run: 0 new credits, 0 new members, 0 removals).

## Decision rules

| Rule | Meaning |
|---|---|
| `email_owner` | A row address belongs to exactly one member and name, college and standing do not contradict it (nicknames and typos in the name are fine). |
| `same_submission` | One row lists addresses held by two member records: one person. The busier record is kept and the other merged with `smart_merge_members`. |
| `unique_candidate` | Exactly one member has this name and nothing contradicts them. A bare name counts. |
| `preserved_credit` | Several members share the name; the one whose existing credit was recorded from this very row keeps it. |
| `different_person` | Every same-name member is contradicted by an address (see below) or by two profile signals; a new member is created. |
| `repeat_submission` | The member was already counted by an earlier row of the same sheet. |

A school login (letters then three digits, e.g. `abc012`) is unique to a student and the digits tell same-initial students apart, so two different logins are two people. A login and a name-based alias (`a8lee`) can belong to one student; two near-identical aliases are treated as a typo. A college or standing that differs on its own can be a slip on the form, so those rows stay pending rather than guessed.

A middle initial never separates two records (the name still compares as exact). A school login with the same digits but different letters (`abc068` / `abxyz068`) is its own review case: same-name students often get similar logins, so it counts as one student only when college **and** class year both agree; if either is missing it stays pending as a near-identical login, and if either differs it is a different person. A full middle name plus a different login still means two people.

A single-word name with no address inherits the full name from the one person elsewhere with that first name, college and standing. A mistyped school domain (`ucsd.edy`, `.net`) is read as `ucsd.edu`.

## Removing wrong credits

A credit is removed only when all of these hold: the import audit shows it was recorded from a specific sheet row; that row is now firmly another member (a different login or another college); no other row of the same sheet credits the member; and the right member received the credit in the same transaction. The original attendance row is stored in `attendance_reconciliation_log.backup` first. Absence from a sheet never removes a credit by itself.

## Audit log

`attendance_reconciliation_log` (migration `20261027045743`) is private: RLS on, admin-only `SELECT`, no anon access. It holds one row per sheet row (`source_row` is the sheet's "Source Row"), plus one row per removed credit, merged member and corrected profile, each with a JSON backup. Outcomes: `credit_inserted`, `already_credited`, `new_member_credit`, `duplicate_submission`, `corrected_assignment`, `pending_review`, `invalid_row`, `credit_removed`, `members_merged`, `profile_corrected`, `resolved_by_admin`.

```sql
-- every row of one event and what became of it
select source_row, outcome, rule, note from attendance_reconciliation_log
where event_id = '<event id>' and source_row is not null order by source_row;
```

## Finishing the pending rows

The six rows left open after the main run were decided by the owner and are logged as `resolved_by_admin` (none are pending). For any future open rows, upload a small file with just those rows on `/admin/import` for the event; the page shows the candidates with their evidence and lets an admin Match existing, Create new or Skip.

## Not applied

This run wrote one transaction at a time, so the per-row production trigger of the time kept cached totals exact (0 drift checked after every event). The statement-level fix, `20261029021759_serialize_member_points_recalculation.sql` (written as `20261010000000`), was applied to production on 2026-10-28. It stores a credit at its event's points, so the 23 Spring 2026 VCN credits stored at 1 (event at 5) become 5 only if a merge rewrites them; they belong to the 2025-26 year and do not affect 2026-27 points.
