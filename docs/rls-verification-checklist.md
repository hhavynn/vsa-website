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
- **Anon: safe columns check** — queries `public_members`, the safe allowlist projection needed for leaderboards. Expects success.
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

---

## 9. Security Commandments (What NOT to do)

- **Do NOT** use a Supabase service-role (`service_role`) key in local terminal configs or the environment variables of this verification tool. Doing so bypasses RLS and invalidates all security checks.
- **Do NOT** paste environment files containing passwords, secret keys, or test credentials into screenshots, github issues, or PR comments.
- **Do NOT** write the raw data-rights export payloads or private check-in codes to console outputs, debug logs, or files. Keep terminal logs clean of member data.
