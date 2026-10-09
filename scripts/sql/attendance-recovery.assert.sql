-- Assertions for migration 20261009000026_historical_attendance_recovery.sql.
-- Run by scripts/test-attendance-recovery.sh against a disposable local cluster.
-- Synthetic people only. One transaction, rolled back. Prints "PASS: ..." per
-- check and aborts on the first failure. Concurrency runs separately in the
-- shell script, because it needs two sessions.

begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000a2', true),
  ('00000000-0000-0000-0000-0000000000b2', false);

insert into public.academic_terms (id, label) values ('70000000-0000-0000-0000-000000000001', 'Fall 2025');
insert into public.events (id, name, points, academic_term_id) values
  ('80000000-0000-0000-0000-000000000001', 'Verify GBM', 10, '70000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000002', 'Verify Social', 5, '70000000-0000-0000-0000-000000000001');

insert into public.members (id, first_name, last_name, email) values
  ('10000000-0000-0000-0000-000000000001', 'Linh', 'Tran', 'linh.tran@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000002', 'Lynn', 'Tran', 'lynn.tran@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000003', 'Minh', 'Nguyen', 'minh1@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000004', 'Minh', 'Nguyen', 'minh2@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000005', 'Kevin', 'Le', 'kevin.le@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000006', 'Kevin', 'Lee', 'kevlee@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000007', 'Anna', 'Pham', 'anna@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000008', 'Bao', 'Vo', 'bao@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000009', 'Tom', 'Do', 'tom@ucsd.edu'),
  ('10000000-0000-0000-0000-000000000010', 'Duc', 'Ha', 'duc@ucsd.edu');

-- Existing ledger; the trigger fills cached totals.
insert into public.member_event_attendance (member_id, event_id, points_earned) values
  ('10000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000001', 10),
  ('10000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000001', 10),
  ('10000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000001', 10),
  ('10000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000001', 10),
  ('10000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 10),
  ('10000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000001', 10),
  ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 5);

insert into public.import_jobs (id, event_id, status, total_rows) values
  ('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'completed', 11),
  ('20000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'completed', 1),
  ('20000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'failed', 1);
-- An import run a day after the attendance it points at already existed.
insert into public.import_jobs (id, event_id, status, total_rows, created_at) values
  ('20000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', 'completed', 1, now() + interval '1 day');

insert into public.import_job_rows (id, import_job_id, source_row_index, event_id, display_name, csv_email, decision, matched_member_id, attendance_member_id, match_details) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 0, '80000000-0000-0000-0000-000000000001', 'Linh Tran', 'linh.new@gmail.com', 'review', null, null,
    '{"match_reason": "ambiguous_match", "candidate_member_ids": ["10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000002"], "can_mark_new": false}'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1, '80000000-0000-0000-0000-000000000001', 'Lynn Tranh', 'lynnh@ucsd.edu', 'review', null, null,
    '{"match_reason": "ambiguous_match", "candidate_member_ids": ["10000000-0000-0000-0000-000000000002"], "can_mark_new": false}'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 2, '80000000-0000-0000-0000-000000000001', 'Minh Nguyen', 'minh3@ucsd.edu', 'review', null, null,
    '{"match_reason": "ambiguous_match", "candidate_member_ids": ["10000000-0000-0000-0000-000000000003", "10000000-0000-0000-0000-000000000004"]}'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 3, '80000000-0000-0000-0000-000000000001', 'Kevin Lee', 'kevlee@ucsd.edu', 'matched', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005',
    '{"match_reason": "fuzzy_match", "match_method": "fuzzy_name", "name_score": 92}'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 4, '80000000-0000-0000-0000-000000000001', 'Anna Pham', null, 'review', null, null,
    '{"match_reason": "ambiguous_match"}'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 5, '80000000-0000-0000-0000-000000000001', 'Kev Le', 'kevin.le@ucsd.edu', 'review', null, null,
    '{"match_reason": "email_name_conflict"}'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 6, '80000000-0000-0000-0000-000000000001', 'Test Row', null, 'review', null, null,
    '{"match_reason": "ambiguous_match"}'),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 7, '80000000-0000-0000-0000-000000000001', 'Minh Nguyen', 'minh2@ucsd.edu', 'matched', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
    '{"match_reason": "exact_name", "match_method": "exact_name"}'),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 0, '80000000-0000-0000-0000-000000000001', 'Minh Nguyen', 'minh1@ucsd.edu', 'matched', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
    '{"match_reason": "email_match", "match_method": "email"}'),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 8, '80000000-0000-0000-0000-000000000001', 'Rollback Person', null, 'review', null, null,
    '{"match_reason": "ambiguous_match"}'),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000003', 0, '80000000-0000-0000-0000-000000000001', 'Failed Job Person', null, 'review', null, null,
    '{"match_reason": "ambiguous_match"}'),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', 9, '80000000-0000-0000-0000-000000000001', 'Anna Pham', 'anna@ucsd.edu', 'matched', '10000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009',
    '{"match_reason": "fuzzy_match", "match_method": "fuzzy_name", "name_score": 70}'),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000001', 10, '80000000-0000-0000-0000-000000000001', 'Duc Hai', 'duchai@ucsd.edu', 'matched', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000010',
    '{"match_reason": "fuzzy_match", "match_method": "fuzzy_name", "name_score": 91}'),
  ('30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000001', 11, '80000000-0000-0000-0000-000000000001', 'Duc Ha', 'duc.ha@gmail.com', 'review', null, null,
    '{"match_reason": "ambiguous_match", "candidate_member_ids": ["10000000-0000-0000-0000-000000000010"]}'),
  ('30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000004', 0, '80000000-0000-0000-0000-000000000001', 'Bao Vo', 'bao.vo@gmail.com', 'matched', '10000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008',
    '{"match_reason": "fuzzy_match", "match_method": "fuzzy_name", "name_score": 90}'),
  ('30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000002', 1, '80000000-0000-0000-0000-000000000001', 'Duc Ha', 'duc.ha@gmail.com', 'review', null, null,
    '{"match_reason": "ambiguous_match", "candidate_member_ids": ["10000000-0000-0000-0000-000000000010"]}');

