# Member account and code check-in retirement

Owner decision: 2026-10-02. Issues: #233, #234, #464.

## Decision and rationale

Member accounts and the old code-based check-in product are **formally retired**.
Students browse publicly and look up points at `/points`; Supabase Auth serves
existing/invited approved admins at `/admin/login`. Public signup must remain
disabled. This decision supersedes the temporary parked-account state.

The member-based attendance ledger already supplies public points, House
standings, member history, and Wrapped without accounts. The account-based ledger
was separate and never reconciled with those totals. Retaining a second product
adds password/support/privacy obligations and contradictory totals without an
active student benefit. Issue #464 records a broken legacy RPC; retirement makes
repairing that RPC unnecessary. Issue #234's proposed repository move is also
obsolete: the RPC call and its entire application path are removed.

This cleanup does not transfer legacy totals, redesign standings, change matching
or import calculations, or delete Auth accounts, member records, or Storage files.

## Engineering brief and acceptance

Actors are public visitors and approved admins. The affected surfaces are the
removed `/profile`, public signup APIs, legacy account points/providers, and
Admin Events code controls. No new route, dependency, public data source, House
assignment, or member calculation is introduced. Auth, grants, triggers, and
private data make this a high-risk change with audit-first points/architecture
review and independent review before delivery.

| Acceptance | Evidence |
|---|---|
| Existing admin login, authorization failure, deep links, sessions and sign-out remain | AuthContext, AdminRoute, SignInForm access/enumeration regression tests; hosted admin QA required |
| No public account/signup product remains | `/profile`, `/signup`, `/register`, `/sign-up` 404 smoke tests; source/config retirement guard |
| `/points`, leaderboard, House totals and member attendance/import use the current ledger | Repository boundary, Find My Points/leaderboard hooks, adminMembers, MemberWorkflow and Import.file tests |
| Events save form URLs and points without code controls or secret calls | Admin Events create/edit regressions and public column allowlists |
| Backend retirement preserves history and active SQL behavior | Isolated PostgreSQL fixture, repeatability, ACL/trigger checks; hosted verification still required |

## Removed application paths

- Parked `/profile`, both profile components, MemberDashboard, unused legacy
  Header, ProtectedRoute, SignUpForm, signup/profile schemas, and dead auth repo.
- PointsContext/PointsProvider, `usePoints`, `useEventAttendance`, the old points
  repo, CheckInCodeInput, ManualCheckIn, and GenerateCheckInCode.
- Code read/write/check-in methods, unused account-attendance event detail/stats
  methods/hooks, code expiry fields in application projections/types/forms,
  and code-control copy/mocks/tests that only described the retired product.
- Private auth-profile avatar lookups. Shared avatars still render approved
  public URLs and the account-free photo-request workflow remains.

The frontend database types describe the reachable application API. Archived
table/RPC types are removed from that contract; their physical schema is retained.
Privacy warnings about historical secrets and data-rights archive count fields
remain intentional and are not account/check-in execution paths.

## Database retirement and preservation

Forward migration:
`supabase/migrations/20261003000000_retire_member_account_check_in.sql`.
It is committed for **manual application**; a frontend merge does not apply it.
Historical migrations are unchanged.

| Objects | Action |
|---|---|
| `event_attendance`, `user_points`, `event_check_in_secrets`, `check_in_codes`, `check_in_code_usage`, optional `check_ins` | Preserve tables, rows, columns and FKs; revoke all PUBLIC/anon/authenticated table and explicit column privileges |
| Every overload of `check_in_to_event`, `generate_check_in_code`, `set_event_check_in_code`, `create_event_check_in_secret`, `handle_new_user_points`, `get_user_points`, `update_user_points`, `handle_check_in` | Retain bodies for dependencies/history; revoke EXECUTE from PUBLIC, anon, authenticated and service_role |
| Event code-generation triggers and Auth points-bootstrap triggers, including renamed registrations using the mapped functions | Detach automatic retired write paths |
| `events.is_code_expired` and any retained legacy schema fields | Preserve dormant database columns; application no longer selects or writes them |
| `check_in_form_url` | Preserve admin-only operational attendance form URL |
| Auth users, `user_profiles`, `is_admin_user`, `handle_new_user`/profile trigger, `members.user_id`, avatars/photo workflows | Preserve admin provisioning/authorization, historical identity links and public photos |
| `get_event_points`, `update_event_points`, `set_event_points`, member attendance synchronization/recalculation, member/House views and imports | Preserve active point assignment/calculation without modifying definitions or grants |
| Admin data-rights preview/export/anonymization routines | Preserve existing dependencies and authorization; definer routines can read archived tables despite client revokes |

