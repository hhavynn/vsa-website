# Content Health and Ask VSA knowledge freshness

Last updated: 2026-10-04

Closes #287 (admin content-health dashboard) and #239 (detect stale Ask VSA knowledge). It extends the Admin Overview "Needs attention" queue from #512 instead of adding a separate notification center.

Nothing here edits, hides, or deletes content. A finding is a pointer to the admin page that fixes it.

## Where it lives

| Surface | What it does |
|---|---|
| `/admin/content-health` | Every finding: priority, reason, content type, last-checked time, a "Fix it" link to the admin page that resolves it, and Acknowledge for the ones that can be accepted. Filter by priority and content type. |
| `/admin` (Needs attention) | One count: "6 content health issues", linking to the page above. Counts only. |
| `/admin/ai-knowledge` | Per-row freshness badge, the reason, a "Needs review" filter, "Most urgent first" sort, and **Mark reviewed**. |
| `/admin/launch-checklist` | "Ask VSA knowledge is current" (automated) and "Review Content Health" (manual link). |

## Checks

| Check | Content type | Priority | Fires when | Cleared by |
|---|---|---|---|---|
| Draft event past its date | Event | Medium | `is_published = false` and the event ended more than a day ago, within the last 90 days (older drafts are treated as abandoned) | Publish or remove the event (`/admin/events?filter=draft`) |
| Public upcoming event missing fields | Event | Medium if no location, else Low | Published, upcoming, and no location, cover image, or both | Fill the fields |
| Empty gallery album | Gallery album | Medium | No Google Photos link, and the album is more than 2 days old | Add the link |
| Incomplete program content | Program content | Medium | Published and has no title/text, a button label without a link, or obvious placeholder text (`lorem ipsum`, `TODO`, `[insert ...]`; not "TBD") | Edit the section |
| Stale academic-year reference | Program content | Low | Published text names only prior school years (`2025-2026`), never the current one; ISO dates like `2025-10-04` do not count | Edit the text |
| Stale Ask VSA knowledge | Ask VSA knowledge | High / Medium / Low | See below | Mark reviewed, or fix the date/link |
| Broken image | Event, Gallery, Cabinet, House, VCN, Site settings | High | Weekly check: 404/410, a missing `/images/...` file, or (on two runs) a URL that returns HTML instead of an image | Fix the URL |
| Dead link | Gallery, Program, Resource, Ask VSA source | Medium | Weekly check: 404/410 | Fix the URL |

Healthy content produces nothing. Application windows are not re-checked here: `/admin/applications` already owns that, and the Overview queue already surfaces them.

## Ask VSA knowledge freshness (#239)

The table already carried most of what freshness needs: `last_verified_at` (when it was last reviewed), `category` and `source_type`/`source_url` (source), `valid_until` (time-bound), `academic_year`, and `freshness`. The only missing fact was which public entity a row refers to, so migration `20261004000000` adds two nullable columns, `linked_entity_type` (`application` or `event`) and `linked_entity_key` (an `ApplicationKey`, or an event id). Curated knowledge stays human-reviewed: nothing is copied from the linked entity, and the editor refuses to link an unpublished event.

The reviewer is **not** stored on `ai_knowledge_base`: that table is readable by anon for active public rows. "Mark reviewed" sets `last_verified_at` and writes `ai.knowledge_reviewed` to the admin-only `admin_activity_log` (Recent Changes → Ask VSA), which carries the actor (pinned to the signed-in admin by RLS) and time. The page shows a first-name label from that entry, and only when the entry is the current review (within 5 minutes of `last_verified_at`).

**A public snippet never describes an unpublished event**, enforced in the database as well as the UI: a trigger (`guard_ai_knowledge_linked_event`) refuses to save or reactivate an active public snippet linked to an event that is not published, and both `match_ai_knowledge_base` and the public read policy on `ai_knowledge_base` (narrowed by `20261004010000`) hide such a snippet if its event is unpublished or deleted after it was linked, so anon cannot read its text directly from the table either. Admins still see it, so it can be fixed. Nothing is deactivated or rewritten automatically; the snippet is flagged High in Content Health until an admin fixes it. Dates on the page are Pacific-time calendar dates, and saving other edits never re-stamps the review date.

Rules live in `src/lib/aiKnowledgeFreshness.ts` and are deterministic. Only active, public rows are evaluated.

