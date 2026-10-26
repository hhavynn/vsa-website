-- Assertions for 20261026075912_member_identity_aliases.sql. Run by
-- scripts/test-member-identity.sh on a disposable local cluster. Synthetic
-- people only. One transaction, rolled back. Prints "PASS: ..." per check and
-- aborts on the first failure. Concurrency runs in the shell script.

begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000b2', false);

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

-- Calls the import function as the admin and returns its jsonb result (or the error).
create function pg_temp.import(p_request jsonb) returns jsonb language sql as $$
  select pg_temp.admin(format('select public.admin_apply_attendance_import(%L::jsonb)', p_request::text));
$$;

create function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

create function pg_temp.alias_owner(p_email text) returns uuid language sql as $$
  select member_id from public.member_identity_emails where email = p_email;
$$;
create function pg_temp.totals(p_member text) returns text language sql as $$
  select points || '/' || events_attended from public.members where id = p_member::uuid;
$$;
create function pg_temp.ledger_ok() returns boolean language sql as $$
  select not exists (
    select 1 from public.members m
    left join public.member_event_attendance a on a.member_id = m.id
    group by m.id, m.points, m.events_attended
    having m.points <> coalesce(sum(a.points_earned), 0) or m.events_attended <> count(a.id)
  );
$$;

create temp table r (label text primary key, v jsonb);

-- ── Backfill ──────────────────────────────────────────────────────────────────
select pg_temp.check_true('a uniquely held primary email becomes a backfilled alias',
  pg_temp.alias_owner('alex@gmail.com') = '11000000-0000-0000-0000-000000000001'
  and (select source || '/' || verification_method from public.member_identity_emails where email = 'alex@gmail.com') = 'backfill/primary_email');
select pg_temp.check_true('an email shared by two members is not backfilled to either',
  pg_temp.alias_owner('shared@ucsd.edu') is null);
select pg_temp.check_true('an invalid stored email is not backfilled',
  pg_temp.alias_owner('not-an-email') is null);
select pg_temp.check_true('every member keeps their stored email unchanged',
  (select count(*) from public.members where email = 'shared@ucsd.edu') = 2);
select pg_temp.check_true('a year is estimated at the member''s latest attended academic year',
  (select academic_year_start || ':' || year_label || ':' || source from public.member_year_observations
   where member_id = '11000000-0000-0000-0000-000000000007') = '2025:3rd Year:profile_estimate');
select pg_temp.check_true('no estimate without attendance or without a year',
  not exists (select 1 from public.member_year_observations
              where member_id in ('11000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000006')));

-- ── Access ────────────────────────────────────────────────────────────────────
select pg_temp.check_true('anon has no privilege on any identity table',
  not exists (
    select 1 from unnest(array['public.member_identity_emails', 'public.member_year_observations', 'public.attendance_import_requests']) t,
                  unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
    where has_table_privilege('anon', t, p)));
select pg_temp.check_true('authenticated can never update aliases or write observations and requests',
  not has_table_privilege('authenticated', 'public.member_identity_emails', 'update')
  and not has_table_privilege('authenticated', 'public.member_year_observations', 'insert')
  and not has_table_privilege('authenticated', 'public.attendance_import_requests', 'insert'));
select pg_temp.check_true('anon cannot execute the import function or the merge',
  not has_function_privilege('anon', 'public.admin_apply_attendance_import(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.smart_merge_members(uuid, uuid)', 'execute'));
select pg_temp.check_true('the trigger functions are not callable by clients',
  not has_function_privilege('authenticated', 'public.sync_member_primary_email_alias()', 'execute')
  and not has_function_privilege('anon', 'public.purge_member_identity_on_anonymize()', 'execute'));
select pg_temp.check_true('every new function is SECURITY DEFINER with an empty search_path',
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p where p.proname in ('admin_apply_attendance_import', 'smart_merge_members',
     'sync_member_primary_email_alias', 'purge_member_identity_on_anonymize')));