No API client, including a signed-in admin, has direct archive access after apply.
Database operators/service-role table access remains for controlled retention and
existing privacy operations. This is an API freeze, not deletion of retained data
or removal of the owner's operational database authority.

Dropping legacy tables is intentionally excluded. The August 19 audit recorded
35 secret rows and 9 user-points rows; September 28 issue #464 recorded zero
legacy attendance rows. These are **dated observations, not a fresh production
inventory**. Privacy routines reference the retained tables. Current meaningful
data has not been inspected, so even an apparently empty table is preserved.

## Verification and rollout

Verification is split so CI is valid before and after the coordinated rollout:

| Layer | Runs | Proves |
|---|---|---|
| Hosted RLS verifier, `pre-migration` phase (default) | PR / push / daily CI | Production as it is today is still locked down; unaffected by this PR |
| Offline PostgreSQL fixture/assertions (`scripts/test-retired-member-check-in.sh`) | Locally, before apply | The migration itself revokes the intended grants and detaches triggers |
| Hosted RLS verifier, `post-migration` phase | Manually after apply, then by CI once `RLS_RETIREMENT_PHASE` is set | The migration really landed on the hosted project |

The hosted verifier never needs the migration to be applied before merge, and no
assertion is weakened: the legacy-state assertions are the ones that already ran on
`main`, and the retired-state assertions are strictly stronger (`42501` for every
role, admins included).

Offline SQL proof requires local `initdb`, `pg_ctl`, and `psql`:

```bash
bash scripts/test-retired-member-check-in.sh
```

The runner creates a unique disposable PostgreSQL cluster with no TCP listener,
uses synthetic records, applies the migration twice, and removes the cluster.
It verifies retained rows/columns/FKs/functions, explicit column ACL closure,
all retired overload grants, trigger removal, invitation profile creation,
event-type points, member attendance synchronization, and actual admin-only
data-rights dependency preview. It also runs the companion catalog inventory before/after and applies twice with optional objects absent.
This is focused compatibility proof, not a full Supabase chain replay or hosted
schema test. The active deployed recalculation trigger bodies are not all tracked.

