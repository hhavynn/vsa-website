-- Assertions for migration 20261011000000_admin_member_lookup_rpcs.sql.
-- Run by scripts/test-attendance-recovery.sh against a disposable local cluster,
-- after Supabase-style default privileges (EXECUTE to anon and authenticated on
-- new functions) were in effect when the migration ran. Synthetic people only.
-- One transaction, rolled back. Prints "PASS: ..." per check and aborts on the
-- first failure.

begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000001a1'),
  ('00000000-0000-0000-0000-0000000001b1');
insert into public.user_profiles (id, is_admin) values
  ('00000000-0000-0000-0000-0000000001a1', true),
  ('00000000-0000-0000-0000-0000000001b1', false);

insert into public.members (id, first_name, last_name, email) values
  ('11000000-0000-0000-0000-000000000001', 'Kevin', 'Le', ' Kevin.Le@UCSD.edu '),
  ('11000000-0000-0000-0000-000000000002', 'Kevin', 'Lee', 'kevlee@ucsd.edu'),
  ('11000000-0000-0000-0000-000000000003', 'Linh', 'Tran', 'linh.tran@ucsd.edu'),
  ('11000000-0000-0000-0000-000000000004', 'Lynn', 'Tran ', 'lynn.tran@ucsd.edu'),
  ('11000000-0000-0000-0000-000000000005', 'Minh', 'Nguyen', null),
  ('11000000-0000-0000-0000-000000000006', 'Anh', 'Pham', 'anh.pham@gmail.com');

