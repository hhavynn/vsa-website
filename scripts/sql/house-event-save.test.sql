-- Disposable fixture for 20261028080000_house_event_atomic_save.sql. House
-- event tables come from the exact repo migrations; the rest are stubs.
\pset tuples_only on
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create table auth.users (id uuid primary key);
create table public.user_profiles (id uuid primary key, is_admin boolean);
create table public.house_page_assets (id uuid primary key, academic_year_start integer, academic_year_end integer, house_key text, display_name text, is_active boolean default true);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.is_admin_user(p_id uuid default auth.uid()) returns boolean language sql stable as $$ select coalesce(p_id = auth.uid() and p_id = '00000000-0000-0000-0000-000000000001', false) $$;
create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
insert into public.user_profiles values ('00000000-0000-0000-0000-000000000001', true);
set client_min_messages = warning;
\ir ../../supabase/migrations/20260529000000_add_house_events.sql
\ir ../../supabase/migrations/20260529000001_collab_house_events.sql
\ir ../../supabase/migrations/20261028080000_house_event_atomic_save.sql
set client_min_messages = notice;
grant select, insert, update, delete on public.house_events, public.house_event_houses to authenticated;
grant select on public.house_page_assets, public.user_profiles to authenticated;
insert into public.house_page_assets values
 ('aaaaaaaa-0000-0000-0000-000000000001', 2026, 2027, 'twilight', 'Twilight Sparkle'),
 ('aaaaaaaa-0000-0000-0000-000000000002', 2026, 2027, 'rarity', 'Rarity'),
 ('aaaaaaaa-0000-0000-0000-000000000025', 2025, 2026, 'toad', 'Toad');

create function pg_temp.expect(statement text, state text, label text) returns void language plpgsql as $$
declare got text; msg text;
begin
 begin execute statement; exception when others then got := sqlstate; msg := sqlerrm; end;
 if got is distinct from state then raise exception 'FAIL (%): expected %, got % %', label, state, got, msg; end if;
 raise notice 'PASS: %', label;
end $$;
grant execute on function pg_temp.expect(text, text, text) to anon, authenticated;

set role anon;
select pg_temp.expect($$select public.admin_save_house_event(null, '{}', '{}', gen_random_uuid())$$, '42501', 'anon cannot save House events');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.expect($$select public.admin_save_house_event(null, '{"title":"x"}', '{}', gen_random_uuid())$$, '42501', 'a non-admin cannot save House events');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

-- Create: draft by default, idempotent retry, both hosts linked.
do $$ declare a uuid; b uuid; begin
 select id into a from public.admin_save_house_event(null,
  '{"house_profile_id":"aaaaaaaa-0000-0000-0000-000000000001","academic_year_start":2026,"title":"Fictional Movie Night","event_date":"2026-11-14"}',
  array['aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002']::uuid[], '11111111-0000-0000-0000-000000000001');
 select id into b from public.admin_save_house_event(null,
  '{"house_profile_id":"aaaaaaaa-0000-0000-0000-000000000001","academic_year_start":2026,"title":"Fictional Movie Night","event_date":"2026-11-14"}',
  array['aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002']::uuid[], '11111111-0000-0000-0000-000000000001');
 if a <> b or (select count(*) from public.house_events) <> 1 then raise exception 'FAIL: a retried create duplicated the event'; end if;
 if (select is_published from public.house_events) then raise exception 'FAIL: a new event is published by default'; end if;
 if (select count(*) from public.house_event_houses where house_event_id = a) <> 2 then raise exception 'FAIL: hosts not linked'; end if;
 raise notice 'PASS: create is a draft, links both hosts, and a retry returns the same event.';
end $$;

select pg_temp.expect($$select public.admin_save_house_event(null, '{"house_profile_id":"aaaaaaaa-0000-0000-0000-000000000001","academic_year_start":2026,"title":"t","event_date":"2026-11-20"}', '{}'::uuid[], gen_random_uuid())$$, '23514', 'at least one host is required');
select pg_temp.expect($$select public.admin_save_house_event(null, '{"house_profile_id":"aaaaaaaa-0000-0000-0000-000000000001","academic_year_start":2026,"title":"t","event_date":"2026-11-20"}', array['aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000025']::uuid[], gen_random_uuid())$$, '23514', 'a host from another academic year is refused');
select pg_temp.expect($$select public.admin_save_house_event(null, '{"house_profile_id":"aaaaaaaa-0000-0000-0000-000000000001","academic_year_start":2026,"title":"t","event_date":"2026-11-20"}', array['aaaaaaaa-0000-0000-0000-000000000002']::uuid[], gen_random_uuid())$$, '23514', 'the primary host must be a host');
select pg_temp.expect($$select public.admin_save_house_event(null, '{"house_profile_id":"aaaaaaaa-0000-0000-0000-000000000001","academic_year_start":2026,"title":"t","event_date":"2026-11-20","is_admin":true}', array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[], gen_random_uuid())$$, '22023', 'unknown fields are refused');
select pg_temp.expect($$insert into public.house_event_houses (house_event_id, house_page_asset_id) select id, 'aaaaaaaa-0000-0000-0000-000000000025' from public.house_events$$, '23514', 'a direct insert of a wrong-year host is refused');

-- Update: hosts replaced atomically; a failure leaves everything unchanged.
create temp table before_state as select (select to_jsonb(e) from public.house_events e) as ev, (select jsonb_agg(h order by house_page_asset_id) from public.house_event_houses h) as hosts;
select pg_temp.expect($$select public.admin_save_house_event((select id from public.house_events), '{"title":"Renamed"}', array['aaaaaaaa-0000-0000-0000-000000000025']::uuid[], null)$$, '23514', 'an update with a wrong-year host is refused');
do $$ begin
 if (select to_jsonb(e) from public.house_events e) <> (select ev from before_state)
   or (select jsonb_agg(h order by house_page_asset_id) from public.house_event_houses h) <> (select hosts from before_state) then
  raise exception 'FAIL: a refused update changed the event or its hosts';
 end if;
 raise notice 'PASS: a refused update leaves the event and its hosts exactly as they were.';
end $$;
select pg_temp.expect($$select public.admin_save_house_event((select id from public.house_events), '{"title":"Stale"}', array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[], null, '2000-01-01T00:00:00Z')$$, '40001', 'a stale editor cannot overwrite a newer change');
do $$ declare ev public.house_events; begin
 select * into ev from public.admin_save_house_event((select id from public.house_events), '{"title":"Solo Movie Night","house_profile_id":"aaaaaaaa-0000-0000-0000-000000000002"}',
  array['aaaaaaaa-0000-0000-0000-000000000002']::uuid[], null, (select updated_at from public.house_events));
 if (select array_agg(house_page_asset_id) from public.house_event_houses) <> array['aaaaaaaa-0000-0000-0000-000000000002']::uuid[] then raise exception 'FAIL: hosts not replaced'; end if;
 if ev.title <> 'Solo Movie Night' or ev.event_date <> '2026-11-14' then raise exception 'FAIL: untouched fields changed or title not saved'; end if;
 raise notice 'PASS: an update replaces hosts in one step and leaves untouched fields alone.';
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon', 'public.admin_save_house_event(uuid,jsonb,uuid[],uuid,timestamptz)', 'execute') then raise exception 'FAIL: anon can execute'; end if;
 if (select prosecdef from pg_proc where proname = 'admin_save_house_event') then raise exception 'FAIL: unexpectedly SECURITY DEFINER'; end if;
 raise notice 'PASS: SECURITY INVOKER (admin RLS applies) and not executable by anon.';
end $$;