select pg_temp.check_true('a non-admin sees no aliases',
  (pg_temp.call_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
     'select to_jsonb(count(*)) from public.member_identity_emails') -> 'result')::int = 0);
select pg_temp.check_true('a non-admin cannot run the import',
  pg_temp.call_as('00000000-0000-0000-0000-0000000000b2', 'authenticated',
    'select public.admin_apply_attendance_import(''{}''::jsonb)') ->> 'code' = '42501');
select pg_temp.check_true('anon cannot read aliases at all',
  pg_temp.call_as('', 'anon', 'select to_jsonb(count(*)) from public.member_identity_emails') ->> 'code' = '42501');
select pg_temp.check_true('an admin can add an alias only as an admin entry',
  (pg_temp.admin('insert into public.member_identity_emails (member_id, email, source, verification_method) values (''11000000-0000-0000-0000-000000000006'', ''tri.ha@ucsd.edu'', ''admin'', ''admin_entered'') returning to_jsonb(id)') ->> 'ok')::boolean
  and pg_temp.admin('insert into public.member_identity_emails (member_id, email, source, verification_method) values (''11000000-0000-0000-0000-000000000006'', ''tri2@ucsd.edu'', ''attendance_import'', ''admin_confirmed'') returning to_jsonb(id)') ->> 'code' = '42501');
select pg_temp.check_true('an alias must be normalized',
  pg_temp.admin('insert into public.member_identity_emails (member_id, email, source, verification_method) values (''11000000-0000-0000-0000-000000000006'', '' Tri3@UCSD.edu'', ''admin'', ''admin_entered'') returning to_jsonb(id)') ->> 'code' = '23514');
select pg_temp.check_true('an address belongs to one member only',
  pg_temp.admin('insert into public.member_identity_emails (member_id, email, source, verification_method) values (''11000000-0000-0000-0000-000000000007'', ''tri.ha@ucsd.edu'', ''admin'', ''admin_entered'') returning to_jsonb(id)') ->> 'code' = '23505');

-- ── members.email → alias ─────────────────────────────────────────────────────
update public.members set email = 'tri@ucsd.edu' where id = '11000000-0000-0000-0000-000000000006';
update public.members set email = 'tri.personal@gmail.com' where id = '11000000-0000-0000-0000-000000000006';
select pg_temp.check_true('setting and then changing a primary email keeps both as aliases',
  pg_temp.alias_owner('tri@ucsd.edu') = '11000000-0000-0000-0000-000000000006'
  and pg_temp.alias_owner('tri.personal@gmail.com') = '11000000-0000-0000-0000-000000000006');
update public.members set email = 'shared@ucsd.edu' where id = '11000000-0000-0000-0000-000000000004';
select pg_temp.check_true('a primary email another member also holds does not become an alias',
  pg_temp.alias_owner('shared@ucsd.edu') is null);
update public.members set email = 'alex@gmail.com' where id = '11000000-0000-0000-0000-000000000004';
select pg_temp.check_true('a primary email that is someone else''s alias stays theirs',
  pg_temp.alias_owner('alex@gmail.com') = '11000000-0000-0000-0000-000000000001');
update public.members set email = null where id = '11000000-0000-0000-0000-000000000004';

