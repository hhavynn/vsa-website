-- Replace the Dashboard-created image-migration webhooks with tracked triggers
-- that read their credentials from Supabase Vault.
--
-- Why: the production Database Webhooks "event-image-migration" (public.events)
-- and "house-event-image-migration" (public.house_events) were created in the
-- Dashboard, not in a migration. A Database Webhook stores its HTTP headers as
-- trigger arguments, in plain text: pg_trigger.tgargs and pg_get_triggerdef().
-- pg_trigger is readable by PUBLIC and pg_get_triggerdef() is executable by
-- PUBLIC, so every role (anon and authenticated included) that can run SQL can
-- read those headers. As of 2026-10-08 both headers held the legacy service_role
-- JWT and the x-image-migration-secret value. See
-- docs/edge-function-security-audit.md and
-- docs/image-migration-webhook-credential-rotation.md.
--
-- What this does
--   1. private.request_image_migration(): an AFTER trigger function that reads
--      the Edge Functions base URL and the webhook secret from Vault at fire
--      time and queues one pg_net POST to the receiving Edge Function. The
--      trigger definition holds only the function name; the function body holds
--      only Vault secret *names*. No credential is stored in the catalog.
--   2. Drops the two Dashboard webhooks (if present) and creates
--      request_event_image_migration / request_house_event_image_migration in
--      the same transaction, so there is no window with both or neither.
--
-- What the receiving Edge Functions get: the same payload shape the Database
-- Webhook sent ({type, table, schema, record, old_record}), with record and
-- old_record reduced to the only fields the functions read (id, image_url).
-- The functions are unchanged: they authorize on x-image-migration-secret only
-- and run with verify_jwt = false (supabase/config.toml). No Authorization
-- header is sent, and no service-role key is involved anywhere in this path.
--
-- Required Vault secrets (create BEFORE applying; values never go in this file)
--   image_migration_functions_url   e.g. https://<project-ref>.supabase.co/functions/v1
--   image_migration_webhook_secret  same value as the Edge Function secret
--                                   IMAGE_MIGRATION_WEBHOOK_SECRET
-- If the legacy Dashboard webhooks still exist and either secret is missing,
-- this migration aborts, so a working webhook is never swapped for an
-- unconfigured one. On a database without the Dashboard webhooks (local,
-- branches) it applies, and the trigger skips with a WARNING until configured.
--
-- Why SECURITY DEFINER: the trigger fires as whoever writes the row (an admin
-- through `authenticated`, or service_role from the migration workflow).
-- `authenticated` cannot read vault.decrypted_secrets, and must not be able to.
-- The function is owned by the migration role, pins search_path to '',
-- schema-qualifies every reference, and takes no caller input other than the
-- row being written. It lives in a new `private` schema that no API role can
-- use, and EXECUTE is revoked from PUBLIC/anon/authenticated (triggers do not
-- need EXECUTE to fire; Postgres checks it only at CREATE TRIGGER).
--
-- Never blocks a write: any failure (missing Vault secret, pg_net unavailable)
-- is reported as a WARNING with SQLSTATE only and the row is still saved. A
-- missed notification is harmless: the daily migrate-images.yml run picks up
-- any row still on a Supabase Storage URL.
--
-- Residual (documented, not fixed here): pg_net keeps each queued request,
-- headers included, in net.http_request_queue until its worker sends it
-- (normally well under a second). Supabase's defaults grant SELECT on that
-- table to anon/authenticated, but the net schema is not exposed through the
-- Data API. The Dashboard webhooks had the same property.
--
-- Forward-only. Applied manually by the owner; see the runbook above.

-- 1. Preflight: refuse to replace a live webhook with an unconfigured trigger.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_trigger tg
    where not tg.tgisinternal
      and (tg.tgrelid, tg.tgname) in (
        ('public.events'::regclass, 'event-image-migration'),
        ('public.house_events'::regclass, 'house-event-image-migration')
      )
  ) then
    if (
      select count(distinct s.name)
      from vault.decrypted_secrets s
      where s.name in ('image_migration_functions_url', 'image_migration_webhook_secret')
        and coalesce(s.decrypted_secret, '') <> ''
    ) < 2 then
      raise exception
        'Create Vault secrets image_migration_functions_url and image_migration_webhook_secret before applying this migration (docs/image-migration-webhook-credential-rotation.md)';
    end if;
  end if;
end;
$$;

-- 2. Private schema: not in the Data API's exposed schemas, no API role access.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 3. Trigger function. TG_ARGV[0] is the receiving Edge Function's name.
create or replace function private.request_image_migration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_function_name text := tg_argv[0];
  v_base_url text;
  v_secret text;
begin
  if tg_op = 'UPDATE' and new.image_url is not distinct from old.image_url then
    return null;
  end if;

  -- Nothing to migrate: no image, or already a repo-hosted path. The Edge
  -- Function applies the same rules; skipping here only saves a request.
  if new.image_url is null or new.image_url = '' or left(new.image_url, 1) = '/' then
    return null;
  end if;

  select s.decrypted_secret into v_base_url
  from vault.decrypted_secrets s
  where s.name = 'image_migration_functions_url';

  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s
  where s.name = 'image_migration_webhook_secret';

  if coalesce(v_base_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning 'image migration trigger on %.%: Vault secrets not configured, request skipped',
      tg_table_schema, tg_table_name;
    return null;
  end if;

  perform net.http_post(
    url := rtrim(v_base_url, '/') || '/' || v_function_name,
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', jsonb_build_object('id', new.id, 'image_url', new.image_url),
      'old_record', case
        when tg_op = 'UPDATE' then jsonb_build_object('id', old.id, 'image_url', old.image_url)
      end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-image-migration-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return null;
exception
  when others then
    -- SQLSTATE only: the message text could echo request details.
    raise warning 'image migration trigger on %.% failed (SQLSTATE %), request skipped',
      tg_table_schema, tg_table_name, sqlstate;
    return null;
end;
$$;

revoke all on function private.request_image_migration() from public, anon, authenticated;

-- 4. Swap the Dashboard webhooks for the tracked triggers.
drop trigger if exists "event-image-migration" on public.events;
drop trigger if exists "house-event-image-migration" on public.house_events;

drop trigger if exists request_event_image_migration on public.events;
create trigger request_event_image_migration
  after insert or update of image_url on public.events
  for each row
  execute function private.request_image_migration('trigger-event-image-migration');

drop trigger if exists request_house_event_image_migration on public.house_events;
create trigger request_house_event_image_migration
  after insert or update of image_url on public.house_events
  for each row
  execute function private.request_image_migration('trigger-house-event-image-migration');
