# 2026–27 House release rehearsal — #639

**Status: staging rehearsal and signoffs NOT performed.** This runbook is a reproducible test matrix, not evidence that production permissions are correct. It complements the academic-year launch runbook and Admin → Launch Checklist. All test identities, events, payments, and Houses must be synthetic on a verified non-production Supabase project. Store sanitized screenshots and HTTP field manifests in a restricted team workspace, never in public GitHub issues.

## Preconditions — otherwise BLOCK launch

- Confirm staging project ID, backend URL, site URL and migration status are distinct from production. Do not apply migrations or reveal production from this checklist.
- Set up fictional members A, B and C plus an ambiguous same-name pair, four approved current-year House profiles, a 2025–26 archived page, a linked and unlinked House Parent, and a reviewed timestamp-priority assignment batch.
- Two fictional GBMs, a multi-host House social, an event before one member's House effective start, and a later attendance correction are needed. Never create fake attendance or scores in production.
- Verify House public standings embargo: assignment Reveal publishes approved identity ONLY, not live scores, rank, contributions or scored activity. GBM snapshot publication is a separate private process (#693).
- Record active academic year, form deadlines in America/Los_Angeles, and expected baseline archived data without copying any private member information.

## Stage-by-stage evidence (capture status PASS / FAIL / BLOCKED / UNKNOWN)

| Case | Action | Required result |
| --- | --- | --- |
| H01 | 2 minutes before, at and after configured application cutoff and DST shift | CTA works only inside approved window; closed/future target URLs absent from public JSON and DOM; no fabricated deadline |
| H02 | Draft/review automatic House placement with ambiguous and duplicate people | No name-only auto-link, no duplicate canonical ID, no disclosed drafts/payments/House parent identities via anon or unrelated auth |
| H03 | Inspect four selected-year profiles and a prior-year archive | No wrong-year/inactive House substitution, no stale cached member.house value, old archive unchanged |
| H04 | Payment cutoff and unconfirmed canonical applicant, missing House, or failed read | Lock and Reveal blocked with exact reason; unknown network response is never treated as complete or zero unassigned |
| H05 | Authorized Lock → explicit Reveal → retry after lost response | Existing writer handles intervals once, no duplicate effective intervals, prior history preserved; no scoring publication |
| H06 | House, House year/detail/archive, Home, /leaderboard, /points and member modal after Reveal | Correct approved House identity and year, no 2025–26 current fallback or public House totals/ranks/scored roster |
| H07 | Import qualifying fictional attendance, including late House assignment and correction | Individual event points unaffected by House effective date; private House contribution follows interval; public score embargo remains |
| H08 | Publish one two-House hosted social and revoke one host | One consistent calendar/Event/Home entry and correct hosts, no House points invented; association permission failure shown as unavailable |
| H09 | GBM 1, GBM 2 after an intervening import, tie and correction | Only reviewed/announced private snapshot used for comparisons; old official snapshot immutable, no public export or CDN score leak; BLOCK until #693 is verified |
| H10 | Revoke one public association grant or fail a later paginated fetch | Incomplete/denied source reports Unknown, not zero or successful final assignment; no private response fields |
| H11 | Change year and revisit member profiles and cache | House and verified roles stay year-scoped; All-Time does not claim former role is current; archive data unchanged |
| H12 | 320/375/390px, desktop, iOS Safari, Android Chrome, keyboard and screen readers | Accessible modal focus, role badges, 44px controls, intact text wrapping, verified Story export/download where applicable |

## Mandatory staging privacy checks — before and after Reveal, again after first import

In an anonymous session and an unrelated authenticated session, inspect the actual network calls and perform negative queries against protected House score views:
- house_yearly_points
- house_all_time_points
- house_recent_activity
- house_member_yearly_points
- house_member_all_time_points
- admin_private_house_standings RPC and any scored activity endpoints

A successful 200 response with protected House scores or private membership/draft fields is an immediate RELEASE BLOCKER even if the UI hides them. Verify the existing public_house_memberships view and public_member_house_badge RPC reveal only approved, score-free identity after explicit publication. Published House event joins must exclude internal notes, source documents and unpublished host profiles. A denied join must fail closed, not look like an empty collaboration.

Capture timestamp, staging environment, request path, HTTP status and REDACTED field names only. Check public pages from a fresh anonymous session without the admin browser cache. Recheck 2025–26 archive isolation.

## Automated and manual test commands

- CI=true npm test -- --watch=false --runInBand
- npm run repo-map:check
- npx tsc --noEmit
- npm run build
- bash scripts/test-public-house-memberships.sh (disposable local PostgreSQL only)
- bash scripts/test-house-payments.sh (local/synthetic only)
- bash scripts/test-house-points-reconciliation.sh (local/synthetic only)
- node scripts/verify-rls-security.mjs with specifically approved staged connection settings, see docs/rls-verification-checklist.md

Automated Jest coverage includes src/__meta__/houseReleaseJourney.test.ts, House Reveal readiness, public House embargo, role permissions and canonical assignment tests. Do NOT claim Playwright traces exist until the #571 browser harness is actually installed and run.

## Approval ledger — maintain in a restricted team workspace

| Signoff | Required evidence | Initial state |
| --- | --- | --- |
| House operational owner | H01–H05 cutoff, payment and consent/publishing review | Pending |
| Webmaster / engineering reviewer | H03–H11 canonical intervals, year isolation, event/attendance integration | Pending |
| Independent privacy reviewer | Before/after/after-import REST/RPC field inventory, no public House scores or drafts | Pending |
| Accessibility reviewer | H12 devices, keyboard/voiceover, Story export and mobile screenshots | Pending |
| President/designated final launch owner | All above accepted and every blocking defect resolved | BLOCKED |

If a release or import is interrupted: stop further publication, compare the authoritative batch state and dated membership history against the existing audit trail, and run only the owner-approved recovery path. Never directly rewrite members.house, House points, private GBM snapshots or previous membership intervals to conceal a discrepancy. In a privacy incident, owner-reviewed grants/route protections take priority; the public fallback must say unavailable, not invent a winner.

**Completion rule:** Real staging evidence for every applicable case, redacted network proof and all independent signoffs are required. Until then #639 must stay open, regardless of green CI.
