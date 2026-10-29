-- Forward-only admin-only roster refinement (#652). The original
-- 20261028075801 migration can already be applied; never change its checksum.
-- Preserve distinct credited attendance (event records) separately from
-- credited_points (SUM(points_earned), matching house_yearly_points).
-- This function remains SECURITY DEFINER, POST-only, and admin-authorized.
--
-- Applied to production 2026-10-28 (schema_migrations version 20261029015725)
create or replace function public.admin_house_roster(
  p_house_profile_id uuid,
  p_term_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_house public.house_page_assets%rowtype;
  v_term public.academic_terms%rowtype;
  v_from date;
  v_to date;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can read House rosters.' using errcode = '42501';
  end if;
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'House rosters require POST' using errcode = '42501';
  end if;
  select * into v_house from public.house_page_assets hp where hp.id = p_house_profile_id;
  if not found then
    raise exception 'House profile not found.' using errcode = 'P0002';
  end if;
  if p_term_id is not null then
    select * into v_term from public.academic_terms t where t.id = p_term_id;
    if not found or v_term.academic_year_start <> v_house.academic_year_start then
      raise exception 'That term is not part of this House''s academic year.' using errcode = '22023';
    end if;
    v_from := v_term.starts_on;
    v_to := v_term.ends_on;
  end if;

  with dated as (
    select hm.member_id
    from public.house_memberships hm
    where hm.house_profile_id = v_house.id
      and hm.academic_year_start = v_house.academic_year_start
      and (v_to is null or hm.effective_start_date <= v_to)
      and (v_from is null or hm.effective_end_date is null or hm.effective_end_date > v_from)
  ),
  -- Same attribution as house_yearly_points, for this House and period.
  credited as (
    select a.member_id, count(*)::integer as credited, sum(a.points_earned)::integer as credited_points, max(e.date) as last_credited_at
    from public.member_event_attendance a
    join public.events e on e.id = a.event_id
    join public.academic_terms t on t.id = e.academic_term_id
    join public.house_memberships hm
      on hm.member_id = a.member_id
     and hm.academic_year_start = t.academic_year_start
     and (e.date)::date >= hm.effective_start_date
     and (hm.effective_end_date is null or (e.date)::date < hm.effective_end_date)
    join public.house_page_assets hp on hp.id = hm.house_profile_id
    where hp.id = v_house.id
      and (p_term_id is null or e.academic_term_id = p_term_id)
      and e.date is not null
      and hp.is_active = true
      and a.points_earned > 0
      and (t.academic_year_start <> 2025 or (e.date)::date >= date '2025-11-08')
    group by a.member_id
  ),
  -- Anyone credited for the House in the period is on its roster, even if an
  -- event is dated outside its term, so the counts always reconcile.
  -- Dates come from the memberships in this House that overlap the period
  -- (all of the year's when none does), so a gap is not hidden and "joined"
  -- matches the overview.
  memberships as (
    select hm.member_id, hm.effective_start_date, hm.effective_end_date,
           (v_to is null or hm.effective_start_date <= v_to)
             and (v_from is null or hm.effective_end_date is null or hm.effective_end_date > v_from) as in_period
    from public.house_memberships hm
    where hm.house_profile_id = v_house.id
      and hm.academic_year_start = v_house.academic_year_start
      and hm.member_id in (select member_id from dated union select member_id from credited)
  ),
  roster as (
    select m.member_id,
           min(m.effective_start_date) filter (where m.in_period or not x.any_in_period) as start_date,
           case when bool_or(m.effective_end_date is null) filter (where m.in_period or not x.any_in_period) then null
                else max(m.effective_end_date) filter (where m.in_period or not x.any_in_period) end as end_date,
           count(*)::integer as stints
    from memberships m
    join (select member_id, bool_or(in_period) as any_in_period from memberships group by member_id) x on x.member_id = m.member_id
    group by m.member_id
  ),
  -- The same events the drilldown lists: the period's termed events, plus,
  -- for the whole year, dated events with no term in the July-to-July year.
  period_events as (
    select e.id, e.date
    from public.events e
    left join public.academic_terms t on t.id = e.academic_term_id
    where (t.academic_year_start = v_house.academic_year_start and (p_term_id is null or e.academic_term_id = p_term_id))
       or (p_term_id is null and t.id is null and e.date is not null
           and (e.date)::date >= make_date(v_house.academic_year_start, 7, 1)
           and (e.date)::date < make_date(v_house.academic_year_start + 1, 7, 1))
  ),
  attended as (
    select a.member_id, count(*)::integer as events_attended
    from public.member_event_attendance a
    join period_events pe on pe.id = a.event_id
    where a.member_id in (select member_id from roster)
    group by a.member_id
  ),
  other_houses as (
    select hm.member_id, count(distinct hm.house_profile_id)::integer as other_house_count
    from public.house_memberships hm
    where hm.academic_year_start = v_house.academic_year_start
      and hm.house_profile_id <> v_house.id
      and hm.member_id in (select member_id from roster)
    group by hm.member_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', r.member_id,
    'first_name', m.first_name,
    'last_name', m.last_name,
    'start_date', r.start_date,
    'end_date', r.end_date,
    'stints', r.stints,
    'joined_in_period', v_from is not null and r.start_date > v_from,
    'other_house_memberships', coalesce(o.other_house_count, 0),
    'credited_attendance', coalesce(c.credited, 0),
    'credited_points', coalesce(c.credited_points, 0),
    'last_credited_at', c.last_credited_at,
    'events_attended', coalesce(ad.events_attended, 0)
  ) order by lower(m.last_name), lower(m.first_name), r.member_id), '[]'::jsonb)
  into v_rows
  from roster r
  join public.members m on m.id = r.member_id
  left join credited c on c.member_id = r.member_id
  left join attended ad on ad.member_id = r.member_id
  left join other_houses o on o.member_id = r.member_id;

  return jsonb_build_object(
    'house', jsonb_build_object('id', v_house.id, 'display_name', v_house.display_name, 'is_active', v_house.is_active,
                                'academic_year_start', v_house.academic_year_start),
    'window', jsonb_build_object('term_id', p_term_id, 'term_label', v_term.label, 'starts_on', v_from, 'ends_on', v_to,
                                 'dated', p_term_id is null or (v_from is not null and v_to is not null)),
    'members', v_rows,
    'checked_at', now()
  );
end;
$$;


revoke execute on function public.admin_house_roster(uuid, uuid) from public, anon;
grant execute on function public.admin_house_roster(uuid, uuid) to authenticated;
comment on function public.admin_house_roster(uuid, uuid) is
  'Admin-only roster: distinct event attendance and weighted House credits kept separate (#652).';
