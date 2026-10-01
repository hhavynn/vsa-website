# GBM launch hardening

## Scope and access boundary

The launch audit found mobile contrast/focus/viewport problems, authenticated
access to raw member/import data, anonymous uploads without an aggregate budget,
concurrent AI calls bypassing logged-request limits, disabled HSTS, and dependency
advisories. This change fixes that audit scope for public visitors and admins.
RLS, grants, Storage, and provider spend make it high risk; migrations require
owner review and manual rollout. No attendance, points, House membership, or
leaderboard calculations change.

Public member reads move to a SELECT-only allowlist view. Raw member and import
ledger reads require admin. Photo upload and AI admission RPCs require service
role, enforce authorization internally, use an empty search path, and reserve
capacity atomically before external work. Reservations contain hashes rather
than raw IPs or chat messages. No secrets are added to the frontend.

## Mobile changes

- Preserve semantic program button colors and link underlines.
- Remove contrast-reducing opacity from points explanations; correct the Current
  badge and sign-in label colors in both themes.
- Cap Ask VSA height against the viewport at every breakpoint.
- Portal sheets above the assistant, isolate the background with inert, trap
  focus, restore the opener, and preserve prior scroll state.
- Make the horizontally scrolling past-event rail keyboard accessible.

## Dependency and transport changes

React Router 7.18.4 patches the audited router advisories. Jest 27 needs a narrow
package-export mapping and Web encoding APIs; obsolete v6 future flags are removed.
Compatible transitive overrides patch CRA's SVG, CSS, serialization, proxy, UUID,
and dev-server dependencies without ejecting. `scripts/start-dev.cjs` adapts CRA's
removed WDS options and shutdown/stats interfaces, keeps host/origin checks ahead
of source/proxy routes, preserves same-origin resource policy, and defaults to
loopback. `node --test scripts/start-dev.test.cjs` checks real HTTP behavior,
invalid host/cross-site denial, source handling, route fallback, and clean shutdown.

HSTS is enabled for this hostname for one year. No subdomain or preload coverage
is assumed.

## Validation evidence

- Lint and production build pass.
- Jest: 53 suites, 449 tests pass, including new sheet and signed-upload regressions.
- Deno: 8 AI handler tests and 6 photo broker tests pass; both Edge entrypoints typecheck.
- Dev-server HTTP/security/shutdown integration test passes.
- npm audit and npm audit --omit=dev: zero vulnerabilities.
- Production artifact: 19 public routes × light/dark at 390 × 844; no page errors,
  horizontal overflow, or WCAG A/AA axe violations in the rendered states.
- At 844 × 390, the assistant and close button remain in view in both themes.
  At 320 × 700, calendar sheets retain Tab focus and restore their opener on Escape.

Browser checks exercise public rendering, not a production photo submission,
private/admin data, or migrated database authorization. Existing jsdom warnings
remain accepted by the repository validation policy.

## Rollout gate and order

This PR is draft until database verification and owner review are complete.
Docker's daemon was unavailable and no disposable PostgreSQL database was present,
so actual SQL policy/concurrency execution is **unverified**. Portable guarded
tests are included in `scripts/test-photo-upload-security.py` and
`supabase/functions/vsa-ai-assistant/quota_postgres_test.py`; each requires an
explicit disposable local database and never loads project environment files.
No migration, Edge deployment, or production upload was performed.

1. Verify all three October migrations and the portable SQL tests in an approved
   disposable/staging environment, then run the RLS runbook with ordinary/admin
   test credentials and explicitly opted-in mutation tests there.
2. Have a maintainer experienced with this repository's migrations review the
   access changes and budgets. Apply the migrations manually only after approval.
3. Deploy `member-photo-upload` (public endpoint with JWT gateway verification
   disabled) and the updated `vsa-ai-assistant` after their migrations exist.
4. Deploy the frontend/HSTS configuration; verify safe public lookup, admin raw
   access, a real signed upload, direct upload rejection, and concurrent AI quota
   rejection using dedicated approved test data.

Old clients against the restricted schema temporarily lose raw-table public
lookup and direct photo submission; new clients against old schema fail closed
because the view/RPCs are absent. Coordinate the rollout promptly and never reopen
public raw reads or anonymous Storage INSERT to resolve a mismatch. See the photo
and assistant runbooks for quotas and operator recovery. Production RLS CI uses
the deployed schema, so a PR check can fail until these migrations are deployed;
that is a rollout blocker, not permission to merge a red check.

Scheduled RLS verification retains guarded zero-row view grant probes. Base-table
write probes now require explicit mutation opt-in because even no-op updates can
fire triggers; default CI does not certify those write policies.
