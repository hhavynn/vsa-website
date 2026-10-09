# Image-migration webhook: credential rotation runbook

**Who runs this:** the project owner, in the Supabase Dashboard, GitHub and Vercel. Every production step needs the owner's explicit approval. Agents may prepare and review, and may run the read-only queries, but never run a production step.

**Why:** both image-migration Database Webhooks were created in the Dashboard with an `Authorization: Bearer <service_role JWT>` header and the `x-image-migration-secret` value. A Database Webhook stores its headers in its trigger definition. `pg_trigger` grants `SELECT` to `PUBLIC`, and `PUBLIC` can execute `pg_get_triggerdef()`, so any role that can run SQL can read both values, `anon` and `authenticated` included. Finding, evidence and exposure assessment: [`edge-function-security-audit.md`](edge-function-security-audit.md) § "Service-role key in image-migration webhooks".

**Handling secrets during this runbook:**

- Never paste a secret value into chat, an issue, a PR, a commit, a log, or a SQL statement that you save as a snippet.
- Enter values in Dashboard secret fields (Vault, Edge Function Secrets, API Keys) or from a shell variable.
- Every query below returns metadata only: names, booleans, lengths and counts.
- Do not `select pg_get_triggerdef(...)` itself. Until stage 1 is done, its output contains both credentials.

## Overview

| Stage | What it does | What it does **not** do | When |
| --- | --- | --- | --- |
| 1. Replace the webhooks and rotate the webhook secret | Removes both credentials from the catalog. Image uploads then go through tracked triggers that read a **new** webhook secret from Vault (`supabase/migrations/20261010120000_vault_backed_image_migration_triggers.sql`). | Invalidate the exposed `service_role` JWT. Anyone who already copied it keeps a working key. | Now (about 20 minutes). |
| 2. Retire the exposed `service_role` JWT | Moves every consumer to new API keys, disables the legacy keys, then revokes the legacy JWT secret. This is the step that makes the leaked key worthless. | | After its code prerequisites ship, and before Supabase's end-of-2026 legacy-key cutoff. Sooner if there is any sign of abuse. |

