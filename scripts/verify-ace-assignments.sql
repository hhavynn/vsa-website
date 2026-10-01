-- Verifies migration 20261001213356_ace_assignment_workspace.sql against a
-- LOCAL or STAGING database. Never run it against production.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-ace-assignments.sql
--
-- Everything runs in one transaction that is rolled back, so no fixture row
-- survives. It prints "PASS: ..." per check and aborts on the first failure.
--
-- Checks: admin-only RLS, lifecycle guards (lock freezes drafts, only the
-- publish function can publish), hard publish blockers, correct family_id +
-- parent_member_id on published Littles, and idempotent re-publish.

begin;

-- Fixtures ----------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000b2', false);

insert into public.members (id, first_name, last_name) values
  ('10000000-0000-0000-0000-000000000001', 'Amy', 'Tran'),
  ('10000000-0000-0000-0000-000000000002', 'Kevin', 'Le');

insert into public.ace_families (id, name, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Verify Sweatpants', 'verify-sweatpants'),
  ('20000000-0000-0000-0000-000000000002', 'Verify NSF', 'verify-nsf');

insert into public.ace_family_members (id, family_id, name, role_label) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'April Pham', 'Little'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Emily Nguyen', 'Little');

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
select pg_temp.check_true('anon cannot read cycles',
  pg_temp.try_as('', 'anon', 'select * from public.ace_assignment_cycles') like 'permission denied%');
select pg_temp.check_true('anon cannot read drafts',
  pg_temp.try_as('', 'anon', 'select * from public.ace_assignment_drafts') like 'permission denied%');
select pg_temp.check_true('non-admin cannot create a cycle',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$insert into public.ace_assignment_cycles (academic_year_start, academic_year_end) values (2026, 2027)$q$)
    like '%row-level security%');

select pg_temp.check_true('admin can create a cycle',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.ace_assignment_cycles (id, academic_year_start, academic_year_end)
       values ('40000000-0000-0000-0000-000000000001', 2026, 2027)$q$) = 'ok');
select pg_temp.check_true('a second open cycle for the same year is rejected',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.ace_assignment_cycles (academic_year_start, academic_year_end) values (2026, 2027)$q$)
    like '%one_open_per_year%');
select pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
  'create temp table seen as select * from public.ace_assignment_cycles');
select pg_temp.check_true('non-admin cannot read cycles',
  (select count(*) from public.ace_assignment_cycles) = 1
  and (select count(*) from pg_temp.seen) = 0);

-- Drafts (admin) ----------------------------------------------------------
select pg_temp.check_true('admin can add drafts',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated', $q$
    insert into public.ace_assignment_drafts (id, cycle_id, little_name, little_member_id, big_ace_member_id, display_order) values
      ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Amy Tran',  '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
      ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Kevin Le',  '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1),
      ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'No Record Person', null, null, 2)
  $q$) = 'ok');

-- Lifecycle ---------------------------------------------------------------
select pg_temp.check_true('cannot publish an unlocked cycle',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001')$q$)
    like '%Lock the assignment cycle%');
select pg_temp.check_true('non-admin cannot call publish',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001')$q$)
    like '%Admin access required%');
select pg_temp.check_true('anon cannot call publish',
  pg_temp.try_as('', 'anon',
    $q$select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001')$q$)
    like 'permission denied%');
select pg_temp.check_true('admin cannot set published directly',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set status = 'published' where id = '40000000-0000-0000-0000-000000000001'$q$)
    like '%Cannot move an assignment cycle from draft to published%');

select pg_temp.check_true('admin can lock',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set status = 'locked' where id = '40000000-0000-0000-0000-000000000001'$q$) = 'ok');
select pg_temp.check_true('locked cycle rejects new drafts',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.ace_assignment_drafts (cycle_id, little_name) values ('40000000-0000-0000-0000-000000000001', 'Late Add')$q$)
    like '%cannot be edited%');
select pg_temp.check_true('locked cycle rejects draft edits',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_drafts set little_name = 'Changed' where id = '50000000-0000-0000-0000-000000000001'$q$)
    like '%cannot be edited%');
select pg_temp.check_true('locked cycle rejects draft deletes',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$delete from public.ace_assignment_drafts where id = '50000000-0000-0000-0000-000000000001'$q$)
    like '%cannot be edited%');
select pg_temp.check_true('locking made nothing public (no new tree nodes)',
  (select count(*) from public.ace_family_members) = 2);

-- Hard blockers ---------------------------------------------------------
select pg_temp.check_true('publish blocked while a Little has no Big',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001')$q$)
    like '%no Big%');
select pg_temp.check_true('a blocked publish created nothing',
  (select count(*) from public.ace_family_members) = 2
  and (select count(*) from public.ace_assignment_drafts where published_ace_member_id is not null) = 0);

