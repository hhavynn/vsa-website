-- Assertions for 20261027190000_ace_member_pickup_year.sql, run by
-- scripts/test-ace-pickup-year.sh after the fixture and the migration (applied
-- twice). Prints "PASS: ..." per check and aborts on the first failure.

create function pg_temp.try_as(p_sub text, p_role text, p_sql text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
    perform set_config('role', 'pickup_operator', true);
    return 'ok';
  exception when others then
    perform set_config('role', 'pickup_operator', true);
    return sqlstate || ' ' || sqlerrm;
  end;
end $$;

create function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

-- Runs p_sql as p_role and returns the first column of its first row as text.
create function pg_temp.value_as(p_sub text, p_role text, p_sql text)
returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('role', p_role, true);
  execute p_sql into v;
  perform set_config('role', 'pickup_operator', true);
  return v;
end $$;

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set member '''00000000-0000-0000-0000-0000000000b2'''

-- Schema is additive -------------------------------------------------------
select pg_temp.check_true('pickup columns are nullable with no default',
  (select bool_and(is_nullable = 'YES' and column_default is null)
   from information_schema.columns
   where table_schema = 'public' and table_name = 'ace_family_members'
     and column_name in ('pickup_academic_year_start', 'pickup_term'))
  and (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'ace_family_members'
         and column_name in ('pickup_academic_year_start', 'pickup_term')) = 2);
select pg_temp.check_true('every existing node reads as unknown (no backfill)',
  not exists (select 1 from public.ace_family_members
              where pickup_academic_year_start is not null or pickup_term is not null));
select pg_temp.check_true('every pre-existing node column is byte-for-byte unchanged',
  (select count(*) from public.zz_pre_snapshot) = 6
  and not exists (
    select 1 from public.zz_pre_snapshot s
    left join public.ace_family_members m on m.id = s.id
    where m.id is null or not (to_jsonb(m) @> s.row_json)));
select pg_temp.check_true('ace_families rows (incl. legacy year columns) unchanged',
  not exists (
    select 1 from public.zz_pre_families s
    join public.ace_families f on f.id = s.id
    where to_jsonb(f) <> s.row_json));
select pg_temp.check_true('no new trigger on ace_family_members',
  (select array_agg(tgname::text order by tgname) from pg_trigger
   where tgrelid = 'public.ace_family_members'::regclass and not tgisinternal)
  = array['update_ace_family_members_updated_at']);

-- Constraints --------------------------------------------------------------
select pg_temp.check_true('year-only value is accepted',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 2021
       where id = '30000000-0000-0000-0000-000000000006'$q$) = 'ok');
select pg_temp.check_true('SP00 belongs to 1999-00',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 1999, pickup_term = 'SP00'
       where id = '30000000-0000-0000-0000-000000000006'$q$) = 'ok');
select pg_temp.check_true('SP24 belongs to 2023-24',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 2023, pickup_term = 'SP24'
       where id = '30000000-0000-0000-0000-000000000006'$q$) = 'ok');