-- Helpers ------------------------------------------------------------------
-- Runs SQL as a role and returns {ok, result} or {ok:false, code, message, hint}.
create function pg_temp.call_as(p_sub text, p_role text, p_sql text)
returns jsonb language plpgsql as $$
declare
  v jsonb;
  v_code text;
  v_msg text;
  v_hint text;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql into v;
    perform set_config('role', 'none', true);
    return jsonb_build_object('ok', true, 'result', v);
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text, v_hint = pg_exception_hint;
    perform set_config('role', 'none', true);
    return jsonb_build_object('ok', false, 'code', v_code, 'message', v_msg, 'hint', v_hint);
  end;
end $$;

create function pg_temp.admin(p_sql text) returns jsonb language sql as $$
  select pg_temp.call_as('00000000-0000-0000-0000-0000000000a1', 'authenticated', p_sql);
$$;

create function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

create function pg_temp.points(p_member text) returns integer language sql as $$
  select points from public.members where id = p_member::uuid;
$$;
create function pg_temp.attended(p_member text) returns integer language sql as $$
  select events_attended from public.members where id = p_member::uuid;
$$;
create function pg_temp.has_att(p_member text, p_event text) returns boolean language sql as $$
  select exists (select 1 from public.member_event_attendance where member_id = p_member::uuid and event_id = p_event::uuid);
$$;
create function pg_temp.latest(p_row text) returns uuid language sql as $$
  select a.id from public.import_recovery_actions a
  where a.import_job_row_id = p_row::uuid
    and not exists (select 1 from public.import_recovery_actions n where n.previous_action_id = a.id);
$$;

create temp table r (label text primary key, v jsonb);

select pg_temp.check_true('fixture totals come from the live trigger',
  pg_temp.points('10000000-0000-0000-0000-000000000005') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000001') = 5);

-- Unauthorized access ---------------------------------------------------------
select pg_temp.check_true('anon cannot execute the recovery RPC',
  (pg_temp.call_as('', 'anon', $q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'restore', null, '10000000-0000-0000-0000-000000000001')$q$) ->> 'code') = '42501');
select pg_temp.check_true('anon cannot execute the findings function',
  (pg_temp.call_as('', 'anon', 'select public.admin_import_recovery_findings()') ->> 'code') = '42501');
