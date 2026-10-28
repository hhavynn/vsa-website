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

-- #622/#692: Upgrade admin_house_points_reconciliation to SECURITY DEFINER.
-- Because SELECT on house_yearly_points and house_member_yearly_points is revoked above,
-- running this admin check under SECURITY INVOKER would fail with 42501 permission denied.
-- Admin authorization is strictly enforced inside the function body.
create or replace function public.admin_house_points_reconciliation(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_summary jsonb;
  v_houses jsonb;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can run the House points check.' using errcode = '42501';
  end if;

  select to_jsonb(s) into v_summary from (
with params as (select p_year as year),
credits as (
  select a.id as credit_id, a.member_id, a.event_id, a.points_earned,
         e.date as event_at, e.academic_term_id, t.academic_year_start
  from public.member_event_attendance a
  join public.events e on e.id = a.event_id
  left join public.academic_terms t on t.id = e.academic_term_id
),
year_credits as (
  select c.* from credits c, params p
  where c.academic_year_start = p.year and c.points_earned > 0 and c.event_at is not null
),
memberships as (
  select hm.* from public.house_memberships hm, params p where hm.academic_year_start = p.year
),
attributed as (
  select yc.credit_id, yc.member_id, hm.house_profile_id, hp.is_active
  from year_credits yc
  join memberships hm on hm.member_id = yc.member_id
   and yc.event_at::date >= hm.effective_start_date
   and (hm.effective_end_date is null or yc.event_at::date < hm.effective_end_date)
  join public.house_page_assets hp on hp.id = hm.house_profile_id
  where yc.academic_year_start <> 2025 or yc.event_at::date >= date '2025-11-08'
),
view_members as (
  select house_profile_id, sum(total_points) as points
  from public.house_member_yearly_points, params p
  where academic_year_start = p.year group by house_profile_id
),
view_houses as (
  select house_profile_id, total_points as points
  from public.house_yearly_points, params p
  where academic_year_start = p.year
)
select   (select year from params) as academic_year_start,
  (select count(*) from year_credits) as year_credits,
  (select count(distinct credit_id) from attributed where is_active) as credits_earning_house_points,
  (select count(*) from year_credits yc where not exists (select 1 from memberships hm where hm.member_id = yc.member_id))
    as credits_member_has_no_house_this_year,
  (select count(*) from year_credits yc where exists (select 1 from memberships hm where hm.member_id = yc.member_id)
     and not exists (select 1 from attributed at where at.credit_id = yc.credit_id))
    as credits_outside_membership_interval,
  (select count(*) from year_credits yc where exists (
     select 1 from memberships hm where hm.member_id = yc.member_id and yc.event_at::date < hm.effective_start_date)
     and not exists (select 1 from attributed at where at.credit_id = yc.credit_id))
    as credits_before_house_start,
  (select count(*) from credits c, params p where c.academic_term_id is null and c.event_at is not null
     and extract(year from c.event_at at time zone 'America/Los_Angeles') between p.year and p.year + 1)
    as credits_event_without_term_near_year,
  (select count(distinct credit_id) from attributed where not is_active) as credits_on_inactive_house_profile,
  (select count(*) from (select credit_id from attributed group by credit_id having count(*) > 1) d)
    as credits_attributed_to_two_houses,
  (select count(*) from memberships a join memberships b on a.member_id = b.member_id and a.id < b.id
     and a.effective_start_date < coalesce(b.effective_end_date, 'infinity'::date)
     and b.effective_start_date < coalesce(a.effective_end_date, 'infinity'::date))
    as overlapping_memberships,
  (select count(*) from (select member_id from memberships group by member_id having count(*) > 1) t)
    as members_transferred_this_year,
  (select count(*) from memberships hm where hm.effective_start_date > current_date) as future_dated_memberships,
  (select count(*) from year_credits yc join memberships hm on hm.member_id = yc.member_id
     where (yc.event_at::date >= hm.effective_start_date) <> ((yc.event_at at time zone 'America/Los_Angeles')::date >= hm.effective_start_date)
        or (hm.effective_end_date is not null and
            (yc.event_at::date < hm.effective_end_date) <> ((yc.event_at at time zone 'America/Los_Angeles')::date < hm.effective_end_date)))
    as pacific_vs_utc_boundary_credits,
  (select count(*) from view_houses vh full join view_members vm using (house_profile_id)
     where coalesce(vh.points, 0) <> coalesce(vm.points, 0))
    as house_member_vs_house_total_mismatch,
  (select count(*) from (
     select at.house_profile_id, count(*) as recomputed from attributed at where at.is_active group by at.house_profile_id
   ) r full join view_houses vh using (house_profile_id)
   where coalesce(r.recomputed, 0) <> coalesce(vh.points, 0))
    as recomputed_vs_view_mismatch
  ) s;

  select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) into v_houses from (
with params as (select p_year as year)
select hp.id as house_profile_id, hp.display_name, hy.total_points as view_house_points,
  (select coalesce(sum(total_points), 0) from public.house_member_yearly_points m
    where m.house_profile_id = hp.id and m.academic_year_start = p.year) as view_member_points_sum,
  (select count(*) from public.house_memberships hm where hm.house_profile_id = hp.id and hm.academic_year_start = p.year) as membership_rows
from public.house_page_assets hp
cross join params p
left join public.house_yearly_points hy on hy.house_profile_id = hp.id and hy.academic_year_start = p.year
where hp.academic_year_start = p.year

  ) h;

  return jsonb_build_object('summary', v_summary, 'houses', v_houses, 'checked_at', now());
