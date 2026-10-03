-- Synthetic records only. This is a targeted compatibility fixture, not a
-- replay of the entire Supabase schema or proof of hosted schema inventory.
create extension "uuid-ossp";
create schema auth;
create schema retirement_test;
grant usage on schema public, auth, retirement_test to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
  select current_user::text;
$$;

-- Exercise the real admin-invite profile trigger, event-type point trigger,
-- code-secret trigger, roster synchronization, and data-rights preview body.
\ir ../../supabase/migrations/20240320000000_create_user_profiles.sql
alter table public.user_profiles add column avatar_url text;
create table public.events (
  id uuid primary key, name text, date timestamptz default now(),
  points integer default 0, is_published boolean default true
);
\ir ../../supabase/migrations/20240320000004_add_event_types.sql
create table public.user_points (
  user_id uuid primary key references auth.users(id),
  points integer default 0, total_points integer default 0, updated_at timestamptz default now()
);
\ir ../../supabase/migrations/20240320000012_update_check_in_system.sql
\ir ../../supabase/migrations/20240320000012_add_user_points_trigger.sql
\ir ../../supabase/migrations/20260620000000_move_check_in_code_to_secrets_table.sql

create table public.members (
  id uuid primary key, user_id uuid references auth.users(id),
  first_name text, last_name text, points integer default 0,
  events_attended integer default 0, updated_at timestamptz default now()
);
create table public.member_event_attendance (
  member_id uuid references public.members(id), event_id uuid references public.events(id),
  points_earned integer, primary key(member_id, event_id)
);
create table public.house_memberships (member_id uuid references public.members(id));
create table public.import_job_rows (
  matched_member_id uuid, created_member_id uuid, attendance_member_id uuid
);
create table public.feedback (user_id uuid references auth.users(id));
create table public.chat_logs (user_id uuid references auth.users(id));
create table public.data_rights_requests (
  id uuid primary key, subject_auth_user_id uuid references auth.users(id),
  subject_member_id uuid references public.members(id),
  subject_display_name text, verification_status text
);
\ir ../../supabase/migrations/20260525000001_sync_attendance_points_on_event_update.sql
\ir ../../supabase/migrations/20260619020000_add_data_rights_dependency_preview.sql

-- These optional historical/drifted objects cover grants and dependency
-- retention; their records do not represent a real member or event.
create table public.check_in_code_usage (
  code_id uuid references public.check_in_codes(id), used_by uuid references auth.users(id)
);
create table public.check_ins (
  user_id uuid references auth.users(id), event_id uuid references public.events(id), code text
);
create function public.check_in_to_event(uuid, text) returns jsonb
  language sql security definer as $$ select '{"legacy":true}'::jsonb; $$;
create function public.generate_check_in_code(integer) returns text
  language sql as $$ select 'SYNTHETIC'; $$;
create function public.get_user_points(uuid) returns integer
  language sql security definer as $$ select total_points from public.user_points where user_id = $1; $$;
create function public.get_user_points() returns integer language sql as $$ select 0; $$;
create function public.set_event_check_in_code() returns trigger language plpgsql as $$
  begin return new; end;
$$;
create function public.update_user_points() returns trigger language plpgsql as $$
  begin return new; end;
$$;
create function public.handle_check_in(text) returns boolean language sql as $$ select true; $$;
create function public.sync_member_points() returns trigger language plpgsql as $$
  begin return new; end;
$$;
create function public.recalculate_member_points(uuid) returns void language sql as $$ select; $$;
create function public.is_admin_user() returns boolean language sql stable security definer as $$
  select exists(select 1 from public.user_profiles where id = auth.uid() and is_admin);
$$;
revoke all on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated;

create trigger renamed_code_secret after insert on public.events
  for each row execute function public.create_event_check_in_secret();
create trigger renamed_code_column before insert on public.events
  for each row execute function public.set_event_check_in_code();
create trigger renamed_points_bootstrap after insert on auth.users
  for each row execute function public.handle_new_user_points();
create trigger sync_member_points after insert on public.member_event_attendance
  for each row execute function public.sync_member_points();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'subject@example.invalid', '{"first_name":"Fixture","last_name":"Subject"}'),
  ('00000000-0000-0000-0000-000000000002', 'admin@example.invalid', '{"first_name":"Fixture","last_name":"Admin"}');
