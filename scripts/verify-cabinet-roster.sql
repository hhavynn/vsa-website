-- Verifies migration 20261001222903_create_cabinet_roster_cycles.sql against a
-- LOCAL or STAGING database. Never run it against production.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-cabinet-roster.sql
--
-- Everything runs in one transaction that is rolled back, so no fixture row
-- survives. It prints "PASS: ..." per check and aborts on the first failure.
--
-- Checks: admin-only RLS (anon and non-admin see and write nothing), one live
-- roster per cabinet year, legal status transitions, a locked roster is
-- immutable except for the publish step stamping published_cabinet_member_id,
-- only draft rosters can be deleted, trigger functions are not callable by
-- clients, and publish_cabinet_roster_cycle is admin-only, idempotent, adopts
-- instead of duplicating, never blanks existing fields or touches Interns or
-- the active flag, refuses blockers, and rolls back completely on failure.

begin;

-- Fixtures ----------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000b2', false);

insert into public.cabinet_years (id, label, slug, start_year, end_year) values
  ('50000000-0000-0000-0000-000000000001', 'Verify 2097-2098 Cabinet', 'verify-2097-2098', 2097, 2098);

insert into public.cabinet_members (id, name, role, category, cabinet_year_id) values
  ('60000000-0000-0000-0000-000000000001', 'Verify Person', 'Treasurer', 'Executive Board', '50000000-0000-0000-0000-000000000001');

-- One call per check, impersonating a role; errors are captured, not raised.
create function pg_temp.try_as(p_sub text, p_role text, p_sql text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
    perform set_config('role', 'postgres', true);
    return 'ok';
  exception when others then
    perform set_config('role', 'postgres', true);
    return sqlerrm;
  end;
end $$;

create function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

-- RLS: admin only ---------------------------------------------------------
select pg_temp.check_true('anon cannot read roster cycles',
  pg_temp.try_as('', 'anon', 'select * from public.cabinet_roster_cycles') like 'permission denied%');
select pg_temp.check_true('anon cannot read roster drafts',
  pg_temp.try_as('', 'anon', 'select * from public.cabinet_roster_drafts') like 'permission denied%');

select pg_temp.check_true('admin can start a roster',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.cabinet_roster_cycles (id, cabinet_year_id)
       values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001')$q$) = 'ok');

select pg_temp.check_true('non-admin cannot start a roster',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$insert into public.cabinet_roster_cycles (cabinet_year_id)
       values ('50000000-0000-0000-0000-000000000001')$q$) like '%row-level security%');

select pg_temp.check_true('non-admin sees no rosters',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$do $d$ begin if (select count(*) from public.cabinet_roster_cycles) <> 0 then raise exception 'leak'; end if; end $d$$q$) = 'ok');

-- One live roster per cabinet year ----------------------------------------
select pg_temp.check_true('a second live roster for the same year is refused',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.cabinet_roster_cycles (cabinet_year_id)
       values ('50000000-0000-0000-0000-000000000001')$q$) like '%one_live_per_year%');

-- Drafts -------------------------------------------------------------------
select pg_temp.check_true('admin can add a position',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.cabinet_roster_drafts (id, cycle_id, role, category, name)
       values ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Treasurer', 'Executive Board', 'A')$q$) = 'ok');

select pg_temp.check_true('Interns are not a roster category',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.cabinet_roster_drafts (cycle_id, role, category)
       values ('70000000-0000-0000-0000-000000000001', 'Intern', 'Interns')$q$) like '%category_check%');

-- Lifecycle ----------------------------------------------------------------
select pg_temp.check_true('draft cannot jump to published',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_cycles set status = 'published'
       where id = '70000000-0000-0000-0000-000000000001'$q$) like '%cannot move from draft to published%');

select pg_temp.check_true('draft can be locked',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_cycles set status = 'locked'
       where id = '70000000-0000-0000-0000-000000000001'$q$) = 'ok');
select pg_temp.check_true('locking stamps locked_at',
  (select locked_at is not null from public.cabinet_roster_cycles where id = '70000000-0000-0000-0000-000000000001'));

select pg_temp.check_true('a locked roster rejects edits',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_drafts set name = 'X'
       where id = '80000000-0000-0000-0000-000000000001'$q$) like '%cannot be edited%');
select pg_temp.check_true('a locked roster rejects new positions',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.cabinet_roster_drafts (cycle_id, role, category)
       values ('70000000-0000-0000-0000-000000000001', 'Y', 'General Board')$q$) like '%cannot be edited%');

select pg_temp.check_true('publish may stamp the public row id while locked',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_drafts
       set published_cabinet_member_id = '60000000-0000-0000-0000-000000000001'
       where id = '80000000-0000-0000-0000-000000000001'$q$) = 'ok');