select pg_temp.check_true('a non-admin cannot recover attendance',
  (pg_temp.call_as('00000000-0000-0000-0000-0000000000b2', 'authenticated', $q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'restore', null, '10000000-0000-0000-0000-000000000001')$q$) ->> 'message')
    = 'Only admins can recover historical attendance');
select pg_temp.check_true('a non-admin cannot read findings',
  (pg_temp.call_as('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'select public.admin_import_recovery_findings()') ->> 'code') = '42501');
select pg_temp.check_true('anon cannot read recovery history',
  (pg_temp.call_as('', 'anon', 'select to_jsonb(count(*)) from public.import_recovery_actions') ->> 'code') = '42501');
select pg_temp.check_true('an admin cannot write recovery history directly',
  (pg_temp.admin($q$insert into public.import_recovery_actions (request_id, import_job_row_id, action, resulting_status, outcome)
     values (gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'dismiss', 'dismissed', 'dismissed') returning to_jsonb(id)$q$) ->> 'code') = '42501');
select pg_temp.check_true('nothing was written by unauthorized calls',
  pg_temp.points('10000000-0000-0000-0000-000000000001') = 5
  and not pg_temp.has_att('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001'));

-- Findings ------------------------------------------------------------------
insert into r select 'findings', pg_temp.admin('select public.admin_import_recovery_findings()');
select pg_temp.check_true('admin reads evidence for every audited row',
  jsonb_array_length((select v -> 'result' from r where label = 'findings')) = 16);
select pg_temp.check_true('evidence flags the fuzzy match whose email differs from the member''s',
  (select (f ->> 'email_conflict')::boolean and (f ->> 'email_conflict_both_school')::boolean
   from r, jsonb_array_elements(r.v -> 'result') f
   where r.label = 'findings' and f ->> 'row_id' = '30000000-0000-0000-0000-000000000004'));
select pg_temp.check_true('evidence counts identical-name members',
  (select (f ->> 'exact_name_members')::int from r, jsonb_array_elements(r.v -> 'result') f
   where r.label = 'findings' and f ->> 'row_id' = '30000000-0000-0000-0000-000000000003') = 2);

-- Restore a skipped attendee to a confirmed existing member -------------------
insert into r select 'restore1', pg_temp.admin($q$select public.admin_recover_import_row(
  '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'restore', null, '10000000-0000-0000-0000-000000000001')$q$);
select pg_temp.check_true('restore adds attendance once and reports it',
  (select v -> 'result' ->> 'outcome' from r where label = 'restore1') = 'attendance_added'
  and (select (v -> 'result' ->> 'points_awarded')::int from r where label = 'restore1') = 10
  and pg_temp.has_att('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001'));
select pg_temp.check_true('the trigger recalculated the restored member''s totals',
  pg_temp.points('10000000-0000-0000-0000-000000000001') = 15
  and pg_temp.attended('10000000-0000-0000-0000-000000000001') = 2);
select pg_temp.check_true('restore did not touch the near-name candidate or a bystander',
  pg_temp.points('10000000-0000-0000-0000-000000000002') = 0
  and pg_temp.points('10000000-0000-0000-0000-000000000008') = 10);
select pg_temp.check_true('restore left the member profile and import row unchanged',
  (select email from public.members where id = '10000000-0000-0000-0000-000000000001') = 'linh.tran@ucsd.edu'
  and (select decision from public.import_job_rows where id = '30000000-0000-0000-0000-000000000001') = 'review');
select pg_temp.check_true('restore is audited in history and the activity log',
  (select count(*) from public.import_recovery_actions where import_job_row_id = '30000000-0000-0000-0000-000000000001') = 1
  and (select actor_user_id from public.import_recovery_actions where request_id = '40000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000000a1'
  and exists (select 1 from public.admin_activity_log where action = 'member.attendance_recovered'
              and entity_id = '30000000-0000-0000-0000-000000000001'
              and metadata ->> 'outcome' = 'attendance_added'
              and actor_user_id = '00000000-0000-0000-0000-0000000000a1'));

-- Repeated attempts -----------------------------------------------------------
insert into r select 'replay', pg_temp.admin($q$select public.admin_recover_import_row(
  '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'restore', null, '10000000-0000-0000-0000-000000000001')$q$);
select pg_temp.check_true('replaying the same request returns the original result without writing',
  (select (v -> 'result' ->> 'replayed')::boolean from r where label = 'replay')
  and (select v -> 'result' ->> 'action_id' from r where label = 'replay') = (select v -> 'result' ->> 'action_id' from r where label = 'restore1')
  and pg_temp.points('10000000-0000-0000-0000-000000000001') = 15
  and (select count(*) from public.import_recovery_actions where import_job_row_id = '30000000-0000-0000-0000-000000000001') = 1
  and (select count(*) from public.admin_activity_log where entity_id = '30000000-0000-0000-0000-000000000001') = 1);
select pg_temp.check_true('a request id cannot be replayed with different parameters',
  (pg_temp.admin($q$select public.admin_recover_import_row('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'restore', null, '10000000-0000-0000-0000-000000000002')$q$) ->> 'message')
    like '%already used for a different recovery%'
  and pg_temp.points('10000000-0000-0000-0000-000000000002') = 0);
select pg_temp.check_true('a request id cannot be reused for another row',
  (pg_temp.admin($q$select public.admin_recover_import_row('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'restore', null, '10000000-0000-0000-0000-000000000001')$q$) ->> 'message')
    like '%already used for a different recovery%');
select pg_temp.check_true('a second attempt from a stale view is rejected',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'restore', null, '10000000-0000-0000-0000-000000000002')$q$) ->> 'hint') = 'stale_finding');
select pg_temp.check_true('a second attempt on a recovered finding is rejected',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'restore', %L, '10000000-0000-0000-0000-000000000002')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000001'))) ->> 'hint') = 'finding_closed');
select pg_temp.check_true('a recovered finding cannot be reopened here',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'reopen', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000001'))) ->> 'hint') = 'finding_closed');
select pg_temp.check_true('rejected attempts changed no points',
  pg_temp.points('10000000-0000-0000-0000-000000000001') = 15
  and pg_temp.points('10000000-0000-0000-0000-000000000002') = 0);

-- Create a separate member: similar name, identical name ----------------------
insert into r select 'create_similar', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000002', 'create_member', null, null, null,
  '{"first_name": "Lynn", "last_name": "Tranh", "email": "LynnH@UCSD.edu ", "college": "Revelle", "year": "2nd"}')$q$);
select pg_temp.check_true('a similar-named attendee becomes a new member with their own attendance',
  (select (v -> 'result' ->> 'created_member')::boolean from r where label = 'create_similar')
  and (select points from public.members where id = (select (v -> 'result' ->> 'member_id')::uuid from r where label = 'create_similar')) = 10
  and (select email from public.members where id = (select (v -> 'result' ->> 'member_id')::uuid from r where label = 'create_similar')) = 'lynnh@ucsd.edu'
  and pg_temp.points('10000000-0000-0000-0000-000000000002') = 0);

insert into r select 'create_same_name', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000003', 'create_member', null, null, null,
  '{"first_name": "Minh", "last_name": "Nguyen", "email": "minh3@ucsd.edu"}')$q$);
select pg_temp.check_true('an identical name belonging to a different person gets a third member',
  (select count(*) from public.members where first_name = 'Minh' and last_name = 'Nguyen') = 3
  and (select points from public.members where id = (select (v -> 'result' ->> 'member_id')::uuid from r where label = 'create_same_name')) = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000003') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000004') = 0);

-- Duplicate email ------------------------------------------------------------
insert into r select 'dup_email', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000006', 'create_member', null, null, null,
  '{"first_name": "Kev", "last_name": "Le", "email": " Kevin.Le@UCSD.edu"}')$q$);
select pg_temp.check_true('a new member cannot take an email another member holds',
  (select v ->> 'code' from r where label = 'dup_email') = 'P0001'
  and (select v ->> 'hint' from r where label = 'dup_email') = 'email_in_use:10000000-0000-0000-0000-000000000005'
  and (select count(*) from public.members where lower(email) = 'kevin.le@ucsd.edu') = 1
  and not exists (select 1 from public.members where first_name = 'Kev')
  and pg_temp.latest('30000000-0000-0000-0000-000000000006') is null);
insert into r select 'dup_email_without', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000006', 'create_member', null, null, null,
  '{"first_name": "Kev", "last_name": "Le"}')$q$);
select pg_temp.check_true('the admin can still create that person without the email',
  (select (v -> 'result' ->> 'created_member')::boolean from r where label = 'dup_email_without')
  and (select email from public.members where first_name = 'Kev') is null
  and pg_temp.points('10000000-0000-0000-0000-000000000005') = 10);

-- Existing destination attendance ---------------------------------------------
insert into r select 'already', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000005', 'restore', null, '10000000-0000-0000-0000-000000000007')$q$);
select pg_temp.check_true('a member who already has the attendance is not credited again',
  (select v -> 'result' ->> 'outcome' from r where label = 'already') = 'already_recorded'
  and (select (v -> 'result' ->> 'points_awarded')::int from r where label = 'already') = 0
  and (select v -> 'result' ->> 'attendance_id' from r where label = 'already') is null
  and pg_temp.points('10000000-0000-0000-0000-000000000007') = 10
  and pg_temp.attended('10000000-0000-0000-0000-000000000007') = 1);

-- Correct an incorrect match (never destructive) ------------------------------
select pg_temp.check_true('restore refuses a row that already credits a member',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'restore', null, '10000000-0000-0000-0000-000000000006')$q$) ->> 'hint') = 'row_already_credited');
select pg_temp.check_true('the original member must be the one the row credits',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'reassign', null,
     '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008')$q$) ->> 'hint') = 'stale_finding');
