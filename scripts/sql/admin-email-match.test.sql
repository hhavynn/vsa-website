-- #804 offline synthetic auth/alias/POST checks. Never run against production.
\pset tuples_only on
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create table public.user_profiles (id uuid primary key, is_admin boolean not null);
create function auth.uid() returns uuid language sql stable set search_path = '' as
  $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.is_admin_user(p_id uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$select coalesce((select p.is_admin from public.user_profiles p where p.id=p_id),false)$$;
grant execute on function public.is_admin_user(uuid), auth.uid() to anon, authenticated;

create table public.members (
  id uuid primary key, first_name text, last_name text, college text, year text,
  email text
);
create table public.member_identity_emails (
  id uuid primary key, member_id uuid not null references public.members(id),
  email text unique not null, confirmed_at timestamptz not null default now()
);
alter table public.members enable row level security;
alter table public.member_identity_emails enable row level security;
grant select on public.members, public.member_identity_emails to authenticated;
create policy member_admin_only on public.members for select to authenticated
  using (public.is_admin_user(auth.uid()));
create policy aliases_admin_only on public.member_identity_emails for select to authenticated
  using (public.is_admin_user(auth.uid()));

\ir ../../supabase/migrations/20261031080000_admin_match_members_by_email.sql

insert into public.user_profiles values
 ('10000000-0000-0000-0000-000000000001',true),
 ('10000000-0000-0000-0000-000000000002',false);
insert into public.members values
 ('20000000-0000-0000-0000-000000000001','Fictional','One','Sixth','Fourth Year','primary@example.edu'),
 ('20000000-0000-0000-0000-000000000002','Fictional','Two','Revelle','Second Year','shared@example.edu'),
 ('20000000-0000-0000-0000-000000000003','Fictional','Three','Revelle','Second Year','shared@example.edu');
insert into public.member_identity_emails values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','alias@example.edu',now()),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','primary@example.edu',now());

set role anon;
do $$
begin
  begin
    perform public.admin_match_members_by_email(array['alias@example.edu']);
    raise exception 'FAIL: anonymous RPC execution was allowed';
  exception when sqlstate '42501' then
    raise notice 'PASS: anon cannot call admin match RPC';
  end;
end $$;
reset role;

set role authenticated;
select set_config('test.uid','10000000-0000-0000-0000-000000000002',false);
do $$
begin
  begin
    perform public.admin_match_members_by_email(array['alias@example.edu']);
    raise exception 'FAIL: ordinary signed-in user could query admin match';
  exception when sqlstate '42501' then
    raise notice 'PASS: ordinary authenticated user is refused by admin guard';
  end;
end $$;
reset role;

set role authenticated;
select set_config('test.uid','10000000-0000-0000-0000-000000000001',false);
select set_config('request.method','POST',false);
do $$
declare result jsonb;
begin
 result := public.admin_match_members_by_email(array[' PRIMARY@EXAMPLE.EDU ','ALIAS@example.edu','shared@example.edu']);
 if jsonb_array_length(result) <> 4 then
   raise exception 'FAIL: expected two names for shared primary email and each alias';
 end if;
 if (select count(*) from jsonb_array_elements(result) as x
   where x->>'input_email'='primary@example.edu'
     and x->>'id'='20000000-0000-0000-0000-000000000001') <> 1 then
   raise exception 'FAIL: same member primary and alias duplicates were not collapsed';
 end if;
 if (select count(*) from jsonb_array_elements(result) as x
   where x->>'input_email'='alias@example.edu'
     and x->>'id'='20000000-0000-0000-0000-000000000001') <> 1 then
   raise exception 'FAIL: confirmed alias failed';
 end if;
 if (select count(*) from jsonb_array_elements(result) as x
   where x->>'input_email'='shared@example.edu') <> 2 then
   raise exception 'FAIL: ambiguous shared email must retain both candidates';
 end if;
 if (select count(*) from jsonb_object_keys(result->0) as key) <> 6
    or result::text ~ 'confirmed_at|admin_note|attendance|points' then
   raise exception 'FAIL: result contains unexpected private fields';
 end if;
 if public.admin_match_members_by_email(null::text[]) <> '[]'::jsonb
    or public.admin_match_members_by_email(array[]::text[]) <> '[]'::jsonb then
   raise exception 'FAIL: empty email input should be empty';
 end if;
 raise notice 'PASS: admin POST matches aliases, de-dupes primary and returns only safe fields';
end $$;

select set_config('request.method','GET',false);
do $$
begin
  begin
    perform public.admin_match_members_by_email(array['alias@example.edu']);
    raise exception 'FAIL: GET method accepted private email in URL';
  exception when sqlstate '42501' then
    raise notice 'PASS: URL-encoded GET RPC refused';
  end;
end $$;
select set_config('request.method','POST',false);

do $$
begin
  begin
    perform public.admin_match_members_by_email(
      array(select 'synthetic-' || i || '@example.edu' from generate_series(1,1001) i));
    raise exception 'FAIL: over 1000 emails accepted';
  exception when sqlstate '22023' then
    raise notice 'PASS: server rejects >1000 email addresses';
  end;
end $$;
reset role;

do $$
begin
 if has_function_privilege('anon','public.admin_match_members_by_email(text[])','EXECUTE') then
   raise exception 'FAIL: anon RPC execute grant exists';
 end if;
 if not has_function_privilege('authenticated','public.admin_match_members_by_email(text[])','EXECUTE') then
   raise exception 'FAIL: authenticated lacks RPC execute grant';
 end if;
 if exists (
   select 1 from pg_proc p, lateral aclexplode(
     coalesce(p.proacl, acldefault('f',p.proowner))) acl
   where p.oid='public.admin_match_members_by_email(text[])'::regprocedure and acl.grantee=0
 ) then
   raise exception 'FAIL: PUBLIC may inherit RPC execute';
 end if;
 raise notice 'PASS: only authenticated can attempt RPC, admin guard still enforced';
end $$;