-- ── Import: happy path ────────────────────────────────────────────────────────
insert into r select 'happy', pg_temp.import(jsonb_build_object(
  'request_id', '90000000-0000-0000-0000-000000000001',
  'event_id', '81000000-0000-0000-0000-000000000026',
  'expected_points', 3,
  'expected_term_id', '71000000-0000-0000-0000-000000000026',
  'snapshot_at', now(),
  'credits', jsonb_build_array(
    jsonb_build_object('row_key', 'row-0', 'member_id', '11000000-0000-0000-0000-000000000001',
      'expected', jsonb_build_object('first_name', 'Alex', 'last_name', 'Nguyen', 'college', 'Muir', 'email', 'alex@gmail.com'),
      'year', jsonb_build_object('from', '2nd Year', 'to', '3rd Year'),
      'aliases', jsonb_build_array(jsonb_build_object('email', 'alex@ucsd.edu', 'method', 'unique_name_college_year')),
      'observed_year', '3rd Year'),
    jsonb_build_object('row_key', 'row-2', 'member_id', '11000000-0000-0000-0000-000000000005',
      'expected', jsonb_build_object('first_name', 'Hana', 'last_name', 'Vo', 'college', 'Revelle', 'email', null),
      'fill', jsonb_build_object('email', 'hana@ucsd.edu'))),
  'creates', jsonb_build_array(
    jsonb_build_object('row_key', 'row-1', 'first_name', 'Bảo', 'last_name', 'Lê', 'college', 'Sixth', 'year', '1st Year',
      'email', 'bao@ucsd.edu',
      'aliases', jsonb_build_array(jsonb_build_object('email', 'bao.le@gmail.com', 'method', 'same_submission')),
      'observed_year', '1st Year'))));

select pg_temp.check_true('the import applies',
  (select (v -> 'result' ->> 'ok')::boolean from r where label = 'happy'));
select pg_temp.check_true('it credits the existing member and the new member once each at the event''s points',
  (select v -> 'result' ->> 'attendance_inserted' from r where label = 'happy') = '3'
  and (select points_earned from public.member_event_attendance where member_id = '11000000-0000-0000-0000-000000000001' and event_id = '81000000-0000-0000-0000-000000000026') = 3
  and pg_temp.totals('11000000-0000-0000-0000-000000000001') = '8/2');
select pg_temp.check_true('the member keeps their id and gains the second address as an alias',
  pg_temp.alias_owner('alex@ucsd.edu') = '11000000-0000-0000-0000-000000000001'
  and pg_temp.alias_owner('alex@gmail.com') = '11000000-0000-0000-0000-000000000001'
  and (select email from public.members where id = '11000000-0000-0000-0000-000000000001') = 'alex@gmail.com'
  and (select verification_method || '/' || source || '/' || (import_request_id is not null)::text
       from public.member_identity_emails where email = 'alex@ucsd.edu') = 'unique_name_college_year/attendance_import/true');
select pg_temp.check_true('year advances only through the expected value, and is observed for the event''s academic year',
  (select year from public.members where id = '11000000-0000-0000-0000-000000000001') = '3rd Year'
  and exists (select 1 from public.member_year_observations
              where member_id = '11000000-0000-0000-0000-000000000001' and academic_year_start = 2026
                and year_label = '3rd Year' and source = 'attendance_import'));
select pg_temp.check_true('an empty email is filled and becomes an alias',
  (select email from public.members where id = '11000000-0000-0000-0000-000000000005') = 'hana@ucsd.edu'
  and pg_temp.alias_owner('hana@ucsd.edu') = '11000000-0000-0000-0000-000000000005');
select pg_temp.check_true('the new member gets both addresses, accents kept, and an observation',
  (select count(*) from public.members m join public.member_identity_emails e on e.member_id = m.id
   where m.first_name = 'Bảo' and m.last_name = 'Lê' and m.email = 'bao@ucsd.edu'
     and e.email in ('bao@ucsd.edu', 'bao.le@gmail.com')) = 2
  and exists (select 1 from public.member_year_observations o join public.members m on m.id = o.member_id
              where m.first_name = 'Bảo' and o.academic_year_start = 2026));
select pg_temp.check_true('the result maps the new member back to its row',
  (select v -> 'result' -> 'created' -> 0 ->> 'row_key' from r where label = 'happy') = 'row-1'
  and (select (v -> 'result' -> 'created' -> 0 ->> 'member_id')::uuid from r where label = 'happy')
      = (select id from public.members where first_name = 'Bảo'));

