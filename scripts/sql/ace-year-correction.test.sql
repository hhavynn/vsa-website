-- #673: AFTER ace-pickup-year.assert.sql; all data synthetic.
create function pg_temp.check_673(label text, good boolean) returns void language plpgsql as $$
begin
  if good is not true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function pg_temp.try_673(who text, actor text, statement text)
returns text language plpgsql as $$
declare outcome text;
begin
  perform set_config('request.jwt.claim.sub',who,true);
  perform set_config('role',actor,true);
  begin
    execute statement;
    outcome:='ok';
  exception when others then
    outcome:=sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role','pickup_operator',true);
  return outcome;
end $$;
select pg_temp.check_673('SECURITY INVOKER and pinned empty search_path',
  (select not prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid='public.correct_ace_member_pickup_year(uuid,integer,text,integer,text,text,uuid)'::regprocedure));
select pg_temp.check_673('anon EXECUTE revoked and authenticated allowed',
  not has_function_privilege('anon','public.correct_ace_member_pickup_year(uuid,integer,text,integer,text,text,uuid)','execute')
  and has_function_privilege('authenticated','public.correct_ace_member_pickup_year(uuid,integer,text,integer,text,text,uuid)','execute'));
select pg_temp.check_673('anon refused',
  pg_temp.try_673('','anon',$q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',null,null,2023,'FA23','admin_entry',null)$q$) like '42501%');
select pg_temp.check_673('non-admin refused',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000b2','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',null,null,2023,'FA23','admin_entry',null)$q$) like '42501%');
select pg_temp.check_673('invalid source refused',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000a1','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',null,null,2023,'FA23','fake',null)$q$) like '22023%');
create temp table before_correction_shape as select
  to_jsonb(m)-'pickup_academic_year_start'-'pickup_term'-'updated_at' as shape
from public.ace_family_members m where id='30000000-0000-0000-0000-000000000006';
select pg_temp.check_673('admin can approve year-only without term',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000a1','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',null,null,2022,null,'admin_entry',null)$q$)='ok');
select pg_temp.check_673('year-only approved with one evidence and audit entry',
  (select pickup_academic_year_start=2022 and pickup_term is null from public.ace_family_members
    where id='30000000-0000-0000-0000-000000000006')
  and (select count(*) from public.ace_member_pickup_evidence where
    ace_member_id='30000000-0000-0000-0000-000000000006' and review_status='approved'
    and candidate_academic_year_start=2022 and candidate_term is null and reviewed_at is not null)=1
  and (select count(*) from public.admin_activity_log where action='ace.pickup_year_changed')=1);
select pg_temp.check_673('stale snapshot rejected before changes',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000a1','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',null,null,2023,'FA23','admin_entry',null)$q$)
    like 'P0001%Someone else changed this pickup year%');
select pg_temp.check_673('replay is no-op without second audit',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000a1','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',2022,null,2022,null,'admin_entry',null)$q$)='ok'
  and (select count(*) from public.admin_activity_log where action='ace.pickup_year_changed')=1);
select pg_temp.check_673('FA23 corrected from year-only',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000a1','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',2022,null,2023,'FA23','official_pairing',null)$q$)='ok');
select pg_temp.check_673('prior evidence superseded, second audit stamped',
  (select count(*) from public.ace_member_pickup_evidence where
    ace_member_id='30000000-0000-0000-0000-000000000006' and review_status='superseded')=1
  and (select count(*) from public.admin_activity_log where action='ace.pickup_year_changed')=2);
select pg_temp.check_673('1998 allowed despite admin log year range',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000a1','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',2023,'FA23',1998,'FA98','admin_entry',null)$q$)='ok');
select pg_temp.check_673('clear to Unknown is audited',
  pg_temp.try_673('00000000-0000-0000-0000-0000000000a1','authenticated',
  $q$select public.correct_ace_member_pickup_year(
    '30000000-0000-0000-0000-000000000006',1998,'FA98',null,null,'admin_entry',null)$q$)='ok');
select pg_temp.check_673('four atomic audits, no lineage/name/photo/member change',
  (select count(*) from public.admin_activity_log where action='ace.pickup_year_changed')=4
  and (select pickup_academic_year_start is null and pickup_term is null
     from public.ace_family_members where id='30000000-0000-0000-0000-000000000006')
  and (select to_jsonb(m)-'pickup_academic_year_start'-'pickup_term'-'updated_at'
     from public.ace_family_members m where id='30000000-0000-0000-0000-000000000006')
  = (select shape from before_correction_shape));
select pg_temp.check_673('audit metadata contains no member name or contact information',
  not exists(select 1 from public.admin_activity_log where action='ace.pickup_year_changed'
    and (metadata::text like '%Graveyard Person%' or metadata::text like '%@%' or
      metadata::text like '%https://%')));