insert into r select 'credit', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'reassign', null,
  '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005')$q$);
select pg_temp.check_true('correcting a match credits the right member and keeps the original credit',
  (select v -> 'result' ->> 'outcome' from r where label = 'credit') = 'correct_member_credited'
  and (select v -> 'result' ->> 'status' from r where label = 'credit') = 'investigating'
  and pg_temp.points('10000000-0000-0000-0000-000000000006') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000005') = 10
  and pg_temp.has_att('10000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000001')
  and exists (select 1 from public.admin_activity_log where action = 'member.recovery_credit_flagged'));
select pg_temp.check_true('a flagged finding cannot be dismissed, reopened or recovered again',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'dismiss', %L, null, null, null, 'not_actionable', 'x')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000004'))) ->> 'hint') = 'finding_closed'
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'reopen', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000004'))) ->> 'hint') = 'finding_closed');
select pg_temp.check_true('resolving as "removed" is refused while the original still has the credit',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'resolve_investigation', %L, null, null, null, 'original_removed', 'Kevin Le was away')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000004'))) ->> 'hint') = 'original_still_credited'
  and pg_temp.points('10000000-0000-0000-0000-000000000005') = 10);
select pg_temp.check_true('resolving needs recorded evidence',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'resolve_investigation', %L, null, null, null, 'original_attended')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000004'))) ->> 'message') like 'Record the evidence%');
-- The admin removes the wrong credit through Admin Members (a direct, confirmed ledger delete).
select pg_temp.check_true('the admin removes the wrong credit in Admin Members; the trigger recalculates',
  (pg_temp.admin($q$delete from public.member_event_attendance where member_id = '10000000-0000-0000-0000-000000000005'
     and event_id = '80000000-0000-0000-0000-000000000001' returning to_jsonb(id)$q$) ->> 'ok')::boolean
  and pg_temp.points('10000000-0000-0000-0000-000000000005') = 0);
