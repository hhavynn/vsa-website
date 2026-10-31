# Staging and Production RLS Verification Checklist

This document provides a runbook and instructions for Vietnamese Student Association (VSA) admins to verify that Row Level Security (RLS) policies and security hardening are active and working correctly on staging and production databases.

---

## 1. Purpose

Member accounts and code-based check-in are retired. The active points system uses `members`, `member_event_attendance`, and the member/House points views. The retirement migration removes API access to legacy archives and execution privileges on obsolete functions; it preserves their data. See [the retirement runbook](member-account-retirement.md).

This verification tooling performs automated checks to prove that:
- Anonymous users cannot retrieve sensitive member columns (`email`, `user_id`) or admin tables.
- Authenticated ordinary users cannot modify points, check-ins, or access private data-rights request details.
- Neither anonymous nor signed-in users can write through public views.
- Authorized administrators retain administrative access.

---

## 2. Environment Variables & Test Accounts

To run the verification script, configure the following variables in a `.env.local` file or export them directly in your shell.

```text
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Authenticated Ordinary User Test Account (Safe to mutate/test)
RLS_TEST_USER_EMAIL=test-member@example.com
RLS_TEST_USER_PASSWORD=test-password-here

# Administrator Test Account
RLS_TEST_ADMIN_EMAIL=admin-user@example.com
RLS_TEST_ADMIN_PASSWORD=admin-password-here

# Optional/Gated IDs (For targeted checkups)
RLS_TEST_EVENT_ID=a-valid-event-uuid
RLS_TEST_MEMBER_ID=a-valid-member-uuid
RLS_TEST_DATA_RIGHTS_REQUEST_ID=a-valid-data-rights-request-uuid

# Enable Mutation (Writes) Testing
RLS_ALLOW_MUTATION_TESTS=false
```

---

## 3. How to Run Against Staging

Running against staging is highly recommended before performing production checks.

1. Configure `.env.local` with your staging Supabase credentials and test accounts.
2. Run the script:
   ```bash
   node scripts/verify-rls-security.mjs
   ```
3. Confirm that all automated checks print `PASS`.

---

## 4. How to Run Against Production Safely

When running against production, safety is the highest priority:
1. **Never run with `RLS_ALLOW_MUTATION_TESTS=true` on production** unless VSA leadership has explicitly approved a maintenance window and you have confirmed back-ups.
2. Ensure you are using credentials for **non-production test accounts** or dedicated verify accounts. Never run scripts using live, active member accounts if they could trigger unexpected lockouts or alerts.
3. Verify that the output prints a clean audit log and exits with `0` (Success).

---

## 5. Non-Mutating (Read-Only) Verification Checks