create function pg_temp.call_as(p_sub text, p_role text, p_method text, p_sql text)
returns jsonb language plpgsql as $$
declare
  v jsonb;
  v_code text;
  v_msg text;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('request.method', p_method, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql into v;
    perform set_config('role', 'none', true);
    return jsonb_build_object('ok', true, 'result', v);
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text;
    perform set_config('role', 'none', true);
    return jsonb_build_object('ok', false, 'code', v_code, 'message', v_msg);
  end;
end $$;

create function pg_temp.admin(p_sql text) returns jsonb language sql as $$
  select pg_temp.call_as('00000000-0000-0000-0000-0000000001a1', 'authenticated', 'POST', p_sql);
$$;

-- Ids (sorted, last 2 digits) an admin lookup returns, e.g. '01,03'.
create function pg_temp.ids(p_sql text) returns text language sql as $$
  select coalesce(string_agg(right(e ->> 'id', 2), ',' order by e ->> 'id'), '')
  from jsonb_array_elements(pg_temp.admin(p_sql) -> 'result') as e;
$$;
-- Ids in the order returned.
create function pg_temp.ordered_ids(p_sql text) returns text language sql as $$
  select coalesce(string_agg(right(e ->> 'id', 2), ',' order by n), '')
  from jsonb_array_elements(pg_temp.admin(p_sql) -> 'result') with ordinality as x(e, n);
$$;

create function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

-- Grants and function properties ----------------------------------------------
select pg_temp.check_true('default privileges really granted anon EXECUTE on new functions (so the revoke is tested)',
  (select count(*) from pg_default_acl d, aclexplode(d.defaclacl) a
   where d.defaclobjtype = 'f' and a.grantee = 'anon'::regrole and a.privilege_type = 'EXECUTE') = 1);
select pg_temp.check_true('anon cannot execute either lookup function; authenticated can',
  not has_function_privilege('anon', 'public.admin_lookup_members(text[], text[])', 'execute')
  and not has_function_privilege('anon', 'public.admin_search_members(text, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.admin_lookup_members(text[], text[])', 'execute')
  and has_function_privilege('authenticated', 'public.admin_search_members(text, integer)', 'execute'));
select pg_temp.check_true('PUBLIC holds no EXECUTE grant on either lookup function',
  not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid in ('public.admin_lookup_members(text[], text[])'::regprocedure, 'public.admin_search_members(text, integer)'::regprocedure)
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'));
select pg_temp.check_true('both functions are SECURITY INVOKER, volatile, with search_path pinned to empty',
  (select bool_and(not p.prosecdef and p.provolatile = 'v' and p.proconfig = array['search_path=""'])
   from pg_proc p
   where p.oid in ('public.admin_lookup_members(text[], text[])'::regprocedure, 'public.admin_search_members(text, integer)'::regprocedure)));
select pg_temp.check_true('exactly one overload of each lookup function',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('admin_lookup_members', 'admin_search_members')) = 2);

-- Unauthorized callers -----------------------------------------------------------
select pg_temp.check_true('anon cannot look up members',
  (pg_temp.call_as('', 'anon', 'POST', $q$select public.admin_lookup_members(array['kevin.le@ucsd.edu'], null)$q$) ->> 'code') = '42501'
  and (pg_temp.call_as('', 'anon', 'POST', $q$select public.admin_search_members('Kevin')$q$) ->> 'code') = '42501');
select pg_temp.check_true('a signed-in non-admin is refused by the explicit admin check',
  (pg_temp.call_as('00000000-0000-0000-0000-0000000001b1', 'authenticated', 'POST', $q$select public.admin_lookup_members(array['kevin.le@ucsd.edu'], array['le'])$q$) ->> 'message') = 'Only admins can look up members'
  and (pg_temp.call_as('00000000-0000-0000-0000-0000000001b1', 'authenticated', 'POST', $q$select public.admin_search_members('Kevin')$q$) ->> 'code') = '42501');
select pg_temp.check_true('an authenticated caller with no user id is refused',
  (pg_temp.call_as('', 'authenticated', 'POST', $q$select public.admin_lookup_members(null, array['le'])$q$) ->> 'code') = '42501');
select pg_temp.check_true('members RLS still hides raw rows from a non-admin outside the function',
  (pg_temp.call_as('00000000-0000-0000-0000-0000000001b1', 'authenticated', 'POST', $q$select to_jsonb(count(*)) from public.members$q$) -> 'result')::int = 0);

-- POST only -----------------------------------------------------------------------
select pg_temp.check_true('GET and HEAD requests are refused, without echoing the values',
  (pg_temp.call_as('00000000-0000-0000-0000-0000000001a1', 'authenticated', 'GET', $q$select public.admin_lookup_members(array['kevin.le@ucsd.edu'], null)$q$) ->> 'message') = 'Member lookups must use POST'
  and (pg_temp.call_as('00000000-0000-0000-0000-0000000001a1', 'authenticated', 'HEAD', $q$select public.admin_lookup_members(null, array['tran'])$q$) ->> 'message') = 'Member lookups must use POST'
  and (pg_temp.call_as('00000000-0000-0000-0000-0000000001a1', 'authenticated', 'HEAD', $q$select public.admin_search_members('tran')$q$) ->> 'message') = 'Member lookups must use POST'
  and (pg_temp.call_as('00000000-0000-0000-0000-0000000001a1', 'authenticated', 'GET', $q$select public.admin_search_members('kevin.le@ucsd.edu')$q$) ->> 'message') = 'Member lookups must use POST');
select pg_temp.check_true('a call outside PostgREST (no request method) is allowed for admins',
  (pg_temp.call_as('00000000-0000-0000-0000-0000000001a1', 'authenticated', '', $q$select public.admin_lookup_members(array['kevlee@ucsd.edu'], null)$q$) ->> 'ok')::boolean);

-- Exact lookups -----------------------------------------------------------------
select pg_temp.check_true('email lookup is exact, trimmed and case-insensitive on both sides',
  pg_temp.ids($q$select public.admin_lookup_members(array['kevin.le@ucsd.edu ', 'KEVLEE@ucsd.edu'], null)$q$) = '01,02');
select pg_temp.check_true('email lookup treats _ and % literally (no wildcard match)',
  pg_temp.ids($q$select public.admin_lookup_members(array['kevin_le@ucsd.edu', '%@ucsd.edu', 'kevin.le'], null)$q$) = '');
select pg_temp.check_true('surname lookup matches a case-insensitive suffix of the trimmed last name',
  pg_temp.ids($q$select public.admin_lookup_members(null, array['TRAN', 'guyen'])$q$) = '03,04,05');
select pg_temp.check_true('surname lookup is literal: "le" does not match Lee, "%" matches nothing',
  pg_temp.ids($q$select public.admin_lookup_members(null, array['le'])$q$) = '01'
  and pg_temp.ids($q$select public.admin_lookup_members(null, array['%', '_'])$q$) = '');
select pg_temp.check_true('emails and surnames combine, each member once',
  pg_temp.ids($q$select public.admin_lookup_members(array['linh.tran@ucsd.edu'], array['tran', 'pham'])$q$) = '03,04,06');
select pg_temp.check_true('null, empty and blank inputs return an empty array',
  (pg_temp.admin($q$select public.admin_lookup_members(null, null)$q$) -> 'result') = '[]'::jsonb
  and (pg_temp.admin($q$select public.admin_lookup_members(array['', '  '], '{}')$q$) -> 'result') = '[]'::jsonb);
select pg_temp.check_true('rows carry exactly the eight member columns the screens read',
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.admin($q$select public.admin_lookup_members(array['kevlee@ucsd.edu'], null)$q$) -> 'result' -> 0) as k)
  = array['college', 'email', 'events_attended', 'first_name', 'id', 'last_name', 'points', 'year']);
