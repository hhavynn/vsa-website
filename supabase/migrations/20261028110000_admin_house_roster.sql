-- Per-House member roster and attendance drilldown for CRC (#652).
-- Admin-only, read-only.
--
-- WHY
--   House Parents and CRC need to see which assigned members actually come,
--   who joined late, and who might welcome an invitation, without reading
--   points as a judgment of commitment, and without a second points model.
--
-- WHAT
--   public.admin_house_roster(p_house_profile_id, p_term_id) returns one row
--   per canonical member (members.id) with a membership in that House that
--   overlaps the period (the term's dates, or the whole year):
--     - plus anyone credited for the House on the period's events; a term
--       without dates cannot bound memberships, so its roster is the whole
--       year and the result says so ('dated': false);
--     - first name and last name only (no email, phone or notes);
--     - membership start/end in this House, and whether the member has another
--       House membership the same year (transfer or overlap);
--     - House-credited attendance in the period: exactly the attribution of
--       house_yearly_points (active profile, effective membership interval by
--       the event's date, positive points, the 2025-26 cutoff), so nothing
--       before the member's start date ever counts;
--     - all VSA events attended in the period, separately (any attendance on
--       the year's or term's events, whatever the House);
--     - the latest House-credited attendance date.
--   It returns one jsonb array (no PostgREST row cap), plus the House and
--   period it describes.
--
--   public.admin_house_member_attendance(p_member_id, p_year) lists every
--   event the member attended that year, and for each one whether it counted
--   for a House, which House, or why not (before the House start, no points,
--   no term, profile not public, outside any membership, the 2025-26 cutoff).
--
-- SECURITY
--   SECURITY DEFINER: members and the House score data are admin-only to the
--   API (#692, GBM launch); both functions check is_admin_user, pin
--   search_path, refuse non-POST requests, and return names and counts only.
--   EXECUTE is revoked from PUBLIC and anon.
--
-- DEPLOY
--   Additive. Apply before the roster view; until then it says the roster is
--   not available. Verify: bash scripts/test-house-roster.sh

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
    select a.member_id, count(*)::integer as credited, max(e.date) as last_credited_at
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
  roster as (
    select hm.member_id,
           min(hm.effective_start_date) as start_date,
           case when bool_or(hm.effective_end_date is null) then null else max(hm.effective_end_date) end as end_date
    from public.house_memberships hm
    where hm.house_profile_id = v_house.id
      and hm.academic_year_start = v_house.academic_year_start
      and hm.member_id in (select member_id from dated union select member_id from credited)
    group by hm.member_id
  ),
  period_events as (
    select e.id, e.date
    from public.events e
    join public.academic_terms t on t.id = e.academic_term_id
    where t.academic_year_start = v_house.academic_year_start
      and (p_term_id is null or e.academic_term_id = p_term_id)
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
    'joined_in_period', v_from is not null and r.start_date > v_from,
    'other_house_memberships', coalesce(o.other_house_count, 0),
    'credited_attendance', coalesce(c.credited, 0),
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
    'house_name', case when status.reason = 'counted' then cv.display_name end,
    'reason', status.reason
  ) order by att.date, att.event_id), '[]'::jsonb)
  into v_rows
  from att
  left join lateral (
    select * from covering c where c.event_id = att.event_id
    order by c.is_active desc, c.house_profile_id limit 1
  ) cv on true
  cross join first_start fs
  cross join lateral (select case
    when att.date is null then 'no_date'
    when att.academic_term_id is null then 'no_term'
    when att.points_earned <= 0 then 'no_points'
    when att.academic_year_start = 2025 and (att.date)::date < date '2025-11-08' then 'before_ledger'
    when cv.house_profile_id is null and fs.start_date is not null and (att.date)::date < fs.start_date then 'before_house_start'
    when cv.house_profile_id is null then 'no_house'
    when not cv.is_active then 'house_not_public'
    else 'counted' end as reason) status;

  return jsonb_build_object('member_id', p_member_id, 'academic_year_start', p_year, 'events', v_rows, 'checked_at', now());
end;
$$;

revoke execute on function public.admin_house_roster(uuid, uuid) from public, anon;
grant execute on function public.admin_house_roster(uuid, uuid) to authenticated;
revoke execute on function public.admin_house_member_attendance(uuid, integer) from public, anon;
grant execute on function public.admin_house_member_attendance(uuid, integer) to authenticated;

comment on function public.admin_house_roster(uuid, uuid) is
  'Admin-only private roster for one House and period: names, membership dates, House-credited and all VSA attendance counts (#652). Read-only.';
comment on function public.admin_house_member_attendance(uuid, integer) is
  'Admin-only per-event list for one member and year: whether each attendance counted for a House and why not (#652). Read-only.';