end;
$$;

revoke all on function public.admin_house_points_reconciliation(integer) from public, anon, authenticated;
grant execute on function public.admin_house_points_reconciliation(integer) to authenticated;

comment on function public.admin_house_points_reconciliation(integer) is
  'Admin-only House points reconciliation check with UTC pinned session and SECURITY DEFINER.';

-- Narrow, read-only per-member badge; no House points, ranking, roster, or
-- full member list in the response. Existing published membership can be shown
-- only after the year's Reveal. Legacy published pre-batch years remain eligible.
create or replace function public.public_member_house_badge(
  p_member_id uuid,
  p_year integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_member_id is null or (p_year is not null and (p_year < 2000 or p_year > 2100)) then
    return null;
  end if;
  select jsonb_build_object(
    'house', hp.house_key,
    'house_profile_id', hp.id,
    'display_name', hp.display_name,
    'accent_color', hp.accent_color,
    'academic_year_start', hm.academic_year_start,
    'latest_activity_at', null
  ) into v_result
  from public.house_memberships hm
  join public.house_page_assets hp on hp.id = hm.house_profile_id
  where hm.member_id = p_member_id
    and (p_year is null or hm.academic_year_start = p_year)
    and hp.is_active = true
    and (
      hm.academic_year_start < 2026
      or exists (
        select 1 from public.house_assignment_batches hb
        where hb.academic_year_start = hm.academic_year_start
          and hb.status = 'published'
      )
    )
    and hm.effective_start_date <= current_date
    and (
      hm.effective_end_date is null or hm.effective_end_date > current_date
      -- Historical badges represent a published assignment, even if it later
      -- ended. Current-year badges must use the active effective interval.
      or hm.academic_year_start < extract(year from current_date)::integer - 1
    )
  order by hm.academic_year_start desc, hm.effective_start_date desc, hm.id
  limit 1;
  return v_result;
end;
$$;

revoke all on function public.public_member_house_badge(uuid, integer) from public, anon, authenticated;
grant execute on function public.public_member_house_badge(uuid, integer) to anon, authenticated;

comment on function public.public_member_house_badge(uuid, integer) is
  'Single published House identity badge (no points), only after the relevant House Reveal.';

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
  if has_function_privilege('anon', 'public.admin_house_points_reconciliation(integer)', 'EXECUTE') then
    raise exception '#692: anon can call admin_house_points_reconciliation';
  end if;
end;
$$;