insert into r select 'resolved_removed', pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000004', 'resolve_investigation', %L, null, null, null, 'original_removed', 'Sign-in sheet says Kevin Lee; Kevin Le confirmed he was away')$q$,
  pg_temp.latest('30000000-0000-0000-0000-000000000004')));
select pg_temp.check_true('the investigation then resolves as "removed" and the finding is recovered',
  (select v -> 'result' ->> 'status' from r where label = 'resolved_removed') = 'recovered'
  and (select v -> 'result' ->> 'outcome' from r where label = 'resolved_removed') = 'original_removed'
  and exists (select 1 from public.admin_activity_log where action = 'member.recovery_investigation_resolved'));

insert into r select 'keep', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000008', 'reassign', null,
  '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003')$q$);
select pg_temp.check_true('"original attended" is refused if the credit is gone, accepted while it exists',
  (select v -> 'result' ->> 'outcome' from r where label = 'keep') = 'correct_member_credited'
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000008', 'resolve_investigation', %L, null, null, null, 'original_removed', 'x')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000008'))) ->> 'hint') = 'original_still_credited'
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000008', 'resolve_investigation', %L, null, null, null, 'original_attended', 'Both Minhs signed in')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000008'))) -> 'result' ->> 'outcome') = 'original_attended'
  and pg_temp.points('10000000-0000-0000-0000-000000000004') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000003') = 10);

