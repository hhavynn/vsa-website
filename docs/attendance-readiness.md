# Post-event attendance status (#653)

Admin → Houses → **Attendance status** answers, for each event of an academic year: has its sign-in sheet been imported, is anything left to review, and was it checked? House standings only reflect imported attendance, so a quiet House may just be a missing import. Admin-only and private: House credits shown here stay embargoed (#692).

## Statuses

| Status | Meaning |
|---|---|
| Upcoming | Has not happened yet. |
| Pending import | Past, with no attendance, no import and no admin statement. |
| Import failed | The latest import job did not complete (needs review if it is still running). |
| Needs review | Imported rows still need a member match (`import_job_rows.decision = 'review'` with no attendance, whose latest recovery action is missing, `open`, `investigating` or `needs_info`). Those people have no credit yet. |
| Imported | The latest import finished with nothing open, not yet checked against the sheet. |
| Verified | A reconciliation run (`attendance_reconciliation_log`) or an admin's "checked" statement is newer than the latest import and the latest credit. A later import puts it back to Imported. |
| No sign-in | An admin stated the event had no sign-in (refused while the event has credits). |
| Unknown: verify manually | Has attendance but no import record: before import auditing began (2026-05-23), or entered another way. Never shown as done. |

The header shows the last import that finished with nothing to review, and how many past events may still change the standings. "Point-earning events only" (on by default) hides events with no points or no term.

## Data and safety

- `admin_event_attendance_readiness(p_year, p_term_id)` (migration `20261028090000`) returns per-event facts only: credits, latest import job, open review rows, last reconciliation, the current statement, and the event's House credits. House credits use exactly the attribution of `house_yearly_points` (active profile, effective membership by the event's date, positive points, the 2025-26 cutoff), so they add up to it (proved in `scripts/test-event-attendance-readiness.sh`). The status itself is derived in `src/lib/attendanceReadiness.ts`. No points are computed.
- `admin_attest_event_attendance` appends to `event_attendance_attestations` (who, when, optional note). It never touches attendance or points. The table has RLS on, no policies and no table grants: only the two functions reach it. Statements can be withdrawn (`cleared`); the latest row is current.
- Both functions check `is_admin_user` and are SECURITY DEFINER (the House score views are private to the API since #692). EXECUTE is revoked from anon. At most 400 events per year are returned, and the page says when it stops there.
- Fixing a status happens in the existing tools: Import, the recovery workspace, the reconciliation process. This page does not import, award or recalculate anything.

Not yet: a non-sensitive summary for ACE/CRC chairs who are not admins needs a role that does not exist (#654), and Admin Overview does not show these statuses yet.
