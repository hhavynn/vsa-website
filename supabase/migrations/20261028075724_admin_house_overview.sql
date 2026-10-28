-- CRC House overview (#651). Admin-only, read-only.
--
-- WHY
--   CRC needs one screen answering "which Houses have started participating,
--   who is struggling, and is an import still pending?" without combining
--   assignments, sign-in sheets and the leaderboard by hand. Live House
--   standings are private (#692), so this is an admin-only read.
--
-- WHAT
--   public.admin_house_overview(p_year, p_term_id) returns, per House profile
--   of the academic year (active or not):
--     - roster: members with a House membership overlapping the window (the
--       term's dates, or the whole year), plus anyone credited for the House
--       on the window's events, and how many joined after the window began.
--       A term without dates cannot bound memberships or House events: they
--       then cover the whole year, and the result says so ('dated': false);
--     - participation: roster members with at least one House-credited
--       attendance in the window, and how many credits. Credits use exactly
--       the attribution of house_yearly_points (active profile, effective
--       membership interval by the event's date, positive points, the 2025-26
--       cutoff), filtered to the term's events when a term is chosen, so
--       attendance before a member's start date never counts for the House;
--     - standing: the year's total, unique members and latest activity read
--       from house_yearly_points itself, the rank among the year's Houses (ties
--       share a rank), and whether the window credits equal the view total
--       (whole-year window only);
--     - House Parents linked / listed, published House events hosted in the
--       window (a collab counts for each host; the global distinct count is
--       returned separately), and overlapping memberships.
--   Counts and House names only: no member names, emails or rows.
--
-- SECURITY
--   SECURITY DEFINER because the House score views are private to the API
--   since #692; it checks is_admin_user itself, pins search_path and returns
--   aggregates only. EXECUTE is revoked from PUBLIC and anon.
--
-- DEPLOY
--   Additive, one function. Apply before the Overview tab; until then the tab
--   says the overview is not available. Verify: bash scripts/test-house-overview.sh

create or replace function public.admin_house_overview(
  p_year integer,
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
  v_term public.academic_terms%rowtype;
  v_from date;
  v_to date;
  v_houses jsonb;
  v_distinct_events integer;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can read the House overview.' using errcode = '42501';
  end if;
  -- Same rule as admin_private_house_standings: private House standings are
  -- never served to a cacheable GET.
  if coalesce(current_setting('request.method', true), '') not in ('', 'POST') then
    raise exception 'The House overview requires POST' using errcode = '42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Academic year is required.' using errcode = '22023';
  end if;
  if p_term_id is not null then
    select * into v_term from public.academic_terms t where t.id = p_term_id;
    if not found or v_term.academic_year_start <> p_year then
      raise exception 'That term is not part of this academic year.' using errcode = '22023';
    end if;
    v_from := v_term.starts_on;
    v_to := v_term.ends_on;
  end if;

  with profiles as (
    select hp.id, hp.house_key, hp.display_name, hp.accent_color, hp.is_active, hp.display_order
    from public.house_page_assets hp
    where hp.academic_year_start = p_year
  ),
  dated_roster as (
    select hm.house_profile_id, hm.member_id, hm.effective_start_date
    from public.house_memberships hm
    where hm.academic_year_start = p_year
      and (v_to is null or hm.effective_start_date <= v_to)
      and (v_from is null or hm.effective_end_date is null or hm.effective_end_date > v_from)
  ),
  -- Same attribution as house_yearly_points, limited to the window's events.
  credited as (
    select hp.id as house_profile_id, a.member_id, e.date as event_at, a.points_earned
    from public.member_event_attendance a
    join public.events e on e.id = a.event_id
    join public.academic_terms t on t.id = e.academic_term_id
    join public.house_memberships hm
      on hm.member_id = a.member_id
     and hm.academic_year_start = t.academic_year_start
     and (e.date)::date >= hm.effective_start_date
     and (hm.effective_end_date is null or (e.date)::date < hm.effective_end_date)
    join public.house_page_assets hp on hp.id = hm.house_profile_id
    where t.academic_year_start = p_year
      and (p_term_id is null or e.academic_term_id = p_term_id)
      and e.date is not null
      and hp.is_active = true
      and a.points_earned > 0
      and (t.academic_year_start <> 2025 or (e.date)::date >= date '2025-11-08')
  ),
  -- Anyone credited for a House on the window's events is on its roster, so
  -- participation can never exceed 100% (e.g. an event dated after its term).
  roster as (
    select house_profile_id, member_id, effective_start_date from dated_roster
    union
    select c.house_profile_id, c.member_id, null::date from credited c
  ),
  standings as (
    select v.house_profile_id, v.total_points, v.unique_members, v.latest_activity_at,
           rank() over (order by v.total_points desc) as rank
    from public.house_yearly_points v
    where v.academic_year_start = p_year
  ),
  hosted as (
    select hh.house_page_asset_id as house_profile_id, he.id as event_id
    from public.house_events he
    join public.house_event_houses hh on hh.house_event_id = he.id
    where he.academic_year_start = p_year
      and he.is_published = true
      and (v_from is null or he.event_date >= v_from)
      and (v_to is null or he.event_date <= v_to)
  ),
  overlapping as (
    select a.house_profile_id, count(distinct a.member_id)::integer as members
    from public.house_memberships a
    join public.house_memberships b
      on b.member_id = a.member_id
     and b.academic_year_start = a.academic_year_start
     and b.id <> a.id
     and a.effective_start_date < coalesce(b.effective_end_date, 'infinity'::date)
     and b.effective_start_date < coalesce(a.effective_end_date, 'infinity'::date)
    where a.academic_year_start = p_year
    group by a.house_profile_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'house_profile_id', p.id,
    'house_key', p.house_key,
    'display_name', p.display_name,
    'accent_color', p.accent_color,
    'is_active', p.is_active,
    'roster_members', (select count(distinct r.member_id) from roster r where r.house_profile_id = p.id),
    'joined_in_window', case when v_from is null then null else
      (select count(distinct r.member_id) from dated_roster r where r.house_profile_id = p.id and r.effective_start_date > v_from) end,
    'participating_members', (select count(distinct c.member_id) from credited c join roster r on r.member_id = c.member_id and r.house_profile_id = c.house_profile_id where c.house_profile_id = p.id),
    'credited_attendance', (select count(*) from credited c where c.house_profile_id = p.id),
    'window_latest_activity_at', (select max(c.event_at) from credited c where c.house_profile_id = p.id),
    'year_total_points', s.total_points,
    'year_unique_members', s.unique_members,
    'year_latest_activity_at', s.latest_activity_at,
    'rank', s.rank,
    'matches_view', case when p_term_id is not null then null
      else coalesce(s.total_points, 0) = coalesce((select sum(c.points_earned) from credited c where c.house_profile_id = p.id), 0) end,
    'parents_listed', (select count(*) from public.house_parents hp2 where hp2.house_profile_id = p.id),
    'parents_linked', (select count(*) from public.house_parents hp2 where hp2.house_profile_id = p.id and hp2.member_id is not null),
    'hosted_events', (select count(distinct h.event_id) from hosted h where h.house_profile_id = p.id),
    'overlapping_members', coalesce(o.members, 0)
  ) order by p.display_order, p.display_name), '[]'::jsonb)
  into v_houses
  from profiles p
  left join standings s on s.house_profile_id = p.id
  left join overlapping o on o.house_profile_id = p.id;

  select count(distinct he.id)::integer into v_distinct_events
  from public.house_events he
  where he.academic_year_start = p_year
    and he.is_published = true
    and (v_from is null or he.event_date >= v_from)
    and (v_to is null or he.event_date <= v_to);

  return jsonb_build_object(
    'houses', v_houses,
    'window', jsonb_build_object('term_id', p_term_id, 'term_label', v_term.label, 'starts_on', v_from, 'ends_on', v_to,
                                 'dated', p_term_id is null or (v_from is not null and v_to is not null)),
    'distinct_house_events', v_distinct_events,
    'checked_at', now()
  );
end;
$$;

revoke execute on function public.admin_house_overview(integer, uuid) from public, anon;
grant execute on function public.admin_house_overview(integer, uuid) to authenticated;

comment on function public.admin_house_overview(integer, uuid) is
  'Admin-only per-House roster, participation and private standing for one academic year or term (#651). Aggregates only, read-only.';