insert into r select 'already_dest', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000012', 'reassign', null,
  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000009')$q$);
select pg_temp.check_true('a correct member who already attended gets nothing, and the original keeps theirs',
  (select v -> 'result' ->> 'outcome' from r where label = 'already_dest') = 'correct_member_already_credited'
  and (select (v -> 'result' ->> 'points_awarded')::int from r where label = 'already_dest') = 0
  and pg_temp.points('10000000-0000-0000-0000-000000000007') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000009') = 10);

-- Credit that predates the import (row 15) and credit confirmed elsewhere (rows 13/14):
-- correcting either never removes it.
insert into r select 'predates', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000015', 'reassign', null,
  '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008')$q$);
select pg_temp.check_true('pre-existing credit is kept when its row is corrected',
  (select v -> 'result' ->> 'status' from r where label = 'predates') = 'investigating'
  and pg_temp.points('10000000-0000-0000-0000-000000000008') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000006') = 10);
insert into r select 'confirm_duc', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000014', 'restore', null, '10000000-0000-0000-0000-000000000010')$q$);
select pg_temp.check_true('confirming a member who already holds the credit awards nothing',
  (select v -> 'result' ->> 'outcome' from r where label = 'confirm_duc') = 'already_recorded'
  and pg_temp.points('10000000-0000-0000-0000-000000000010') = 10);
select pg_temp.check_true('correcting the other row of a confirmed member keeps the confirmed credit',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000013', 'reassign', null,
     '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000010')$q$) -> 'result' ->> 'status') = 'investigating'
  and pg_temp.points('10000000-0000-0000-0000-000000000010') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000004') = 10);
select pg_temp.check_true('the recovery function never deletes attendance',
  (select prosrc from pg_proc where proname = 'admin_recover_import_row') !~* 'delete\s+from');
insert into r select 'findings_after', pg_temp.admin('select public.admin_import_recovery_findings()');
select pg_temp.check_true('a recovered finding counts as identity evidence for a same-email twin row',
  (select (f ->> 'resolved_elsewhere')::boolean from r, jsonb_array_elements(r.v -> 'result') f
   where r.label = 'findings' and f ->> 'row_id' = '30000000-0000-0000-0000-000000000016') is false
  and (select (f ->> 'resolved_elsewhere')::boolean from r, jsonb_array_elements(r.v -> 'result') f
   where r.label = 'findings_after' and f ->> 'row_id' = '30000000-0000-0000-0000-000000000016') is true
  and (select (f ->> 'resolved_elsewhere')::boolean from r, jsonb_array_elements(r.v -> 'result') f
   where r.label = 'findings_after' and f ->> 'row_id' = '30000000-0000-0000-0000-000000000014') is false);

-- Dismiss, hold, reopen --------------------------------------------------------
select pg_temp.check_true('dismissing needs a reason',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'dismiss')$q$) ->> 'message') like 'Choose why%');
select pg_temp.check_true('"not actionable" needs an explanation',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'dismiss', null, null, null, null, 'not_actionable')$q$) ->> 'message') like 'Explain%');
insert into r select 'dismiss', pg_temp.admin($q$select public.admin_recover_import_row(
  gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'dismiss', null, null, null, null, 'intentional_skip', 'Test entry by an officer')$q$);
select pg_temp.check_true('a dismissal keeps its reason and note and writes no attendance',
  (select reason_code || '|' || note from public.import_recovery_actions where id = (select (v -> 'result' ->> 'action_id')::uuid from r where label = 'dismiss'))
    = 'intentional_skip|Test entry by an officer'
  and (select count(*) from public.member_event_attendance where event_id = '80000000-0000-0000-0000-000000000001') = 11);