insert into r select 'replay', pg_temp.import(jsonb_build_object(
  'request_id', '90000000-0000-0000-0000-000000000001',
  'event_id', '81000000-0000-0000-0000-000000000026',
  'expected_points', 3,
  'expected_term_id', '71000000-0000-0000-0000-000000000026',
  'snapshot_at', now(),
  'credits', jsonb_build_array(
    jsonb_build_object('row_key', 'row-0', 'member_id', '11000000-0000-0000-0000-000000000001',
      'expected', jsonb_build_object('first_name', 'Alex', 'last_name', 'Nguyen', 'college', 'Muir', 'email', 'alex@gmail.com'),
      'year', jsonb_build_object('from', '2nd Year', 'to', '3rd Year'),
      'aliases', jsonb_build_array(jsonb_build_object('email', 'alex@ucsd.edu', 'method', 'unique_name_college_year')),
      'observed_year', '3rd Year'),
    jsonb_build_object('row_key', 'row-2', 'member_id', '11000000-0000-0000-0000-000000000005',
      'expected', jsonb_build_object('first_name', 'Hana', 'last_name', 'Vo', 'college', 'Revelle', 'email', null),
      'fill', jsonb_build_object('email', 'hana@ucsd.edu'))),
  'creates', jsonb_build_array(
    jsonb_build_object('row_key', 'row-1', 'first_name', 'Bảo', 'last_name', 'Lê', 'college', 'Sixth', 'year', '1st Year',
      'email', 'bao@ucsd.edu',
      'aliases', jsonb_build_array(jsonb_build_object('email', 'bao.le@gmail.com', 'method', 'same_submission')),
      'observed_year', '1st Year'))));
select pg_temp.check_true('a retry of the same request returns the first result and writes nothing',
  (select (v -> 'result' ->> 'replayed')::boolean from r where label = 'replay')
  and (select count(*) from public.members where first_name = 'Bảo') = 1
  and (select count(*) from public.member_event_attendance where event_id = '81000000-0000-0000-0000-000000000026') = 3);
select pg_temp.check_true('a request id reused for a different import is refused',
  pg_temp.import(jsonb_build_object('request_id', '90000000-0000-0000-0000-000000000001',
    'event_id', '81000000-0000-0000-0000-000000000026', 'expected_points', 3,
    'expected_term_id', '71000000-0000-0000-0000-000000000026', 'snapshot_at', now(),
    'credits', jsonb_build_array(jsonb_build_object('row_key', 'r', 'member_id', '11000000-0000-0000-0000-000000000007',
      'expected', jsonb_build_object('first_name', 'Minh', 'last_name', 'Pham', 'college', 'ERC', 'email', 'minh@ucsd.edu')))))
  ->> 'hint' = 'request_id_reused');

-- ── Import: already recorded, year compare-and-set ────────────────────────────
insert into r select 'again', pg_temp.import(jsonb_build_object(
  'request_id', '90000000-0000-0000-0000-000000000002',
  'event_id', '81000000-0000-0000-0000-000000000026', 'expected_points', 3,
  'expected_term_id', '71000000-0000-0000-0000-000000000026', 'snapshot_at', now(),
  'credits', jsonb_build_array(
    jsonb_build_object('row_key', 'row-0', 'member_id', '11000000-0000-0000-0000-000000000001',
      'expected', jsonb_build_object('first_name', 'Alex', 'last_name', 'Nguyen', 'college', 'Muir', 'email', 'alex@gmail.com')),
    jsonb_build_object('row_key', 'row-1', 'member_id', '11000000-0000-0000-0000-000000000007',
      'expected', jsonb_build_object('first_name', 'Minh', 'last_name', 'Pham', 'college', 'ERC', 'email', 'minh@ucsd.edu'),
      'year', jsonb_build_object('from', '2nd Year', 'to', '4th Year')))));
select pg_temp.check_true('re-importing a credited member adds nothing and says so',
  (select v -> 'result' -> 'attendance_already_present' from r where label = 'again') = '["row-0"]'::jsonb
  and (select v -> 'result' ->> 'attendance_inserted' from r where label = 'again') = '1'
  and pg_temp.totals('11000000-0000-0000-0000-000000000001') = '8/2');