The receiving Edge Functions do not change. They authorize only on `x-image-migration-secret`, run with `verify_jwt = false` (pinned in `supabase/config.toml` since #526), and never use the service-role key. The only privileged credential they hold is `GITHUB_DISPATCH_TOKEN`, and that never appeared in the trigger definitions.

---

## Stage 0: Preflight (read-only)

1. **Freeze window.** Check `vsa-seasonal-operations`. Stage 1 briefly pauses automatic image migration; stage 2 touches every Supabase client.
2. **Current state.** Run in the SQL Editor:

   ```sql
   select c.relname, tg.tgname, tg.tgenabled::text as enabled,
          pn.nspname || '.' || p.proname as fn,
          pg_get_triggerdef(tg.oid) ~* 'authorization' as has_authorization_header,
          pg_get_triggerdef(tg.oid) ~ 'eyJ[A-Za-z0-9_-]+\.eyJ' as has_jwt,
          pg_get_triggerdef(tg.oid) ~ 'sb_secret_' as has_secret_key,
          pg_get_triggerdef(tg.oid) ~* 'x-image-migration-secret' as has_webhook_secret
   from pg_trigger tg
   join pg_class c on c.oid = tg.tgrelid
   join pg_proc p on p.oid = tg.tgfoid
   join pg_namespace pn on pn.oid = p.pronamespace
   where not tg.tgisinternal and c.relname in ('events', 'house_events')
     and (pn.nspname in ('supabase_functions', 'private') or tg.tgname ilike '%image%');
   ```

   On 2026-10-08 this returned `event-image-migration` and `house-event-image-migration`, both `supabase_functions.http_request`, enabled, with `has_authorization_header`, `has_jwt` and `has_webhook_secret` all `true`.

3. **Extensions.** Both `pg_net` and `supabase_vault` must be installed (they were on 2026-10-08):

   ```sql
   select extname, extversion from pg_extension where extname in ('pg_net', 'supabase_vault');
   ```

4. **Data API exposed schemas.** Check **Project Settings → Data API → Exposed schemas**. It must list only `public` and `graphql_public`. If `pg_catalog`, `net`, `vault`, `supabase_functions` or `private` is listed, remove it before anything else: that would let any visitor read trigger definitions or the `pg_net` queue over HTTP. This setting cannot be read from SQL and was not verified in the audit.
5. **Function JWT setting.** Run `supabase functions list --project-ref sxephkrekdztmkptyzca`, or open the Dashboard. Both `trigger-event-image-migration` and `trigger-house-event-image-migration` must show JWT verification **off**. The new triggers send no `Authorization` header.

## Stage 1: Replace the webhooks and rotate the webhook secret

Do steps 1.3 to 1.5 back to back. Between 1.4 and 1.5, uploads get a 401 from the function. That is harmless: the row keeps its working Storage URL, and the daily `migrate-images.yml` run migrates it.

**1.1 Merge the PR** that adds `20261010120000_vault_backed_image_migration_triggers.sql`. Merging applies nothing.

**1.2 Generate the new webhook secret** locally and keep it in your password manager. Never reuse the old value.

```bash
openssl rand -hex 32
```

**1.3 Create the two Vault secrets.** In the Dashboard, open **Vault** (under **Integrations** in the current Dashboard) and choose **Add new secret**:

| Name | Value |
| --- | --- |
| `image_migration_functions_url` | `https://sxephkrekdztmkptyzca.supabase.co/functions/v1` |
| `image_migration_webhook_secret` | the value from 1.2 |

Alternative with `psql`: pass the value as a variable through stdin. Do not use `-c`, because `psql -c` does not interpolate variables:

```bash
read -rs IMG_SECRET   # paste the value; nothing is echoed
printf "select vault.create_secret(:'s', 'image_migration_webhook_secret', 'x-image-migration-secret for the image-migration triggers');\n" \
  | psql "$PROD_DB_URL" -v s="$IMG_SECRET"
```

Verify (lengths only):

```sql
select name, length(decrypted_secret) as len
from vault.decrypted_secrets
where name in ('image_migration_functions_url', 'image_migration_webhook_secret');
-- expect two rows: functions_url len 53, webhook_secret len 64
```

**1.4 Set the Edge Function secret** to the same value. Do this in **Edge Functions → Secrets** in the Dashboard (key `IMAGE_MIGRATION_WEBHOOK_SECRET`), or:

```bash
read -rs IMG_SECRET
supabase secrets set --project-ref sxephkrekdztmkptyzca IMAGE_MIGRATION_WEBHOOK_SECRET="$IMG_SECRET"
unset IMG_SECRET
```

Secrets are project-wide, so this covers both functions. No redeploy is needed: Supabase makes secrets available to functions immediately.

**1.5 Apply the migration.** Use the repo's usual manual path: the Supabase MCP `apply_migration` with the file's contents verbatim, or paste the file into the SQL Editor. Then follow the rename-to-recorded-version convention (see #528) if the recorded version differs from the filename.

Do **not** use `supabase db push`. Production's `supabase_migrations.schema_migrations` records 41 versions, while the directory holds over 120 files (2026-10-08), so `db push` would try to apply unrelated migrations.

What the migration does:

- If the Dashboard webhooks still exist and either Vault secret is missing or empty, it aborts and changes nothing.
- Otherwise, in one transaction, it creates `private.request_image_migration()`, drops `event-image-migration` and `house-event-image-migration`, and creates `request_event_image_migration` and `request_house_event_image_migration`.

**1.6 Verify (read-only).**

```sql
-- a) Only the tracked triggers remain, and nothing calls the Dashboard webhook function.
select c.relname, tg.tgname, tg.tgenabled::text as enabled, pn.nspname || '.' || p.proname as fn
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_proc p on p.oid = tg.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where not tg.tgisinternal and (pn.nspname in ('supabase_functions', 'private') or tg.tgname ilike '%image%');
-- expect exactly: events / request_event_image_migration / O / private.request_image_migration
--                 house_events / request_house_event_image_migration / O / private.request_image_migration

-- b) No credential anywhere in trigger definitions or function bodies (counts only).
select
  (select count(*) from pg_trigger t where not t.tgisinternal
     and (pg_get_triggerdef(t.oid) ~* 'authorization|x-image-migration-secret'
          or pg_get_triggerdef(t.oid) ~ 'eyJ[A-Za-z0-9_-]+\.eyJ|sb_secret_')) as triggers_with_credentials,
  (select count(*) from pg_trigger t, vault.decrypted_secrets s
     where s.name = 'image_migration_webhook_secret'
       and position(s.decrypted_secret in pg_get_triggerdef(t.oid)) > 0) as triggers_with_new_secret,
  (select count(*) from pg_proc p, vault.decrypted_secrets s
     where s.name = 'image_migration_webhook_secret'
       and position(s.decrypted_secret in p.prosrc) > 0) as functions_with_new_secret;
-- expect 0, 0, 0

-- c) API roles cannot reach the function, the schema, or Vault.
select r as role,
  has_function_privilege(r, 'private.request_image_migration()', 'EXECUTE') as can_execute,
  has_schema_privilege(r, 'private', 'USAGE') as private_usage,
  has_table_privilege(r, 'vault.decrypted_secrets', 'SELECT') as vault_select
from unnest(array['anon', 'authenticated']) r;
-- expect false / false / false for both roles
```

**Database → Webhooks** in the Dashboard now lists nothing. That is expected: the tracked triggers are not Dashboard webhooks. Do not create new ones there.

**1.7 Smoke test.**

- **Wrong secret is refused.** This needs no secret, and it also closes the audit's open live-test item:

  ```bash
  for f in trigger-event-image-migration trigger-house-event-image-migration; do
    curl -s -o /dev/null -w "$f %{http_code}\n" -X POST \
      "https://sxephkrekdztmkptyzca.supabase.co/functions/v1/$f" \
      -H 'Content-Type: application/json' -H 'x-image-migration-secret: wrong' -d '{}'
  done
  # expect: 401 for both
  ```

- **A real upload dispatches.** On the next real image upload in the admin (an event's or a House event's), check:

  ```sql
  select id, status_code,
         (content::jsonb) ->> 'triggered' as triggered,
         (content::jsonb) ->> 'reason' as reason,
         created
  from net._http_response
  order by id desc
  limit 5;
  -- expect: 200, true, "Dispatched to GitHub"
  ```

  `pg_net` keeps responses for about 6 hours. Also confirm a new **Migrate event images to static assets** run in GitHub Actions, and the function log in **Edge Functions → Logs**. A title-only edit must add no new row. A `401` with reason `Unauthorized` means the Vault value and the function secret differ: redo 1.4 with the same value as 1.3. Do not create test events for this check (`AGENTS.md`).

**1.8 Rollback.** Drop the new triggers. Automatic per-upload migration stops, and the daily `migrate-images.yml` run still migrates every Storage URL:

```sql
drop trigger if exists request_event_image_migration on public.events;
drop trigger if exists request_house_event_image_migration on public.house_events;
```

Never recreate a Dashboard webhook with an `Authorization` header. If a Dashboard webhook is ever needed as a stopgap, send only `Content-type` and `x-image-migration-secret`, and treat it as temporary: it puts the webhook secret back into `pg_trigger`.

**1.9 Record it.** Update the open item in `edge-function-security-audit.md` with the date, who applied it, the recorded migration version, and the 1.6 and 1.7 results.

---

## Stage 2: Retire the exposed `service_role` JWT

A legacy `service_role` key cannot be rotated on its own. It is a JWT signed with the project's legacy JWT secret, which also signs the `anon` key and every user session. Supabase no longer offers rotation of that secret. The supported path:

1. Move every consumer to the new publishable and secret API keys.
2. Disable the legacy API keys.
3. Move Auth to JWT signing keys.
4. Revoke the legacy JWT secret.

Only that last step makes the leaked JWT cryptographically invalid. The full reasoning and blast radius are in the audit doc's "Phase B"; this is the operator checklist.

### 2.0 Code prerequisites (separate, gated PRs; each needs review before deploy)

| Consumer | Today | Needed before 2.4 |
| --- | --- | --- |
| `vsa-ai-assistant` | Admin client from `SUPABASE_SERVICE_ROLE_KEY` (`index.ts:96`). Gateway `verify_jwt` on. Ask VSA sends `Authorization: Bearer <anon key>` (`VsaAiAssistant.tsx`). | Read `SUPABASE_SECRET_KEYS`. Set `verify_jwt = false` and check the `apikey` and any user JWT in code. Frontend sends the publishable key on `apikey` only. |
| `member-photo-upload` | `SUPABASE_SERVICE_ROLE_KEY` (`index.ts:5`) | Read `SUPABASE_SECRET_KEYS`. |
| `analytics-proxy` | `SUPABASE_ANON_KEY` (`index.ts:127`-`:128`). Gateway `verify_jwt` on. | Read `SUPABASE_PUBLISHABLE_KEYS`. Set `verify_jwt = false` and verify the admin's JWT in code (`auth.getClaims()`). |
| `trigger-*-image-migration` | No Supabase key. | Nothing. |

Supabase documents both variables (`SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS`) as JSON maps keyed by key name, injected alongside the legacy ones. It also documents that the gateway's `verify_jwt` only understands legacy JWT keys.

### 2.1 Create keys

In **Settings → API Keys → Publishable and secret API keys**: a `default` publishable key already exists (seen 2026-10-08). Create one secret key per consumer so each can be revoked alone. Suggested names: `edge-functions`, `github-actions`, `local-scripts`.

### 2.2 Move backend consumers to secret keys

- **GitHub Actions.** Run `gh secret set SUPABASE_SERVICE_ROLE_KEY --repo hhavynn/vsa-website`. It prompts for the value; nothing goes into shell history. Used by `migrate-images.yml`, `migrate-event-images.yml` and `content-link-check.yml`.
  - **Verify:** dispatch `migrate-event-images.yml` and `content-link-check.yml`, both with `apply` off. Both must go green.
- **Edge Functions.** Deploy the 2.0 changes, then verify:
  - Ask VSA answers an anonymous question.
  - An admin member-photo upload works.
  - Admin analytics loads.
- **Local copies.** Everyone who holds a `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` switches to the `local-scripts` key. This covers `scripts/migrate-supabase-images-to-public.ts`, `check-content-links.ts`, `audit-storage-backed-content.ts`, `audit-anon-exposure.mjs` and `cleanup-stale-photo-requests.mjs`.
- **Vercel env.** Confirm Vercel holds no service-role key (only `REACT_APP_*` is expected).

### 2.3 Move public consumers to the publishable key

- Set Vercel `REACT_APP_SUPABASE_ANON_KEY` to the publishable key, then rebuild and redeploy (the key is compiled into the bundle).
- Update the GitHub secret of the same name.
- Update local `.env.local` files.
- **Verify:** public pages load data, an admin can sign in, Ask VSA works, and the browser console shows no 401s.

### 2.4 Disable the legacy `anon` and `service_role` keys

Do this in **Settings → API Keys → Legacy API keys**. It is reversible.

- **Verify:** watch the API and Edge Function logs for 401s for a day.
- From your own terminal, a request whose `apikey` is the old `service_role` JWT must now be refused. Never paste the key or the command line anywhere.
- If something you missed breaks, re-enable the legacy keys, fix that consumer, and repeat.

### 2.5 Move to JWT signing keys and revoke the legacy secret

Work in **Settings → JWT Keys**:

1. Confirm no function still has gateway `verify_jwt` on (2.0). Supabase warns that rotation can break the gateway check.
2. Click **Migrate JWT secret**. This imports the legacy secret and creates a standby asymmetric key.
3. Click **Rotate keys**. Auth signs new sessions with the new key, and existing tokens stay valid, so nobody is signed out.
4. Wait at least the access-token lifetime plus 15 minutes (1 h 15 min at the default 1-hour expiry).
5. **Revoke** the legacy key, now under *Previously used*.
   - Revoke immediately only if the key is believed to be actively abused. Active sessions (mostly admins) are then signed out.

**Verify:**

- Admin sign-in and sign-out work, and Ask VSA works.
- A request that sends the old `service_role` JWT as `Authorization: Bearer` with the new publishable key as `apikey` is refused.

**Rollback:**

- Until step 5, re-enabling the legacy keys restores the old state.
- After step 5, a revoked key can be moved back to standby and rotated to, per Supabase's signing-keys docs.

### 2.6 Close out

- Mark the audit's open item resolved, with dates.
- Delete any local file that still holds the old key.
- `GITHUB_DISPATCH_TOKEN` was never in the trigger definitions and does not need rotating for this finding.

## Residual risk after both stages

- `pg_net` holds each queued request's headers, including the new webhook secret, in `net.http_request_queue` until its worker sends it, normally well under a second.
  - Supabase's defaults grant `SELECT` on that table to `anon` and `authenticated`, but `net` is not an exposed Data API schema (stage 0, step 4).
  - A leaked webhook secret can only start migration runs for real rows: since #526, `migrate-event-images.yml` allowlists the category and requires UUID ids.
- The trigger function is `SECURITY DEFINER` so that it can read Vault. Its only input is the row being written, and it builds the request from fixed parts: the Vault URL plus a trigger argument set by the migration.