select pg_temp.check_true('the stamp cannot carry any other change',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_drafts
       set published_cabinet_member_id = null, name = 'sneaky'
       where id = '80000000-0000-0000-0000-000000000001'$q$) like '%cannot be edited%');

select pg_temp.check_true('a locked roster cannot be deleted',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$delete from public.cabinet_roster_cycles
       where id = '70000000-0000-0000-0000-000000000001'$q$) like '%Only draft%');

select pg_temp.check_true('a locked roster keeps its cabinet year',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_cycles set cabinet_year_id = gen_random_uuid()
       where id = '70000000-0000-0000-0000-000000000001'$q$) like '%year is fixed%');

select pg_temp.check_true('locked can be published',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_cycles set status = 'published'
       where id = '70000000-0000-0000-0000-000000000001'$q$) = 'ok');
select pg_temp.check_true('publishing stamps published_at',
  (select published_at is not null from public.cabinet_roster_cycles where id = '70000000-0000-0000-0000-000000000001'));
select pg_temp.check_true('publishing never changes the cabinet year active flag',
  (select is_active = false from public.cabinet_years where id = '50000000-0000-0000-0000-000000000001'));
select pg_temp.check_true('a published roster cannot return to draft',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.cabinet_roster_cycles set status = 'draft'
       where id = '70000000-0000-0000-0000-000000000001'$q$) like '%cannot move from published to draft%');

-- Trigger functions are not client RPCs -------------------------------------
select pg_temp.check_true('clients cannot execute the guard functions',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    'select public.guard_cabinet_roster_cycle_update()') like 'permission denied%');

-- publish_cabinet_roster_cycle ----------------------------------------------
insert into public.members (id, first_name, last_name) values
  ('10000000-0000-0000-0000-000000000001', 'Adopt', 'Me'),
  ('10000000-0000-0000-0000-000000000002', 'Intern', 'Person');
insert into public.cabinet_years (id, label, slug, start_year, end_year) values
  ('50000000-0000-0000-0000-000000000002', 'Verify 2098-2099 Cabinet', 'verify-2098-2099', 2098, 2099),
  ('50000000-0000-0000-0000-000000000003', 'Verify 2099-2100 Cabinet', 'verify-2099-2100', 2099, 2100);
-- An existing public row to adopt (with a bio the draft does not have) and an intern.
insert into public.cabinet_members (id, name, role, category, cabinet_year_id, member_id, college, fun_fact) values
  ('60000000-0000-0000-0000-000000000010', 'Adopt Me', 'Old Role', 'General Board', '50000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001', 'Existing College', 'existing bio'),
  ('60000000-0000-0000-0000-000000000011', 'Intern Person', 'Intern', 'Interns', '50000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002', null, null);

insert into public.cabinet_roster_cycles (id, cabinet_year_id) values
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003');
insert into public.cabinet_roster_drafts (id, cycle_id, role, category, display_order, name, member_id) values
  ('80000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000002', 'Treasurer', 'Executive Board', 0, 'Adopt Me', '10000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000002', 'Historian', 'General Board', 1, 'New Person', null);