Local evidence (2026-10-02, rebased onto `main` after #507, #508 and #509 merged):
- Full Jest: 181 suites / 1,945 tests passed, including the admin session-expiry,
  admin-status and sign-in lifecycle suites from #507, the #508 Events bulk/confirm
  suites, member points, admin imports, the source-boundary guard, the admin-auth
  retention guard and the RLS verifier phase guards. Timezone suites passed in UTC,
  America/New_York, Asia/Ho_Chi_Minh and America/Los_Angeles (70 tests each).
- ESLint reported no errors (only existing script-URL fixture warnings in tests);
  `npm run typecheck` (TypeScript 5.6.3), `npm run build` (TypeScript 4.9, es5),
  Edge Function `deno check` and `deno test` (52 tests) and `git diff --check`
  passed.
- `src/types/database.ts` is identical to `main`: the migration preserves every
  legacy table, column and function, so the generated types keep describing them.
- Hosted RLS verifier (read-only anon sections, production): `pre-migration` phase
  passed; `post-migration` phase refuses to run without existing ordinary-user and
  admin accounts, and (with them) would require `42501` on the six legacy archive
  reads, which is expected to fail until the migration is applied. An unknown phase
  exits non-zero.
- Isolated PostgreSQL proofs and before/after companion SQL passed
  (`bash scripts/test-retired-member-check-in.sh`). Retired client grants/triggers
  returned zero rows afterward; synthetic row counts and active points totals were
  unchanged.
- Offline browser QA (earlier run) used an unreachable localhost Supabase URL and
  dummy public key, with no hosted requests: approved-admin login renders at
  desktop/mobile, profile is a generic 404, public points lookup renders without
  login, and the leaderboard settles into its existing outage fallback.
  Real authentication, imports, known totals and hosted grants need staging QA.

### Manual rollout and completion gates

**Retirement is not operationally complete until every box below is checked.**
Merging the PR, applying the migration, or editing `supabase/config.toml` is not
enough on its own. `config.toml` `enable_signup = false` only configures the local
Supabase stack; it says nothing about the hosted project, whose Auth settings live
in the Supabase dashboard. As of 2026-10-02 the hosted project still reports
`"disable_signup": false` from `GET /auth/v1/settings` (issue #429 is open).

Hosted setting and admin access (manual, dashboard):

- [ ] **Hosted public email signup is disabled** for every enabled Auth channel
  (Authentication → Sign In / Providers → turn off "Allow new users to sign up").
  Verify with the public anon key, not by reading the dashboard:
  `curl -s -H "apikey: $REACT_APP_SUPABASE_ANON_KEY" "$REACT_APP_SUPABASE_URL/auth/v1/settings"`
  must return `"disable_signup": true`.
- [ ] **No new public member account can be created.** Confirm the signup endpoint
  refuses (do not complete a real signup against production; the settings response
  above is the evidence, optionally plus a staging attempt).
- [ ] **Existing/invited admin login still works** at `/admin/login`, a non-admin
  account is turned away, and the session-expiry prompt still re-authenticates in
  place. New admins are invited from the dashboard.

Database and CI (manual apply, then the workflow):

- [ ] Inventory the hosted catalog and snapshot aggregate counts/totals with the
  read-only companion SQL below. Confirm no unexpected trigger/wrapper still
  invokes retired functions. Take the normal backup before manual schema changes.
- [ ] Exercise the new frontend against the existing schema in a non-production
  environment (it needs no archive tables or new columns), and test the migration
  against a staging copy/branch of the live schema.
- [ ] **The retirement migration is applied**, manually, before the new frontend
  deploys. Older cached code attempting an obsolete API must be denied; an old
  Admin Events editor can report a code-save failure in this interval, so reload
  admin tabs after the deploy. Public points, House views, imports and other
  active schema paths remain compatible.
- [ ] Re-run the read-only catalog/count checks. No retained count or active point
  total changed.
- [ ] **The post-migration RLS workflow passes with anon + ordinary authenticated +
  admin coverage.** Configure the existing test accounts as repository secrets
  (`RLS_TEST_USER_EMAIL`/`_PASSWORD`, `RLS_TEST_ADMIN_EMAIL`/`_PASSWORD`; an
  existing ordinary account and an approved admin, never a newly created public
  account), then dispatch `RLS verification` with `retirement_phase=post-migration`
  (or run `RLS_RETIREMENT_PHASE=post-migration node scripts/verify-rls-security.mjs`).
  This phase fails closed: with either account missing the workflow stops with a
  clear error instead of skipping, so a green run proves all three audiences.
- [ ] **Only then** set the repository variable `RLS_RETIREMENT_PHASE=post-migration`
  so PR, push and scheduled runs keep asserting the retired state.

Application checks (staging, without production writes):

- [ ] `/profile` is the generic 404, login rejects non-admins, public lookup/
  leaderboard/House standings show the same known totals, and admin attendance/
  CSV import still updates member totals. Check mobile/light/dark login and Events
  controls.

Issue #429 (disable public email sign-up) must be referenced from the rollout and
closed **only after** the hosted `disable_signup: true` response above has been
observed. Do not close it because `config.toml` or this PR changed.

Read-only catalog and aggregate inventory:
[`member-account-retirement.sql`](./member-account-retirement.sql). Before apply,
the ACL/trigger queries list expected legacy exposure; after apply they must
return no rows. They inspect privileges rather than execute retired mutation RPCs.

## Limits and follow-ups

- No production SQL, signup configuration change, private-data inspection, or
  Storage operation is performed by this cleanup. Hosted retirement is complete
  only after manual apply and verification.
- Old identities/JWTs are not erased. `authenticated` is not synonymous with
  admin; existing RLS and admin-only function guards remain mandatory.
- Historical data-rights export SQL refers to `user_points.total_points` and
  timestamp columns that #464 says differ from production. That is pre-existing
  schema drift: retain the tables, verify historical export privately, and handle
  any repair separately. Do not revive check-in or change active ledger totals.
- #233's retirement decision is implemented; #234 and #464 are superseded by
  removal, not by repository refactoring or RPC repair. Close all three on merge
  using the cleanup PR's issue references, with the manual DB rollout noted.