update public.user_profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000002';
insert into public.events (id, name, event_type) values
  ('00000000-0000-0000-0000-000000000003', 'Synthetic compatibility event', 'general_event');
insert into public.members (id, user_id, first_name, last_name, points, events_attended) values
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Fixture', 'Subject', 10, 1);
insert into public.member_event_attendance values
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 10);
insert into public.event_attendance (event_id, user_id, points_earned, check_in_type) values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 10, 'code');
update public.user_points set total_points = 10 where user_id = '00000000-0000-0000-0000-000000000001';
insert into public.check_in_codes (id, event_id, code, used_by) values
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'SYNTHETIC-ARCHIVE', '00000000-0000-0000-0000-000000000001');
insert into public.check_in_code_usage values
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001');
insert into public.check_ins values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'SYNTHETIC-ARCHIVE');
insert into public.house_memberships values ('00000000-0000-0000-0000-000000000004');
insert into public.import_job_rows (matched_member_id) values ('00000000-0000-0000-0000-000000000004');
insert into public.data_rights_requests values (
  '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000004', 'Fixture Subject', 'verified'
);

grant all on all tables in schema public to public, anon, authenticated, service_role;
-- Use column ACLs independently of the table ACL, including PUBLIC leakage.
grant select (user_id), insert (user_id), update (points), references (user_id)
  on public.user_points to public, anon, authenticated;
grant select (check_in_code), update (check_in_code)
  on public.event_check_in_secrets to public, anon, authenticated;
do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure signature from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'check_in_to_event', 'generate_check_in_code', 'set_event_check_in_code',
      'create_event_check_in_secret', 'handle_new_user_points', 'get_user_points',
      'update_user_points', 'handle_check_in'
    )
  loop
    execute format('grant execute on function %s to public, anon, authenticated, service_role', fn.signature);
  end loop;
end;
$$;

create function retirement_test.assert(ok boolean, message text) returns void
  language plpgsql as $$ begin if ok is not true then raise exception '%', message; end if; end; $$;
do $$
begin
  perform retirement_test.assert(has_table_privilege('authenticated', 'public.user_points', 'SELECT'),
    'Fixture failed to install the legacy table grant');
  perform retirement_test.assert(exists (
    select 1 from pg_attribute a
    cross join lateral aclexplode(a.attacl) acl
    where a.attrelid = 'public.user_points'::regclass and a.attname = 'points'
      and acl.grantee = 0 and acl.privilege_type = 'UPDATE'
  ), 'Fixture failed to install the explicit PUBLIC column grant');
  perform retirement_test.assert(has_function_privilege('service_role',
    'public.check_in_to_event(text)', 'EXECUTE'), 'Fixture failed to install the service-role RPC grant');
end;
$$;
create table retirement_test.before_data (relation_name text primary key, rows jsonb);
do $$
declare tbl record; rows jsonb;
begin
  for tbl in select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('auth', 'public') and c.relkind = 'r'
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %I.%I t',
      tbl.nspname, tbl.relname) into rows;
    insert into retirement_test.before_data values (format('%I.%I', tbl.nspname, tbl.relname), rows);
  end loop;
end;
$$;
create table retirement_test.before_functions as
  select p.oid, pg_get_functiondef(p.oid) definition, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'auth') and p.prokind = 'f';
create table retirement_test.before_columns as
  select a.attrelid, a.attnum, a.attname, a.atttypid, a.attnotnull, a.attisdropped
  from pg_attribute a join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth') and c.relkind = 'r' and a.attnum > 0;
create table retirement_test.before_constraints as
  select con.oid, pg_get_constraintdef(con.oid) definition
  from pg_constraint con join pg_namespace n on n.oid = con.connamespace
  where n.nspname in ('public', 'auth');
create table retirement_test.before_triggers as
  select t.oid, pg_get_triggerdef(t.oid) definition from pg_trigger t
  where not t.tgisinternal and t.tgname in (
    'on_auth_user_created', 'set_event_points', 'sync_attendance_points_on_event_update', 'sync_member_points'
  );
\echo 'Fixture ready: actual retained SQL bodies plus legacy overloads, renamed triggers, and explicit column ACLs.'
