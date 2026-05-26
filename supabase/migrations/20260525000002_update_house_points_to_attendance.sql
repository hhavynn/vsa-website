-- Update House Point calculation to be "1 point per event attended".
-- This keeps the label "House Points" but changes the math to ignore event weight.

-- 1. Redefine house_yearly_points
create or replace view public.house_yearly_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end,
  count(*)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  count(distinct mea.member_id)::int as unique_members,
  round(
    count(*)::numeric / nullif(count(distinct mea.member_id), 0),
    2
  ) as average_points_per_member,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end;

-- 2. Redefine house_all_time_points
create or replace view public.house_all_time_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end,
  count(*)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  count(distinct mea.member_id)::int as unique_members,
  round(
    count(*)::numeric / nullif(count(distinct mea.member_id), 0),
    2
  ) as average_points_per_member,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  t.academic_year_start,
  t.academic_year_end;

-- 3. Redefine house_recent_activity
create or replace view public.house_recent_activity as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  e.id as event_id,
  e.name as event_name,
  e.date as event_date,
  t.academic_year_start,
  t.academic_year_end,
  count(distinct mea.member_id)::int as total_points,
  count(distinct mea.member_id)::int as contributing_members,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  e.id,
  e.name,
  e.date,
  t.academic_year_start,
  t.academic_year_end;

-- 4. Redefine house_member_yearly_points
create or replace view public.house_member_yearly_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.college,
  m.year as graduation_year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end,
  count(*)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.members m
  on m.id = mea.member_id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id,
  m.first_name,
  m.last_name,
  m.college,
  m.year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end;

-- 5. Redefine house_member_all_time_points
create or replace view public.house_member_all_time_points as
select
  hp.house_key as house,
  hp.id as house_profile_id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.college,
  m.year as graduation_year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end,
  count(*)::int as total_points,
  count(*)::int as events_attended,
  count(distinct mea.event_id)::int as unique_events,
  max(e.date) as latest_activity_at
from public.member_event_attendance mea
join public.members m
  on m.id = mea.member_id
join public.events e
  on e.id = mea.event_id
join public.academic_terms t
  on t.id = e.academic_term_id
join public.house_memberships hm
  on hm.member_id = mea.member_id
  and hm.academic_year_start = t.academic_year_start
  and e.date::date >= hm.effective_start_date
  and (hm.effective_end_date is null or e.date::date < hm.effective_end_date)
join public.house_page_assets hp
  on hp.id = hm.house_profile_id
where e.date is not null
  and e.academic_term_id is not null
  and hp.is_active = true
group by
  hp.house_key,
  hp.id,
  hp.display_name,
  hp.image_url,
  hp.accent_color,
  m.id,
  m.first_name,
  m.last_name,
  m.college,
  m.year,
  m.user_id,
  t.academic_year_start,
  t.academic_year_end;