select pg_temp.check_true('a dismissed finding cannot be recovered until reopened',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'restore', %L, '10000000-0000-0000-0000-000000000002')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000007'))) ->> 'hint') = 'finding_closed');
select pg_temp.check_true('a dismissed finding can be reopened, then put on hold with a note',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'reopen', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000007'))) -> 'result' ->> 'status') = 'open'
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'needs_info', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000007'))) ->> 'message') like 'Note what%'
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000007', 'needs_info', %L, null, null, null, null, 'Ask the events chair for the sheet')$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000007'))) -> 'result' ->> 'status') = 'needs_info');
select pg_temp.check_true('history keeps every step in order',
  (select count(*) from public.import_recovery_actions where import_job_row_id = '30000000-0000-0000-0000-000000000007') = 3);

select pg_temp.check_true('rows from a failed import are refused',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000011', 'restore', null, '10000000-0000-0000-0000-000000000002')$q$) ->> 'message') like 'Rows from a failed import%');

-- Failed transactions roll back -----------------------------------------------
-- Make the activity-log write (the last step) fail, then prove nothing before it survived.
alter table public.admin_activity_log add constraint verify_force_failure check (action <> 'member.attendance_recovered') not valid;
select pg_temp.check_true('a failure after the attendance write rolls the whole restore back',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000010', 'restore', null, '10000000-0000-0000-0000-000000000002')$q$) ->> 'ok')::boolean = false
  and not pg_temp.has_att('10000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001')
  and pg_temp.points('10000000-0000-0000-0000-000000000002') = 0
  and pg_temp.latest('30000000-0000-0000-0000-000000000010') is null);
select pg_temp.check_true('a failure after creating a member rolls the member back too',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000010', 'create_member', null, null, null,
     '{"first_name": "Rollback", "last_name": "Person"}')$q$) ->> 'ok')::boolean = false
  and not exists (select 1 from public.members where first_name = 'Rollback'));
alter table public.admin_activity_log drop constraint verify_force_failure;

-- Ledger integrity ------------------------------------------------------------
select pg_temp.check_true('every cached total equals the ledger (trigger-only recalculation)',
  not exists (
    select 1 from public.members m
    where m.points <> coalesce((select sum(a.points_earned) from public.member_event_attendance a where a.member_id = m.id), 0)
       or m.events_attended <> (select count(*) from public.member_event_attendance a where a.member_id = m.id)));
select pg_temp.check_true('final points match the expected ledger',
  pg_temp.points('10000000-0000-0000-0000-000000000001') = 15
  and pg_temp.points('10000000-0000-0000-0000-000000000002') = 0
  and pg_temp.points('10000000-0000-0000-0000-000000000003') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000004') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000005') = 0
  and pg_temp.points('10000000-0000-0000-0000-000000000006') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000007') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000008') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000009') = 10
  and pg_temp.points('10000000-0000-0000-0000-000000000010') = 10);
select pg_temp.check_true('import rows were never modified',
  (select count(*) from public.import_job_rows where decision = 'review') = 10
  and (select attendance_member_id from public.import_job_rows where id = '30000000-0000-0000-0000-000000000004') = '10000000-0000-0000-0000-000000000005');

select pg_temp.check_true('an open finding with no history cannot be "reopened"',
  (pg_temp.admin($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000010', 'reopen')$q$) ->> 'hint') = 'finding_closed');
-- Row 8 was resolved "original attended" (member 3 kept the credit). If that credit
-- is removed later, the finding says so and may reopen.
select pg_temp.check_true('an "original attended" resolution cannot reopen while that credit exists',
  (select (f ->> 'original_credit_present')::boolean from jsonb_array_elements(pg_temp.admin('select public.admin_import_recovery_findings()') -> 'result') f
       where f ->> 'row_id' = '30000000-0000-0000-0000-000000000008') is true
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000008', 'reopen', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000008'))) ->> 'hint') = 'finding_closed');
select pg_temp.admin($q$delete from public.member_event_attendance where member_id = '10000000-0000-0000-0000-000000000003'
  and event_id = '80000000-0000-0000-0000-000000000001' returning to_jsonb(id)$q$);
