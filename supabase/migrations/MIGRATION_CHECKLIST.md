# Supabase Migration Authoring Checklist

Last updated: 2026-08-24

Use this checklist before writing or reviewing any migration in this directory. It does not authorize a protected database change or apply anything to Supabase. Migrations remain forward-only, require owner review, and are applied manually after staging verification.

## Before writing

- [ ] Link the approved issue and describe the affected roles (`anon`, `authenticated`, and service-side callers).
- [ ] Add a new timestamped migration; never edit a migration that has already merged or shipped.
- [ ] State the intended access boundary in the migration header and PR description.

## Security checklist

### Every migration

- [ ] Add no secrets, credentials, private URLs, check-in codes, or member/admin data to SQL, comments, fixtures, or logs.
- [ ] Add no grants to `PUBLIC`. Revoke default `PUBLIC` privileges from new functions and grant only to the intended roles.
- [ ] Keep object references schema-qualified where privileged execution is involved.
- [ ] Update `src/types/database.ts` and the owning runbook when the schema contract changes.

### New or replaced tables

- [ ] Enable Row Level Security (RLS) immediately after creating the table.
- [ ] Define explicit policies for every allowed operation and role; an omitted policy must mean intentionally blocked.
- [ ] Give `UPDATE` and `ALL` policies both `USING` and `WITH CHECK` expressions.
- [ ] Revoke broad table privileges before granting only the required operations or safe columns.

### New or replaced views

- [ ] Revoke all privileges from `anon` and `authenticated`, then grant back `SELECT` only to the narrowest intended audience.
- [ ] Exclude auth UUIDs, emails, secrets, import metadata, and admin/reviewer fields from public projections.
- [ ] For caller-scoped views, filter with `auth.uid()` and use `security_barrier = true`.
- [ ] Reapply the revoke-then-grant sequence whenever a view is dropped and recreated.

### New or replaced functions and RPCs

- [ ] Prefer `SECURITY INVOKER`. If `SECURITY DEFINER` is necessary, justify it in the migration header and PR.
- [ ] For every `SECURITY DEFINER` function, set `search_path = ''`, schema-qualify references, and enforce authorization inside the function before accessing data.
- [ ] Revoke execution from `PUBLIC` and `anon`, then grant execution only to the intended role.
- [ ] Derive identity and protected values from `auth.uid()` and server data rather than trusting client-supplied identifiers or values.

### Storage changes

- [ ] Keep new buckets private unless public access is explicitly approved and documented.
- [ ] Scope `storage.objects` policies by bucket and path, with admin-only access to private objects.

## Verification and review

- [ ] Follow [`docs/rls-verification-checklist.md`](../../docs/rls-verification-checklist.md) against staging and record the exact result or blocker in the PR. Do not duplicate that runbook here.
- [ ] Test the old-frontend/new-schema and new-frontend/old-schema mismatch windows when a frontend change ships with the migration.
- [ ] Confirm the PR does not apply the migration to production.
- [ ] Request review from a maintainer who has previously authored or applied a migration in this repository.
