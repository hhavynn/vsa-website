# Historical attendance import audit

Read-only audit of whether past attendance imports skipped or mis-assigned legitimate attendees,
and the admin recovery workflow built on it. The audit itself writes nothing. Figures below are
aggregate counts from a read-only query run on 2026-10-07; they contain no names, emails or raw rows.

## Tools

| Piece | Purpose |
|---|---|
| `scripts/audit-import-history.sql` | Admin-runnable, SELECT-only. Query A: per-job reconciliation. Query B: row-level classification, ids only. |
| `src/lib/importHistoryAudit.ts` | Tested reference classifier and report builder (pure). The SQL mirrors it; keep them in sync. |
| `src/lib/importHistoryAudit.test.ts` | Synthetic-data tests, plus static checks that the SQL has no mutating statements and selects no PII. |

Run the SQL as an admin (RLS on `import_jobs` / `import_job_rows` is admin-only). To summarise,
use the variant noted in the file. Do not paste row-level results into tickets, PRs or chat; join
back to `import_job_rows` / `members` by id inside the SQL editor when a person must be looked at.

## What history is actually retained

| Source | Retained | Limit |
|---|---|---|
| `import_jobs` (since 2026-05-23, #50) | event, source type/URL, row counters, status, creator | Audit-write failures are swallowed (`console.warn`), so a job can exist with no audit, and an import with no audit leaves no trace. |
| `import_job_rows` | full `raw_row` (every CSV cell), name/email/college/year, matched/created/attendance member ids, decision, score, `match_details` (reason, method, candidates, override, `can_mark_new`) | `match_details` on the first two jobs lacks `match_reason`. Rows store ids, not a snapshot of the candidate members, so "who was the candidate" is live data. |
| `member_event_attendance` | one row per member/event (`UNIQUE(member_id, event_id)`) | No record of which import wrote a row. |
| Imports before 2026-05-23 | nothing | Not reconstructable from the database. |

Production holds 14 audit jobs over 10 events (1,320 rows; 2026-05-23 → 2026-10-07), against
3,162 attendance rows overall, so most attendance predates or bypasses audited imports (earlier
imports, admin attendance edits).

## Findings (verified against production, read-only)

Integrity of recorded work is good:
- 0 jobs failed; every job's stored row count equals its `total_rows`.
- All 645 `matched` rows have an attendance row today; all 249 `created` rows with a linked member do too.

Rows that need a human (flagged = category other than legitimate / no_issue; split rows give events per priority):

| Category | Kind | Priority | Rows | Events |
|---|---|---|---|---|
| Confirmed missing | `created_row_without_member` | high | 4 | 2 |
| Suspected missing | `no_new_member_path` | high | 44 | 4 |
| Suspected missing | `multiple_candidates_unresolved` | medium | 17 | 5 |
| Insufficient evidence | `candidate_already_attended` | medium | 18 | 5 |
| Insufficient evidence | `missing_audit_metadata` | medium | 2 | 2 |
| Possible incorrect match | `email_conflict_match` | high 47 / medium 38 | 85 | 7 / 6 |
| Possible incorrect match | `weak_name_match` | high 4 / medium 4 | 8 | 3 / 2 |
| Possible incorrect match | `context_mismatch_match` | medium 5 / low 45 | 50 | 4 / 8 |

Not a problem: 341 rows already recorded (skipped duplicates, plus 20 unresolved rows) whose person has
attendance for the event by identity-strong evidence: the matched member, a member with the same email, or
another completed-job row with the same email whose member still has attendance. A shared name alone never
counts as "already recorded". Every one of the 14 jobs ran before #518 merged (2026-10-08 06:26 UTC), so no
production row yet uses the new `manual_decision` / `skipped_by_admin` audit fields; the audit reads both formats.

**Confirmed missing (4).** Four rows in the first two jobs (2026-05-23, 2026-05-25) were recorded as
"created" but produced no member and no attendance; no member with that email has attendance. The job
headers corroborate it independently (job 1: 3 created rows, 1 member created). "Confirmed" means the
audit proves the import did not record them; whether each person should be added is still the admin's call.

**Suspected missing (44 + 17).** All 99 `skipped_unresolved_review` rows are `ambiguous_match`, which
the old importer used for both "tied candidates" and "one near-name candidate, not confident". For 94
of the 101 review rows `can_mark_new` was false and an email was present, so an admin could only
force-match to an existing member or leave the row skipped. The 44 `no_new_member_path` rows are the
sharpest case: the email is unknown to the roster, no member has that exact name, there is a single
near-name candidate, and that candidate has no attendance either. They are *either* a new person who
could not be created *or* the same person under a new email. The data cannot tell which, so they are
"suspected", never "confirmed". #518 removed this dead end for future imports.

**Header shortfalls.** Three jobs show `matched_rows + created_members` exceeding
`created_attendance_count` by 1–3: rows whose member already had attendance, or two rows hitting one member
(the write is `upsert … ignoreDuplicates`). Every matched row still has attendance today, so these are
collisions, not losses.

**Incorrect matches.** Before #518 a unique exact name auto-matched even when the email or college
disagreed, so exact-name matches are scored alongside fuzzy and admin-chosen ones. 85 matched rows carry an
email that differs from the matched member's stored email; 71 of them are automatic exact-name matches.
47 are high priority: both addresses are UCSD addresses (33 of them exact-name), and one student rarely has
two. The other 38 pair a UCSD address with a personal one, most likely one student with two emails (medium).
A differing email is a lead, not a verdict. 45 low-priority rows are admin force-matches chosen among several
candidates, or exact-name matches whose college differs.

## Can skipped attendees be recovered? Can matches be investigated?

- **Skipped attendees, from 2026-05-23 on: yes.** The full source row is in `import_job_rows.raw_row`, with
  candidate ids in `match_details`. Nothing needs to be fabricated.
- **Before 2026-05-23: no**, from the database. Only the original sheets can recover them.
- **Incorrect matches: yes, can be investigated**, comparing stored source row against the member profile.
  They cannot be settled automatically, and the audit never infers identity from name similarity alone.

## Recovery workflow (Admin → Import → Historical Recovery)

Implemented by migration `20261008000000_historical_attendance_recovery.sql`, which must be applied to
production manually before the panel works (until then it shows a load error and changes nothing).
Findings come from `admin_import_recovery_findings()` classified by `importHistoryAudit.ts` in the
browser. It returns the same evidence as Query B (checked on production data: 0 differences across all
1,320 rows) in about 0.2 s instead of 4.2 s, plus one addition: a recovered finding whose member still
has the attendance counts as identity evidence for other rows with the same email. Every change is one admin-confirmed action on one import row;
there is no bulk or automatic correction.

| Action | Offered when | Writes (one transaction) |
|---|---|---|
| Match existing member | Row credits nobody (skipped, unresolved, created-but-missing) | Inserts `member_event_attendance` for the chosen member with the event's points; `ON CONFLICT DO NOTHING` |
| Create separate member | Same | Inserts a member (email only if no member holds it, case-insensitive), then their attendance |
| Correct incorrect match | Row credits a member whose attendance exists | Inserts the correct member's attendance. **Keeps the original credit** and moves the finding to "Original credit to investigate" |
| Resolve investigation | Finding under investigation | History only, after the database checks the ledger: "did not attend" requires the original credit to be gone already (removed in Admin Members); "also attended" requires it to still exist |
| Dismiss | Any open finding | History only: `intentional_skip`, `legitimate_duplicate`, or `not_actionable` (needs a note) |
| Needs more information | Any open finding | History only, with a required note |
| Reopen | Dismissed or on-hold findings, or a recovered finding whose recorded credit was later removed | History only |

Before any write the dialog shows:
- the original event and import reference, and the stored source row
- the current match or unresolved status
- the selected member with email, college, year, totals and recent attendance, and whether they already attended
- the exact database changes

Candidates are listed but never preselected. The admin must confirm identity (or, for Create, that the
attendee differs from every suggestion, including same-name members the audit row did not list) and then
confirm the changes. Identity actions stay disabled until every member lookup has loaded; a failed lookup
shows an error and a retry, never an empty candidate list.

**Recovery never deletes attendance.** Nothing in the data proves that an attendance row exists only
because of one import row:
- `member_event_attendance` has no provenance column.
- The importer records `attendance_member_id` even when its upsert inserted nothing, and keeps only
  per-job counts of what it inserted.
- The Admin Members editor writes no audit trail.
- Timestamps only correlate. On production, an import's own writes land about 2 s before its audit
  record, but 8 matched rows point at credit that already existed.

Even record-level provenance would not prove the original member was absent: their own sheet row may have
been skipped, or recorded only as a duplicate or a candidate. An independent review reproduced exactly
that deletion against an earlier "move" design. So a correction credits the right member and flags the
original credit. If an officer confirms the original member did not attend, they remove that credit in
Admin Members (the existing confirmed path; the dialog opens it), then resolve the finding here.

**Points.** Only inserts into `member_event_attendance`. The live `trg_sync_member_points` trigger
recalculates cached totals; yearly, House and leaderboard views read the ledger. The event row is read
`FOR SHARE`, so a concurrent points edit either finishes first (recovery uses the new value) or waits and
then cascades to the new row.

**No double credit.** `UNIQUE(member_id, event_id)` plus `ON CONFLICT DO NOTHING`: a destination who
already attended gets nothing ("already recorded"). A finding is recovered once. It can be reopened only
if the credit it recorded no longer exists, which the panel flags.

**Concurrency and retries.** The function:
- locks the import row and rejects a caller whose view of the history is stale (the dialog keeps the
  state it opened with)
- stores a client request id and a fingerprint of the parameters, so a retry returns the original result
  without writing and a reused id with different parameters is refused
- takes an advisory lock per member before writing attendance. Two recoveries for one member, on any
  events, then never compute that member's total from snapshots that miss each other's rows. Without the
  lock, a two-session test left a member at 7 points / 1 event instead of 17 / 2.
- serializes new-member emails with another advisory lock

These locks cover this function only. The importer and Admin Members take neither, and `members.email`
has no unique index (see limitations).

**Audit.** `import_recovery_actions` is immutable:
- Admins can read it, and only the function writes it. `service_role` cannot write it either.
- A trigger rejects UPDATE, DELETE and TRUNCATE from any role, so changing that needs a reviewed migration.
- Its ids are plain columns, not foreign keys, so deleting a member, event, user or import job never
  rewrites or erases it.

Each action also writes `admin_activity_log` in the same transaction:
- `member.attendance_recovered`
- `member.recovery_credit_flagged`
- `member.recovery_investigation_resolved`
- `member.recovery_dismissed`
- `member.recovery_on_hold`
- `member.recovery_reopened`

Admins can also insert into that log directly, so `import_recovery_actions` is the authoritative trail.
`import_job_rows` is never modified.

**Safe before the frontend.** The migration only adds objects and changes nothing existing. The current
frontend does not reference them.

**Verification.** `bash scripts/test-attendance-recovery.sh` runs the migration on a disposable local
PostgreSQL cluster. The cluster has the production bodies of `sync_member_points`,
`recalculate_member_points` and `sync_attendance_points_on_event_update`, and Supabase's default grants.
It checks:
- authorization, including privileges after default grants
- restore; similar and identical names; duplicate emails; already-credited destinations
- non-destructive corrections and investigation resolution against the ledger
- dismissals, reopen rules and history immutability
- replays, and stale and concurrent attempts, including:
  - the same member on two events
  - a recovery racing an event points edit (mutation-tested: each fails without its lock)
- rollback
- that the function contains no DELETE, and that every cached total equals the ledger

`scripts/audit-import-history.sql` does not read recovery history. After a recovery it still reports the
row by its import-time state. The Historical Recovery panel is the source of truth for recovery status.

## Remaining limitations

- Pre-existing trigger race, not introduced here: `recalculate_member_points` computes the sum in the same
  `UPDATE` that waits for the member row lock. A recovery that commits while the importer or the Admin
  Members editor writes the same member's attendance on another event can leave that member's cached total
  short until their next attendance change. Recovery-versus-recovery is serialized. The real fix is to lock
  the member row in `sync_member_points` before recalculating, which is a protected trigger change needing
  owner approval. Until then, do not run Historical Recovery while an import is in progress.
- Admins can edit `import_job_rows` directly (RLS allows it), so the evidence a finding shows is only as
  trustworthy as admin conduct. Recovery never deletes based on it.

- Evidence queries use lower-case letters-and-spaces name comparison, slightly looser than the app's
  normalizer; they can over- or under-report "name exists".
- `candidate_member_ids` point at live members; if members were merged or anonymized since, candidates may
  be gone (counted as no candidate evidence).
- "Candidate attended" cannot distinguish the same person from a different person who also attended.
- Imports before 2026-05-23, and imports whose audit write silently failed, are invisible.
- A stored member email reflects the member today; it can have been filled in after the import ran.
- Not verified: whether the 18 `candidate_already_attended` and 44 `no_new_member_path` rows are real people
  missing points, or whether any `email_conflict_match` row is a wrong person; that needs an officer comparing
  against the source sheets.
