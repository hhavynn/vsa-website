-- Verifies migrations 20261001213356_ace_assignment_workspace.sql and
-- 20261030120000_ace_assignment_eligibility_policy.sql against a LOCAL or
-- STAGING database. Never run it against production.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-ace-assignments.sql
--
-- Everything runs in one transaction that is rolled back, so no fixture row
-- survives. It prints "PASS: ..." per check and aborts on the first failure.
--
-- Checks: admin-only RLS, lifecycle guards (lock freezes drafts, only the
-- publish function can publish), hard publish blockers, correct family_id +
-- parent_member_id on published Littles, and idempotent re-publish; plus the
-- saved eligibility policy: admin-only RLS on the qualifying-event table and
-- the save function, the 1–20 minimums, completed/dated/published same-year
-- events only, and the policy freeze once the cycle leaves draft.

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

insert into public.academic_terms (id, code, label, academic_year_start, academic_year_end, quarter) values
  ('60000000-0000-0000-0000-000000000001', 'VERIFY-FA26', 'Verify Fall 2026', 2026, 2027, 'fall'),
  ('60000000-0000-0000-0000-000000000002', 'VERIFY-FA25', 'Verify Fall 2025', 2025, 2026, 'fall');

insert into public.events (id, name, date, is_published, academic_term_id) values
  ('70000000-0000-0000-0000-000000000001', 'Verify past GBM', now() - interval '20 days', true, '60000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', 'Verify past social', now() - interval '10 days', true, '60000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000003', 'Verify future GBM', now() + interval '10 days', true, '60000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000004', 'Verify unpublished past', now() - interval '5 days', false, '60000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000005', 'Verify last year GBM', now() - interval '400 days', true, '60000000-0000-0000-0000-000000000002');

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


-- Eligibility policy (draft) ----------------------------------------------
select pg_temp.check_true('a new cycle has no saved minimums',
  (select little_min_events is null and big_min_events is null
   from public.ace_assignment_cycles where id = '40000000-0000-0000-0000-000000000001'));
select pg_temp.check_true('anon cannot read qualifying events',
  pg_temp.try_as('', 'anon', 'select * from public.ace_assignment_cycle_events') like 'permission denied%');
select pg_temp.check_true('anon cannot call the policy save',
  pg_temp.try_as('', 'anon',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 4, 3,
       array['70000000-0000-0000-0000-000000000001']::uuid[])$q$) like 'permission denied%');
select pg_temp.check_true('anon has no EXECUTE on the policy save',
  not has_function_privilege('anon', 'public.save_ace_eligibility_policy(uuid,integer,integer,uuid[])', 'EXECUTE'));
select pg_temp.check_true('non-admin cannot save a policy',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 4, 3,
       array['70000000-0000-0000-0000-000000000001']::uuid[])$q$) like '%Admin access required%');
select pg_temp.check_true('non-admin cannot add a qualifying event directly',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$insert into public.ace_assignment_cycle_events (cycle_id, event_id)
       values ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001')$q$)
    like '%row-level security%');

select pg_temp.check_true('admin saves 4/3 with two qualifying events',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 4, 3,
       array['70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002']::uuid[])$q$) = 'ok');
select pg_temp.check_true('the saved minimums and events are stored on the cycle',
  (select little_min_events = 4 and big_min_events = 3
   from public.ace_assignment_cycles where id = '40000000-0000-0000-0000-000000000001')
  and (select count(*) from public.ace_assignment_cycle_events
       where cycle_id = '40000000-0000-0000-0000-000000000001') = 2);
select pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
  'create temp table seen_events as select * from public.ace_assignment_cycle_events');
select pg_temp.check_true('non-admin cannot read qualifying events',
  (select count(*) from pg_temp.seen_events) = 0);
select pg_temp.check_true('admin can save a smaller event set',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 4, 3,
       array['70000000-0000-0000-0000-000000000002']::uuid[])$q$) = 'ok');
select pg_temp.check_true('saving replaces the event set',
  (select array_agg(event_id) from public.ace_assignment_cycle_events
       where cycle_id = '40000000-0000-0000-0000-000000000001')
      = array['70000000-0000-0000-0000-000000000002']::uuid[]);
select pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
  $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 4, 3,
     array['70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002']::uuid[])$q$);

select pg_temp.check_true('a minimum of 0 is rejected',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 0, 3, array[]::uuid[])$q$)
    like '%1 to 20%');
select pg_temp.check_true('a minimum of 21 is rejected by the column check',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set big_min_events = 21
       where id = '40000000-0000-0000-0000-000000000001'$q$) like '%big_min_events_check%');
select pg_temp.check_true('a future event cannot qualify',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.ace_assignment_cycle_events (cycle_id, event_id)
       values ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003')$q$)
    like '%completed, dated, published%');
select pg_temp.check_true('an unpublished event cannot qualify',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 4, 3,
       array['70000000-0000-0000-0000-000000000004']::uuid[])$q$) like '%completed, dated, published%');
select pg_temp.check_true('an event from another academic year cannot qualify',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.ace_assignment_cycle_events (cycle_id, event_id)
       values ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005')$q$)
    like '%academic year%');
select pg_temp.check_true('the same event cannot be added twice',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.ace_assignment_cycle_events (cycle_id, event_id)
       values ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001')$q$)
    like '%duplicate key%');
select pg_temp.check_true('qualifying event rows cannot be updated in place',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycle_events set event_id = '70000000-0000-0000-0000-000000000002'
       where event_id = '70000000-0000-0000-0000-000000000001'$q$) like 'permission denied%');
select pg_temp.check_true('a rejected save left the policy unchanged',
  (select count(*) from public.ace_assignment_cycle_events
   where cycle_id = '40000000-0000-0000-0000-000000000001') = 2);
select pg_temp.check_true('no published_* view reads the assignment tables',
  not exists (select 1 from pg_views where schemaname = 'public' and viewname like 'published%'
              and definition ilike '%ace_assignment%'));

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
select pg_temp.check_true('locked cycle refuses a policy save',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 5, 3,
       array['70000000-0000-0000-0000-000000000001']::uuid[])$q$) like '%policy is locked%');
select pg_temp.check_true('locked cycle freezes the minimums',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set little_min_events = 5
       where id = '40000000-0000-0000-0000-000000000001'$q$) like '%policy is locked%');
select pg_temp.check_true('locked cycle rejects adding a qualifying event',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.ace_assignment_cycle_events (cycle_id, event_id)
       values ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001')$q$)
    like '%policy is locked%');
select pg_temp.check_true('locked cycle rejects removing a qualifying event',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$delete from public.ace_assignment_cycle_events
       where event_id = '70000000-0000-0000-0000-000000000001'$q$) like '%policy is locked%');
select pg_temp.check_true('a frozen policy is intact',
  (select little_min_events = 4 and big_min_events = 3
   from public.ace_assignment_cycles where id = '40000000-0000-0000-0000-000000000001')
  and (select count(*) from public.ace_assignment_cycle_events
       where cycle_id = '40000000-0000-0000-0000-000000000001') = 2);
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

-- Eligibility policy after publish ----------------------------------------
select pg_temp.check_true('published cycle refuses a policy save',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$select public.save_ace_eligibility_policy('40000000-0000-0000-0000-000000000001', 4, 3, array[]::uuid[])$q$)
    like '%policy is published%');
select pg_temp.check_true('deleting a chosen event is not blocked by the frozen policy',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$delete from public.events where id = '70000000-0000-0000-0000-000000000002'$q$) = 'ok');
select pg_temp.check_true('the deleted event left the frozen policy',
  (select count(*) from public.ace_assignment_cycle_events
       where cycle_id = '40000000-0000-0000-0000-000000000001') = 1);
select pg_temp.check_true('admin can archive the published cycle',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set status = 'archived'
       where id = '40000000-0000-0000-0000-000000000001'$q$) = 'ok');
select pg_temp.check_true('archived cycle freezes the minimums',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.ace_assignment_cycles set big_min_events = 1
       where id = '40000000-0000-0000-0000-000000000001'$q$) like '%policy is archived%');

rollback;
