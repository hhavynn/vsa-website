-- #623: bounded, six-column, public-safe Cabinet/Intern role projection.
-- Owner-reviewed deployment required BEFORE the frontend RPC cutover.
-- Future House/ACE/VCN arms must replace this whole function with forward migrations.
create or replace function public.public_member_roles(p_year integer, p_member_ids uuid[])
returns table (
  member_id uuid, kind text, label text, academic_year_start integer,
  source_type text, related_key text
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_active_year integer;
  v_year_rows integer;
  v_cabinet_year_id uuid;
begin
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Academic year is required' using errcode = '22023';
  end if;
  if p_member_ids is null or cardinality(p_member_ids) = 0 then return; end if;
  if cardinality(p_member_ids) > 200 then
    raise exception 'Role lookup accepts at most 200 members' using errcode = '22023';
  end if;
  select max(t.academic_year_start) into v_active_year
  from public.academic_terms t where t.is_active;
  -- Missing active-term proof is not permission to disclose preloaded roles.
  if v_active_year is null or p_year > v_active_year then return; end if;

  select count(*), min(cy.id::text)::uuid into v_year_rows, v_cabinet_year_id
    from public.cabinet_years cy where cy.start_year = p_year;
  if v_year_rows > 1 then
    raise exception 'Ambiguous Cabinet year' using errcode = '22023';
  end if;
  if v_year_rows = 0 then return; end if;

  return query
    select distinct on (r.member_id, r.kind, lower(r.label))
      r.member_id, r.kind, r.label, p_year, r.source_type, r.related_key
    from (
      select cm.member_id, 'board'::text as kind, 'Board Member'::text as label,
        'cabinet_members'::text as source_type, null::text as related_key
      from public.cabinet_members cm
      where cm.cabinet_year_id = v_cabinet_year_id
        and cm.category in ('Executive Board', 'General Board')
      union all
      select cm.member_id, 'cabinet_position'::text, btrim(cm.role),
        'cabinet_members'::text, null::text
      from public.cabinet_members cm
      where cm.cabinet_year_id = v_cabinet_year_id
        and cm.category in ('Executive Board', 'General Board')
        and cm.role is not null and btrim(cm.role) <> ''
        and lower(btrim(cm.role)) <> 'board member'
      union all
      select cm.member_id, 'intern'::text, 'Intern'::text,
        'cabinet_members'::text, null::text
      from public.cabinet_members cm
      where cm.cabinet_year_id = v_cabinet_year_id
        and cm.category = 'Interns'
    ) r
    where r.member_id is not null and r.member_id = any(p_member_ids)
    order by r.member_id, r.kind, lower(r.label), r.label;
end;
$$;

comment on function public.public_member_roles(integer, uuid[]) is
  'Six public-safe columns, by approved academic year and up to 200 canonical member IDs; only published Cabinet/Intern roles. No names, notes, private drafts or House affiliations.';

revoke all on function public.public_member_roles(integer, uuid[]) from public, anon, authenticated;
grant execute on function public.public_member_roles(integer, uuid[]) to anon, authenticated;

do $$
begin
  if not has_function_privilege('anon', 'public.public_member_roles(integer,uuid[])', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.public_member_roles(integer,uuid[])', 'EXECUTE')
     or exists (
       select 1 from pg_proc p,
         lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
       where p.oid = 'public.public_member_roles(integer,uuid[])'::regprocedure
         and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
     ) then
    raise exception 'Public role RPC must be callable by anon/authenticated, but not inherited from PUBLIC';
  end if;
end
$$;