select pg_temp.check_true('SP23 is rejected for 2023-24',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 2023, pickup_term = 'SP23'
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%pickup_term_valid%');
select pg_temp.check_true('FA23 is rejected for 1923',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 1923, pickup_term = 'FA23'
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%');
select pg_temp.check_true('a term without a year is rejected',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = null, pickup_term = 'FA23'
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%pickup_term_valid%');
select pg_temp.check_true('lowercase, summer and malformed terms are rejected',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 2023, pickup_term = 'fa23'
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%'
  and pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 2022, pickup_term = 'SU23'
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%'
  and pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 2023, pickup_term = 'legacy'
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%');
select pg_temp.check_true('years outside 1960-2100 are rejected',
  pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 1959, pickup_term = null
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%pickup_year_range%'
  and pg_temp.try_as(:admin, 'authenticated',
    $q$update public.ace_family_members set pickup_academic_year_start = 2101, pickup_term = null
       where id = '30000000-0000-0000-0000-000000000006'$q$) like '23514%pickup_year_range%');
select pg_temp.check_true('a non-admin cannot write pickup years directly',
  pg_temp.value_as(:member, 'authenticated',
    $q$with u as (update public.ace_family_members set pickup_academic_year_start = 2000
       where id = '30000000-0000-0000-0000-000000000003' returning 1) select count(*)::text from u$q$) = '0');
select pg_temp.check_true('the non-admin write left the node unknown',
  (select pickup_academic_year_start from public.ace_family_members
   where id = '30000000-0000-0000-0000-000000000003') is null);
-- Reset the graveyard node to unknown for the visibility checks below.
update public.ace_family_members set pickup_academic_year_start = null, pickup_term = null
where id = '30000000-0000-0000-0000-000000000006';

-- Evidence table is admin-only ---------------------------------------------
select pg_temp.check_true('anon has no privilege on evidence',
  not has_table_privilege('anon', 'public.ace_member_pickup_evidence', 'select')
  and not has_table_privilege('anon', 'public.ace_member_pickup_evidence', 'insert')
  and not has_table_privilege('anon', 'public.ace_member_pickup_evidence', 'update')
  and not has_table_privilege('anon', 'public.ace_member_pickup_evidence', 'delete'));
select pg_temp.check_true('anon select on evidence is denied',
  pg_temp.try_as('', 'anon', 'select * from public.ace_member_pickup_evidence') like '42501%');
select pg_temp.check_true('authenticated cannot delete evidence (no grant)',
  not has_table_privilege('authenticated', 'public.ace_member_pickup_evidence', 'delete'));
select pg_temp.check_true('RLS is enabled on evidence',
  (select relrowsecurity from pg_class where oid = 'public.ace_member_pickup_evidence'::regclass));

select pg_temp.check_true('admin records import evidence as pending',
  pg_temp.try_as(:admin, 'authenticated', $q$
    insert into public.ace_member_pickup_evidence
      (id, ace_member_id, source_kind, source_label, raw_value, candidate_academic_year_start, candidate_term, source_confidence)
    values
      ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'import_json', 'synthetic.json', 'FA23', 2023, 'FA23', 'confirmed'),
      ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'import_json', 'synthetic.json', 'legacy', null, null, 'confirmed'),
      ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'workbook_year_row', 'workbook', '2021-22', 2021, null, null)
  $q$) = 'ok');
select pg_temp.check_true('evidence defaults to pending with no reviewer and the creator recorded',
  (select bool_and(review_status = 'pending' and reviewed_at is null and reviewed_by is null
                   and created_by = '00000000-0000-0000-0000-0000000000a1')
   from public.ace_member_pickup_evidence));
select pg_temp.check_true('re-recording the same source value is a no-op',
  pg_temp.try_as(:admin, 'authenticated', $q$
    insert into public.ace_member_pickup_evidence (ace_member_id, source_kind, source_label, raw_value, candidate_academic_year_start, candidate_term)
    values ('30000000-0000-0000-0000-000000000003', 'import_json', 'synthetic.json', 'FA23', 2023, 'FA23')
    on conflict do nothing
  $q$) = 'ok'
  and (select count(*) from public.ace_member_pickup_evidence) = 3);
select pg_temp.check_true('importing evidence did not approve anything',
  not exists (select 1 from public.ace_family_members where pickup_academic_year_start is not null));
select pg_temp.check_true('evidence rejects links and Drive references as labels',
  pg_temp.try_as(:admin, 'authenticated', $q$
    insert into public.ace_member_pickup_evidence (ace_member_id, source_kind, source_label)
    values ('30000000-0000-0000-0000-000000000003', 'workbook_year_row', 'https://docs.google.com/x')
  $q$) like '23514%source_label_check%');
select pg_temp.check_true('evidence candidate term must fit its year',
  pg_temp.try_as(:admin, 'authenticated', $q$
    insert into public.ace_member_pickup_evidence (ace_member_id, source_kind, raw_value, candidate_academic_year_start, candidate_term)
    values ('30000000-0000-0000-0000-000000000003', 'admin_entry', 'SP23', 2023, 'SP23')
  $q$) like '23514%term_valid%');
select pg_temp.check_true('evidence without a candidate cannot be approved',
  pg_temp.try_as(:admin, 'authenticated', $q$
    update public.ace_member_pickup_evidence set review_status = 'approved', reviewed_at = now()
    where id = '40000000-0000-0000-0000-000000000002'
  $q$) like '23514%approved_has_year%');
select pg_temp.check_true('a non-admin sees no evidence and cannot add any',
  pg_temp.value_as(:member, 'authenticated', 'select count(*)::text from public.ace_member_pickup_evidence') = '0'
  and pg_temp.try_as(:member, 'authenticated', $q$
    insert into public.ace_member_pickup_evidence (ace_member_id, source_kind) values
      ('30000000-0000-0000-0000-000000000003', 'admin_entry')
  $q$) like '42501%row-level security%');

-- Review function ----------------------------------------------------------
select pg_temp.check_true('set_ace_member_pickup_year is SECURITY INVOKER with a pinned search_path',
  (select not prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.set_ace_member_pickup_year(uuid,integer,text,uuid)'::regprocedure));
select pg_temp.check_true('anon cannot execute it; authenticated can',
  not has_function_privilege('anon', 'public.set_ace_member_pickup_year(uuid,integer,text,uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.set_ace_member_pickup_year(uuid,integer,text,uuid)', 'execute'));
select pg_temp.check_true('a non-admin is refused',
  pg_temp.try_as(:member, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000003', 2023, 'FA23', null)
  $q$) like '42501%Only admins%');
select pg_temp.check_true('approved value must match the evidence candidate',
  pg_temp.try_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000003', 2023, null,
      '40000000-0000-0000-0000-000000000001')
  $q$) like '22023%must match%');
select pg_temp.check_true('evidence from another node is refused',
  pg_temp.try_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000002', 2023, 'FA23',
      '40000000-0000-0000-0000-000000000001')
  $q$) like 'P0002%does not belong%');
