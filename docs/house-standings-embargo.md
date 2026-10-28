# House standings embargo — #692

**Policy (CRC-approved):** House points are still computed and reviewed
privately. There is **no public live House score**, rank, momentum, per-event
House delta, member House-contribution breakdown, or archived standings. The
House Chair/CRC announces reviewed official snapshots at GBMs. Issue #693 owns
that future freeze, review and export workflow; do not invent snapshots here.

## Trust boundary and affected surfaces

- PostgreSQL authority: five `house_*_points` / `house_recent_activity`
  views, still using existing qualifying attendance and effective memberships.
  Migration `20261028073000_embargo_public_house_scores.sql` **revokes
  SELECT from PUBLIC, anon and authenticated**. Database owners and approved
  admins may still compute/review scores; no formulas, triggers, attendance
  or membership writes are changed.
- **Admin read**: `admin_private_house_standings(p_year)` with a
  `public.is_admin_user(auth.uid())` check, safe argument bounds, and an
  EXECUTE grant only to authenticated. An ordinary authenticated user must
  get 42501; logged-out users must be denied at the grant layer. Do not expose
  this RPC to public pages or House Parents.
- **Identity-only public read**: `public_member_house_badge(member_id,
  year)` resolves a single effective House label/color after the appropriate
  membership publication. For 2026 onwards this requires a published
  `house_assignment_batches` record for that year. No points or membership
  roster, no draft assignments, no unpublished family identity.
  Enumerating a public member ID must not bypass reveal.
- **Web pages**: Home, `/leaderboard?view=houses`, `/house`,
  `/house/year/*`, individual House pages and the static Wrapped recap
  show a GBM-announcement notice rather than score data. Individual VSA
  leaderboard points remain public under the existing approved policy.
  `src/components/features/wrapped/HouseCup.tsx` is not mounted in public
  routes: do not import it on a public page. Old cached browser bundles and
  historic static exports may still contain previously released figures.
- **No implied permission**: `authenticated` alone is not admin or CRC
  authorization; publicly displayed House names are not score release approval.

## Rollout order (STAGING FIRST; not yet verified here)

1. Save a sanitized/synthetic baseline in isolated staging. Record the existing
   House view definitions and totals using a read-only snapshot; compare them
   to the same totals after migration to prove the scoring math did not move.
2. Apply `20261028073000_embargo_public_house_scores.sql` in staging.
   Never re-run historical migrations, weaken policies, or mutate production.
3. **API negative tests:** using anon key and a test non-admin authenticated
   account, attempt `GET /rest/v1/house_yearly_points?select=*` and the other
   four views. Each must return permission denied (SQLSTATE 42501), not an
   empty 200 response. Attempt `admin_private_house_standings` with anon
   and non-admin; both must deny. A guessed member ID before Reveal must
   return null from `public_member_house_badge`.
4. **Positive admin tests:** sign in as a test approved administrator, call
   `admin_private_house_standings` by POST for a seeded synthetic year, check
   accurate totals and no member personal data in the aggregate result. Verify
   admin import, regular member yearly points, and House reconciliation still
   work. Verify approved badge after Reveal and current-year-only visibility.
   An ordinary user must not become an admin simply by signing in.
5. Execute `RLS_HOUSE_EMBARGO_PHASE=post-migration node
   scripts/verify-rls-security.mjs` against staging, with test credentials
   configured through secrets. This check runs SELECT-denial probes and an
   approved-admin positive RPC test; it does not apply migrations.
6. Verify public Home, House, House detail, `/leaderboard?view=houses`,
   `/points`, Wrapped and Top-3 Story at desktop and mobile sizes, logged
   out and as a normal user. Inspect Network and the **serialized response**
   and built JavaScript: no score view requests, fallback totals, historic
   House leaderboard, private member contribution or query errors. Test the
   normal individual points leaderboard and approved House badge.
7. After owners approve a production rollout, deploy compatible frontend and
   database changes in the same controlled window, ensure no stale cached
   JavaScript keeps requesting old score views, and rerun the post-migration
   negative/positive tests. Archive the results **without real member data**.

## Rollback and remaining risk

Do **not** restore anonymous SELECT grants as an emergency UI rollback:
doing so exposes scores again. A frontend rollback must retain the private
database boundary; revert to a no-score UI and re-verify the five views remain
denied. If the admin RPC is unavailable, temporarily use authorized direct
database access for CRC internal review, not a public API shortcut.

Static client tests prove only the committed source and SQL text, **not live
Postgres grants, hosted browser cache, RLS or user role configuration**.
Previously published/archived numbers cannot be made secret retroactively,
and an individual member's public activity plus disclosed House affiliation
may allow partial score inference. These limitations require an explicit
owner review before calling #692 fully closed.

This branch has **not applied** a migration to production or run live
RLS verification. #693 owns official GBM snapshots, release approvals and
embargo-safe export; this PR must not create or auto-publish those snapshots.
