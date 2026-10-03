# Recruitment status and attention queue

Covers #275 (admin application windows), #281 (homepage closing-soon notice), and #253 (Admin Overview "what needs me?"). All three read the same pure helpers in `src/lib/applicationWindows.ts`, so the admin page, the public site, and the Overview can't disagree about what "open" or "closing soon" means. **No migration, no new table, and no change to `public_application_links` or its masking.**

## One definition of "closing soon"

`CLOSING_SOON_DAYS = 7` (and `OPENING_SOON_DAYS = 7`) live in `applicationWindows.ts`. The homepage notice, the admin card's "Closes tomorrow" line, and the Overview queue all call `getClosingSoon()`, which recomputes status from `open_at` / `due_at` / `is_enabled` against `now` (never from a cached `status`). Days are counted on the **San Diego calendar**, not 24-hour blocks, for both the wording and the cutoff: a 25-hour-away deadline at 11 PM PT reads "tomorrow", and at 8 AM PT on Oct 1 an Oct 8 11:59 PM PT deadline is "in 7 days" and listed. The homepage notice starts at San Diego midnight, `CLOSING_SOON_DAYS` calendar days before the due date.

Every datetime in these surfaces is shown through `formatPacificDateTime()` ("Oct 8, 2026, 11:59 PM PT"), independent of the browser's timezone. Run `npm run test:timezones`; the new suites are part of it.

## /admin/applications

- **State per window:** Open, Scheduled, Closed, Disabled, or *Needs fixing* (`getAdminWindowState`). Both dates and "Students can reach the form now / Not public" are on the card, not behind Edit.
- **Needs fixing** = an error issue: missing/invalid schedule, close not after open, or an *enabled* window without a complete `https://` URL. A *disabled* window with a bad URL only gets a heads-up. A seeded `example.com` link is always a warning (it shows again in the publish confirmation). Note the database view only checks enabled + dates, so a live row with a bad link **is** reachable by students; the card says so rather than "Not public".
- **Guardrails:** the Zod schema is unchanged; the form adds live notices (close before open, open time already in the past). The Enable button refuses a window with an error issue.
- **Public preview** (below the form): "Right now" and "Once open". It renders the site's own `CTABlock` from `projectPublicApplicationLink()` (the same `getApplicationStatus` + `maskTargetUrl` as the view), so a scheduled or closed window shows its before/after message and **no link**. The raw form link appears only in a labelled *Admins only* line outside the student-facing card. The public projection was not changed to allow this.
- **Confirmation:** a save or Enable that moves a window from not-public to publicly reachable asks first, as does changing the link of a window that is live right now. Copy-only edits and saves that publish nothing don't. A Google Drive link keeps its existing "is it public?" confirmation.
- **History:** reuses `admin_activity_log` (Recent Changes → *Applications*): `application.window_created / updated / toggled / deleted` with `application_key`, previous/new state and schedule, actor, and timestamp. **The form URL is never stored**, only `urlChanged`. Like every activity write, it is best-effort and never blocks a save (the activity-log migration `20261002040000` is still unapplied in production until the owner applies it).

## Homepage notice

`ClosingSoonApplications` sits directly after `ThisWeekInVSA` (it does not touch it). It reuses the cached `usePublicApplicationLinks` query, so it adds no request, and renders nothing while loading, on error, and when nothing is closing soon. It never gates first paint and can't push the This Week cards down. Only a row that is open right now **and** carries a valid `https://` URL becomes a link; the masked public projection already withholds the URL of a scheduled/closed/disabled window. Up to three notices; the pulse dot is `motion-safe:` only. Timers run at the real boundaries: the Apply link is removed the moment a window closes, and the public links are refetched when a scheduled window opens (the server withholds its URL until then); a minute tick only keeps the wording fresh.

## Admin Overview attention queue

`AttentionQueue` is the first block on `/admin` and reads signals the Overview already loads. Count-only: no names, emails, submissions, or request details are ever read into it.

| Signal | Source | Destination |
|---|---|---|
| Application windows closing / opening within 7 days, and windows that need fixing | existing `application_links` read (+ `application_key`, `target_url`, used only to classify the window, never shown) | `/admin/applications?filter=open` / `?filter=scheduled` / `?filter=misconfigured` |
| Pending photo requests | head count, `member_photo_requests` `status = pending` | `/admin/photo-requests?filter=pending` |
| Open data-rights requests | head count, status not completed/rejected/cancelled | `/admin/data-rights?filter=open` |
| Unresolved Ask VSA feedback | head count, `ai_feedback.resolved_at is null` | `/admin/ai-feedback?filter=unresolved` |
| Feedback to triage | existing `feedback` read, `status = pending` | `/admin/feedback?filter=pending` |
| Unpublished events in the next 14 days | existing `events` read | `/admin/events?filter=draft` (opens Manage) |

**Request budget:** the three head counts replace the old `merge_exclusions` count in the same single parallel stage (net +2 requests; 17 table reads). `adminRequestBudget.test.ts` still replays a full Overview load through the real guard three times without tripping it.

**Deliberately skipped:**
- *Unreviewed merge suggestions*: Merge Review derives them by matching the whole `members` table in the browser; a dashboard count would reintroduce that read.
- *Failing launch-checklist items*: the checklist runs about twelve separate queries; counting it here would undo the #503/#505 fan-out reduction for a cosmetic number.

Application counts use the same window-state rule as the admin page, so each count matches the rows its link shows. A source that fails to load is reported as "Could not check", never read as zero, and "You're all caught up" appears only when every source loaded and nothing is waiting. Seasonal suppression: the "no upcoming published events" content-health warning is quiet during summer break (`warnsWhenNoUpcomingEvents`); window and draft-event signals are date-bounded, so they disappear out of season by construction.
