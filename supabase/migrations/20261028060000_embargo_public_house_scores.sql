-- #692: Private live House competition data. Forward-only, no scoring changes.
-- Deploy after compatible public UI; verify in staging first.
-- The five views were previously SELECT-granted to anon/authenticated.
-- REVOKE removes the PostgREST/API permission even for a guessed URL.
-- Revoke PUBLIC as well because grants inherited from PUBLIC defeat role revokes.

revoke all on public.house_yearly_points from public, anon, authenticated;
revoke all on public.house_all_time_points from public, anon, authenticated;
revoke all on public.house_recent_activity from public, anon, authenticated;
revoke all on public.house_member_yearly_points from public, anon, authenticated;
revoke all on public.house_member_all_time_points from public, anon, authenticated;

-- Admin-only read: read the authoritative view, never recalculate scores.
-- Do NOT grant the underlying view to authenticated, including House Parents.
-- This RPC is SECURITY DEFINER because revoking the views is intentional.
-- Use a pinned search_path and a checked approved admin identity.
-- An authenticated role alone is never sufficient authorization.
create or replace function public.admin_private_house_standings(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only approved admins can read private House standings'
      using errcode = '42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Academic year is required' using errcode = '22023';
  end if;
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'Private standings require POST' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.total_points desc, s.display_name), '[]'::jsonb)
    into v_result
    from public.house_yearly_points s
    where s.academic_year_start = p_year;
  return v_result;
end;
$$;

revoke all on function public.admin_private_house_standings(integer) from public, anon, authenticated;
grant execute on function public.admin_private_house_standings(integer) to authenticated;

comment on function public.admin_private_house_standings(integer) is
  'Private authoritative House standings for approved admins only. No public snapshots or live standings.';

-- Assert migration postconditions at the SQL privilege layer.
do $$
declare
  v_view text;
  v_role text;
begin
  foreach v_view in array array[
    'house_yearly_points', 'house_all_time_points', 'house_recent_activity',
    'house_member_yearly_points', 'house_member_all_time_points'
  ] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role, 'public.' || v_view, 'SELECT') then
        raise exception '#692: % retains SELECT on %', v_role, v_view;
      end if;
    end loop;
  end loop;
  if has_function_privilege('anon', 'public.admin_private_house_standings(integer)', 'EXECUTE') then
    raise exception '#692: anon can call private House standings';
  end if;
end;
$$;