By default, the script performs read checks and guarded zero-row view probes; base-table mutations require explicit opt-in:
- **Anon: sensitive columns check** — attempts to select `user_id` and `email` on `members`. Expects access denied.
- **Anon: safe columns check** — queries `public_members`, the safe allowlist projection needed for leaderboards. Expects success. From the `RLS_HOUSE_CACHE_PHASE=post-migration` phase on, the legacy `house` column is left out of this projection and asserted denied instead (see [House phases](#house-phases)).
- **Anon: upload reservation check** — count-only SELECT on `member_photo_upload_reservations` must return permission denied.
- **User: raw-member privacy checks** — head/count-only reads of `members` and `member_event_attendance` must be denied or return zero rows; the same account must retain SELECT on `public_members`. No private values are printed. Requires existing ordinary test credentials; never create a live account to run this.
- **Admin: raw-member checks** — head-only reads of both base tables must succeed, preserving import/review permissions.
- **Post-migration phase only — anon/user/admin retired archive checks** — head-only reads of `event_attendance`, `user_points`, `event_check_in_secrets`, `check_in_codes`, `check_in_code_usage`, and `check_ins` must return `42501`. Older code/usage/check-in tables may be absent. Empty results do not prove privilege revocation. In the default `pre-migration` phase these reads are not asserted as `42501` (production still has the legacy grants); instead the pre-retirement legacy assertions run: anon/ordinary users cannot read rows of `event_check_in_secrets`, admins can, and the gated admin manual check-in probes behave as before. See [Retirement phase](#retirement-phase).
- **Anon: data rights RPC check** — attempts to call preview/export functions. Expects access denied.
- **Anon: data rights requests check** — attempts to query requests history. Expects access denied or empty list.
- **Anon and user: zero-row writes through public views (#472)** — attempts `UPDATE` and `DELETE` through every public view listed in the script. Expects `42501`. Supabase's default privileges grant `ALL` on new views to `anon` and `authenticated`, and a simple single-table view runs as its owner, so a leftover write grant bypasses the base table's RLS. A write that succeeds is reported as FAIL naming the view. Non-destructive: every write is filtered on the nil UUID, the same filter is read first and the probe is not run if it matches anything, and the base tables have only row-level triggers, so a zero-row write fires nothing. Aggregate and join views reject writes with `55000` before Postgres checks grants, so for them the script prints one SKIP line; any other error is a FAIL. Filtering a write needs `SELECT` on the view, so a role that cannot read it gets `42501` whether or not the write grant exists: a denied read on a view the role should read is a FAIL, and anon on `my_member_photo_requests` (signed-in only by design) is a SKIP that the signed-in run covers. The signed-in run needs the `RLS_TEST_USER_*` account. **When you add a view, add it to `simpleViews` or `nonUpdatableViews` in the script.**
- **User: write probes, gated by `RLS_ALLOW_MUTATION_TESTS=true`** — attempts current-value updates on `events`, `members`, and `member_event_attendance`. Expects denial or zero updated rows. In `pre-migration` mode the legacy `event_attendance`/`user_points` probes also run; they never run in `post-migration` mode.
- **User: data rights check** — attempts to read data rights requests or call admin RPCs. Expects access denied.
- **Admin: data rights read check** — attempts to read data rights requests. Expects success.
- **Admin: RPC access check** — calls dependency/export handlers with a nil request UUID in read-only mode, so no real export/audit row is created. A real `RLS_TEST_DATA_RIGHTS_REQUEST_ID` is used only with mutation opt-in. Expects authorization access, even when the nil request is not found.

### Incident regression checks (#227)

Each historical security incident has one check per property it established. The logic lives in `scripts/lib/rlsIncidentChecks.mjs` as pure functions over a Supabase-like client; `verify-rls-security.mjs` runs those same functions against production, and `src/lib/rlsIncidentChecks.test.ts` (run by `npm test`, so by the deploy workflow) feeds each one a fake client answering like the hardened database (must pass) and like the pre-migration database (rows returned, PII columns resolving, `42P17`, function executable: must fail). That is the "fails if reverted" proof, because the migration chain cannot be replayed (#393/#396). Each check asserts the property (for example "anon gets `42501` or zero rows"), not the mechanism, so a different valid fix still passes. Messages never contain a row value.

| Migration (incident) | Property | Check (`rlsIncidentChecks.mjs`) | Audience | Anon (what CI runs) | Needs `RLS_TEST_*` |
|---|---|---|---|---|---|
| `20260619000000_emergency_security_hardening.sql` A (any user could read every profile, `is_admin` mutable) | Anon gets no `user_profiles` rows; an ordinary user sees only their own | `checkNoRowsFromProtectedTable`, `checkUserSeesOnlyOwnRows` | anon, user | anon read | user: own row only |
| same, A (`is_admin`/`email` mutation) | Protected columns cannot be changed by a client | none: the guard trigger only fires on a real change, so there is no non-mutating probe. Verify by hand: confirm the `guard_profile_protected_fields` trigger on `public.user_profiles` exists in `pg_trigger` (SQL editor, read-only), or probe on a disposable database | n/a | not covered | not covered |
| same, B (`smart_merge_members` open to all) | Not executable by anon; a signed-in non-admin is refused by an authorization error, not by "member not found" | `checkRpcDeniedAtGrant`, `checkOrdinaryUserRefusedBySmartMerge` | anon, user | anon `42501` (nil ids) | user refusal (nil ids) |
| same, C/D/E (`check_in_code` readable, `user_points` and `event_attendance` over-exposed) and `20260620010000_harden_attendance_rls.sql` | Anon and non-admins read no foreign attendance or points rows (pre-migration phase; the retirement migration revokes the tables outright and the strict head reads take over) | `checkNoRowsFromProtectedTable`, `checkUserSeesOnlyOwnRows` | anon, user | anon `event_attendance`, `user_points` | user own rows only |
| `20260620010000` and `20260619000000` D (self-written attendance/points) | An ordinary user cannot insert or update attendance or points | `checkUserCannotWriteEventAttendance`, `checkUserCannotWriteUserPoints` (use `classifyInsertDenied`, `classifyNoRowsUpdated`) | user | not probeable: a filtered anon write needs `SELECT` on the table, which anon lacks, so `42501` would prove nothing | user, and only with `RLS_ALLOW_MUTATION_TESTS=true` (never in CI) |
| `20260619040000_minimize_public_member_exposure.sql` | Anon cannot read `members.user_id`, `email`, `needs_review`; public member/House views carry no `user_id` | `checkAnonCannotReadMemberPii`, `checkPublicViewsOmitAuthUserId` | anon | both | none |
| `20260619050000_check_in_code_secrets.sql` and `20260620000000_move_check_in_code_to_secrets_table.sql` | `event_check_in_secrets` returns nothing to anon or a non-admin; `events.check_in_code` does not resolve | `checkNoRowsFromProtectedTable`, `checkEventsHaveNoReadableCheckInCode` | anon, user | anon on both | user on both |
| `20260620020000_fix_user_profiles_rls_recursion.sql` | `user_profiles` policies evaluate without `42P17` for every audience; `is_admin_user()` is not callable by anon and is caller-bound (false for a user, true for an admin) | `checkUserProfilesNoRecursion`, `checkAdminReadsUserProfiles`, `checkIsAdminUserHelper`, `checkRpcDeniedAtGrant` | anon, user, admin | anon recursion probe and `is_admin_user` denial | user and admin recursion probes, `is_admin_user` answers |

Anon recursion probe caveat: it only sees `42P17` if anon's policies are evaluated, which is true while anon keeps `SELECT` on `user_profiles` (production returns an empty list). If that grant is ever revoked the anon probe passes trivially and the signed-in probes are the real recursion guard, so configure the `RLS_TEST_*` secrets. In the default `pre-migration` phase the `event_attendance` / `user_points` checks run; `post-migration` replaces them with the strict `42501` head reads. When you add an incident check, add it to the library, add a hardened and a reverted case to the unit test, then call it from the verifier with the migration and `#227` in a comment.

---

## 6. Gated Mutation (Write) Verification Checks

If you set `RLS_ALLOW_MUTATION_TESTS=true`, use a disposable local/staging database with explicit authorization. These checks cover current-value ordinary-user updates, INSERT probes through simple public views, and admin data-rights handlers with a real request ID when supplied.

Public-view INSERT probes use `{ id: null }` and expect `42501`. If grants regress, a constraint can reject the row only after BEFORE INSERT triggers have run; those triggers can change other rows. Data-rights handlers may create audit records. Keep these probes disabled for production.

In the default `pre-migration` phase the verifier still includes the legacy admin manual check-in insert/cleanup and `user_points` write probes; `post-migration` mode has none of them, and the verifier never calls a code RPC other than the anon `check_in_to_event` denial check, which holds in both phases.

---

## 7. What Pass / Fail Means

- **PASS:** The security rule behaves as expected (e.g. access is blocked for users, or granted for admins).
- **FAIL:** A privilege mismatch was detected. For example, if any API account can read a retired archive, retirement privileges are misconfigured. **Stop immediately and check database migrations.**

### Retirement phase

`RLS_RETIREMENT_PHASE` selects what the verifier asserts about the retired member-account / code check-in objects. It exists because the retirement migration is applied to production manually, after merge, so CI must be valid both before and after that moment without weakening either state:

| Phase | When | Legacy archives (`event_attendance`, `user_points`, `event_check_in_secrets`, optional code tables) |
|---|---|---|
| `pre-migration` (default) | Production has not had `20261003000000_retire_member_account_check_in.sql` applied | Anon/ordinary users get no rows; admins keep access; legacy admin write probes run when mutation tests are enabled |
| `post-migration` | After the migration is applied | Every role, admins included, gets `42501` on a head read |

Everything else is identical in both phases, including `anon cannot call check_in_to_event`. An unknown value exits non-zero. The migration-level proof (grants, trigger detachment, retired overloads) is separate and offline: `bash scripts/test-retired-member-check-in.sh`.

```bash
RLS_RETIREMENT_PHASE=post-migration node scripts/verify-rls-security.mjs
```

The `post-migration` phase **fails closed**: it requires an existing ordinary authenticated test account *and* an approved admin account (`RLS_TEST_USER_*` and `RLS_TEST_ADMIN_*`). With either pair missing, the workflow stops with a clear error before running (and the script itself exits non-zero) rather than reporting SKIP, so a green post-migration run always covers anon, ordinary users and admins. `pre-migration` keeps the signed-in sections optional, as before. Never create a public member account to satisfy this.

Rollout order: merge, apply the migration, run the **RLS verification** workflow manually with `retirement_phase=post-migration`, and once it is green set the repository variable `RLS_RETIREMENT_PHASE=post-migration`. Hosted public email signup must also be verified disabled (`GET /auth/v1/settings` returns `"disable_signup": true`); see the completion gates in [the retirement runbook](member-account-retirement.md). Until the variable is set, scheduled/PR/push runs keep verifying `pre-migration`, which fails loudly after the migration (admins can no longer read the archives); that failure is the reminder to flip the variable.

### Member lookup phase

`RLS_MEMBER_LOOKUP_PHASE` does the same for the admin member lookup RPCs (`admin_lookup_members`, `admin_search_members`, migration `20261009232329_admin_member_lookup_rpcs.sql`), which Historical Recovery depends on:

| Phase | When | Lookup RPCs |
|---|---|---|
| `pre-migration` (default) | Production has not had `20261009232329` applied | A missing function is a SKIP; a present one is checked as below |
| `post-migration` | After the migration is applied | A missing function is a FAIL for anon, ordinary users and admins; both test accounts are required (fails closed, never SKIP) |

In both phases: anon must get `42501`. An ordinary user must get the function's own refusal (`Only admins can look up members`), because a bare `permission denied for function` means `authenticated` lost EXECUTE and admins are locked out too. The admin must get a JSON array back. Probes use synthetic values only. An unknown value exits non-zero. The migration-level proof is offline: `bash scripts/test-attendance-recovery.sh`.

```bash
RLS_MEMBER_LOOKUP_PHASE=post-migration node scripts/verify-rls-security.mjs
```

Rollout order: merge, apply the migration, run the **RLS verification** workflow manually with `member_lookup_phase=post-migration`, and once it is green set the repository variable `RLS_MEMBER_LOOKUP_PHASE=post-migration`.

### House phases

Two House privacy migrations follow the same manual rollout, each with its own variable (`pre-migration` default, unknown value exits non-zero):

| Variable | Migration | `post-migration` asserts |
|---|---|---|
| `RLS_HOUSE_EMBARGO_PHASE` | `20261028073000_embargo_public_house_scores.sql` (#692) | Anon gets `42501` on `house_yearly_points`, `house_all_time_points`, `house_recent_activity`, `house_member_yearly_points` and `house_member_all_time_points`, and on `admin_private_house_standings`. Those five views are expected to be unreadable, so the write-grant probe (#472) skips them instead of failing. With test accounts: the ordinary user gets the same denials, the admin can read private standings. |
| `RLS_HOUSE_CACHE_PHASE` | `20261028083000_restrict_public_members_house_cache.sql` (#704) | Anon gets `42501` on `public_members.house` and can still read `id, first_name, last_name, points`; the safe-columns checks drop `house` from the projection. With test accounts: the same for the ordinary user. |

In `pre-migration`, `house` is part of the safe projection and the five score views must be readable for their write grants to be probed, so once a migration is applied the default fails loudly (five `could not be probed (#472)` failures for #692, `anon cannot select safe public columns` for #704). That failure is the reminder to flip the variable.

Neither phase requires the signed-in test accounts. The security claim (anon is denied) is fully asserted by the anon section, and the signed-in variants add coverage whenever `RLS_TEST_*` are configured.

```bash
RLS_HOUSE_EMBARGO_PHASE=post-migration RLS_HOUSE_CACHE_PHASE=post-migration node scripts/verify-rls-security.mjs
```

Rollout order: merge, apply the migration, run the **RLS verification** workflow manually with `house_embargo_phase=post-migration` / `house_cache_phase=post-migration`, and once it is green set the matching repository variable. See [the embargo runbook](house-standings-embargo.md) and [the cache runbook](house-cache-privacy-704.md).

### In CI

`.github/workflows/rls-verify.yml` runs this script on PRs to `main`, on every push to `main`, and daily on a schedule, against production (the only Supabase project). The daily run matters most: past RLS regressions (#422, #423) came from policies created in the dashboard, which no PR would trigger.

- **Not every PR is checked.** It skips PRs from forks and from Dependabot, because neither receives repository secrets. For those, the check runs on the push to `main` after merge, and on the next daily run. A dependency or fork PR merged without a green `verify` has *not* had production RLS checked before merge.
- It never sets `RLS_ALLOW_MUTATION_TESTS`, so base-table and public-view INSERT probes are skipped; guarded zero-row view UPDATE/DELETE probes still run.
- Daily CI retains the zero-row view ACL probes. Base-table write-policy checks require explicit mutation opt-in against a disposable database; the scheduled job does not cover that policy drift.
- The signed-in sections are skipped until the `RLS_TEST_*` repository secrets are configured.
- A failing run names the table, column or RPC and the issue it guards. Treat it as a security incident: check `pg_policies` and grants in production before assuming the test is wrong.

---

## 8. Manual Supabase Dashboard Verification

Some aspects of RLS cannot be fully automated by a client-side script. Admins should manually inspect the following in the Supabase Dashboard:

### Check 1: Supabase Storage Bucket Policies
1. Go to **Storage** -> **Buckets**.
2. Select the `events` and `gallery` buckets.
3. Click **Policies** and verify:
   - Anonymous users have `SELECT` (Read) access only.
   - Only authenticated users with `is_admin = true` profile flag have write/delete permissions.

### Check 2: retired execution and archive grants
Run [member-account-retirement.sql](member-account-retirement.sql) using an authorized SQL operator before and after the forward migration. Inspect all overloads, table/column grants, obsolete triggers, and any unexpected wrappers/views. Expected post-migration client grant and retired trigger queries return zero rows. This complements the head-only API checks; do not test obsolete mutation RPCs by executing them.

### Check 3: admin-only Auth
Verify hosted Supabase **Allow new users to sign up** remains disabled. Existing/invited approved admins must still sign in through `/admin/login`. Local `supabase/config.toml` disables signup, but it does not update hosted Auth settings. Do not create member accounts for verification.

### Check 4: content health cache table
`content_health_state` (migration `20261004000000`) is admin-only. Before applying it to production, run [verify-content-health.sql](../scripts/verify-content-health.sql) against a local or staging database (`psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-content-health.sql`; one rolled-back transaction, every line prints `PASS`). It proves anon and non-admins read and write nothing, an admin can write only their own `acknowledgement` rows (never a link-check or check-run result, and never `acknowledged_by`), the entity-link constraint on `ai_knowledge_base` accepts only the documented pairs, and a public snippet linked to an unpublished or deleted event is hidden from retrieval **and** from direct anon reads. It uses one dedicated fixture snippet and needs both `20261004000000` and `20261004010000` applied. After applying to production, `verify-rls-security.mjs` adds an anon read probe for the table (a SKIP while the table is absent, never a PASS). The weekly link-check job writes with the service role from a GitHub Actions secret only (`.github/workflows/content-link-check.yml`); the service-role key still never belongs in this verifier's environment.

---

## 9. Security Commandments (What NOT to do)

- **Do NOT** use a Supabase service-role (`service_role`) key in local terminal configs or the environment variables of this verification tool. Doing so bypasses RLS and invalidates all security checks.
- **Do NOT** paste environment files containing passwords, secret keys, or test credentials into screenshots, github issues, or PR comments.
- **Do NOT** write the raw data-rights export payloads or private check-in codes to console outputs, debug logs, or files. Keep terminal logs clean of member data.
### Reviewed ACE pickup-year corrections (#673, additive migration)

Migration `20261031080736_ace_pickup_year_correction.sql` adds `correct_ace_member_pickup_year(uuid,integer,text,integer,text,text,uuid)`, a SECURITY INVOKER RPC with `search_path=''` and `is_admin_user(auth.uid())` check, EXECUTE restricted to authenticated. It uses a locked member row, compares both expected fields to prevent lost admin edits, records pending evidence and approvals via the existing #669 setter, and writes an `ace.pickup_year_changed` audit row in that same transaction only on changes. This is a **migration-gated backend PR**, not an applied deployment.

Run `bash scripts/test-ace-pickup-year.sh` offline; it applies #673 twice in the disposable PostgreSQL fixture after #669 regression tests, then checks denied personas, allowed and rejected sources, stale expected values, FA23/year-only/Unknown, audit count, 1998 and no lineage/identity changes. The owner must separately run live anon, ordinary and approved-admin probes after explicitly applying on staging, then verify actor/time/year metadata with no PII pasted to GitHub. No new public table/view/grant, and no new public evidence projection. Follow the production change-control and database schema-migration checklist before any rollout.


### Admin ACE email matching by POST (#804)

Migration `20261031070316_admin_match_members_by_email.sql` adds the read-only, SECURITY INVOKER `admin_match_members_by_email(p_emails text[])` function. It replaces `members?email=in.(...)` GET URL filters with POST RPC bodies, joins normalized `members.email` and confirmed `member_identity_emails.email`, returns only `{input_email,id,first_name,last_name,college,year}`, and preserves ambiguous shared-email matches. Admin guard, pinned search path, explicit GET/HEAD refusal, 1000-address server bound, PUBLIC/anon grant revocation, and authenticated-only EXECUTE apply.

Applied to production 2026-10-31 as version 20261031070316, before the frontend RPC cutover. Offline proof: `bash scripts/test-admin-email-match.sh` in a disposable local PostgreSQL cluster, exercising anon denial, non-admin denial, admin POST alias resolution, ambiguous primary, HTTP GET refusal, 1001-address rejection. Hosted check: `node scripts/verify-rls-security.mjs` and approved anon/non-admin/admin PostgREST requests on production only after authorized migration; no service-role key, never a GET URL containing an email. Inspect the three ACE admin pages' Network requests at the same time. A failed RPC must fail the entire match, not return zero identities.

`memberIdentity.ts` already reads confirmed aliases with keyset pagination using row ID, and scopes an individual alias read by canonical member ID. It does not filter GET URLs by email. Historical Supabase gateway logs may contain addresses from the old URL method; owner must determine retention/impact without copying actual email values into issues or PRs.

### Public role projection RPC migration phase (#623)

Migration 20261031070305_public_member_roles.sql adds public_member_roles(p_year integer, p_member_ids uuid[]) with exactly six public-safe columns. It grants EXECUTE to anon and authenticated explicitly, not through PUBLIC, and adds no SELECT grant to private tables. The SQL contract test is bash scripts/test-public-member-roles.sh in a disposable, local-only PostgreSQL cluster.

The hosted verifier accepts RLS_MEMBER_ROLES_PHASE=pre-migration (default: absent RPC produces SKIP) or post-migration (absent RPC produces FAIL). In either phase when the function exists it sends one nil UUID and asserts an empty result, then 201 nil IDs expecting SQLSTATE 22023. Run the RLS verification workflow manually with member_roles_phase=post-migration once the owner has applied the migration, and update the repository variable afterward. The client must not ship until the RPC exists and passes the anonymous checks.

Owner SQL/HTTP review must verify the exact returned keys member_id, kind, label, academic_year_start, source_type, related_key; direct grants to anon/authenticated without PUBLIC inheritance; and no new public table grants, draft joins, stored notes, or future Cabinet years. The nil-UUID verifier alone does not prove the live result schema when it is empty. Use a separately approved fictional/staging row for a nonempty projection contract and keep response values out of GitHub.

This does not verify or publish House Parent, ACE or VCN roles, and it does not change House Reveal/score publication.
