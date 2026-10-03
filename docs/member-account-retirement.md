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

Local evidence (2026-10-02, branch rebased on the then-current `main`; #507, #508
and #509 were still open, so final integration is a separate step):
- Full Jest: 154 suites / 1,505 tests passed, including admin authorization,
  session/sign-out, retired account routes, member points, admin imports, the
  source-boundary guard and the RLS verifier phase guard. Timezone suites passed
  in UTC, America/New_York, Asia/Ho_Chi_Minh and America/Los_Angeles.
- ESLint reported no errors (only existing script-URL fixture warnings in tests);
  production build compiled; `git diff --check` clean.
- `src/types/database.ts` is the generated file from `main` again: the migration
  preserves every legacy table, column and function, so the generated types keep
  describing them. Type-checked with pinned TypeScript 5.6.3 / `target: es2015`
  (the `tsconfig.typecheck.json` introduced by #507) plus the TypeScript 4.9 / es5
  build.
- Hosted RLS verifier (read-only anon sections, production): `pre-migration` phase
  passed; `post-migration` phase correctly failed on the six legacy archive reads
  because the migration is not applied yet. An unknown phase exits non-zero.
- Isolated PostgreSQL proofs and before/after companion SQL passed
  (`bash scripts/test-retired-member-check-in.sh`). Retired client grants/triggers
  returned zero rows afterward; synthetic row counts and active points totals were
  unchanged.
- Offline browser QA (earlier run) used an unreachable localhost Supabase URL and
  dummy public key, with no hosted requests: approved-admin login renders at
  desktop/mobile, profile is a generic 404, public points lookup renders without
  login, and the leaderboard settles into its existing outage fallback.
  Real authentication, imports, known totals and hosted grants need staging QA.

For manual rollout:

1. Keep hosted public signup disabled for all enabled Auth channels. Local
   `[auth].enable_signup` and `[auth.email].enable_signup` are false. Admin accounts
   are existing/invited only; use the existing trusted admin approval process.
2. Inventory the hosted catalog and snapshot aggregate counts/totals with the
   read-only companion SQL below. Confirm no unexpected trigger/wrapper still
   invokes retired functions. Take the normal backup before manual schema changes.
3. Exercise the new frontend against the existing schema in a non-production
   environment; it needs no archive tables or new columns. Test the migration
   against a staging copy/branch of the live schema. Verify existing/invited admin
   login, profile creation and event create/edit there.
4. During a short coordinated rollout, manually apply the retirement migration
   before deploying the new frontend. Older cached code attempting an obsolete
   API must be denied; an old Admin Events editor can report a code-save failure
   in this interval, so reload admin tabs after the deploy. Public points, House
   views, imports and other active schema paths remain compatible.
5. Re-run the read-only catalog/count checks. Verify no retained count or active
   point total changed. Run the hosted RLS verification in the **post-migration**
   phase with mutation mode off:
   `RLS_RETIREMENT_PHASE=post-migration node scripts/verify-rls-security.mjs`, or
   dispatch the `RLS verification` workflow with `retirement_phase=post-migration`.
   Provide an existing ordinary account as well as an admin to exercise both
   JWT audiences. Never create a public account to perform this check. When it
   is green, set the repository variable `RLS_RETIREMENT_PHASE=post-migration` so
   PR, push and scheduled runs keep asserting the retired state.
6. Verify `/profile` is the generic 404, login rejects non-admins, public lookup/
   leaderboard/House standings show the same known totals, and admin attendance/
   CSV import still updates member totals in staging. Check mobile/light/dark
   login and Events controls without performing production writes.

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