| Rule | Priority | Detail |
|---|---|---|
| Time-bound fact expired | Medium | `valid_until` has passed. Retrieval already skips it; this is a gap, not a wrong answer. Marking reviewed does **not** clear it: renew the date or deactivate. |
| Expiring within 14 days | Low | Cleared by a review made inside that window. |
| Prior-cycle year-specific content | High | `academic_year` is before the current year, the row is not `stable` or `historical_archive`, and it has not been reviewed since 1 September (Pacific) of the current year. If the active term was switched before then, a review does not count: revise the content and update the year label. |
| Unreadable year label | Low | A changing row whose `academic_year` is not `2026-2027` / `2026-27` / `2026`, so the year rule could not run. Edit the label. |
| Review cadence | Low | `quarterly` 90 days, `event_live` 14 days, `yearly` 365 days since the last review. `stable` is **never** flagged for age. |
| Linked application window | Medium / High | Edited after the last review; closed after it; or gone (High). A key can have several windows, so the newest one is judged. |
| Linked event | Medium / High | Edited after the last review, or already over (a review must be after the day following it); or missing or **unpublished** (High: a public snippet must not describe a draft event). |

"Current year" is the active academic term, falling back to the calendar-derived year, the same as the Overview. If the lookup fails, the year rule is skipped, not guessed. If the linked rows cannot be read, the entity rules are skipped, not read as "gone".

## Acknowledging without hiding a real failure forever

Acknowledging stores a `content_health_state` row (`kind = 'acknowledgement'`) holding the finding key, a **fingerprint** of the condition, and an expiry (60 days). It only applies while the fingerprint still matches:

- Derived findings: the source row's `updated_at`. Any edit brings the finding back.
- Link failures: the URL plus `failing_since`, when the current failing streak began. A link that recovers and breaks again is a new streak, so an old acknowledgement does not hide it.
- Ask VSA findings cannot be acknowledged; reviewing the row is the resolution.

States: **fixed** (the finding is gone, nothing to show), **acknowledged** (listed under "Acknowledged", not counted, with Stop ignoring), **still failing** (counted). The expiry bounds every acknowledgement even if nothing changes.

## How the Overview stays cheap

The Overview already read events, gallery, program content, Ask VSA rows, and application windows. Content Health adds columns to those same reads (never a text column that is large: event descriptions and gallery image arrays are deliberately not read) and **one** new request: a filtered read of `content_health_state` (failed link checks, the last-run row, acknowledgements; healthy rows are never read). The full report is computed from those rows in `buildOverviewSnapshot`, cached under the existing `admin-health` query key (60 s, no refetch on focus or timer, retries off), and the queue receives only `{ issues, urgent }`.

`/admin/content-health` reads the same cached snapshot, so Overview → Health costs nothing, and the two numbers cannot disagree. Opening Health directly loads the same set the Overview loads. The #503/#505 request-budget tests still pass (`adminRequestBudget.test.ts`; the Overview is now 18 table reads, up from 17).

## Weekly image and link check

External checks never run from the browser. `scripts/check-content-links.ts` (`npm run check:content-links`) runs from `.github/workflows/content-link-check.yml`, reads the public image/link fields (target list in `src/lib/contentLinkCheck.ts`; it never reads `source_doc_url`, `drive_folder_url`, planning docs, notes, or anything private), and writes its results to `content_health_state` with the service role from a GitHub Actions secret.

