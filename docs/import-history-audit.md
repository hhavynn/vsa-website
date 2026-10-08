# Historical attendance import audit

Read-only audit of whether past attendance imports skipped or mis-assigned legitimate attendees,
and a safe path to correcting them. Nothing in this audit writes to production. Figures below are
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

Rows that need a human (flagged = category other than legitimate / no_issue):

| Category | Kind | Priority | Rows | Events |
|---|---|---|---|---|
| Confirmed missing | `created_row_without_member` | high | 4 | 2 |
| Suspected missing | `no_new_member_path` | high | 44 | 4 |
| Suspected missing | `multiple_candidates_unresolved` | medium | 17 | 5 |
| Insufficient evidence | `candidate_already_attended` | medium | 17 | 5 |
| Insufficient evidence | `missing_audit_metadata` | medium | 2 | 2 |
| Possible incorrect match | `email_conflict_match` | high | 14 | 5 |
| Possible incorrect match | `weak_name_match` | high 4 / medium 4 | 8 | 4 |
| Possible incorrect match | `context_mismatch_match` | medium 5 / low 42 | 47 | 8 |

Not a problem: 321 rows skipped as already-recorded/duplicate, and 21 further unresolved rows whose
person demonstrably has attendance for the event (same email, or resolved by another row).

**Confirmed missing (4).** Four rows in the first two jobs (2026-05-23, 2026-05-25) were recorded as
"created" but produced no member and no attendance; no member with that email or name exists. The job
headers corroborate it independently (job 1: 3 created rows, 1 member created). "Confirmed" means the
audit proves the import did not record them; whether each person should be added is still the admin's call.

**Suspected missing (61 + 17).** All 99 `skipped_unresolved_review` rows are `ambiguous_match`, which
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

**Incorrect matches.** 14 fuzzy/forced matches have an email that differs from the matched member's stored
email (7 are from early rows with no recorded method). A differing email can be a student using a second
address, so this is a lead, not a verdict. 42 low-priority rows are admin force-matches chosen among several
candidates, which is expected behaviour.

## Can skipped attendees be recovered? Can matches be investigated?

- **Skipped attendees, from 2026-05-23 on: yes.** The full source row is in `import_job_rows.raw_row`, with
  candidate ids in `match_details`. Nothing needs to be fabricated.
- **Before 2026-05-23: no**, from the database. Only the original sheets can recover them.
- **Incorrect matches: yes, can be investigated**, comparing stored source row against the member profile.
  They cannot be settled automatically, and the audit never infers identity from name similarity alone.

## Proposed recovery workflow (not implemented)

Integrate into the existing Admin Import audit panel (`ImportAuditPanel`) rather than a new surface.

1. **Review.** Add a "Needs follow-up" filter to the panel, fed by Query B's classification (the TS
   classifier is ready to drive it client-side from the same rows the panel already loads). Show category,
   priority, reason and next action; keep names admin-only as today.
2. **Decide identity.** Open the flagged row in the #518 per-row dialog (Match Existing / Create New Member /
   Skip) pre-filled from `raw_row` and the candidate ids. Never default to the best name match.
3. **Check existing attendance.** Before any write, look up `(member_id, event_id)` in
   `member_event_attendance` and show it. Existing attendance means "already recorded": no write.
4. **Restore without duplicate points.** Reuse the importer's write path: insert with
   `upsert … onConflict: member_id,event_id, ignoreDuplicates`, `points_earned` read from the event, and let
   the `sync_member_points` trigger recompute totals. Never write `members` totals or `user_points`.
   Re-running the same recovery is therefore idempotent.
5. **Correct a wrong assignment.** Remove the wrong member/event row and add the right one through the
   existing Admin Members attendance editor (`adminMembers.ts`), which already confirms removal and relies on
   triggers. Never merge or split members to fix a single attendance.
6. **Audit trail.** Write one `import_jobs` row per recovery batch (tagged in `match_details`, e.g.
   `recovered_from_row_id`, since `source_type` is check-constrained) and an entry in the append-only
   `admin_activity_log`. Record before/after attendance ids so the action can be reversed.
7. **Permissions.** Admin-only via existing RLS; any server-side batch RPC must be SECURITY DEFINER with an
   `is_admin` check, follow the revoke-then-grant convention, and be applied to production manually after
   review. None is proposed in this PR.

A migration is *not* required for steps 1–5. Only a batch RPC or a new `source_type` value would need one,
which needs separate approval.

## Remaining limitations

- Evidence queries use lower-case letters-and-spaces name comparison, slightly looser than the app's
  normalizer; they can over- or under-report "name exists".
- `candidate_member_ids` point at live members; if members were merged or anonymized since, candidates may
  be gone (counted as no candidate evidence).
- "Candidate attended" cannot distinguish the same person from a different person who also attended.
- Imports before 2026-05-23, and imports whose audit write silently failed, are invisible.
- Not verified: whether the 17 `candidate_already_attended` and 44 `no_new_member_path` rows are real people
  missing points; that needs an officer comparing against the source sheets.
