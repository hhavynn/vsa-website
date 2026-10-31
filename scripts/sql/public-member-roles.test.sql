-- Synthetic security contract for the exact #623 migration; never production.
\pset tuples_only on
create role anon;
create role authenticated;
grant usage on schema public to anon, authenticated;
create table public.academic_terms (academic_year_start integer, is_active boolean not null);
create table public.cabinet_years (id uuid primary key, start_year integer not null);
create table public.cabinet_members (
  id uuid primary key, member_id uuid, cabinet_year_id uuid,
  role text, category text, admin_notes text
);
\ir ../../supabase/migrations/20261031070305_public_member_roles.sql

insert into public.academic_terms values (2026, true);
insert into public.cabinet_years values
 ('10000000-0000-0000-0000-000000000001', 2026),
 ('10000000-0000-0000-0000-000000000002', 2025),
 ('10000000-0000-0000-0000-000000000003', 2027);
insert into public.cabinet_members values
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Events Chair','General Board','private'),
 ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','PR Chair','Executive Board','private'),
 ('20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Intern','Interns','private'),
 ('20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Intern','Interns','private'),
 ('20000000-0000-0000-0000-000000000005',null,'10000000-0000-0000-0000-000000000001','President','Executive Board','private'),
 ('20000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Board Member','Executive Board','private'),
 ('20000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Treasurer','Draft','private'),
 ('20000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','President','Executive Board','private'),
 ('20000000-0000-0000-0000-000000000009','30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000003','President','Executive Board','future'),
 ('20000000-0000-0000-0000-000000000010','30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Co-Chair','General Board','private'),
 ('20000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Co-Chair','General Board','private');
-- RPC is the only public path to these sources in the isolated fixture.
revoke all on public.cabinet_members, public.cabinet_years, public.academic_terms from public, anon, authenticated;
set role anon;
do $$
declare
  m uuid := '30000000-0000-0000-0000-000000000001';
  i uuid := '30000000-0000-0000-0000-000000000002';
  b uuid := '30000000-0000-0000-0000-000000000003';
begin
 if (select count(*) from public.public_member_roles(2026, array[m])) <> 4
    or (select count(*) from public.public_member_roles(2026, array[m]) where kind='board') <> 1 then
   raise exception 'FAIL: Board, two exact positions and Intern must coexist';
 end if;
 if (select count(*) from public.public_member_roles(2026, array[i])) <> 1
    or exists (select 1 from public.public_member_roles(2026, array[i]) where kind='board') then
   raise exception 'FAIL: Intern-only member promoted to Board';
 end if;
 if (select count(*) from public.public_member_roles(2026, array[b])) <> 1 then
   raise exception 'FAIL: Board Member-only entry should have one chip';
 end if;
 if exists (select 1 from public.public_member_roles(2026,
       array['30000000-0000-0000-0000-000000000004'::uuid]))
    or exists (select 1 from public.public_member_roles(2026,
       array['30000000-0000-0000-0000-000000000005'::uuid]))
    or exists (select 1 from public.public_member_roles(2027,
       array['30000000-0000-0000-0000-000000000005'::uuid]))
    or exists (select 1 from public.public_member_roles(2024, array[m])) then
   raise exception 'FAIL: draft, future, missing-year or unlinked role leaked';
 end if;
 if exists (select 1 from public.public_member_roles(2026, null::uuid[]))
    or exists (select 1 from public.public_member_roles(2026, array[]::uuid[])) then
   raise exception 'FAIL: empty and null arrays should return zero rows';
 end if;
 if (select count(*) from public.public_member_roles(2026,
    array['30000000-0000-0000-0000-000000000006'::uuid,'30000000-0000-0000-0000-000000000007'::uuid])
    where kind='cabinet_position') <> 2 then
   raise exception 'FAIL: two distinct co-chairs need their own role rows';
 end if;
 raise notice 'PASS: anon Board, co-held positions, Intern, co-chairs, no drafts, no future years';
end $$;
reset role;

-- Ambiguous published year and excessive ID arrays must always fail.
insert into public.cabinet_years values ('10000000-0000-0000-0000-000000000004',2026);
set role anon;
do $$
begin
 begin
   perform * from public.public_member_roles(2026,array['30000000-0000-0000-0000-000000000001'::uuid]);
   raise exception 'FAIL: ambiguous Cabinet year accepted';
 exception when sqlstate '22023' then
   raise notice 'PASS: ambiguous year rejected';
 end;
 begin
   perform * from public.public_member_roles(2026,array(
     select (lpad(to_hex(i),8,'0') || '-0000-0000-0000-000000000000')::uuid
     from generate_series(1,201) i
   ));
   raise exception 'FAIL: 201-member request accepted';
 exception when sqlstate '22023' then
   raise notice 'PASS: input upper bound enforced';
 end;
 begin
   perform * from public.public_member_roles(null::integer,array['30000000-0000-0000-0000-000000000001'::uuid]);
   raise exception 'FAIL: invalid academic year accepted';
 exception when sqlstate '22023' then
   raise notice 'PASS: invalid year rejected';
 end;
end $$;
reset role;
do $$
begin
 if not has_function_privilege('anon','public.public_member_roles(integer,uuid[])','EXECUTE')
   or not has_function_privilege('authenticated','public.public_member_roles(integer,uuid[])','EXECUTE')
   or exists (
     select 1 from pg_proc p,
       lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) acl
     where p.oid='public.public_member_roles(integer,uuid[])'::regprocedure
       and acl.grantee=0
   ) then
   raise exception 'FAIL: function grants are not narrowly scoped';
 end if;
 raise notice 'PASS: narrow anon/authenticated EXECUTE, no PUBLIC inherited grant';
end $$;