- `/images/...` paths are checked against the checkout: no network (a path that climbs out of `public/` counts as missing).
- Supabase hosts get a **HEAD only**, never a GET, including when a link redirects to one. The paid image-transform (`render/image`) endpoint is not checked.
- Never contacted, **including when a link redirects to them**: Instagram and other social hosts, Google Drive/Docs/Forms/Photos and Google's image hosts, link shorteners (`bit.ly`, `linktr.ee`, ...), and file-sharing hosts (Dropbox, OneDrive, Notion, Canva, ...). Redirects are followed by hand (3 hops at most) and every hop goes back through this policy.
- Never fetched from the CI runner: `localhost`, private or metadata addresses, IP literals, credentialed URLs, non-default ports, single-label or `.local`/`.internal` hosts, on the first hop or any redirect. (A public name that later resolves to a private address is not caught; response bodies are never read, which limits the harm.)
- One request at a time; at least 2 s between requests to the same third-party host; self-identifying user agent; one retry of a transient failure; response bodies cancelled unread; a 1-byte ranged GET only where HEAD is refused (never to a Supabase host). HEAD can still be answered by an origin behind a CDN, so "HEAD only" limits egress rather than proving zero.
- Cache windows: ok 7 days, failing 20 hours, inconclusive (403/429) 30 days. At most 120 URLs per run (a few requests each in the worst case), results saved in batches as they arrive, and no new URL is started after 15 minutes. A run immediately after an applied run contacts nothing it just checked. **A dry run saves nothing**, so a second dry run, or a dry run followed by `--apply`, contacts the same URLs again; a dry run defaults to 25 URLs for that reason.
- A failure is shown to admins only when it is certain (404, 410, missing file) or has repeated on two runs (timeouts, 5xx, HTML instead of an image, loops). A failed check is a recorded result, never an action. A URL whose check hit an unexpected error is recorded inconclusive and the run continues.
- A cached URL is forgotten only when every source table was read in full that run, so a failed or truncated read never resets a failure's history. Reads are paged explicitly (PostgREST caps a response).
- CI logs never name admin-only links (Resources Index, Ask VSA source URLs). The cache table is admin-only and stores each URL as written, so a token in a Resources Index link is stored there; keep tokens out of those links.

**The schedule ships dormant.** Before enabling it:

1. Apply `20261004000000_content_health_state_and_ai_knowledge_entity_link.sql` to production manually, after running `scripts/verify-content-health.sql` against a local or staging database.
2. Run the workflow once from the Actions tab with `apply: true` and read the job summary. Run it first with `apply: false` to see what it would do.
3. Set the repository variable `CONTENT_LINK_CHECK_ENABLED` to `true`.

Until then, `/admin/content-health` says link checks are not set up and everything else works. A fixed link can show as failing until the next run.

Run it locally (dry run by default; it checks but writes nothing):

```bash
npm run check:content-links               # dry run
npm run check:content-links -- --limit 10 # at most 10 URLs
npm run check:content-links -- --apply    # also write the cache (needs the migration)
```

## Schema and access

Migrations `20261004000000_content_health_state_and_ai_knowledge_entity_link.sql` and its follow-up `20261004010000_ai_knowledge_public_read_linked_event.sql` (additive, forward-only, apply manually):

- `ai_knowledge_base.linked_entity_type`, `linked_entity_key`: nullable, constrained to `application`/`event` with a key. Anon can read them on active public rows; they hold only a public identifier.
- `content_health_state`: RLS on, `anon` has nothing, admins (`is_admin_user`) read everything. Admins can insert/update/delete **only** `acknowledgement` rows, as themselves, and can update only `kind`, `subject_key`, `fingerprint`, `acknowledged_at`, `expires_at` (so `acknowledged_by` cannot be rewritten). `link_check` and `check_run` rows come only from the weekly job (service role), so an admin cannot mark a failing link healthy.

Frontend before migration: the Overview and Launch Checklist retry their Ask VSA read without the entity columns, a save that does not touch the link or review date names neither column, and a missing `content_health_state` reads as "links not checked", so deploying the frontend first degrades quietly instead of breaking. The documented order is still migration first.

The migration also replaces `match_ai_knowledge_base` (same signature, owner and grants) to add the linked-event condition, and adds the `guard_ai_knowledge_linked_event` trigger. No current row has a link, so neither changes any answer today.

## Privacy

Findings carry public content names, generic reasons, and admin paths. No member email, phone, roster, Ask VSA chat log, admin note, recap note, or application submission is an input. The Overview carries counts only. Link URLs are shown without their query strings.

## Deferred on purpose

- Auto-fix, auto-unpublish, or deleting anything: out of scope by design.
- Checking Instagram, Google Drive/Docs/Forms/Photos links (they block bots or answer 200 for dead links). Gallery albums' Google Photos links are therefore only checked for presence.
- Validating that an internal route in a link field (`/events`) or an Ask VSA `source_url` path still exists.
- External-event (`external_events`) and UVSA school links and logos; intern and ACE photos.
- Re-checking one URL on demand from the admin page (needs an authenticated trigger for the job).
- Stale-year detection beyond Program content (event descriptions, homepage copy), which risks flagging legitimate history.
- Per-snippet "linked to a House or Cabinet year" entities.