select pg_temp.check_true('a term without a year is refused',
  pg_temp.try_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000003', null, 'FA23', null)
  $q$) like '22023%');
select pg_temp.check_true('an unknown node is refused',
  pg_temp.try_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('39999999-0000-0000-0000-000000000000', 2023, 'FA23', null)
  $q$) like 'P0002%');

create table public.zz_before_approve as
  select id, to_jsonb(m) - 'pickup_academic_year_start' - 'pickup_term' - 'updated_at' as row_json
  from public.ace_family_members m;

select pg_temp.check_true('admin approves FA23 from evidence',
  pg_temp.value_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000003', 2023, ' fa23 ',
      '40000000-0000-0000-0000-000000000001')::text
  $q$)::jsonb = '{"ace_member_id": "30000000-0000-0000-0000-000000000003", "changed": true,
                  "previous": {"academic_year_start": null, "term": null},
                  "current": {"academic_year_start": 2023, "term": "FA23"}}'::jsonb);
select pg_temp.check_true('the node now holds 2023 / FA23',
  (select pickup_academic_year_start = 2023 and pickup_term = 'FA23'
   from public.ace_family_members where id = '30000000-0000-0000-0000-000000000003'));
select pg_temp.check_true('the evidence is stamped approved by the admin',
  (select review_status = 'approved' and reviewed_by = '00000000-0000-0000-0000-0000000000a1'
          and reviewed_at is not null
   from public.ace_member_pickup_evidence where id = '40000000-0000-0000-0000-000000000001'));

-- psql autocommits each statement, so an UPDATE here would move updated_at.
create table public.zz_before_rerun as
  select updated_at from public.ace_family_members where id = '30000000-0000-0000-0000-000000000003';
select pg_temp.check_true('re-applying the same value changes nothing',
  (pg_temp.value_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000003', 2023, 'FA23',
      '40000000-0000-0000-0000-000000000001')::text
  $q$)::jsonb ->> 'changed') = 'false');
select pg_temp.check_true('the re-apply did not touch the row',
  (select updated_at from public.ace_family_members
   where id = '30000000-0000-0000-0000-000000000003') = (select updated_at from public.zz_before_rerun));

select pg_temp.check_true('admin approves a year-only workbook row without inventing a term',
  (pg_temp.value_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000002', 2021, null,
      '40000000-0000-0000-0000-000000000003')::text
  $q$)::jsonb ->> 'changed') = 'true');
-- Separate statement: a read in the same statement would use its pre-update snapshot.
select pg_temp.check_true('the node holds 2021 with no term',
  (select pickup_academic_year_start = 2021 and pickup_term is null
   from public.ace_family_members where id = '30000000-0000-0000-0000-000000000002'));
select pg_temp.check_true('the legacy evidence stays pending',
  (select review_status from public.ace_member_pickup_evidence
   where id = '40000000-0000-0000-0000-000000000002') = 'pending');

select pg_temp.check_true('approvals touched only pickup columns (and updated_at)',
  not exists (
    select 1 from public.zz_before_approve b
    join public.ace_family_members m on m.id = b.id
    where (to_jsonb(m) - 'pickup_academic_year_start' - 'pickup_term' - 'updated_at') <> b.row_json));

-- Public view ---------------------------------------------------------------
select pg_temp.check_true('view keeps its 10 columns in order and appends exactly two',
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
   where table_schema = 'public' and table_name = 'published_ace_family_members')
  = array['id', 'family_id', 'name', 'role_label', 'photo_url', 'parent_member_id', 'display_order',
          'created_at', 'updated_at', 'member_id', 'pickup_academic_year_start', 'pickup_term']);
