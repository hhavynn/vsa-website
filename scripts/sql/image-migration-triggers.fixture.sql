-- Synthetic stub of the Supabase pieces that
-- 20261010120000_vault_backed_image_migration_triggers.sql touches. Not a replay
-- of the hosted schema. Privileges mirror production as read on 2026-10-08:
-- anon/authenticated have no vault access and can execute net.http_post, and
-- PUBLIC can read pg_trigger. net.http_post records requests instead of sending
-- them. Every credential below is fake. Run through
-- scripts/sql/image-migration-triggers.test.sh, never against a real project.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
-- app_owner stands in for Supabase's non-superuser `postgres` role.
do $$ begin create role app_owner login createrole; exception when duplicate_object then null; end $$;
do $$ begin execute format('grant create on database %I to app_owner', current_database()); end $$;
grant authenticated, anon, service_role to app_owner;

create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
revoke all on schema vault from public;
revoke all on all tables in schema vault from public;
grant usage on schema vault to app_owner, service_role;
grant select on vault.decrypted_secrets to app_owner, service_role;
grant select, insert, update, delete on vault.secrets to app_owner;

create schema net;
create table net.calls (id bigserial primary key, url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds int);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                              headers jsonb default '{"Content-Type": "application/json"}',
                              timeout_milliseconds int default 5000)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if current_setting('stub.net_fail', true) = 'on' then
    raise exception 'stub pg_net failure for url %', url;
  end if;
  insert into net.calls (url, body, params, headers, timeout_milliseconds)
  values (url, body, params, headers, timeout_milliseconds) returning id into v_id;
  return v_id;
end $$;
grant usage on schema net to public;
grant execute on function net.http_post(text, jsonb, jsonb, jsonb, int) to public;

create schema supabase_functions;
create function supabase_functions.http_request() returns trigger language plpgsql as $$
begin
  insert into net.calls (url, headers) values ('legacy:' || tg_argv[0], tg_argv[2]::jsonb);
  return null;
end $$;
grant usage on schema supabase_functions to public;

create table public.events (id uuid primary key default gen_random_uuid(), name text, image_url text);
create table public.house_events (id uuid primary key default gen_random_uuid(), title text, image_url text, image_thumbnail_url text);
alter table public.events owner to app_owner;
alter table public.house_events owner to app_owner;
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.events, public.house_events to authenticated, service_role;

-- Dashboard-style webhooks with inline credentials (fake values).
create trigger "event-image-migration" after insert or update on public.events
  for each row execute function supabase_functions.http_request(
    'https://example.supabase.co/functions/v1/trigger-event-image-migration', 'POST',
    '{"Content-type":"application/json","Authorization":"Bearer FAKE-SERVICE-ROLE-TOKEN","x-image-migration-secret":"LEGACYSECRET0000"}',
    '{}', '5000');
create trigger "house-event-image-migration" after insert or update on public.house_events
  for each row execute function supabase_functions.http_request(
    'https://example.supabase.co/functions/v1/trigger-house-event-image-migration', 'POST',
    '{"Content-type":"application/json","Authorization":"Bearer FAKE-SERVICE-ROLE-TOKEN","x-image-migration-secret":"LEGACYSECRET0000"}',
    '{}', '5000');