select pg_temp.check_true('a year that changed since the preview is left alone and reported',
  (select year from public.members where id = '11000000-0000-0000-0000-000000000007') = '3rd Year'
  and (select v -> 'result' -> 'years_skipped' from r where label = 'again') = '["row-1"]'::jsonb);

-- ── Import: stale previews write nothing ──────────────────────────────────────
create function pg_temp.stale(p_request jsonb) returns text language plpgsql as $$
declare
  v jsonb;
  v_before bigint := (select count(*) from public.member_event_attendance) + (select count(*) from public.members)
                   + (select count(*) from public.member_identity_emails);
begin
  v := pg_temp.import(p_request);
  if (v -> 'result' ->> 'ok')::boolean is distinct from false then
    raise exception 'FAIL: expected a stale result, got %', v;
  end if;
  if (select count(*) from public.member_event_attendance) + (select count(*) from public.members)
     + (select count(*) from public.member_identity_emails) <> v_before
     or exists (select 1 from public.attendance_import_requests where request_id = (p_request ->> 'request_id')::uuid) then
    raise exception 'FAIL: a stale import wrote something';
  end if;
  return v -> 'result' -> 'problems' -> 0 ->> 'kind';
end $$;

create function pg_temp.req(p_id text, p_credits jsonb, p_creates jsonb default '[]', p_points int default 7, p_event text default '81000000-0000-0000-0000-000000000027')
returns jsonb language sql as $$
  select jsonb_build_object('request_id', p_id, 'event_id', p_event, 'expected_points', p_points,
    'expected_term_id', '71000000-0000-0000-0000-000000000026', 'snapshot_at', now(),
    'credits', p_credits, 'creates', p_creates);
$$;

create function pg_temp.minh(p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('row_key', 'row-m', 'member_id', '11000000-0000-0000-0000-000000000007',
    'expected', jsonb_build_object('first_name', 'Minh', 'last_name', 'Pham', 'college', 'ERC', 'email', 'minh@ucsd.edu')) || p_extra;
$$;

select pg_temp.check_true('an event whose points changed since the preview is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000010', jsonb_build_array(pg_temp.minh()), '[]', 99)) = 'event_changed');
select pg_temp.check_true('an event without an academic term is refused',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000011', jsonb_build_array(pg_temp.minh()), '[]', 1,
    '81000000-0000-0000-0000-000000000099')) = 'event_has_no_term');
select pg_temp.check_true('a member edited since the preview is stale, never retargeted',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000012', jsonb_build_array(
    pg_temp.minh('{"expected": {"first_name": "Minh", "last_name": "Pham", "college": "Muir", "email": "minh@ucsd.edu"}}')))) = 'member_changed');
select pg_temp.check_true('a member deleted or merged away since the preview is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000013', jsonb_build_array(
    pg_temp.minh('{"member_id": "11000000-0000-0000-0000-0000000000ff"}')))) = 'member_missing');
select pg_temp.check_true('an address that became someone else''s alias is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000014', jsonb_build_array(
    pg_temp.minh('{"aliases": [{"email": "alex@ucsd.edu", "method": "admin_confirmed"}]}')))) = 'email_owned_by_other');
select pg_temp.check_true('a new member''s address that another member holds is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000015', '[]', jsonb_build_array(
    jsonb_build_object('row_key', 'row-n', 'first_name', 'Lan', 'last_name', 'Tran', 'email', 'shared@ucsd.edu')))) = 'email_held_by_other');
insert into public.members (first_name, last_name, created_at) values ('Cam', 'Ly', now() + interval '1 minute');
select pg_temp.check_true('a new member whose name appeared after the preview is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000016', '[]', jsonb_build_array(
    jsonb_build_object('row_key', 'row-n', 'first_name', 'cam', 'last_name', 'LY')))) = 'possible_duplicate_created');

