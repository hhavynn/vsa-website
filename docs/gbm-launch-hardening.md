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
- Actual local PostgreSQL 18 policy/ACL/concurrency tests pass for all three
  migrations. Photo tests cover the exact safe projection, anonymous/ordinary
  denial, admin access, service-only admission, same-IP/member/email concurrency,
  rotating-IP global caps, and the lifetime budget. AI tests cover concurrent
  session/IP/global limits, legacy logs, idempotent completion, abandoned
  reservations, expiry, and unsupported-isolation rejection.
- npm audit and npm audit --omit=dev: zero vulnerabilities.
- Production artifact: 19 public routes × light/dark at 390 × 844; no page errors,
  horizontal overflow, or WCAG A/AA axe violations in the rendered states.
- At 844 × 390, the assistant and close button remain in view in both themes.
  At 320 × 700, calendar sheets retain Tab focus and restore their opener on Escape.

Browser checks exercise public rendering, not a production photo submission,
private/admin data, or migrated database authorization. Existing jsdom warnings
remain accepted by the repository validation policy.

## Rollout gate and order

The owner authorized the reviewed rollout on October 1, 2026 (UTC). Docker remains
unavailable; the portable tests ran successfully against dedicated fixture
databases on the existing local PostgreSQL installation. The tests require an
explicit disposable local database and never load project environment files.
Production uses PostgreSQL 17.6; the fixture execution used PostgreSQL 18.

Live read-only preflight confirmed enabled RLS, caller-bound admin authorization,
the existing pending-request triggers/defaults, and a private photo bucket allowing
JPEG/PNG/WebP with a 5 MiB ceiling. The new objects were absent before rollout.
Only migration `20261001000300_atomic_ai_quota` has been applied and recorded
atomically in production migration history. The updated `vsa-ai-assistant`
(version 22, existing JWT verification preserved) and new `member-photo-upload`
(version 1, public gateway) are deployed. Invalid-input HTTP smoke checks returned
400 without creating reservations or calling the provider.
Live read-only simulations using existing ordinary/admin profiles confirmed
caller-bound helper behavior and the AI RPCs' internal service-role guards, even
when invoked by the database owner. Profile identifiers were not exported.

The two restrictive migrations and frontend/HSTS deployment remain pending
Vercel authentication. Applying those restrictions before the compatible frontend
is ready would disrupt public lookup and photo submissions. The photo broker
fails closed for valid requests until its admission RPC exists. No production
photo submission, test account creation, member-row mutation, or deletion was
performed. Dedicated ordinary/admin credentials are unavailable, so real
authenticated client verification remains an explicit gate.

1. Prepare a production-environment frontend deployment without moving domains.
2. Apply only the remaining two reviewed migrations manually, recording each
   transaction in migration history; do not push unrelated pending migrations.
3. Verify safe projection and browser/service grants, then promote the compatible
   frontend promptly. Both required Edge Functions are already deployed.
4. Verify the frontend/HSTS configuration, safe public lookup, admin raw
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
