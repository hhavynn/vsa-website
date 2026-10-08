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
| Correct incorrect match | Row credits a member whose attendance exists | Inserts the correct member's attendance; with "Remove it", deletes the original row in the same transaction |
| Dismiss | Any open finding | History only: `intentional_skip`, `legitimate_duplicate`, or `not_actionable` (needs a note) |
| Needs more information | Any open finding | History only, with a required note |
| Reopen | Dismissed or on-hold findings | History only |

Before any write the dialog shows the original event and import reference, the stored source row, the
current match or unresolved status, the selected member with email, college, year, totals and recent
attendance, whether they already attended, and the exact database changes. Candidates are listed but never
preselected. The admin must confirm identity (or, for Create, that the attendee differs from every
suggestion) and then confirm the changes.

**Points.** Only `member_event_attendance` rows are written. The live `trg_sync_member_points` trigger
recalculates cached totals for each member touched; yearly, House and leaderboard views read the ledger.
A correction is DELETE + INSERT, never an UPDATE of `member_id`, because the trigger recalculates only
`NEW.member_id` on UPDATE and would leave the wrongly credited member's total stale.

**No double credit.** `UNIQUE(member_id, event_id)` plus `ON CONFLICT DO NOTHING`: a destination who
already attended gets nothing ("already recorded"). A finding can be recovered once; a recovered finding
is read-only here (change that attendance in Admin Members).

**Concurrency and retries.** The function:
- locks the import row and rejects a caller whose view of the history is stale (the dialog keeps the
  state it opened with)
- stores a client request id and a fingerprint of the parameters, so a retry returns the original result
  without writing and a reused id with different parameters is refused
- takes an advisory lock per (member, event) on every attendance write, so a confirmation and a correction
  for the same member never interleave
- serializes new-member emails with another advisory lock. That lock covers this function only: the
  importer and Admin Members do not take it, and `members.email` has no unique index.

**Removing the original member's attendance** requires a written reason, and proof the credit came from
this row alone. It is refused when:
- the attendance row was not written within two minutes of this import's audit record. An import's own
  writes land a median 1.5–2.3 s earlier; the 8 production matches pointing at older attendance were
  credits that already existed.
- another completed import row credits that member for the event
- another recovered finding confirmed that member for the event

The default is to keep the original and only add the correct member. The removed row is saved in the
history entry so it can be restored.

**Audit.** `import_recovery_actions` is append-only (admins can read it; only the function writes it). It
keeps `import_job_row_id` and `import_job_id` as plain ids, so deleting an import job never erases it, and
each action also writes `admin_activity_log` (`member.attendance_recovered`, `member.attendance_reassigned`,
`member.recovery_dismissed`, `member.recovery_on_hold`, `member.recovery_reopened`). `import_job_rows` is
never modified.

**Verification.** `bash scripts/test-attendance-recovery.sh` runs the migration on a disposable local
PostgreSQL cluster with the production trigger bodies and checks authorization, restore, similar and
identical names, duplicate emails, already-credited destinations, corrections (including credit that
predates the import or is confirmed elsewhere), dismissals, replays, stale and concurrent attempts
(including a confirmation racing a correction), rollback, and that every cached total equals the ledger.

`scripts/audit-import-history.sql` does not read recovery history. After a recovery it still reports the
row by its import-time state (for example, a moved match as `attendance_row_absent`). The Historical
Recovery panel is the source of truth for recovery status.

## Remaining limitations

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