insert into r select 'ryan', pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000017', '[]', jsonb_build_array(
    jsonb_build_object('row_key', 'row-r', 'first_name', 'Ryan', 'last_name', 'Le',
      'known_same_name_ids', jsonb_build_array('11000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000003'))),
    4, '81000000-0000-0000-0000-000000000028'));
select pg_temp.check_true('a new member the admin confirmed against every same-name member the preview saw is created',
  (select (v -> 'result' ->> 'ok')::boolean from r where label = 'ryan')
  and (select count(*) from public.members where first_name = 'Ryan' and last_name = 'Le') = 3);
insert into public.members (id, first_name, last_name) values ('11000000-0000-0000-0000-0000000000a7', 'Minh', 'Pham');
select pg_temp.check_true('an automatic name match whose name became shared after the preview is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000018', jsonb_build_array(
    pg_temp.minh('{"known_same_name_ids": ["11000000-0000-0000-0000-000000000007"]}')))) = 'possible_duplicate_created');
delete from public.members where id = '11000000-0000-0000-0000-0000000000a7';
insert into r select 'old-event-year', pg_temp.import(jsonb_build_object(
  'request_id', '90000000-0000-0000-0000-000000000019',
  'event_id', '81000000-0000-0000-0000-000000000025', 'expected_points', 5,
  'expected_term_id', '71000000-0000-0000-0000-000000000025',
  'credits', jsonb_build_array(jsonb_build_object('row_key', 'row-o', 'member_id', '11000000-0000-0000-0000-000000000001',
    'expected', jsonb_build_object('first_name', 'Alex', 'last_name', 'Nguyen', 'college', 'Muir', 'email', 'alex@gmail.com'),
    'year', jsonb_build_object('from', '3rd Year', 'to', '4th Year')))));
select pg_temp.check_true('the database never applies a year from an event older than the latest observation',
  (select year from public.members where id = '11000000-0000-0000-0000-000000000001') = '3rd Year'
  and (select v -> 'result' -> 'years_skipped' from r where label = 'old-event-year') = '["row-o"]'::jsonb);

insert into public.member_identity_emails (member_id, email, source, verification_method)
values ('11000000-0000-0000-0000-000000000007', 'evidence@ucsd.edu', 'admin', 'admin_entered');
update public.members set email = 'evidence@ucsd.edu' where id = '11000000-0000-0000-0000-000000000004';
select pg_temp.check_true('a known-email match whose address became another member''s contact email is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000030', jsonb_build_array(
    pg_temp.minh('{"evidence_emails": ["evidence@ucsd.edu"]}')))) = 'email_held_by_other');
update public.members set email = null where id = '11000000-0000-0000-0000-000000000004';
delete from public.member_identity_emails where email = 'evidence@ucsd.edu';
select pg_temp.check_true('a known-email match whose address no longer identifies the member is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000031', jsonb_build_array(
    pg_temp.minh('{"evidence_emails": ["gone@ucsd.edu"]}')))) = 'member_changed');
select pg_temp.check_true('a known-email match whose address still identifies only the member applies',
  (pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000032', jsonb_build_array(
    pg_temp.minh('{"evidence_emails": ["minh@ucsd.edu"]}')), '[]', 4, '81000000-0000-0000-0000-000000000028')) -> 'result' ->> 'ok')::boolean);

select pg_temp.check_true('name folding matches the resolver: accents, Đ, case, spacing, punctuation, middle initials',
  public.fold_person_name('Nguyễn  Văn An') = 'nguyen van an'
  and public.fold_person_name('ĐẶNG Thị Hồng') = 'dang thi hong'
  and public.fold_person_name('O''Brien-Tran') = 'obrien tran'
  and public.fold_person_name('Kevin J. Nguyen') = 'kevin nguyen'
  and public.fold_person_name('An Tran') = 'an tran');
insert into public.members (first_name, last_name) values ('Hoa', 'Nguyễn');
select pg_temp.check_true('a new member whose accented name appeared after the preview is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000033', '[]', jsonb_build_array(
    jsonb_build_object('row_key', 'row-h', 'first_name', 'Hoa', 'last_name', 'Nguyen', 'known_same_name_ids', '[]'::jsonb)))) = 'possible_duplicate_created');
