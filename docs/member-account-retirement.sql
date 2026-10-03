-- Read-only hosted inventory. Run privately before and after manual retirement.
-- Reports metadata and aggregates only; never executes a retired RPC.
begin transaction read only;

-- Snapshot these counts/totals before apply and compare afterward.
do $$
declare
  relation_name text;
  row_count bigint;
  member_points bigint;
  attendance_points bigint;
begin
  foreach relation_name in array array[
    'members', 'member_event_attendance', 'house_memberships',
    'event_attendance', 'user_points', 'event_check_in_secrets',
    'check_in_codes', 'check_in_code_usage', 'check_ins'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('select count(*) from public.%I', relation_name) into row_count;
      raise notice '% rows: %', relation_name, row_count;
    else
      raise notice '% is absent', relation_name;
    end if;
  end loop;
  select coalesce(sum(points), 0) into member_points from public.members;
  select coalesce(sum(points_earned), 0) into attendance_points from public.member_event_attendance;
  raise notice 'Active member total: %; active attendance total: %', member_points, attendance_points;
end;
$$;

-- Expected AFTER apply: no client table or column privilege rows.
select c.relname as archive, client.role_name,
  has_table_privilege(client.role_name, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as table_access,
  has_any_column_privilege(client.role_name, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES') as column_access
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) client(role_name)
where n.nspname = 'public'
  and c.relname in ('event_attendance', 'user_points', 'event_check_in_secrets', 'check_in_codes', 'check_in_code_usage', 'check_ins')
  and (
    has_table_privilege(client.role_name, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
    or has_any_column_privilege(client.role_name, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
  );

-- Expected AFTER apply: no executable retired overload rows, for any API role.
select p.oid::regprocedure as signature, client.role_name
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated'), ('service_role')) client(role_name)
where n.nspname = 'public' and p.prokind = 'f'
  and p.proname in (
    'check_in_to_event', 'generate_check_in_code', 'set_event_check_in_code',
    'create_event_check_in_secret', 'handle_new_user_points', 'get_user_points',
    'update_user_points', 'handle_check_in'
  ) and has_function_privilege(client.role_name, p.oid, 'EXECUTE');

-- Expected AFTER apply: no retired event-generation/Auth-points registrations.
select n.nspname, c.relname, t.tgname, p.oid::regprocedure as function
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace fn on fn.oid = p.pronamespace
where not t.tgisinternal and (
  (n.nspname = 'public' and c.relname = 'events' and (
    t.tgname in ('generate_event_check_in_code', 'generate_event_check_in_secret')
    or (fn.nspname = 'public' and p.proname in ('set_event_check_in_code', 'create_event_check_in_secret', 'generate_check_in_code'))
  ))
  or (n.nspname = 'auth' and c.relname = 'users' and (
    t.tgname = 'on_auth_user_created_points'
    or (fn.nspname = 'public' and p.proname = 'handle_new_user_points')
  ))
);

-- Inspect unknown client-callable wrappers that could reach the retained data.
-- Existing guarded data-rights preview/export/anonymization are intentional.
-- Any other result needs review before manual apply; do not paste private bodies.
select p.oid::regprocedure as signature, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ~ '\m(event_attendance|user_points|event_check_in_secrets|check_in_codes|check_in_code_usage|check_ins)\M'
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));

-- Inspect legacy views before apply. Active member-based views must not appear.
select schemaname, viewname
from pg_views
where schemaname = 'public'
  and definition ~ '\m(event_attendance|user_points|event_check_in_secrets|check_in_codes|check_in_code_usage|check_ins)\M';

-- This field should already be absent (codes moved to the private secrets table).
-- A result means an older schema needs a separate archival/permission review.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'events' and column_name = 'check_in_code';

commit;