select pg_temp.check_true('more than 1000 distinct values is refused without echoing them',
  (pg_temp.admin($q$select public.admin_lookup_members(null, array(select 's' || g from generate_series(1, 1001) g))$q$) ->> 'code') = '22023'
  and (pg_temp.admin($q$select public.admin_lookup_members(array(select 'x' || g || '@ucsd.edu' from generate_series(1, 1001) g), null)$q$) ->> 'message') not like '%@%');
select pg_temp.check_true('duplicates collapse before the 1000 cap (3000 values, 1000 distinct, accepted)',
  pg_temp.ids($q$select public.admin_lookup_members(null, array(select 'S' || (g % 999) from generate_series(1, 3000) g) || array['Tran'])$q$) = '03,04');

-- Typeahead search ---------------------------------------------------------------
select pg_temp.check_true('a single token with @ searches email by substring',
  pg_temp.ids($q$select public.admin_search_members('ucsd.edu')$q$) = ''
  and pg_temp.ids($q$select public.admin_search_members('@UCSD.edu')$q$) = '01,02,03,04');
select pg_temp.check_true('one name token matches first or last name',
  pg_temp.ids($q$select public.admin_search_members('kev')$q$) = '01,02'
  and pg_temp.ids($q$select public.admin_search_members('tran')$q$) = '03,04');
select pg_temp.check_true('two name tokens match first and last (dots split names)',
  pg_temp.ids($q$select public.admin_search_members('Kevin Lee')$q$) = '02'
  and pg_temp.ids($q$select public.admin_search_members('linh.tran')$q$) = '03');
select pg_temp.check_true('results are ordered by last then first name',
  pg_temp.ordered_ids($q$select public.admin_search_members('in', 50)$q$) = '01,02,05,03');
select pg_temp.check_true('search matches literally: _ and % are not wildcards',
  pg_temp.ids($q$select public.admin_search_members('k_vin')$q$) = ''
  and pg_temp.ids($q$select public.admin_search_members('%%')$q$) = '');
select pg_temp.check_true('fewer than two characters returns nothing',
  (pg_temp.admin($q$select public.admin_search_members(' a ')$q$) -> 'result') = '[]'::jsonb
  and (pg_temp.admin($q$select public.admin_search_members(null)$q$) -> 'result') = '[]'::jsonb);
select pg_temp.check_true('the limit is honoured and clamped to 1..50',
  pg_temp.ordered_ids($q$select public.admin_search_members('in', 2)$q$) = '01,02'
  and pg_temp.ordered_ids($q$select public.admin_search_members('in', 0)$q$) = '01'
  and jsonb_array_length(pg_temp.admin($q$select public.admin_search_members('in', 100000)$q$) -> 'result') = 4);

rollback;
