-- #804: admin-only canonical member email resolution, including confirmed aliases.
-- Email inputs travel in a POST RPC body, never in GET PostgREST filters.
-- Owner must deploy this migration manually BEFORE client cutover.
-- Read-only. No member, alias, role, points or attendance writes.
create or replace function public.admin_match_members_by_email(p_emails text[])
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_emails text[];
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can match members by email' using errcode = '42501';
  end if;
  -- RPCs are normally POST, but PostgREST can also invoke immutable/stable
  -- functions via GET. Explicitly refuse a method that leaks arguments in URLs.
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'Email lookups must use POST' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_emails, '{}'::text[])) > 1000 then
    raise exception 'At most 1000 email addresses per lookup' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct normalized order by normalized), '{}'::text[])
    into v_emails
  from (
    select lower(btrim(input)) as normalized
    from unnest(coalesce(p_emails, '{}'::text[])) as input
  ) norm
  where normalized <> '';
  if cardinality(v_emails) = 0 then return '[]'::jsonb; end if;

  -- The same confirmed alias may also equal members.email. UNION removes
  -- that duplicate, but two distinct members sharing a primary email remain
  -- two explicit candidates (the admin must resolve the ambiguity).
  with matched as (
    select lower(btrim(m.email)) as input_email, m.id, m.first_name,
      m.last_name, m.college, m.year
    from public.members m
    where lower(btrim(m.email)) = any(v_emails)
    union
    select a.email as input_email, m.id, m.first_name,
      m.last_name, m.college, m.year
    from public.member_identity_emails a
    join public.members m on m.id = a.member_id
    where a.email = any(v_emails)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'input_email', matched.input_email,
    'id', matched.id,
    'first_name', matched.first_name,
    'last_name', matched.last_name,
    'college', matched.college,
    'year', matched.year
  ) order by matched.input_email, matched.id), '[]'::jsonb)
  into v_result
  from matched;

  return v_result;
end;
$$;

comment on function public.admin_match_members_by_email(text[]) is
  'Admin-only POST email matching against primary and confirmed aliases; input email plus canonical member option only. No GET, no score/attendance/private note fields.';

revoke all on function public.admin_match_members_by_email(text[]) from public, anon, authenticated;
grant execute on function public.admin_match_members_by_email(text[]) to authenticated;
