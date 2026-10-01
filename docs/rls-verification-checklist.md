# Staging and Production RLS Verification Checklist

This document provides a runbook and instructions for Vietnamese Student Association (VSA) admins to verify that Row Level Security (RLS) policies and security hardening are active and working correctly on staging and production databases.

---

## 1. Purpose

The recent security hardening transition removes client-authoritative write privileges from ordinary users and places them behind server-authoritative controls (such as the `check_in_to_event` RPC). 

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
- **Anon: event secrets check** — attempts to query the `event_check_in_secrets` table. Expects access denied or empty list.
- **Anon: data rights RPC check** — attempts to call preview/export functions. Expects access denied.
- **Anon: data rights requests check** — attempts to query requests history. Expects access denied or empty list.
- **Anon and user: zero-row writes through public views (#472)** — attempts `UPDATE` and `DELETE` through every public view listed in the script. Expects `42501`. Supabase's default privileges grant `ALL` on new views to `anon` and `authenticated`, and a simple single-table view runs as its owner, so a leftover write grant bypasses the base table's RLS. A write that succeeds is reported as FAIL naming the view. Non-destructive: every write is filtered on the nil UUID, the same filter is read first and the probe is not run if it matches anything, and the base tables have only row-level triggers, so a zero-row write fires nothing. Aggregate and join views reject writes with `55000` before Postgres checks grants, so for them the script prints one SKIP line; any other error is a FAIL. Filtering a write needs `SELECT` on the view, so a role that cannot read it gets `42501` whether or not the write grant exists: a denied read on a view the role should read is a FAIL, and anon on `my_member_photo_requests` (signed-in only by design) is a SKIP that the signed-in run covers. The signed-in run needs the `RLS_TEST_USER_*` account. **When you add a view, add it to `simpleViews` or `nonUpdatableViews` in the script.**
- **User: write probes, gated by `RLS_ALLOW_MUTATION_TESTS=true`** — attempts to insert into `event_attendance` and `user_points`, and to update `event_attendance`, `user_points`, `events`, `members` and `member_event_attendance`. Expects RLS block (`42501` on insert, 0 rows on update). The probes are non-destructive even if RLS is broken: inserts target an unknown event or the user's existing row, so a constraint rejects them after RLS lets them through (reported as FAIL), and updates write each row's current values back.
- **User: event secrets check** — attempts to read secrets. Expects access denied or empty list.
- **User: data rights check** — attempts to read data rights requests or call admin RPCs. Expects access denied.
- **Admin: read check** — attempts to read event secrets and data rights requests. Expects success.
- **Admin: RPC access check** — calls dependency/export handlers with a nil request UUID in read-only mode, so no real export/audit row is created. A real `RLS_TEST_DATA_RIGHTS_REQUEST_ID` is used only with mutation opt-in. Expects authorization access, even when the nil request is not found.

---

## 6. Gated Mutation (Write) Verification Checks

If you set `RLS_ALLOW_MUTATION_TESTS=true`, the script will run active write checks.
> [!WARNING]
> These checks insert and then delete a real `event_attendance` row. They clean up after themselves, but they are not recommended for production.

These checks cover:
- **Anon/user: public view UPDATE/DELETE and ordinary-user insert/update probes** — disabled by default along with INSERT probes. Use a disposable local/staging environment with explicit authorization.
- **Admin: direct manual insert support** — verifies that admins can manually check in members directly via the dashboard by writing to `event_attendance`.
- **Admin: no direct `user_points` writes** — verifies that even admins cannot write `user_points` from the client; it is server-authoritative (written only by `check_in_to_event` and the signup trigger). Non-destructive: the probe targets the admin's existing row.
- **Anon and user: no inserts through simple public views (#472)** — inserts `{ id: null }` through each auto-updatable view. Expects `42501`. If the grant is live, `NOT NULL` on `id` rejects the row (reported as FAIL), but only after `BEFORE INSERT` triggers have run, and some of those write to other rows (`ensure_single_current_vcn_archive`). That is why this probe is gated.

---

## 7. What Pass / Fail Means

- **PASS:** The security rule behaves as expected (e.g. access is blocked for users, or granted for admins).
- **FAIL:** A privilege mismatch was detected. For example, if an ordinary user successfully writes to `event_attendance` without using the RPC, RLS policies have been weakened or misconfigured. **Stop immediately and check database migrations.**

### In CI

`.github/workflows/rls-verify.yml` runs this script on PRs to `main`, on every push to `main`, and daily on a schedule, against production (the only Supabase project). The daily run matters most: past RLS regressions (#422, #423) came from policies created in the dashboard, which no PR would trigger.

- **Not every PR is checked.** It skips PRs from forks and from Dependabot, because neither receives repository secrets. For those, the check runs on the push to `main` after merge, and on the next daily run. A dependency or fork PR merged without a green `verify` has *not* had production RLS checked before merge.
- It never sets `RLS_ALLOW_MUTATION_TESTS`, so all write probes are skipped.
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

### Check 2: database.js and Repository Enforcement
1. Search the codebase for `supabase.from`.
2. Verify that **no client-side file** makes direct mutations (`.insert()`, `.update()`, `.delete()`) to `event_attendance` or `user_points` for normal members. All check-ins must flow through the repository singleton invoking the RPC.

---

## 9. Security Commandments (What NOT to do)

- **Do NOT** use a Supabase service-role (`service_role`) key in local terminal configs or the environment variables of this verification tool. Doing so bypasses RLS and invalidates all security checks.
- **Do NOT** paste environment files containing passwords, secret keys, or test credentials into screenshots, github issues, or PR comments.
- **Do NOT** write the raw data-rights export payloads or private check-in codes to console outputs, debug logs, or files. Keep terminal logs clean of member data.
