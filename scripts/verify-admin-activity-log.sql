-- Verifies migration 20261002040000_admin_activity_log_and_review_marks.sql
-- against a LOCAL or STAGING database. Never run it against production.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-admin-activity-log.sql
--
-- One transaction, rolled back: no fixture row survives. Prints "PASS: ..." per
-- check and aborts on the first failure.
--
-- Checks: admin-only RLS (anon and non-admin read and write nothing), an admin
-- can only record activity as themselves, the log is append-only (no UPDATE or
-- DELETE), shape/size constraints, and the review-marks table (one mark per
-- row, unique, admin-only, removable by admins).

begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000b2', false);

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

-- Row count of a SELECT as a role (RLS applies).
create function pg_temp.count_as(p_sub text, p_role text, p_table text)
returns bigint language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('role', p_role, true);
  execute format('select count(*) from %s', p_table) into v;
  perform set_config('role', 'postgres', true);
  return v;
end $$;

create function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

-- admin_activity_log: RLS ---------------------------------------------------
select pg_temp.check_true('anon cannot read the activity log',
  pg_temp.try_as('', 'anon', 'select * from public.admin_activity_log') like 'permission denied%');
select pg_temp.check_true('anon cannot write the activity log',
  pg_temp.try_as('', 'anon', $q$insert into public.admin_activity_log (action, entity_type, summary) values ('ace.link_changed', 'x', 's')$q$) like 'permission denied%');

select pg_temp.check_true('admin can record activity',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_activity_log (id, action, entity_type, summary, metadata)
       values ('90000000-0000-0000-0000-000000000001', 'house.assignment_changed', 'house_assignment_draft', 'Changed Kevin''s House: Boo → Toad', '{"actor":"Havyn"}')$q$) = 'ok');
select pg_temp.check_true('the actor defaults to the signed-in admin',
  (select actor_user_id from public.admin_activity_log where id = '90000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000000a1');

select pg_temp.check_true('non-admin cannot record activity',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$insert into public.admin_activity_log (action, entity_type, summary) values ('ace.link_changed', 'x', 's')$q$) like '%row-level security%');
select pg_temp.check_true('an admin cannot record activity as someone else',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_activity_log (actor_user_id, action, entity_type, summary)
       values ('00000000-0000-0000-0000-0000000000b2', 'ace.link_changed', 'x', 's')$q$) like '%row-level security%');

select pg_temp.check_true('an admin can read the log',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'select count(*) from public.admin_activity_log') = 'ok');
select pg_temp.check_true('a non-admin sees no rows',
  pg_temp.count_as('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'public.admin_activity_log') = 0);
select pg_temp.check_true('an admin sees the entry',
  pg_temp.count_as('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'public.admin_activity_log') = 1);

-- Append-only ----------------------------------------------------------------
select pg_temp.check_true('an admin cannot update a log entry',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.admin_activity_log set summary = 'rewritten'$q$) like 'permission denied%');
select pg_temp.check_true('an admin cannot delete a log entry',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    'delete from public.admin_activity_log') like 'permission denied%');

-- Shape and size -------------------------------------------------------------
select pg_temp.check_true('rejects a malformed action',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_activity_log (action, entity_type, summary) values ('NotAnAction', 'x', 's')$q$) like '%admin_activity_log_action_check%');
select pg_temp.check_true('rejects an empty summary',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_activity_log (action, entity_type, summary) values ('ace.link_changed', 'x', '')$q$) like '%admin_activity_log_summary_check%');
select pg_temp.check_true('rejects an oversized metadata blob',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_activity_log (action, entity_type, summary, metadata)
       values ('ace.link_changed', 'x', 's', jsonb_build_object('blob', repeat('x', 5000)))$q$) like '%admin_activity_log_metadata_check%');
select pg_temp.check_true('rejects non-object metadata',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_activity_log (action, entity_type, summary, metadata) values ('ace.link_changed', 'x', 's', '[1]')$q$) like '%admin_activity_log_metadata_check%');

-- admin_review_marks ---------------------------------------------------------
select pg_temp.check_true('anon cannot read review marks',
  pg_temp.try_as('', 'anon', 'select * from public.admin_review_marks') like 'permission denied%');
select pg_temp.check_true('admin can mark a row reviewed',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_review_marks (entity_type, entity_id, academic_year_start)
       values ('house_assignment_draft', '91000000-0000-0000-0000-000000000001', 2026)$q$) = 'ok');
select pg_temp.check_true('marking the same row twice is a no-op with ON CONFLICT DO NOTHING',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_review_marks (entity_type, entity_id)
       values ('house_assignment_draft', '91000000-0000-0000-0000-000000000001')
       on conflict (entity_type, entity_id) do nothing$q$) = 'ok');
select pg_temp.check_true('a plain duplicate insert is rejected',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_review_marks (entity_type, entity_id)
       values ('house_assignment_draft', '91000000-0000-0000-0000-000000000001')$q$) like '%admin_review_marks_unique%');
select pg_temp.check_true('only the four draft tables can be marked',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$insert into public.admin_review_marks (entity_type, entity_id)
       values ('members', '91000000-0000-0000-0000-000000000002')$q$) like '%admin_review_marks_entity_type_check%');
select pg_temp.check_true('non-admin cannot mark a row reviewed',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    $q$insert into public.admin_review_marks (entity_type, entity_id)
       values ('intern_cohort_draft', '91000000-0000-0000-0000-000000000003')$q$) like '%row-level security%');
select pg_temp.check_true('a non-admin delete removes nothing',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'delete from public.admin_review_marks') = 'ok');
select pg_temp.check_true('...so the mark is still there',
  (select count(*) from public.admin_review_marks) = 1);
select pg_temp.check_true('an admin can clear the mark',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'delete from public.admin_review_marks') = 'ok');
select pg_temp.check_true('...and it is gone',
  (select count(*) from public.admin_review_marks) = 0);
insert into public.admin_review_marks (entity_type, entity_id) values ('intern_cohort_draft', '91000000-0000-0000-0000-000000000009');
select pg_temp.check_true('review marks cannot be updated',
  pg_temp.try_as('00000000-0000-0000-0000-0000000000a1', 'authenticated',
    $q$update public.admin_review_marks set academic_year_start = 1$q$) like 'permission denied%');

rollback;