select pg_temp.check_true('the fold function is not callable by clients',
  not has_function_privilege('anon', 'public.fold_person_name(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.fold_person_name(text)', 'execute'));

select pg_temp.check_true('an automatic match whose standing changed since the preview is stale',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000034', jsonb_build_array(
    pg_temp.minh('{"expected_standing": {"year": "3rd Year", "observations": 0}}')))) = 'member_changed'
  and pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000035', jsonb_build_array(
    pg_temp.minh('{"expected_standing": {"year": "2nd Year", "observations": 1}}')))) = 'member_changed');
select pg_temp.check_true('an automatic match whose standing is unchanged applies',
  (pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000036', jsonb_build_array(
    pg_temp.minh(jsonb_build_object('expected_standing', jsonb_build_object('year', '3rd Year',
      'observations', (select count(*) from public.member_year_observations where member_id = '11000000-0000-0000-0000-000000000007'))))),
    '[]', 7)) -> 'result' ->> 'ok')::boolean);

insert into public.members (id, first_name, last_name) values ('11000000-0000-0000-0000-0000000000b8', 'Kevin', 'Pham');
select pg_temp.check_true('a middle-name match is stale when a member with the row''s own name appeared',
  pg_temp.stale(pg_temp.req('90000000-0000-0000-0000-000000000037', jsonb_build_array(
    pg_temp.minh('{"source_name": "Kevin Pham", "known_same_name_ids": []}')))) = 'possible_duplicate_created');
delete from public.members where id = '11000000-0000-0000-0000-0000000000b8';

-- ── Import: malformed requests ────────────────────────────────────────────────
select pg_temp.check_true('crediting one member twice is refused',
  pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000020', jsonb_build_array(pg_temp.minh(), pg_temp.minh('{"row_key": "row-x"}')))) ->> 'code' = '22023');
select pg_temp.check_true('one address for two people is refused',
  pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000021',
    jsonb_build_array(pg_temp.minh('{"aliases": [{"email": "x@ucsd.edu", "method": "admin_confirmed"}]}')),
    jsonb_build_array(jsonb_build_object('row_key', 'row-n', 'first_name', 'Lan', 'last_name', 'Tran', 'email', 'x@ucsd.edu')))) ->> 'code' = '22023');
select pg_temp.check_true('an unknown alias method is refused',
  pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000022',
    jsonb_build_array(pg_temp.minh('{"aliases": [{"email": "y@ucsd.edu", "method": "primary_email"}]}')))) ->> 'code' = '22023');
select pg_temp.check_true('a new member needs a first and last name',
  pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000023', '[]',
    jsonb_build_array(jsonb_build_object('row_key', 'row-n', 'first_name', 'Lan', 'last_name', ' ')))) ->> 'code' = '22023');
select pg_temp.check_true('an empty import is refused',
  pg_temp.import(pg_temp.req('90000000-0000-0000-0000-000000000024', '[]')) ->> 'code' = '22023');

-- ── Merge ─────────────────────────────────────────────────────────────────────
insert into public.member_year_observations (member_id, academic_year_start, year_label, source) values
  ('11000000-0000-0000-0000-000000000011', 2026, '3rd Year', 'attendance_import'),
  ('11000000-0000-0000-0000-000000000011', 2024, '1st Year', 'profile_estimate');
insert into public.house_page_assets (id, academic_year_start, house_key) values
  ('a1000000-0000-0000-0000-000000000025', 2025, 'boo'),
  ('a1000000-0000-0000-0000-000000000024', 2024, 'chai');
insert into public.house_memberships (member_id, house_profile_id, academic_year_start, academic_year_end) values
  ('11000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000025', 2025, 2026),
  ('11000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000024', 2024, 2025),
  ('11000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000024', 2024, 2025);
