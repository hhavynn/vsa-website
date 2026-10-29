-- Forward-only #652 correction: if the original 20261028075801 migration
-- was already applied, preserve its checksum. Replace only the admin-only
-- member attendance drilldown to report ALL active overlapping House credits.
-- No new grants, tables, public exposure, or scoring mutations.
--
-- Applied to production 2026-10-28 (schema_migrations version 20261029015700)
create or replace function public.admin_house_member_attendance(
  p_member_id uuid,
  p_year integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can read member attendance.' using errcode = '42501';
  end if;
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'Member attendance requires POST' using errcode = '42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Academic year is required.' using errcode = '22023';
  end if;

  with att as (
    select a.event_id, a.points_earned, e.name, e.date, e.academic_term_id, t.academic_year_start, t.label as term_label
    from public.member_event_attendance a
    join public.events e on e.id = a.event_id
    left join public.academic_terms t on t.id = e.academic_term_id
    where a.member_id = p_member_id
      and (t.academic_year_start = p_year
           or (t.id is null and (e.date)::date >= make_date(p_year, 7, 1) and (e.date)::date < make_date(p_year + 1, 7, 1)))
  ),
  -- The membership that covers each event's date, by the views' rule.
  covering as (
    select att.event_id, hm.house_profile_id, hp.display_name, hp.is_active
    from att
    join public.house_memberships hm
      on hm.member_id = p_member_id
     and hm.academic_year_start = p_year
     and (att.date)::date >= hm.effective_start_date
     and (hm.effective_end_date is null or (att.date)::date < hm.effective_end_date)
    join public.house_page_assets hp on hp.id = hm.house_profile_id
  ),
  first_start as (
    select min(hm.effective_start_date) as start_date
    from public.house_memberships hm
    where hm.member_id = p_member_id and hm.academic_year_start = p_year
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', att.event_id,
    'name', att.name,
    'date', att.date,
    'term_label', att.term_label,
    'points_earned', att.points_earned,
    'house_profile_id', case when status.reason = 'counted' then cv.house_profile_id end,
    'house_name', case when status.reason in ('counted', 'overlapping_houses') then cv.display_name end,
    'reason', status.reason
  ) order by att.date, att.event_id), '[]'::jsonb)
  into v_rows
  from att
  left join lateral (
    -- Do not silently pick one House when effective memberships overlap.
    -- Canonical House views credit every active effective membership.
    select count(*)::integer as any_count,
           count(*) filter (where c.is_active)::integer as active_count,
           (array_agg(c.house_profile_id order by c.house_profile_id)
             filter (where c.is_active))[1] as house_profile_id,
           string_agg(c.display_name, ', ' order by c.display_name)
             filter (where c.is_active) as display_name
    from covering c where c.event_id = att.event_id
  ) cv on true
  cross join first_start fs
  cross join lateral (select case
    when att.date is null then 'no_date'
    when att.academic_term_id is null then 'no_term'
    when att.points_earned <= 0 then 'no_points'
    when att.academic_year_start = 2025 and (att.date)::date < date '2025-11-08' then 'before_ledger'
    when cv.any_count = 0 and fs.start_date is not null and (att.date)::date < fs.start_date then 'before_house_start'
    when cv.any_count = 0 then 'no_house'
    when cv.active_count = 0 then 'house_not_public'
    when cv.active_count > 1 then 'overlapping_houses'
    else 'counted' end as reason) status;

  return jsonb_build_object('member_id', p_member_id, 'academic_year_start', p_year, 'events', v_rows, 'checked_at', now());
end;
$$;

revoke execute on function public.admin_house_member_attendance(uuid, integer) from public, anon;
grant execute on function public.admin_house_member_attendance(uuid, integer) to authenticated;
comment on function public.admin_house_member_attendance(uuid, integer) is
  'Admin-only member attendance: list all overlapping active House credits rather than silently selecting one (#652).';
