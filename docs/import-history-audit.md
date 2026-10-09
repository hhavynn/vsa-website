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

Implemented by migration `20261009000026_historical_attendance_recovery.sql`, applied to production on
2026-10-09 (the file was renamed to the version Supabase recorded).
Findings come from `admin_import_recovery_findings()` classified by `importHistoryAudit.ts` in the
browser. It returns the same evidence as Query B (checked on production data: 0 differences across all
1,320 rows) in about 0.2 s instead of 4.2 s, plus one addition: a recovered finding whose member still
has the attendance counts as identity evidence for other rows with the same email. Every change is one
admin-confirmed action on one import row, applied through `admin_recover_import_row`. Admins can review
and apply many such actions together (see "Bulk reconciliation workspace" below), but nothing is ever
decided or applied automatically.

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

When correcting a match or resolving an investigation, the dialog also lists every other audited row
for the event that names the originally credited member: matched, created, credited, a duplicate, or a
candidate. That is evidence they may have attended.

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
if the ledger no longer matches what it recorded, which the panel flags:
- the credit it added was later removed, or
- an investigation resolved as "original also attended" and that original credit was later removed.

**Concurrency and retries.** The function:
- locks the import row and rejects a caller whose view of the history is stale (the dialog keeps the
  state it opened with)
- stores a client request id and a fingerprint of the parameters, so a retry returns the original result
  without writing and a reused id with different parameters is refused
- takes an advisory lock per member, then locks that member's row, before writing attendance:
  - Two recoveries for one member, on any events, queue on the advisory lock and never compute the total
    from snapshots that miss each other's rows. Without it, a two-session test left a member at
    7 points / 1 event instead of 17 / 2.
  - A recovery that starts while the importer or Admin Members is writing the same member waits for that
    write to commit. Without the row lock: 10 / 1 instead of 17 / 2.
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
frontend does not reference them. It refuses to run if an earlier draft's table (the destructive
`removed_attendance` shape) exists, and drops that draft's 10-argument function if present. Production had
neither as of 2026-10-08 (read-only check).

**Member lookups stay out of request URLs.** Recovery looks members up by attendee email, surname and
typeahead text through `admin_lookup_members(p_emails, p_surnames)` and
`admin_search_members(p_query, p_limit)` (migration `20261009232329_admin_member_lookup_rpcs.sql`, applied to production on 2026-10-09 with owner
approval and recorded under that version), not
through `members?or=(email.ilike…)` filters. supabase-js sends `rpc()` arguments in a POST body, so emails
and names no longer appear in Supabase API logs; both functions refuse GET and HEAD. They are SECURITY INVOKER
(the admin-only `members` RLS still applies), check `is_admin_user(auth.uid())` first, pin `search_path`
to `''`, revoke EXECUTE from PUBLIC and anon, and return a jsonb array so the row cap cannot truncate a
common surname. Matching is literal (`_` and `%` are not wildcards). **Deploy order:** apply this
migration before the frontend that calls it; until then Historical Recovery lookups fail. After applying,
run the RLS verification workflow with `member_lookup_phase=post-migration`, then set the repository variable
`RLS_MEMBER_LOOKUP_PHASE=post-migration` so a later missing or broken lookup function fails CI.

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
  - the workspace's two-lane batch, and a retry after a lost response. An equivalent payload replays;
    a changed payload, or a request id reused on another row, is refused.
- the member lookup functions: no EXECUTE for anon or PUBLIC under default grants, INVOKER with an empty
  search_path, non-admin and GET refused, exact/literal matching, the 1000-value cap and the search limit
- rollback
- that the function contains no DELETE, and that every cached total equals the ledger

### Bulk reconciliation workspace

The panel is an event-scoped review table (`src/components/features/admin/recovery/`). The single-row
dialog above stays available on every row as Details / Full review, and is the only path for resolving an
investigation or reopening.

- **Triage.** Each row is placed in one of five groups: safe or already resolved; straightforward,
  confirm; ambiguous identity; possible incorrect original match; insufficient evidence. The table
  suggests crediting an existing member only when the row's email equals that member's stored email.
  Similar names produce "compare these", never a suggestion. A new member is suggested only when no
  member has the email or the name and no similar member attended. Suggestions are never preselected
  or staged.
- **Staging.** Match, Create, Credit correct member, Dismiss and Needs more information are staged
  inline. Nothing is written until Apply.
  - Staged decisions survive event switches and page navigation in this tab only: sessionStorage, keyed
    by admin, with a 4-hour TTL. Other admins' staged work is removed on load. Leaving the page with
    staged work prompts first.
  - Each decision freezes its exact request, including the request id and the history entry it was
    staged against.
- **Bulk staging** applies only to homogeneous cases and lists the rows it skips and why:
  - Needs more information, with one shared note.
  - Dismiss, with one shared reason. "Legitimate duplicate" needs ledger evidence on each row.
  - New members, only for rows that have an email and no possible existing identity, once per person.
  - Bulk never matches anyone to an existing member.
- **Review.** One confirmation re-reads findings, history, members, attendance, event points, email
  holders and, when members are created, the whole roster. It blocks:
  - a finding that changed since staging
  - a member whose details changed (the admin re-confirms)
  - one member credited twice for one event
  - rows that look like the same person sent to different members
  - a new-member email that is duplicated or already held
  - similar names on bulk-created members

  A restore whose member already attended adds nothing and cannot be reopened, so it needs a per-row
  acknowledgement. The ledger summary always shows 0 attendance removed.
- **Apply.** Calls `admin_recover_import_row` once per row, at most 2 at a time, with one member's rows
  in one lane. Each row reports applied, already applied, conflict, failed (rolled back) or no answer.
  - Applied rows leave staging. The others stay, with their request kept.
  - A row with no answer is locked until the next review. If the history holds its request id, it
    counts as applied. If not, it never committed, and applying again sends the identical request.
  - After a run, a read-only check compares the affected members' cached totals with their attendance
    and reports any difference. It never writes totals.

`scripts/audit-import-history.sql` does not read recovery history. After a recovery it still reports the
row by its import-time state. The Historical Recovery panel is the source of truth for recovery status.

## Remaining limitations

- Pre-existing trigger race, not introduced here: `recalculate_member_points` computes the sum inside the
  same `UPDATE` that waits for the member row lock. Recovery now waits for earlier writers, and other
  recoveries wait for it. In one direction it still applies: the importer or Admin Members writes a member
  on another event while a recovery for that member is committing. That writer's own trigger can then
  leave the cached total short, until that member's next attendance change.

  The real fix is to lock the member row in `sync_member_points` before recalculating. That is a protected
  trigger change needing owner approval. Until then, do not run Historical Recovery while an import is in
  progress. Detect drift (read-only) with:

  ```sql
  select m.id, m.points, m.events_attended, coalesce(sum(a.points_earned), 0) as ledger_points, count(a.id) as ledger_events
  from public.members m left join public.member_event_attendance a on a.member_id = m.id
  group by m.id having m.points <> coalesce(sum(a.points_earned), 0) or m.events_attended <> count(a.id);
  ```
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