select pg_temp.check_true('view is SELECT-only for anon and authenticated',
  has_table_privilege('anon', 'public.published_ace_family_members', 'select')
  and has_table_privilege('authenticated', 'public.published_ace_family_members', 'select')
  and not has_table_privilege('anon', 'public.published_ace_family_members', 'insert,update,delete,truncate')
  and not has_table_privilege('authenticated', 'public.published_ace_family_members', 'insert,update,delete,truncate'));
select pg_temp.check_true('anon cannot write through the view',
  pg_temp.try_as('', 'anon', $q$
    update public.published_ace_family_members set pickup_academic_year_start = 2000
    where id = '30000000-0000-0000-0000-000000000003'
  $q$) similar to '(42501|55000)%');
select pg_temp.check_true('anon reads the approved FA23 on a published node',
  pg_temp.value_as('', 'anon', $q$
    select pickup_academic_year_start || '/' || pickup_term from public.published_ace_family_members
    where id = '30000000-0000-0000-0000-000000000003'
  $q$) = '2023/FA23');
select pg_temp.check_true('anon sees exactly the published nodes of published fams',
  pg_temp.value_as('', 'anon', $q$
    select string_agg(name, ',' order by name) from public.published_ace_family_members
  $q$) = 'Graveyard Person,Leaf Person,Middle Person,Root Person');
update public.ace_family_members set pickup_academic_year_start = 2024, pickup_term = 'FA24'
where id in ('30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000005');
select pg_temp.check_true('anon cannot see the year of an unpublished node or a node in an unpublished fam',
  pg_temp.value_as('', 'anon', $q$
    select count(*)::text from public.published_ace_family_members
    where pickup_academic_year_start = 2024
  $q$) = '0');
select pg_temp.check_true('the graveyard fam still loads with an unknown year',
  pg_temp.value_as('', 'anon', $q$
    select coalesce(pickup_academic_year_start::text, 'null') from public.published_ace_family_members
    where id = '30000000-0000-0000-0000-000000000006'
  $q$) = 'null');
select pg_temp.check_true('the view exposes no evidence or reviewer column',
  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'published_ace_family_members'
                and column_name in ('raw_value', 'candidate_academic_year_start', 'candidate_term',
                                    'source_label', 'source_confidence', 'review_status', 'reviewed_by',
                                    'review_note', 'is_published')));

-- Publishing new Littles keeps the Big's own year --------------------------
select pg_temp.check_true('admin creates and fills an assignment cycle',
  pg_temp.try_as(:admin, 'authenticated', $q$
    insert into public.ace_assignment_cycles (id, academic_year_start, academic_year_end)
    values ('50000000-0000-0000-0000-000000000001', 2026, 2027);
    insert into public.ace_assignment_drafts (cycle_id, little_name, big_ace_member_id)
    values ('50000000-0000-0000-0000-000000000001', 'New Little', '30000000-0000-0000-0000-000000000002');
    update public.ace_assignment_cycles set status = 'locked' where id = '50000000-0000-0000-0000-000000000001';
  $q$) = 'ok');
select pg_temp.check_true('publish still works with the new columns',
  (pg_temp.value_as(:admin, 'authenticated', $q$
    select public.publish_ace_assignment_cycle('50000000-0000-0000-0000-000000000001')::text
  $q$)::jsonb ->> 'created') = '1');
select pg_temp.check_true('the published Little has an explicitly unknown year',
  (select pickup_academic_year_start is null and pickup_term is null
          and parent_member_id = '30000000-0000-0000-0000-000000000002'
   from public.ace_family_members where name = 'New Little'));
select pg_temp.check_true('the Big keeps their own 2021 pickup year',
  (select pickup_academic_year_start = 2021 and pickup_term is null
   from public.ace_family_members where id = '30000000-0000-0000-0000-000000000002'));

-- Clearing and corrections --------------------------------------------------
select pg_temp.check_true('admin can clear a year back to unknown',
  (pg_temp.value_as(:admin, 'authenticated', $q$
    select public.set_ace_member_pickup_year('30000000-0000-0000-0000-000000000002', null, null, null)::text
  $q$)::jsonb #>> '{previous,academic_year_start}') = '2021');
select pg_temp.check_true('the cleared node reads as unknown',
  (select pickup_academic_year_start is null and pickup_term is null
   from public.ace_family_members where id = '30000000-0000-0000-0000-000000000002'));

-- Deleting a node takes its evidence with it ------------------------------
delete from public.ace_family_members where id = '30000000-0000-0000-0000-000000000003';
select pg_temp.check_true('evidence cascades with its node',
  not exists (select 1 from public.ace_member_pickup_evidence
              where ace_member_id = '30000000-0000-0000-0000-000000000003'));