select pg_temp.check_true('once the kept original credit is removed, the finding flags it and may reopen',
  (select (f ->> 'original_credit_present')::boolean from jsonb_array_elements(pg_temp.admin('select public.admin_import_recovery_findings()') -> 'result') f
       where f ->> 'row_id' = '30000000-0000-0000-0000-000000000008') is false
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000008', 'reopen', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000008'))) -> 'result' ->> 'status') = 'open');
select pg_temp.check_true('findings expose candidate and created member ids for counter-evidence',
  (select f -> 'candidate_member_ids' from jsonb_array_elements(pg_temp.admin('select public.admin_import_recovery_findings()') -> 'result') f
       where f ->> 'row_id' = '30000000-0000-0000-0000-000000000001') = '["10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000002"]'::jsonb);

-- Findings stay accurate when a recovered credit is later removed --------------
select pg_temp.check_true('a recovered finding cannot be reopened while its credit is in place',
  (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'reopen', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000001'))) ->> 'hint') = 'finding_closed'
  and (select (f ->> 'recovered_credit_present')::boolean from jsonb_array_elements(pg_temp.admin('select public.admin_import_recovery_findings()') -> 'result') f
       where f ->> 'row_id' = '30000000-0000-0000-0000-000000000001') is true);
select pg_temp.admin($q$delete from public.member_event_attendance where member_id = '10000000-0000-0000-0000-000000000001'
  and event_id = '80000000-0000-0000-0000-000000000001' returning to_jsonb(id)$q$);
select pg_temp.check_true('after the credit is removed in Admin Members, the finding shows it and can be reopened',
  (select (f ->> 'recovered_credit_present')::boolean from jsonb_array_elements(pg_temp.admin('select public.admin_import_recovery_findings()') -> 'result') f
       where f ->> 'row_id' = '30000000-0000-0000-0000-000000000001') is false
  and (pg_temp.admin(format($q$select public.admin_recover_import_row(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'reopen', %L)$q$,
     pg_temp.latest('30000000-0000-0000-0000-000000000001'))) -> 'result' ->> 'status') = 'open'
  and pg_temp.points('10000000-0000-0000-0000-000000000001') = 5);

-- History is immutable --------------------------------------------------------
select pg_temp.check_true('an admin has no write privilege on recovery history',
  not has_table_privilege('authenticated', 'public.import_recovery_actions', 'insert')
  and not has_table_privilege('authenticated', 'public.import_recovery_actions', 'update')
  and not has_table_privilege('authenticated', 'public.import_recovery_actions', 'delete')
  and not has_table_privilege('anon', 'public.import_recovery_actions', 'select')
  and not has_function_privilege('anon', 'public.admin_recover_import_row(uuid, uuid, text, uuid, uuid, uuid, jsonb, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_import_recovery_findings()', 'execute')
  and not has_table_privilege('service_role', 'public.import_recovery_actions', 'insert')
  and not has_table_privilege('service_role', 'public.import_recovery_actions', 'update')
  and not has_table_privilege('service_role', 'public.import_recovery_actions', 'delete')
  and has_table_privilege('service_role', 'public.import_recovery_actions', 'select'));
select pg_temp.check_true('even the table owner cannot update, delete or truncate history',
  (pg_temp.call_as('', 'none', $q$update public.import_recovery_actions set note = 'rewritten' returning to_jsonb(id)$q$) ->> 'message') like 'Recovery history is append-only%'
  and (pg_temp.call_as('', 'none', $q$delete from public.import_recovery_actions returning to_jsonb(id)$q$) ->> 'message') like 'Recovery history is append-only%'
  and (pg_temp.call_as('', 'none', $q$truncate public.import_recovery_actions$q$) ->> 'message') like 'Recovery history is append-only%');

insert into r select 'delete_member', pg_temp.call_as('', 'none', $q$delete from public.members where id = '10000000-0000-0000-0000-000000000006' returning to_jsonb(id)$q$);
insert into r select 'delete_job', pg_temp.call_as('', 'none', $q$delete from public.import_jobs where id = '20000000-0000-0000-0000-000000000001' returning to_jsonb(id)$q$);
select pg_temp.check_true('deleting an import job or merging away a member leaves the history untouched',
  (select (v ->> 'ok')::boolean from r where label = 'delete_member')
  and (select (v ->> 'ok')::boolean from r where label = 'delete_job')
  and (select count(*) from public.import_recovery_actions where import_job_id = '20000000-0000-0000-0000-000000000001') >= 10
  and exists (select 1 from public.import_recovery_actions where member_id = '10000000-0000-0000-0000-000000000006'))

rollback;