-- Unlock, fix: the unassigned Little is given a duplicate member + name ------
select pg_temp.check_true('admin can unlock',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set status = 'draft' where id = '40000000-0000-0000-0000-000000000001'$q$) = 'ok');
select pg_temp.check_true('unlocked cycle accepts edits again',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated', $q$
    update public.ace_assignment_drafts
    set big_ace_member_id = '30000000-0000-0000-0000-000000000001',
        little_member_id = '10000000-0000-0000-0000-000000000001',
        little_name = 'amy  tran'
    where id = '50000000-0000-0000-0000-000000000003'
  $q$) = 'ok');
update public.ace_assignment_cycles set status = 'locked' where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check_true('publish blocked by duplicate Little and duplicate member',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001')$q$)
    like '%appear more than once%' );

-- Fix the third row into a distinct Little under the same Big ---------------
update public.ace_assignment_cycles set status = 'draft' where id = '40000000-0000-0000-0000-000000000001';
update public.ace_assignment_drafts
set little_name = 'No Record Person', little_member_id = null
where id = '50000000-0000-0000-0000-000000000003';
update public.ace_assignment_cycles set status = 'locked' where id = '40000000-0000-0000-0000-000000000001';

-- Publish ---------------------------------------------------------------
select pg_temp.check_true('publish succeeds once blockers are fixed',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$create temp table pub1 as select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001') as r$q$) = 'ok');
select pg_temp.check_true('publish reports 3 created',
  (select (r->>'created')::int = 3 and (r->>'already_published')::boolean = false from pg_temp.pub1));
select pg_temp.check_true('Little nodes sit in the Big''s family with the Big as parent',
  (select count(*) from public.ace_family_members n
   join public.ace_assignment_drafts d on d.published_ace_member_id = n.id
   join public.ace_family_members big on big.id = d.big_ace_member_id
   where n.family_id = big.family_id and n.parent_member_id = big.id
     and n.role_label = 'Little' and n.is_published = true) = 3);
select pg_temp.check_true('Amy Tran is in the Sweatpants fam under April Pham and keeps her member link',
  exists (select 1 from public.ace_family_members
          where name = 'Amy Tran'
            and family_id = '20000000-0000-0000-0000-000000000001'
            and parent_member_id = '30000000-0000-0000-0000-000000000001'
            and member_id = '10000000-0000-0000-0000-000000000001'));
select pg_temp.check_true('Kevin Le is in the NSF fam under Emily Nguyen',
  exists (select 1 from public.ace_family_members
          where name = 'Kevin Le'
            and family_id = '20000000-0000-0000-0000-000000000002'
            and parent_member_id = '30000000-0000-0000-0000-000000000002'));
select pg_temp.check_true('a Little with no member record is created unlinked',
  exists (select 1 from public.ace_family_members where name = 'No Record Person' and member_id is null));
select pg_temp.check_true('a second Little under the same Big gets the next sibling order',
  (select array_agg(display_order order by display_order)
   from public.ace_family_members
   where parent_member_id = '30000000-0000-0000-0000-000000000001') = array[0, 1]);
select pg_temp.check_true('cycle is published and every draft records its node',
  (select status from public.ace_assignment_cycles where id = '40000000-0000-0000-0000-000000000001') = 'published'
  and (select count(*) from public.ace_assignment_drafts where published_ace_member_id is not null) = 3);

-- Idempotency -----------------------------------------------------------
select pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
  $q$create temp table pub2 as select public.publish_ace_assignment_cycle('40000000-0000-0000-0000-000000000001') as r$q$);
select pg_temp.check_true('second publish is a no-op',
  (select (r->>'created')::int = 0 and (r->>'already_published')::boolean from pg_temp.pub2));
select pg_temp.check_true('no duplicate Littles after the second publish',
  (select count(*) from public.ace_family_members) = 5);
select pg_temp.check_true('published cycle cannot be unlocked',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set status = 'draft' where id = '40000000-0000-0000-0000-000000000001'$q$)
    like '%Cannot move an assignment cycle from published to draft%');
select pg_temp.check_true('published drafts stay frozen',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_drafts set notes = 'x' where id = '50000000-0000-0000-0000-000000000001'$q$)
    like '%cannot be edited%');

-- Deleting a live node must not be blocked by a frozen draft --------------
select pg_temp.check_true('a frozen draft does not block deleting its live node',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$delete from public.ace_family_members where name = 'Kevin Le'$q$) = 'ok');
select pg_temp.check_true('the deleted node is nulled on its draft',
  (select published_ace_member_id from public.ace_assignment_drafts
   where id = '50000000-0000-0000-0000-000000000002') is null);

rollback;