insert into public.ace_family_members (name, member_id) values ('Kim Do', '11000000-0000-0000-0000-000000000011');
insert into public.import_jobs (id, event_id, status) values ('21000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000025', 'completed');
insert into public.import_job_rows (id, import_job_id, source_row_index, event_id, display_name, decision, matched_member_id, attendance_member_id) values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 0, '81000000-0000-0000-0000-000000000025', 'Kim Do', 'matched',
   '11000000-0000-0000-0000-000000000011', '11000000-0000-0000-0000-000000000011');

select pg_temp.check_true('merging a member into itself is refused',
  pg_temp.admin('select to_jsonb(public.smart_merge_members(''11000000-0000-0000-0000-000000000010'', ''11000000-0000-0000-0000-000000000010''))') ->> 'ok' = 'false');
insert into r select 'merge', pg_temp.admin('select to_jsonb(public.smart_merge_members(''11000000-0000-0000-0000-000000000011'', ''11000000-0000-0000-0000-000000000010''))');
select pg_temp.check_true('the merge applies', (select (v ->> 'ok')::boolean from r where label = 'merge'));
select pg_temp.check_true('the source is gone and the target keeps its id and contact email',
  not exists (select 1 from public.members where id = '11000000-0000-0000-0000-000000000011')
  and (select email from public.members where id = '11000000-0000-0000-0000-000000000010') = 'kim@gmail.com');
select pg_temp.check_true('both addresses resolve to the surviving member, the moved one traceable',
  pg_temp.alias_owner('kim@gmail.com') = '11000000-0000-0000-0000-000000000010'
  and pg_temp.alias_owner('kim@ucsd.edu') = '11000000-0000-0000-0000-000000000010'
  and (select moved_from_member_id from public.member_identity_emails where email = 'kim@ucsd.edu') = '11000000-0000-0000-0000-000000000011');
select pg_temp.check_true('attendance is the union, with no event credited twice',
  pg_temp.totals('11000000-0000-0000-0000-000000000010') = '7/2');
select pg_temp.check_true('the more recently observed year wins',
  (select year from public.members where id = '11000000-0000-0000-0000-000000000010') = '3rd Year'
  and (select count(*) from public.member_year_observations where member_id = '11000000-0000-0000-0000-000000000010') = 4);
select pg_temp.check_true('college is filled from the source only where the target had none',
  (select college from public.members where id = '11000000-0000-0000-0000-000000000010') = 'Seventh');
select pg_temp.check_true('House history moves for years the target had none, and never overlaps',
  (select string_agg(academic_year_start::text, ',' order by academic_year_start) from public.house_memberships
   where member_id = '11000000-0000-0000-0000-000000000010') = '2024,2025');
select pg_temp.check_true('identity links follow the surviving member instead of becoming null',
  (select member_id from public.ace_family_members where name = 'Kim Do') = '11000000-0000-0000-0000-000000000010'
  and (select matched_member_id::text || attendance_member_id::text from public.import_job_rows
       where id = '31000000-0000-0000-0000-000000000001')
      = '11000000-0000-0000-0000-00000000001011000000-0000-0000-0000-000000000010');

-- ── Anonymization ─────────────────────────────────────────────────────────────
update public.members set first_name = 'Deleted', last_name = 'Member', college = null, year = null, user_id = null
where id = '11000000-0000-0000-0000-000000000001';
update public.members set email = null where id = '11000000-0000-0000-0000-000000000001';
select pg_temp.check_true('anonymizing a member removes their aliases and observations, keeps attendance',
  not exists (select 1 from public.member_identity_emails where member_id = '11000000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.member_year_observations where member_id = '11000000-0000-0000-0000-000000000001')
  and pg_temp.totals('11000000-0000-0000-0000-000000000001') = '8/2');

select pg_temp.check_true('every cached total equals the ledger', pg_temp.ledger_ok());
select pg_temp.check_true('the import function contains no DELETE',
  pg_get_functiondef('public.admin_apply_attendance_import(jsonb)'::regprocedure) !~* '\mdelete\s+from');

rollback;
