# Staging and Production RLS Verification Checklist

This document provides a runbook and instructions for Vietnamese Student Association (VSA) admins to verify that Row Level Security (RLS) policies and security hardening are active and working correctly on staging and production databases.

---

## 1. Purpose

The recent security hardening transition removes client-authoritative write privileges from ordinary users and places them behind server-authoritative controls (such as the `check_in_to_event` RPC). 

This verification tooling performs automated checks to prove that:
- Anonymous users cannot retrieve sensitive member columns (`email`, `user_id`) or admin tables.
- Authenticated ordinary users cannot modify points, check-ins, or access private data-rights request details.
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

By default, the script only performs read-only checks that cannot affect production data:
- **Anon: sensitive columns check** — attempts to select `user_id` and `email` on `members`. Expects access denied.
- **Anon: safe columns check** — attempts to query public information needed for leaderboards. Expects success.
- **Anon: event secrets check** — attempts to query the `event_check_in_secrets` table. Expects access denied or empty list.
- **Anon: data rights RPC check** — attempts to call preview/export functions. Expects access denied.
- **Anon: data rights requests check** — attempts to query requests history. Expects access denied or empty list.
- **User: points check** — attempts to update points totals. Expects RLS block.
- **User: event secrets check** — attempts to read secrets. Expects access denied or empty list.
- **User: data rights check** — attempts to read data rights requests or call admin RPCs. Expects access denied.
- **Admin: read check** — attempts to read event secrets and data rights requests. Expects success.
- **Admin: RPC access check** — attempts to call dependency and export handlers. Expects auth validation success.

---

## 6. Gated Mutation (Write) Verification Checks

If you set `RLS_ALLOW_MUTATION_TESTS=true`, the script will run active write checks.
> [!WARNING]
> These checks will perform actual `INSERT` and `DELETE` queries on `event_attendance` and `user_points`. They will attempt to clean up after themselves, but they are not recommended for production.

These checks cover:
- **Admin: direct manual insert support** — verifies that admins can manually check in members directly via the dashboard by writing to `event_attendance`.
- **Admin: direct user points update** — verifies that admin accounts can write directly to `user_points` when adjusting leaderboards.

---

## 7. What Pass / Fail Means

- **PASS:** The security rule behaves as expected (e.g. access is blocked for users, or granted for admins).
- **FAIL:** A privilege mismatch was detected. For example, if an ordinary user successfully writes to `event_attendance` without using the RPC, RLS policies have been weakened or misconfigured. **Stop immediately and check database migrations.**

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
