-- Disposable cluster fixture. Prerequisites are stubs; House tables, RLS,
-- guard triggers, placement columns and RPC come from the exact repo migrations.
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create table auth.users (id uuid primary key);
create table public.members (id uuid primary key);
create table public.house_page_assets (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function public.is_admin_user(p_id uuid) returns boolean language sql stable as $$
 select coalesce(p_id = auth.uid() and p_id = '00000000-0000-0000-0000-000000000001', false);
$$;
create function public.update_updated_at_column() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
set client_min_messages = warning;
\ir ../../supabase/migrations/20261001213414_create_house_assignment_batches.sql
\ir ../../supabase/migrations/20261026230757_house_assignment_timestamp_placement.sql
\ir ../../supabase/migrations/20261027120000_house_placement_override_rpc.sql
set client_min_messages = notice;
insert into public.house_page_assets values
 ('20000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002');
insert into public.house_assignment_batches
 (id, academic_year_start, academic_year_end, effective_start_date, assignment_method, capacity_config)
values ('10000000-0000-0000-0000-000000000001',2026,2027,'2026-11-01','timestamp_ranked',
 '{"20000000-0000-0000-0000-000000000001":2,"20000000-0000-0000-0000-000000000002":1}');
insert into public.house_assignment_drafts (id,batch_id,house_profile_id,generated_house_profile_id,source_order)
values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',2);
-- Inject a real database exception on the second row to prove rollback.
create function public.fail_second_override() returns trigger language plpgsql as $$
begin
 if new.id = '30000000-0000-0000-0000-000000000002' and new.override_reason = 'fail second' then
  raise exception 'Synthetic second-row failure' using errcode = '23514';
 end if;
 return new;
end $$;
create trigger test_second_update_failure before update on public.house_assignment_drafts
for each row execute function public.fail_second_override();

do $$ begin
 if has_function_privilege('anon','public.admin_apply_house_placement_override(uuid,jsonb,text)','execute') then
   raise exception 'anon unexpectedly has RPC execute';
 end if;
 if not has_function_privilege('authenticated','public.admin_apply_house_placement_override(uuid,jsonb,text)','execute') then
   raise exception 'authenticated lacks RPC execute';
 end if;
 if (select prosecdef from pg_proc where oid = 'public.admin_apply_house_placement_override(uuid,jsonb,text)'::regprocedure) then
   raise exception 'RPC is unexpectedly SECURITY DEFINER';
 end if;
 raise notice 'PASS: SECURITY INVOKER, anon denied, authenticated EXECUTE retained.';
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
create function pg_temp.expect_error(changes jsonb, reason text, expected_state text) returns void language plpgsql as $$
declare before_rows jsonb; actual_state text;
begin
 select jsonb_agg(to_jsonb(d) order by id) into before_rows from public.house_assignment_drafts d;
 begin
  perform * from public.admin_apply_house_placement_override('10000000-0000-0000-0000-000000000001', changes, reason);
 exception when others then actual_state := sqlstate;
 end;
 if actual_state is distinct from expected_state then
  raise exception 'Expected SQLSTATE %, got %', expected_state, actual_state;
 end if;
 if before_rows is distinct from (select jsonb_agg(to_jsonb(d) order by id) from public.house_assignment_drafts d) then
  raise exception 'Failed override left a partial change';
 end if;
 raise notice 'PASS: rejection % leaves all draft rows unchanged.', expected_state;
end $$;
-- Successful single move fills the one available spot.
do $$ declare changed integer; begin
 select count(*) into changed from public.admin_apply_house_placement_override('10000000-0000-0000-0000-000000000001',
 '[{"draft_id":"30000000-0000-0000-0000-000000000001","house_profile_id":"20000000-0000-0000-0000-000000000002"}]', 'approved');
 if changed <> 1 or not exists (select 1 from public.house_assignment_drafts where source_order=1 and house_profile_id='20000000-0000-0000-0000-000000000002' and override_reason='approved') then
  raise exception 'Single move did not persist';
 end if;
 raise notice 'PASS: single move returns and persists the changed row.';
end $$;
select pg_temp.expect_error('[{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000002"}]', 'over capacity','23514');
select pg_temp.expect_error('[{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000099"}]', 'invalid destination','22023');
select pg_temp.expect_error('[{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000002"}]',null,'22023');
update public.house_assignment_batches set status='locked';
select pg_temp.expect_error('[{"draft_id":"30000000-0000-0000-0000-000000000001","house_profile_id":"20000000-0000-0000-0000-000000000001"}]',null,'22023');
update public.house_assignment_batches set status='draft';
select pg_temp.expect_error('[{"draft_id":"30000000-0000-0000-0000-000000000001","house_profile_id":"20000000-0000-0000-0000-000000000001"},{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000002"}]','fail second','23514');
-- The same pair succeeds without the injected failure, even at full capacity.
do $$ declare changed integer; begin
 select count(*) into changed from public.admin_apply_house_placement_override('10000000-0000-0000-0000-000000000001',
 '[{"draft_id":"30000000-0000-0000-0000-000000000001","house_profile_id":"20000000-0000-0000-0000-000000000001"},{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000002"}]', 'approved swap');
 if changed <> 2 or not exists (select 1 from public.house_assignment_drafts where source_order=2 and house_profile_id='20000000-0000-0000-0000-000000000002') then
  raise exception 'Swap did not apply both rows';
 end if;
 raise notice 'PASS: two-row swap succeeds at full capacity.';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare denied boolean := false; begin
 begin
  perform * from public.admin_apply_house_placement_override('10000000-0000-0000-0000-000000000001',
  '[{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000001"}]', null);
 exception when insufficient_privilege then denied := true;
 end;
 if not denied then raise exception 'Non-admin RPC call unexpectedly succeeded'; end if;
 if exists(select 1 from public.house_assignment_drafts) then raise exception 'Non-admin can read drafts'; end if;
 raise notice 'PASS: non-admin call rejected and drafts stay private.';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists (select 1 from public.house_assignment_drafts where source_order=2 and house_profile_id='20000000-0000-0000-0000-000000000002') then
  raise exception 'Non-admin changed persisted placement';
 end if;
end $$;
-- Restore both rows to the generated House before concurrent last-slot moves.
select count(*) from public.admin_apply_house_placement_override('10000000-0000-0000-0000-000000000001',
 '[{"draft_id":"30000000-0000-0000-0000-000000000002","house_profile_id":"20000000-0000-0000-0000-000000000001"}]',null);
reset role;