select pg_temp.check_true('anon cannot execute the publish function',
  pg_temp.try_as('', 'anon', $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000002')$q$) like 'permission denied%');
select pg_temp.check_true('a non-admin cannot publish',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000002')$q$) like '%Admin access required%');
select pg_temp.check_true('a draft roster cannot be published',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000002')$q$) like '%Lock the Cabinet roster%');

update public.cabinet_roster_cycles set status = 'locked' where id = '70000000-0000-0000-0000-000000000002';

select pg_temp.check_true('an admin can publish a locked roster',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000002')$q$) = 'ok');
select pg_temp.check_true('publish created one row and adopted one',
  (select count(*) = 2 from public.cabinet_members where cabinet_year_id = '50000000-0000-0000-0000-000000000002' and category <> 'Interns'));
select pg_temp.check_true('the adopted row took the new role but kept its bio and college',
  (select role = 'Treasurer' and category = 'Executive Board' and college = 'Existing College' and fun_fact = 'existing bio'
   from public.cabinet_members where id = '60000000-0000-0000-0000-000000000010'));
select pg_temp.check_true('every draft is stamped with its public row',
  (select count(*) = 2 and bool_and(published_cabinet_member_id is not null)
   from public.cabinet_roster_drafts where cycle_id = '70000000-0000-0000-0000-000000000002'));
select pg_temp.check_true('the adopted draft points at the existing row',
  (select published_cabinet_member_id = '60000000-0000-0000-0000-000000000010'
   from public.cabinet_roster_drafts where id = '80000000-0000-0000-0000-000000000010'));
select pg_temp.check_true('the intern row is untouched',
  (select name = 'Intern Person' and role = 'Intern' and category = 'Interns'
   from public.cabinet_members where id = '60000000-0000-0000-0000-000000000011'));
select pg_temp.check_true('the cycle is published',
  (select status = 'published' and published_at is not null from public.cabinet_roster_cycles where id = '70000000-0000-0000-0000-000000000002'));
select pg_temp.check_true('publishing did not activate the cabinet year',
  (select not is_active from public.cabinet_years where id = '50000000-0000-0000-0000-000000000002'));

create temp table pg_temp.before_repeat as
  select count(*) as n from public.cabinet_members where cabinet_year_id = '50000000-0000-0000-0000-000000000002';
select pg_temp.check_true('a repeat publish succeeds',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000002')$q$) = 'ok');
-- Separate statement: a count in the same statement would use the earlier snapshot.
select pg_temp.check_true('a repeat publish creates nothing',
  (select n from pg_temp.before_repeat) = (select count(*) from public.cabinet_members where cabinet_year_id = '50000000-0000-0000-0000-000000000002'));

-- Blockers and rollback ---------------------------------------------------------
insert into public.cabinet_roster_drafts (id, cycle_id, role, category, display_order, name, member_id) values
  ('80000000-0000-0000-0000-000000000020', '70000000-0000-0000-0000-000000000003', 'Secretary', 'Executive Board', 0, 'Ok Person', null),
  ('80000000-0000-0000-0000-000000000021', '70000000-0000-0000-0000-000000000003', 'Treasurer', 'Executive Board', 1, null, null);
update public.cabinet_roster_cycles set status = 'locked' where id = '70000000-0000-0000-0000-000000000003';

select pg_temp.check_true('an empty position blocks publish',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000003')$q$) like '%still empty%');

update public.cabinet_roster_cycles set status = 'draft' where id = '70000000-0000-0000-0000-000000000003';
update public.cabinet_roster_drafts set name = 'Dup One', member_id = '10000000-0000-0000-0000-000000000001'
  where id = '80000000-0000-0000-0000-000000000020';
update public.cabinet_roster_drafts set name = 'Dup Two', member_id = '10000000-0000-0000-0000-000000000001'
  where id = '80000000-0000-0000-0000-000000000021';
update public.cabinet_roster_cycles set status = 'locked' where id = '70000000-0000-0000-0000-000000000003';
select pg_temp.check_true('the same member twice blocks publish',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000003')$q$) like '%more than one position%');

-- Force the SECOND insert to fail and prove nothing from the first survives.
update public.cabinet_roster_cycles set status = 'draft' where id = '70000000-0000-0000-0000-000000000003';
update public.cabinet_roster_drafts set name = 'Fine Person', member_id = null where id = '80000000-0000-0000-0000-000000000020';
update public.cabinet_roster_drafts set name = 'Boom', member_id = null where id = '80000000-0000-0000-0000-000000000021';
update public.cabinet_roster_cycles set status = 'locked' where id = '70000000-0000-0000-0000-000000000003';
create function public.verify_boom() returns trigger language plpgsql as $f$
begin
  if new.name = 'Boom' then raise exception 'forced failure'; end if;
  return new;
end $f$;
create trigger verify_boom before insert on public.cabinet_members for each row execute function public.verify_boom();

select pg_temp.check_true('a failure partway is reported',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000003')$q$) like '%forced failure%');
select pg_temp.check_true('a failure partway publishes nothing (no partial Cabinet)',
  (select count(*) = 0 from public.cabinet_members where cabinet_year_id = '50000000-0000-0000-0000-000000000003'));
select pg_temp.check_true('a failure partway stamps no drafts and leaves the roster locked',
  (select count(*) = 0 from public.cabinet_roster_drafts where cycle_id = '70000000-0000-0000-0000-000000000003' and published_cabinet_member_id is not null)
  and (select status = 'locked' from public.cabinet_roster_cycles where id = '70000000-0000-0000-0000-000000000003'));

drop trigger verify_boom on public.cabinet_members;
select pg_temp.check_true('after the fault clears, the retry succeeds',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_cabinet_roster_cycle('70000000-0000-0000-0000-000000000003')$q$) = 'ok');
select pg_temp.check_true('the retry created each row exactly once and published the roster',
  (select count(*) = 2 from public.cabinet_members where cabinet_year_id = '50000000-0000-0000-0000-000000000003')
  and (select status = 'published' from public.cabinet_roster_cycles where id = '70000000-0000-0000-0000-000000000003'));

rollback;
